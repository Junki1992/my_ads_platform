from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.accounts.models import User
from apps.campaigns.models import Campaign


class AlertRule(models.Model):
    """アラートルールモデル"""
    
    ALERT_TYPE_CHOICES = [
        ('BUDGET_THRESHOLD', _('Budget Threshold')),
        ('PERFORMANCE_DROP', _('Performance Drop')),
        ('CAMPAIGN_PAUSED', _('Campaign Paused')),
        ('API_ERROR', _('API Error')),
        ('BULK_UPLOAD_COMPLETE', _('Bulk Upload Complete')),
        ('BULK_UPLOAD_FAILED', _('Bulk Upload Failed')),
        ('CUSTOM', _('Custom')),
    ]
    
    CONDITION_CHOICES = [
        ('GREATER_THAN', _('Greater Than')),
        ('LESS_THAN', _('Less Than')),
        ('EQUALS', _('Equals')),
        ('NOT_EQUALS', _('Not Equals')),
        ('CONTAINS', _('Contains')),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='alert_rules')
    name = models.CharField(max_length=200, help_text=_('アラートルール名'))
    description = models.TextField(blank=True, help_text=_('アラートルールの説明'))
    
    # アラート条件
    alert_type = models.CharField(max_length=50, choices=ALERT_TYPE_CHOICES)
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES)
    threshold_value = models.CharField(max_length=100, help_text=_('閾値（数値、文字列、パーセンテージなど）'))
    
    # 対象キャンペーン（空の場合は全キャンペーン）
    target_campaigns = models.ManyToManyField(Campaign, blank=True, help_text=_('対象キャンペーン（空の場合は全キャンペーン）'))
    
    # 通知設定
    is_active = models.BooleanField(default=True)
    notification_frequency = models.CharField(
        max_length=20,
        choices=[
            ('IMMEDIATE', _('Immediate')),
            ('HOURLY', _('Hourly')),
            ('DAILY', _('Daily')),
            ('WEEKLY', _('Weekly')),
        ],
        default='IMMEDIATE'
    )
    
    # 通知先設定
    chatwork_webhook_url = models.URLField(blank=True, help_text=_('Chatwork Webhook URL'))
    slack_webhook_url = models.URLField(blank=True, help_text=_('Slack Webhook URL'))
    email_notification = models.BooleanField(default=False)
    email_addresses = models.TextField(blank=True, help_text=_('通知先メールアドレス（複数の場合は改行区切り）'))
    
    # メッセージテンプレート
    chatwork_message_template = models.TextField(
        default='🚨 アラート: {alert_name}\n📊 キャンペーン: {campaign_name}\n📈 値: {current_value}\n🎯 閾値: {threshold_value}',
        help_text=_('Chatworkメッセージテンプレート')
    )
    slack_message_template = models.TextField(
        default='🚨 *アラート: {alert_name}*\n📊 *キャンペーン:* {campaign_name}\n📈 *値:* {current_value}\n🎯 *閾値:* {threshold_value}',
        help_text=_('Slackメッセージテンプレート')
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_triggered = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = _('Alert Rule')
        verbose_name_plural = _('Alert Rules')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.get_alert_type_display()})"


class AlertNotification(models.Model):
    """アラート通知履歴モデル"""
    
    STATUS_CHOICES = [
        ('PENDING', _('Pending')),
        ('SENT', _('Sent')),
        ('FAILED', _('Failed')),
    ]
    
    CHANNEL_CHOICES = [
        ('CHATWORK', _('Chatwork')),
        ('SLACK', _('Slack')),
        ('EMAIL', _('Email')),
        ('DASHBOARD', _('Dashboard')),
    ]
    
    alert_rule = models.ForeignKey(AlertRule, on_delete=models.CASCADE, related_name='notifications')
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, null=True, blank=True)
    
    # 通知内容
    title = models.CharField(max_length=200)
    message = models.TextField()
    current_value = models.CharField(max_length=100, help_text=_('現在の値'))
    threshold_value = models.CharField(max_length=100, help_text=_('閾値'))
    
    # 通知設定
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    error_message = models.TextField(blank=True, help_text=_('エラーメッセージ'))
    
    # 送信情報
    sent_at = models.DateTimeField(null=True, blank=True)
    response_data = models.JSONField(default=dict, help_text=_('送信レスポンスデータ'))
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('Alert Notification')
        verbose_name_plural = _('Alert Notifications')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} - {self.get_channel_display()} ({self.get_status_display()})"


class AlertSettings(models.Model):
    """ユーザー別アラート設定モデル"""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='alert_settings')
    
    # 全体的な通知設定
    global_notifications_enabled = models.BooleanField(default=True)
    quiet_hours_start = models.TimeField(null=True, blank=True, help_text=_('通知停止開始時間'))
    quiet_hours_end = models.TimeField(null=True, blank=True, help_text=_('通知停止終了時間'))
    
    # デフォルト通知先
    default_chatwork_webhook = models.URLField(blank=True, help_text=_('デフォルトChatwork Webhook URL'))
    default_slack_webhook = models.URLField(blank=True, help_text=_('デフォルトSlack Webhook URL'))
    default_email = models.EmailField(blank=True, help_text=_('デフォルト通知メールアドレス'))
    
    # 通知頻度制限
    max_notifications_per_hour = models.IntegerField(default=10, help_text=_('時間あたりの最大通知数'))
    max_notifications_per_day = models.IntegerField(default=50, help_text=_('日あたりの最大通知数'))
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Alert Settings')
        verbose_name_plural = _('Alert Settings')
    
    def __str__(self):
        return f"Alert Settings for {self.user.username}"
