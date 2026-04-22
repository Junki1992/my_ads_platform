from django.db import models
from django.utils.translation import gettext_lazy as _


class DailyAdInsight(models.Model):
    """Meta Insights API から取得した広告単位の日次スナップショット（前日分を定期取り込み）。"""

    meta_account = models.ForeignKey(
        'accounts.MetaAccount',
        on_delete=models.CASCADE,
        related_name='daily_ad_insights',
    )
    stat_date = models.DateField(_('stat date'), db_index=True)
    meta_ad_id = models.CharField(_('Meta ad id'), max_length=64, db_index=True)

    campaign_name = models.CharField(_('campaign name'), max_length=512, blank=True)
    adset_name = models.CharField(_('adset name'), max_length=512, blank=True)
    ad_name = models.CharField(_('ad name'), max_length=512, blank=True)

    impressions = models.BigIntegerField(default=0)
    clicks = models.BigIntegerField(default=0)
    ctr = models.FloatField(default=0.0)
    cpc = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    spend = models.DecimalField(max_digits=16, decimal_places=2, default=0)

    conversions = models.FloatField(
        _('conversions (purchase)'),
        default=0,
        help_text=_('offsite_conversion.fb_pixel_purchase'),
    )
    cpa = models.DecimalField(
        max_digits=16,
        decimal_places=4,
        null=True,
        blank=True,
        verbose_name=_('CPA (purchase)'),
    )

    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Daily ad insight')
        verbose_name_plural = _('Daily ad insights')
        constraints = [
            models.UniqueConstraint(
                fields=['meta_account', 'stat_date', 'meta_ad_id'],
                name='uniq_daily_ad_insight_account_date_ad',
            ),
        ]
        indexes = [
            models.Index(fields=['meta_account', 'stat_date']),
        ]

    def __str__(self):
        return f'{self.stat_date} {self.meta_ad_id}'
