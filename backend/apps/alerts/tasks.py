from celery import shared_task
from django.utils import timezone
from django.db.models import Q
import logging

from .models import AlertRule, AlertNotification
from .services import NotificationService, AlertConditionChecker
from apps.campaigns.models import Campaign

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def check_all_alert_rules(self):
    """全てのアクティブなアラートルールをチェック"""
    try:
        active_rules = AlertRule.objects.filter(is_active=True)
        total_checked = 0
        total_triggered = 0
        
        logger.info(f"Starting alert check for {active_rules.count()} active rules")
        
        for rule in active_rules:
            try:
                triggered = check_single_alert_rule.delay(rule.id)
                total_checked += 1
                if triggered:
                    total_triggered += 1
            except Exception as e:
                logger.error(f"Error checking alert rule {rule.id}: {str(e)}")
        
        logger.info(f"Alert check completed: {total_checked} checked, {total_triggered} triggered")
        return {
            'status': 'success',
            'total_checked': total_checked,
            'total_triggered': total_triggered
        }
        
    except Exception as e:
        logger.error(f"Error in check_all_alert_rules: {str(e)}")
        return {
            'status': 'error',
            'error': str(e)
        }


@shared_task(bind=True)
def check_single_alert_rule(self, rule_id):
    """単一のアラートルールをチェック"""
    try:
        rule = AlertRule.objects.get(id=rule_id)
        logger.info(f"Checking alert rule: {rule.name} (ID: {rule_id})")
        
        # 対象キャンペーンを取得
        if rule.target_campaigns.exists():
            campaigns = rule.target_campaigns.all()
        else:
            campaigns = Campaign.objects.filter(user=rule.user).exclude(status__in=['DELETED', 'ARCHIVED'])
        
        triggered_count = 0
        
        for campaign in campaigns:
            try:
                triggered, current_value = check_alert_condition(rule, campaign)
                
                if triggered:
                    # 通知を送信
                    notification_service = NotificationService(rule, campaign)
                    notifications = notification_service.send_notifications(
                        current_value=current_value,
                        threshold_value=rule.threshold_value
                    )
                    
                    if notifications:
                        triggered_count += 1
                        rule.last_triggered = timezone.now()
                        rule.save()
                        logger.info(f"Alert triggered for campaign {campaign.name}: {current_value}")
                
            except Exception as e:
                logger.error(f"Error checking campaign {campaign.id} for rule {rule_id}: {str(e)}")
        
        return triggered_count > 0
        
    except AlertRule.DoesNotExist:
        logger.error(f"Alert rule {rule_id} not found")
        return False
    except Exception as e:
        logger.error(f"Error in check_single_alert_rule {rule_id}: {str(e)}")
        return False


def check_alert_condition(rule: AlertRule, campaign: Campaign) -> tuple[bool, str]:
    """アラート条件をチェック"""
    try:
        if rule.alert_type == 'BUDGET_THRESHOLD':
            return AlertConditionChecker.check_budget_threshold(
                campaign, rule.threshold_value, rule.condition
            )
        elif rule.alert_type == 'PERFORMANCE_DROP':
            return AlertConditionChecker.check_performance_drop(
                campaign, rule.threshold_value, rule.condition
            )
        elif rule.alert_type == 'CAMPAIGN_PAUSED':
            return AlertConditionChecker.check_campaign_status(
                campaign, rule.threshold_value, rule.condition
            )
        elif rule.alert_type == 'API_ERROR':
            # API エラーは別途トリガーされる
            return False, "N/A"
        elif rule.alert_type == 'BULK_UPLOAD_COMPLETE':
            # 一括入稿完了は別途トリガーされる
            return False, "N/A"
        elif rule.alert_type == 'BULK_UPLOAD_FAILED':
            # 一括入稿失敗は別途トリガーされる
            return False, "N/A"
        else:
            logger.warning(f"Unknown alert type: {rule.alert_type}")
            return False, "N/A"
            
    except Exception as e:
        logger.error(f"Error checking alert condition: {str(e)}")
        return False, "Error"


@shared_task(bind=True)
def send_system_alert(self, user_id, alert_type, message, campaign_id=None, **kwargs):
    """システムアラートを送信"""
    try:
        from apps.accounts.models import User
        user = User.objects.get(id=user_id)
        
        # 該当するアラートルールを取得
        rules = AlertRule.objects.filter(
            user=user,
            alert_type=alert_type,
            is_active=True
        )
        
        campaign = None
        if campaign_id:
            try:
                campaign = Campaign.objects.get(id=campaign_id)
            except Campaign.DoesNotExist:
                pass
        
        notifications_sent = 0
        
        for rule in rules:
            try:
                notification_service = NotificationService(rule, campaign)
                
                context = {
                    'alert_name': rule.name,
                    'campaign_name': campaign.name if campaign else 'システム',
                    'current_value': kwargs.get('current_value', 'N/A'),
                    'threshold_value': rule.threshold_value,
                    'alert_type': rule.get_alert_type_display(),
                    'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'system_message': message,
                    **kwargs
                }
                
                notifications = notification_service.send_notifications(
                    current_value=kwargs.get('current_value', 'N/A'),
                    threshold_value=rule.threshold_value,
                    custom_context=context
                )
                
                if notifications:
                    notifications_sent += len(notifications)
                    rule.last_triggered = timezone.now()
                    rule.save()
                
            except Exception as e:
                logger.error(f"Error sending system alert for rule {rule.id}: {str(e)}")
        
        logger.info(f"System alert sent: {notifications_sent} notifications for user {user_id}")
        return {
            'status': 'success',
            'notifications_sent': notifications_sent
        }
        
    except Exception as e:
        logger.error(f"Error in send_system_alert: {str(e)}")
        return {
            'status': 'error',
            'error': str(e)
        }


@shared_task(bind=True)
def cleanup_old_notifications(self, days=30):
    """古い通知履歴をクリーンアップ"""
    try:
        from datetime import timedelta
        cutoff_date = timezone.now() - timedelta(days=days)
        
        old_notifications = AlertNotification.objects.filter(
            created_at__lt=cutoff_date
        )
        
        count = old_notifications.count()
        old_notifications.delete()
        
        logger.info(f"Cleaned up {count} old notifications older than {days} days")
        return {
            'status': 'success',
            'deleted_count': count
        }
        
    except Exception as e:
        logger.error(f"Error in cleanup_old_notifications: {str(e)}")
        return {
            'status': 'error',
            'error': str(e)
        }


@shared_task(bind=True)
def retry_failed_notifications(self):
    """失敗した通知を再送信"""
    try:
        failed_notifications = AlertNotification.objects.filter(
            status='FAILED',
            created_at__gte=timezone.now() - timezone.timedelta(hours=24)
        )
        
        retried_count = 0
        
        for notification in failed_notifications:
            try:
                # 同じアラートルールで最近成功した通知があるかチェック
                recent_success = AlertNotification.objects.filter(
                    alert_rule=notification.alert_rule,
                    status='SENT',
                    created_at__gte=timezone.now() - timezone.timedelta(hours=1)
                ).exists()
                
                if not recent_success:
                    # 再送信を試行
                    notification_service = NotificationService(
                        notification.alert_rule, 
                        notification.campaign
                    )
                    
                    context = {
                        'alert_name': notification.alert_rule.name,
                        'campaign_name': notification.campaign.name if notification.campaign else 'システム',
                        'current_value': notification.current_value,
                        'threshold_value': notification.threshold_value,
                        'alert_type': notification.alert_rule.get_alert_type_display(),
                        'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S')
                    }
                    
                    if notification.channel == 'CHATWORK':
                        new_notification = notification_service._send_chatwork_notification(
                            context, notification.current_value, notification.threshold_value
                        )
                    elif notification.channel == 'SLACK':
                        new_notification = notification_service._send_slack_notification(
                            context, notification.current_value, notification.threshold_value
                        )
                    elif notification.channel == 'EMAIL':
                        new_notification = notification_service._send_email_notification(
                            context, notification.current_value, notification.threshold_value
                        )
                    else:
                        continue
                    
                    if new_notification and new_notification.status == 'SENT':
                        retried_count += 1
                        logger.info(f"Retried notification {notification.id} successfully")
                
            except Exception as e:
                logger.error(f"Error retrying notification {notification.id}: {str(e)}")
        
        logger.info(f"Retried {retried_count} failed notifications")
        return {
            'status': 'success',
            'retried_count': retried_count
        }
        
    except Exception as e:
        logger.error(f"Error in retry_failed_notifications: {str(e)}")
        return {
            'status': 'error',
            'error': str(e)
        }
