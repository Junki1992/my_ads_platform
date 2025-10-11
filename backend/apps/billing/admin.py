from django.contrib import admin
from .models import Subscription, Payment, UsageMetrics, PlanLimit


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'plan', 'status', 'current_period_end', 'created_at']
    list_filter = ['plan', 'status', 'cancel_at_period_end']
    search_fields = ['user__email', 'user__username', 'stripe_subscription_id']
    readonly_fields = ['stripe_subscription_id', 'stripe_customer_id', 'created_at', 'updated_at']
    
    fieldsets = (
        ('基本情報', {
            'fields': ('user', 'plan', 'status')
        }),
        ('Stripe情報', {
            'fields': ('stripe_subscription_id', 'stripe_customer_id')
        }),
        ('期間', {
            'fields': ('current_period_start', 'current_period_end', 'trial_end', 'cancel_at_period_end')
        }),
        ('タイムスタンプ', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['user', 'amount', 'currency', 'status', 'created_at']
    list_filter = ['status', 'currency']
    search_fields = ['user__email', 'stripe_payment_intent_id']
    readonly_fields = ['stripe_payment_intent_id', 'created_at', 'updated_at']
    
    fieldsets = (
        ('基本情報', {
            'fields': ('user', 'subscription', 'status')
        }),
        ('支払い詳細', {
            'fields': ('amount', 'currency', 'payment_method', 'description')
        }),
        ('Stripe情報', {
            'fields': ('stripe_payment_intent_id',)
        }),
        ('タイムスタンプ', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(UsageMetrics)
class UsageMetricsAdmin(admin.ModelAdmin):
    list_display = ['user', 'date', 'campaign_count', 'api_calls', 'ad_spend']
    list_filter = ['date']
    search_fields = ['user__email', 'user__username']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'date'


@admin.register(PlanLimit)
class PlanLimitAdmin(admin.ModelAdmin):
    list_display = ['plan', 'max_campaigns', 'max_api_calls_per_day', 'max_users']
    list_filter = ['plan']
    
    fieldsets = (
        ('プラン', {
            'fields': ('plan',)
        }),
        ('数値制限', {
            'fields': ('max_campaigns', 'max_api_calls_per_day', 'max_ad_spend_per_month', 'max_users')
        }),
        ('機能フラグ', {
            'fields': ('allow_bulk_upload', 'allow_automation', 'allow_custom_reports', 'allow_api_access')
        }),
        ('タイムスタンプ', {
            'fields': ('created_at', 'updated_at')
        }),
    )
