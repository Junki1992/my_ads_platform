import requests
import json
import logging
from datetime import datetime, time
from typing import Dict, Any, Optional, List
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from .models import AlertRule, AlertNotification, AlertSettings

logger = logging.getLogger(__name__)


class NotificationService:
    """通知サービスのベースクラス"""
    
    def __init__(self, alert_rule: AlertRule, campaign=None):
        self.alert_rule = alert_rule
        self.campaign = campaign
        self.alert_settings = self._get_alert_settings()
    
    def _get_alert_settings(self) -> Optional[AlertSettings]:
        """ユーザーのアラート設定を取得"""
        try:
            return AlertSettings.objects.get(user=self.alert_rule.user)
        except AlertSettings.DoesNotExist:
            return None
    
    def _is_quiet_hours(self) -> bool:
        """現在が通知停止時間かどうかを判定"""
        if not self.alert_settings or not self.alert_settings.quiet_hours_start:
            return False
        
        now = timezone.now().time()
        start = self.alert_settings.quiet_hours_start
        end = self.alert_settings.quiet_hours_end
        
        if start <= end:
            # 同じ日の中での時間範囲
            return start <= now <= end
        else:
            # 日を跨ぐ時間範囲（例：22:00-06:00）
            return now >= start or now <= end
    
    def _check_notification_limits(self) -> bool:
        """通知制限をチェック"""
        if not self.alert_settings:
            return True
        
        # 時間あたりの制限チェック
        hour_ago = timezone.now() - timezone.timedelta(hours=1)
        hourly_count = AlertNotification.objects.filter(
            alert_rule__user=self.alert_rule.user,
            created_at__gte=hour_ago
        ).count()
        
        if hourly_count >= self.alert_settings.max_notifications_per_hour:
            logger.warning(f"Hourly notification limit reached for user {self.alert_rule.user.id}")
            return False
        
        # 日あたりの制限チェック
        today = timezone.now().date()
        daily_count = AlertNotification.objects.filter(
            alert_rule__user=self.alert_rule.user,
            created_at__date=today
        ).count()
        
        if daily_count >= self.alert_settings.max_notifications_per_day:
            logger.warning(f"Daily notification limit reached for user {self.alert_rule.user.id}")
            return False
        
        return True
    
    def _format_message(self, template: str, context: Dict[str, Any]) -> str:
        """メッセージテンプレートをフォーマット"""
        try:
            return template.format(**context)
        except KeyError as e:
            logger.error(f"Template formatting error: {e}")
            return f"アラート: {context.get('alert_name', 'Unknown')}"
    
    def _create_notification_record(self, channel: str, message: str, 
                                  current_value: str, threshold_value: str) -> AlertNotification:
        """通知レコードを作成"""
        return AlertNotification.objects.create(
            alert_rule=self.alert_rule,
            campaign=self.campaign,
            title=f"{self.alert_rule.name} - {self.alert_rule.get_alert_type_display()}",
            message=message,
            current_value=current_value,
            threshold_value=threshold_value,
            channel=channel,
            status='PENDING'
        )
    
    def send_notifications(self, current_value: str, threshold_value: str, 
                          custom_context: Dict[str, Any] = None) -> List[AlertNotification]:
        """通知を送信"""
        if not self.alert_settings or not self.alert_settings.global_notifications_enabled:
            logger.info(f"Global notifications disabled for user {self.alert_rule.user.id}")
            return []
        
        if self._is_quiet_hours():
            logger.info(f"Quiet hours active for user {self.alert_rule.user.id}")
            return []
        
        if not self._check_notification_limits():
            return []
        
        # 通知頻度チェック
        if not self._should_send_notification():
            return []
        
        notifications = []
        context = {
            'alert_name': self.alert_rule.name,
            'campaign_name': self.campaign.name if self.campaign else '全キャンペーン',
            'current_value': current_value,
            'threshold_value': threshold_value,
            'alert_type': self.alert_rule.get_alert_type_display(),
            'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
            **(custom_context or {})
        }
        
        # Chatwork通知
        if self.alert_rule.chatwork_webhook_url:
            notification = self._send_chatwork_notification(context, current_value, threshold_value)
            if notification:
                notifications.append(notification)
        
        # Slack通知
        if self.alert_rule.slack_webhook_url:
            notification = self._send_slack_notification(context, current_value, threshold_value)
            if notification:
                notifications.append(notification)
        
        # メール通知
        if self.alert_rule.email_notification:
            notification = self._send_email_notification(context, current_value, threshold_value)
            if notification:
                notifications.append(notification)
        
        # ダッシュボード通知（常に作成）
        dashboard_notification = self._create_notification_record(
            'DASHBOARD', 
            self._format_message(self.alert_rule.slack_message_template, context),
            current_value, 
            threshold_value
        )
        dashboard_notification.status = 'SENT'
        dashboard_notification.sent_at = timezone.now()
        dashboard_notification.save()
        notifications.append(dashboard_notification)
        
        return notifications
    
    def _should_send_notification(self) -> bool:
        """通知頻度に基づいて送信すべきかどうかを判定"""
        if self.alert_rule.notification_frequency == 'IMMEDIATE':
            return True
        
        if not self.alert_rule.last_triggered:
            return True
        
        now = timezone.now()
        last_triggered = self.alert_rule.last_triggered
        
        if self.alert_rule.notification_frequency == 'HOURLY':
            return (now - last_triggered).total_seconds() >= 3600
        elif self.alert_rule.notification_frequency == 'DAILY':
            return (now - last_triggered).total_seconds() >= 86400
        elif self.alert_rule.notification_frequency == 'WEEKLY':
            return (now - last_triggered).total_seconds() >= 604800
        
        return True
    
    def _send_chatwork_notification(self, context: Dict[str, Any], 
                                   current_value: str, threshold_value: str) -> Optional[AlertNotification]:
        """Chatwork通知を送信"""
        try:
            message = self._format_message(self.alert_rule.chatwork_message_template, context)
            
            payload = {
                'body': message
            }
            
            response = requests.post(
                self.alert_rule.chatwork_webhook_url,
                data=json.dumps(payload),
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            notification = self._create_notification_record(
                'CHATWORK', message, current_value, threshold_value
            )
            
            if response.status_code == 200:
                notification.status = 'SENT'
                notification.sent_at = timezone.now()
                notification.response_data = {'status_code': response.status_code}
                logger.info(f"Chatwork notification sent successfully for alert rule {self.alert_rule.id}")
            else:
                notification.status = 'FAILED'
                notification.error_message = f"HTTP {response.status_code}: {response.text}"
                logger.error(f"Chatwork notification failed: {response.status_code} - {response.text}")
            
            notification.save()
            return notification
            
        except Exception as e:
            logger.error(f"Chatwork notification error: {str(e)}")
            notification = self._create_notification_record(
                'CHATWORK', f"Error: {str(e)}", current_value, threshold_value
            )
            notification.status = 'FAILED'
            notification.error_message = str(e)
            notification.save()
            return notification
    
    def _send_slack_notification(self, context: Dict[str, Any], 
                                current_value: str, threshold_value: str) -> Optional[AlertNotification]:
        """Slack通知を送信"""
        try:
            message = self._format_message(self.alert_rule.slack_message_template, context)
            
            payload = {
                'text': message,
                'username': 'Ads Platform Alert',
                'icon_emoji': ':warning:'
            }
            
            response = requests.post(
                self.alert_rule.slack_webhook_url,
                data=json.dumps(payload),
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            notification = self._create_notification_record(
                'SLACK', message, current_value, threshold_value
            )
            
            if response.status_code == 200:
                notification.status = 'SENT'
                notification.sent_at = timezone.now()
                notification.response_data = {'status_code': response.status_code}
                logger.info(f"Slack notification sent successfully for alert rule {self.alert_rule.id}")
            else:
                notification.status = 'FAILED'
                notification.error_message = f"HTTP {response.status_code}: {response.text}"
                logger.error(f"Slack notification failed: {response.status_code} - {response.text}")
            
            notification.save()
            return notification
            
        except Exception as e:
            logger.error(f"Slack notification error: {str(e)}")
            notification = self._create_notification_record(
                'SLACK', f"Error: {str(e)}", current_value, threshold_value
            )
            notification.status = 'FAILED'
            notification.error_message = str(e)
            notification.save()
            return notification
    
    def _send_email_notification(self, context: Dict[str, Any], 
                                current_value: str, threshold_value: str) -> Optional[AlertNotification]:
        """メール通知を送信"""
        try:
            subject = f"🚨 アラート: {self.alert_rule.name}"
            message = self._format_message(self.alert_rule.slack_message_template, context)
            
            # ユーザーのメールアドレスを取得
            recipient_email = self.alert_rule.user.email
            if self.alert_settings and self.alert_settings.default_email:
                recipient_email = self.alert_settings.default_email
            
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient_email],
                fail_silently=False
            )
            
            notification = self._create_notification_record(
                'EMAIL', message, current_value, threshold_value
            )
            notification.status = 'SENT'
            notification.sent_at = timezone.now()
            notification.save()
            
            logger.info(f"Email notification sent successfully for alert rule {self.alert_rule.id}")
            return notification
            
        except Exception as e:
            logger.error(f"Email notification error: {str(e)}")
            notification = self._create_notification_record(
                'EMAIL', f"Error: {str(e)}", current_value, threshold_value
            )
            notification.status = 'FAILED'
            notification.error_message = str(e)
            notification.save()
            return notification


class AlertConditionChecker:
    """アラート条件チェッカー"""
    
    @staticmethod
    def check_budget_threshold(campaign, threshold_value: str, condition: str) -> tuple[bool, str]:
        """予算閾値チェック"""
        try:
            threshold = float(threshold_value)
            current_budget = float(campaign.budget)
            budget_used = current_budget - (float(campaign.budget_remaining) if campaign.budget_remaining else 0)
            budget_usage_percentage = (budget_used / current_budget) * 100
            
            if condition == 'GREATER_THAN':
                triggered = budget_usage_percentage > threshold
            elif condition == 'LESS_THAN':
                triggered = budget_usage_percentage < threshold
            else:
                triggered = False
            
            return triggered, f"{budget_usage_percentage:.1f}%"
            
        except (ValueError, TypeError, ZeroDivisionError) as e:
            logger.error(f"Budget threshold check error: {e}")
            return False, "0%"
    
    @staticmethod
    def check_performance_drop(campaign, threshold_value: str, condition: str) -> tuple[bool, str]:
        """パフォーマンス低下チェック"""
        try:
            threshold = float(threshold_value)
            # ここではCTRを例として使用（実際の実装では、より詳細なパフォーマンス指標を使用）
            current_ctr = 2.0  # 仮の値（実際にはMeta APIから取得）
            
            if condition == 'LESS_THAN':
                triggered = current_ctr < threshold
            elif condition == 'GREATER_THAN':
                triggered = current_ctr > threshold
            else:
                triggered = False
            
            return triggered, f"{current_ctr:.2f}%"
            
        except (ValueError, TypeError) as e:
            logger.error(f"Performance drop check error: {e}")
            return False, "0%"
    
    @staticmethod
    def check_campaign_status(campaign, threshold_value: str, condition: str) -> tuple[bool, str]:
        """キャンペーンステータスチェック"""
        current_status = campaign.status
        
        if condition == 'EQUALS':
            triggered = current_status == threshold_value
        elif condition == 'NOT_EQUALS':
            triggered = current_status != threshold_value
        else:
            triggered = False
        
        return triggered, current_status
