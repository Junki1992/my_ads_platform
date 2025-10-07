from rest_framework import serializers
from .models import AlertRule, AlertNotification, AlertSettings
from apps.campaigns.models import Campaign


class AlertRuleSerializer(serializers.ModelSerializer):
    """アラートルールシリアライザー"""
    
    target_campaigns = serializers.PrimaryKeyRelatedField(
        queryset=Campaign.objects.all(),
        many=True,
        required=False
    )
    
    class Meta:
        model = AlertRule
        fields = [
            'id', 'name', 'description', 'alert_type', 'condition', 'threshold_value',
            'target_campaigns', 'is_active', 'notification_frequency',
            'chatwork_webhook_url', 'slack_webhook_url', 'email_notification',
            'chatwork_message_template', 'slack_message_template',
            'created_at', 'updated_at', 'last_triggered'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_triggered']
    
    def validate(self, data):
        """バリデーション"""
        # Webhook URLが設定されている場合の検証
        if not data.get('chatwork_webhook_url') and not data.get('slack_webhook_url') and not data.get('email_notification'):
            raise serializers.ValidationError('少なくとも1つの通知方法を設定してください。')
        
        # 閾値の検証（数値系のアラートタイプの場合）
        if data.get('alert_type') in ['BUDGET_THRESHOLD', 'PERFORMANCE_DROP']:
            try:
                float(data.get('threshold_value', 0))
            except (ValueError, TypeError):
                raise serializers.ValidationError('数値系のアラートでは閾値は数値である必要があります。')
        
        return data


class AlertRuleListSerializer(serializers.ModelSerializer):
    """アラートルール一覧用シリアライザー"""
    
    target_campaigns_count = serializers.SerializerMethodField()
    notifications_count = serializers.SerializerMethodField()
    
    class Meta:
        model = AlertRule
        fields = [
            'id', 'name', 'alert_type', 'is_active', 'notification_frequency',
            'target_campaigns_count', 'notifications_count', 'last_triggered',
            'created_at', 'updated_at'
        ]
    
    def get_target_campaigns_count(self, obj):
        return obj.target_campaigns.count()
    
    def get_notifications_count(self, obj):
        return obj.notifications.count()


class AlertNotificationSerializer(serializers.ModelSerializer):
    """アラート通知シリアライザー"""
    
    alert_rule_name = serializers.ReadOnlyField(source='alert_rule.name')
    campaign_name = serializers.ReadOnlyField(source='campaign.name')
    
    class Meta:
        model = AlertNotification
        fields = [
            'id', 'alert_rule', 'alert_rule_name', 'campaign', 'campaign_name',
            'title', 'message', 'current_value', 'threshold_value',
            'channel', 'status', 'error_message', 'sent_at', 'response_data',
            'created_at'
        ]
        read_only_fields = [
            'id', 'alert_rule_name', 'campaign_name', 'sent_at', 'response_data', 'created_at'
        ]


class AlertNotificationListSerializer(serializers.ModelSerializer):
    """アラート通知一覧用シリアライザー"""
    
    alert_rule_name = serializers.ReadOnlyField(source='alert_rule.name')
    campaign_name = serializers.ReadOnlyField(source='campaign.name')
    
    class Meta:
        model = AlertNotification
        fields = [
            'id', 'alert_rule_name', 'campaign_name', 'title', 'channel', 'status',
            'current_value', 'threshold_value', 'sent_at', 'created_at'
        ]


class AlertSettingsSerializer(serializers.ModelSerializer):
    """アラート設定シリアライザー"""
    
    class Meta:
        model = AlertSettings
        fields = [
            'global_notifications_enabled', 'quiet_hours_start', 'quiet_hours_end',
            'default_chatwork_webhook', 'default_slack_webhook', 'default_email',
            'max_notifications_per_hour', 'max_notifications_per_day',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class AlertTestSerializer(serializers.Serializer):
    """アラートテスト用シリアライザー"""
    
    alert_rule_id = serializers.IntegerField()
    test_message = serializers.CharField(max_length=500, required=False)
    test_channels = serializers.ListField(
        child=serializers.ChoiceField(choices=['CHATWORK', 'SLACK', 'EMAIL']),
        required=False
    )
    
    def validate_alert_rule_id(self, value):
        try:
            AlertRule.objects.get(id=value, user=self.context['request'].user)
        except AlertRule.DoesNotExist:
            raise serializers.ValidationError('指定されたアラートルールが見つかりません。')
        return value


class AlertStatsSerializer(serializers.Serializer):
    """アラート統計シリアライザー"""
    
    total_rules = serializers.IntegerField()
    active_rules = serializers.IntegerField()
    total_notifications = serializers.IntegerField()
    notifications_today = serializers.IntegerField()
    notifications_this_week = serializers.IntegerField()
    failed_notifications = serializers.IntegerField()
    success_rate = serializers.FloatField()
    
    # チャンネル別統計
    chatwork_notifications = serializers.IntegerField()
    slack_notifications = serializers.IntegerField()
    email_notifications = serializers.IntegerField()
    
    # アラートタイプ別統計
    budget_alerts = serializers.IntegerField()
    performance_alerts = serializers.IntegerField()
    system_alerts = serializers.IntegerField()
