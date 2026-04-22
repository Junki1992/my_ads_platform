from rest_framework import serializers

from .models import DailyAdInsight


class DailyAdInsightSerializer(serializers.ModelSerializer):
    meta_account_name = serializers.CharField(source='meta_account.account_name', read_only=True)
    meta_account_id_str = serializers.CharField(source='meta_account.account_id', read_only=True)
    meta_business_name = serializers.CharField(source='meta_account.business_name', read_only=True)
    meta_business_id = serializers.CharField(source='meta_account.business_id', read_only=True)

    class Meta:
        model = DailyAdInsight
        fields = (
            'id',
            'stat_date',
            'meta_account',
            'meta_account_name',
            'meta_account_id_str',
            'meta_business_name',
            'meta_business_id',
            'meta_ad_id',
            'campaign_name',
            'adset_name',
            'ad_name',
            'impressions',
            'clicks',
            'ctr',
            'cpc',
            'spend',
            'conversions',
            'cpa',
            'fetched_at',
        )
        read_only_fields = (
            'id',
            'stat_date',
            'meta_account',
            'meta_account_name',
            'meta_account_id_str',
            'meta_business_name',
            'meta_business_id',
            'meta_ad_id',
            'campaign_name',
            'adset_name',
            'ad_name',
            'impressions',
            'clicks',
            'ctr',
            'cpc',
            'spend',
            'conversions',
            'cpa',
            'fetched_at',
        )
