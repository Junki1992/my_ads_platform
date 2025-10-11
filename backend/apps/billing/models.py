from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.accounts.models import User


class Subscription(models.Model):
    """サブスクリプションモデル"""
    
    PLAN_CHOICES = [
        ('free', _('Free')),
        ('pro', _('Pro')),
        ('enterprise', _('Enterprise')),
    ]
    
    STATUS_CHOICES = [
        ('active', _('Active')),
        ('trialing', _('Trialing')),
        ('past_due', _('Past Due')),
        ('canceled', _('Canceled')),
        ('unpaid', _('Unpaid')),
    ]
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='subscription'
    )
    plan = models.CharField(
        max_length=20,
        choices=PLAN_CHOICES,
        default='free'
    )
    stripe_subscription_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True
    )
    stripe_customer_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    trial_end = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Subscription')
        verbose_name_plural = _('Subscriptions')
        db_table = 'billing_subscription'
    
    def __str__(self):
        return f"{self.user.email} - {self.plan}"
    
    @property
    def is_active(self):
        """サブスクリプションが有効かどうか"""
        return self.status in ['active', 'trialing']
    
    @property
    def is_free_plan(self):
        """Freeプランかどうか"""
        return self.plan == 'free'
    
    @property
    def is_pro_plan(self):
        """Proプランかどうか"""
        return self.plan == 'pro'
    
    @property
    def is_enterprise_plan(self):
        """Enterpriseプランかどうか"""
        return self.plan == 'enterprise'
    
    def get_campaign_limit(self):
        """キャンペーン数の上限を返す"""
        limits = {
            'free': 3,
            'pro': None,  # 無制限
            'enterprise': None,  # 無制限
        }
        return limits.get(self.plan)
    
    def get_api_call_limit(self):
        """1日あたりのAPI呼び出し上限を返す"""
        limits = {
            'free': 1000,
            'pro': 10000,
            'enterprise': 100000,
        }
        return limits.get(self.plan, 0)


class Payment(models.Model):
    """支払い履歴モデル"""
    
    STATUS_CHOICES = [
        ('succeeded', _('Succeeded')),
        ('pending', _('Pending')),
        ('failed', _('Failed')),
        ('refunded', _('Refunded')),
    ]
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments'
    )
    stripe_payment_intent_id = models.CharField(
        max_length=255,
        unique=True
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )
    currency = models.CharField(
        max_length=3,
        default='jpy'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    payment_method = models.CharField(
        max_length=50,
        blank=True
    )
    description = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Payment')
        verbose_name_plural = _('Payments')
        db_table = 'billing_payment'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.email} - ¥{self.amount} ({self.status})"


class UsageMetrics(models.Model):
    """使用量メトリクスモデル"""
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='usage_metrics'
    )
    date = models.DateField()
    
    # メトリクス
    campaign_count = models.IntegerField(default=0)
    api_calls = models.IntegerField(default=0)
    ad_spend = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Usage Metrics')
        verbose_name_plural = _('Usage Metrics')
        db_table = 'billing_usage_metrics'
        unique_together = ['user', 'date']
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.user.email} - {self.date}"


class PlanLimit(models.Model):
    """プラン制限設定モデル（管理画面で変更可能）"""
    
    plan = models.CharField(
        max_length=20,
        choices=Subscription.PLAN_CHOICES,
        unique=True
    )
    
    # 制限値
    max_campaigns = models.IntegerField(
        null=True,
        blank=True,
        help_text=_('null = unlimited')
    )
    max_api_calls_per_day = models.IntegerField(default=0)
    max_ad_spend_per_month = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('null = unlimited')
    )
    max_users = models.IntegerField(
        null=True,
        blank=True,
        help_text=_('null = unlimited')
    )
    
    # 機能フラグ
    allow_bulk_upload = models.BooleanField(default=False)
    allow_automation = models.BooleanField(default=False)
    allow_custom_reports = models.BooleanField(default=False)
    allow_api_access = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Plan Limit')
        verbose_name_plural = _('Plan Limits')
        db_table = 'billing_plan_limit'
    
    def __str__(self):
        return f"{self.get_plan_display()} - Limits"
