from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Count
from django.utils import timezone
from datetime import datetime, timedelta
import logging

from .models import AlertRule, AlertNotification, AlertSettings
from .serializers import (
    AlertRuleSerializer, AlertRuleListSerializer,
    AlertNotificationSerializer, AlertNotificationListSerializer,
    AlertSettingsSerializer, AlertTestSerializer, AlertStatsSerializer
)
from .services import NotificationService, AlertConditionChecker

logger = logging.getLogger(__name__)


class AlertRuleViewSet(viewsets.ModelViewSet):
    """アラートルール管理ViewSet"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return AlertRuleListSerializer
        return AlertRuleSerializer
    
    def get_queryset(self):
        """自分のアラートルールのみ取得"""
        return AlertRule.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """アラートルール作成時にユーザーを設定"""
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """アラートルールのテスト実行"""
        alert_rule = self.get_object()
        serializer = AlertTestSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
            test_message = serializer.validated_data.get('test_message', 'テスト通知です')
            test_channels = serializer.validated_data.get('test_channels', ['DASHBOARD'])
            
            # テスト通知を送信
            notification_service = NotificationService(alert_rule)
            context = {
                'alert_name': alert_rule.name,
                'campaign_name': 'テストキャンペーン',
                'current_value': 'テスト値',
                'threshold_value': alert_rule.threshold_value,
                'alert_type': alert_rule.get_alert_type_display(),
                'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            
            notifications = []
            if 'CHATWORK' in test_channels and alert_rule.chatwork_webhook_url:
                notification = notification_service._send_chatwork_notification(
                    context, 'テスト値', alert_rule.threshold_value
                )
                if notification:
                    notifications.append(notification)
            
            if 'SLACK' in test_channels and alert_rule.slack_webhook_url:
                notification = notification_service._send_slack_notification(
                    context, 'テスト値', alert_rule.threshold_value
                )
                if notification:
                    notifications.append(notification)
            
            if 'EMAIL' in test_channels and alert_rule.email_notification:
                notification = notification_service._send_email_notification(
                    context, 'テスト値', alert_rule.threshold_value
                )
                if notification:
                    notifications.append(notification)
            
            return Response({
                'status': 'success',
                'message': f'{len(notifications)}件のテスト通知を送信しました',
                'notifications': AlertNotificationListSerializer(notifications, many=True).data
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """アラートルールの有効/無効を切り替え"""
        alert_rule = self.get_object()
        alert_rule.is_active = not alert_rule.is_active
        alert_rule.save()
        
        return Response({
            'status': 'success',
            'is_active': alert_rule.is_active,
            'message': f'アラートルールを{"有効" if alert_rule.is_active else "無効"}にしました'
        })


class AlertNotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """アラート通知履歴ViewSet"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return AlertNotificationListSerializer
        return AlertNotificationSerializer
    
    def get_queryset(self):
        """自分のアラートルールの通知のみ取得"""
        return AlertNotification.objects.filter(alert_rule__user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """最近の通知を取得"""
        recent_notifications = self.get_queryset().order_by('-created_at')[:10]
        serializer = self.get_serializer(recent_notifications, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def failed(self, request):
        """失敗した通知を取得"""
        failed_notifications = self.get_queryset().filter(status='FAILED').order_by('-created_at')
        serializer = self.get_serializer(failed_notifications, many=True)
        return Response(serializer.data)


class AlertSettingsViewSet(viewsets.ModelViewSet):
    """アラート設定ViewSet"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AlertSettingsSerializer
    
    def get_queryset(self):
        """自分のアラート設定のみ取得"""
        return AlertSettings.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """アラート設定作成時にユーザーを設定"""
        serializer.save(user=self.request.user)
    
    def get_object(self):
        """既存の設定を取得、なければ作成"""
        obj, created = AlertSettings.objects.get_or_create(user=self.request.user)
        return obj


class AlertStatsView(viewsets.ViewSet):
    """アラート統計ViewSet"""
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """ダッシュボード用統計を取得"""
        user = request.user
        
        # 基本統計
        total_rules = AlertRule.objects.filter(user=user).count()
        active_rules = AlertRule.objects.filter(user=user, is_active=True).count()
        total_notifications = AlertNotification.objects.filter(alert_rule__user=user).count()
        
        # 今日の通知数
        today = timezone.now().date()
        notifications_today = AlertNotification.objects.filter(
            alert_rule__user=user,
            created_at__date=today
        ).count()
        
        # 今週の通知数
        week_ago = timezone.now() - timedelta(days=7)
        notifications_this_week = AlertNotification.objects.filter(
            alert_rule__user=user,
            created_at__gte=week_ago
        ).count()
        
        # 失敗した通知数
        failed_notifications = AlertNotification.objects.filter(
            alert_rule__user=user,
            status='FAILED'
        ).count()
        
        # 成功率
        success_rate = 0
        if total_notifications > 0:
            success_rate = ((total_notifications - failed_notifications) / total_notifications) * 100
        
        # チャンネル別統計
        chatwork_notifications = AlertNotification.objects.filter(
            alert_rule__user=user,
            channel='CHATWORK'
        ).count()
        
        slack_notifications = AlertNotification.objects.filter(
            alert_rule__user=user,
            channel='SLACK'
        ).count()
        
        email_notifications = AlertNotification.objects.filter(
            alert_rule__user=user,
            channel='EMAIL'
        ).count()
        
        # アラートタイプ別統計
        budget_alerts = AlertNotification.objects.filter(
            alert_rule__user=user,
            alert_rule__alert_type='BUDGET_THRESHOLD'
        ).count()
        
        performance_alerts = AlertNotification.objects.filter(
            alert_rule__user=user,
            alert_rule__alert_type='PERFORMANCE_DROP'
        ).count()
        
        system_alerts = AlertNotification.objects.filter(
            alert_rule__user=user,
            alert_rule__alert_type__in=['API_ERROR', 'BULK_UPLOAD_COMPLETE', 'BULK_UPLOAD_FAILED']
        ).count()
        
        stats_data = {
            'total_rules': total_rules,
            'active_rules': active_rules,
            'total_notifications': total_notifications,
            'notifications_today': notifications_today,
            'notifications_this_week': notifications_this_week,
            'failed_notifications': failed_notifications,
            'success_rate': round(success_rate, 1),
            'chatwork_notifications': chatwork_notifications,
            'slack_notifications': slack_notifications,
            'email_notifications': email_notifications,
            'budget_alerts': budget_alerts,
            'performance_alerts': performance_alerts,
            'system_alerts': system_alerts
        }
        
        serializer = AlertStatsSerializer(stats_data)
        return Response(serializer.data)

