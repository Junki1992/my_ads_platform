from django.contrib import admin

from .models import DailyAdInsight


@admin.register(DailyAdInsight)
class DailyAdInsightAdmin(admin.ModelAdmin):
    list_display = (
        'stat_date',
        'meta_account',
        'meta_ad_id',
        'campaign_name',
        'spend',
        'conversions',
        'fetched_at',
    )
    list_filter = ('stat_date', 'meta_account')
    search_fields = ('meta_ad_id', 'campaign_name', 'ad_name')
    date_hierarchy = 'stat_date'
