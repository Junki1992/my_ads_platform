from rest_framework import serializers
from .models import Subscription, Payment, UsageMetrics, PlanLimit


class SubscriptionSerializer(serializers.ModelSerializer):
    """サブスクリプションシリアライザ"""
    
    is_active = serializers.ReadOnlyField()
    is_free_plan = serializers.ReadOnlyField()
    is_pro_plan = serializers.ReadOnlyField()
    is_enterprise_plan = serializers.ReadOnlyField()
    campaign_limit = serializers.SerializerMethodField()
    api_call_limit = serializers.SerializerMethodField()
    
    class Meta:
        model = Subscription
        fields = [
            'id', 'plan', 'status',
            'current_period_start', 'current_period_end',
            'cancel_at_period_end', 'trial_end',
            'is_active', 'is_free_plan', 'is_pro_plan', 'is_enterprise_plan',
            'campaign_limit', 'api_call_limit',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'status', 'current_period_start', 'current_period_end',
            'trial_end', 'created_at', 'updated_at'
        ]
    
    def get_campaign_limit(self, obj):
        return obj.get_campaign_limit()
    
    def get_api_call_limit(self, obj):
        return obj.get_api_call_limit()


class PaymentSerializer(serializers.ModelSerializer):
    """支払い履歴シリアライザ"""
    
    class Meta:
        model = Payment
        fields = [
            'id', 'amount', 'currency', 'status',
            'payment_method', 'description',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class UsageMetricsSerializer(serializers.ModelSerializer):
    """使用量メトリクスシリアライザ"""
    
    class Meta:
        model = UsageMetrics
        fields = [
            'id', 'date', 'campaign_count',
            'api_calls', 'ad_spend',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class PlanLimitSerializer(serializers.ModelSerializer):
    """プラン制限シリアライザ"""
    
    class Meta:
        model = PlanLimit
        fields = [
            'plan', 'max_campaigns', 'max_api_calls_per_day',
            'max_ad_spend_per_month', 'max_users',
            'allow_bulk_upload', 'allow_automation',
            'allow_custom_reports', 'allow_api_access'
        ]


class CheckoutSessionSerializer(serializers.Serializer):
    """Stripe Checkout Session作成用"""
    
    plan = serializers.ChoiceField(
        choices=['pro', 'enterprise'],
        required=True
    )
    billing_period = serializers.ChoiceField(
        choices=['monthly', 'yearly'],
        default='monthly'
    )
    success_url = serializers.URLField(required=False)
    cancel_url = serializers.URLField(required=False)


class CancelSubscriptionSerializer(serializers.Serializer):
    """サブスクリプションキャンセル用"""
    
    cancel_at_period_end = serializers.BooleanField(default=True)
    reason = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True
    )


class ChangePlanSerializer(serializers.Serializer):
    """プラン変更用"""
    
    new_plan = serializers.ChoiceField(
        choices=['free', 'pro', 'enterprise'],
        required=True
    )

