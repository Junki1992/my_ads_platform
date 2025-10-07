from rest_framework import serializers
from .models import Campaign, AdSet, Ad
from apps.accounts.models import MetaAccount


class CampaignSerializer(serializers.ModelSerializer):
    """キャンペーンシリアライザー"""
    user_email = serializers.ReadOnlyField(source='user.email')
    meta_account_name = serializers.ReadOnlyField(source='meta_account.account_name')
    meta_account_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = Campaign
        fields = [
            'id', 'campaign_id', 'name', 'objective', 'status',
            'budget', 'budget_type', 'budget_optimization', 'budget_remaining',
            'start_date', 'end_date', 'schedule_start_time', 'schedule_end_time',
            'schedule_days', 'timezone',
            'user', 'user_email', 'meta_account', 'meta_account_name', 'meta_account_id',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'campaign_id', 'user', 'meta_account', 'budget_remaining', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        """キャンペーン作成時にcampaign_idを自動生成"""
        import uuid
        validated_data['campaign_id'] = f"camp_{uuid.uuid4().hex[:12]}"
        return super().create(validated_data)


class CampaignListSerializer(serializers.ModelSerializer):
    """キャンペーン一覧用の簡易シリアライザー"""
    class Meta:
        model = Campaign
        fields = [
            'id', 'campaign_id', 'name', 'objective', 'status',
            'budget', 'budget_type', 'start_date', 'end_date'
        ]


class AdSetSerializer(serializers.ModelSerializer):
    """広告セットシリアライザー"""
    campaign_name = serializers.ReadOnlyField(source='campaign.name')
    
    class Meta:
        model = AdSet
        fields = [
            'id', 'adset_id', 'name', 'status',
            'budget', 'budget_type',
            'bid_strategy', 'bid_amount', 'optimization_goal',
            'targeting', 'placement_type', 'placements',
            'start_time', 'end_time', 'delivery_type',
            'campaign', 'campaign_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'adset_id', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        """広告セット作成時にadset_idを自動生成"""
        import uuid
        import time
        
        # より確実にユニークなIDを生成
        timestamp = str(int(time.time() * 1000))
        unique_id = uuid.uuid4().hex[:8]
        validated_data['adset_id'] = f"adset_{timestamp}_{unique_id}"
        return super().create(validated_data)


class AdSerializer(serializers.ModelSerializer):
    """広告シリアライザー"""
    adset_name = serializers.ReadOnlyField(source='adset.name')
    
    class Meta:
        model = Ad
        fields = [
            'id', 'ad_id', 'name', 'status',
            'creative_type', 'headline', 'description',
            'link_url', 'display_link', 'cta_type',
            'creative',
            'adset', 'adset_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'ad_id', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        """広告作成時にad_idを自動生成"""
        import uuid
        import time
        
        # より確実にユニークなIDを生成
        timestamp = str(int(time.time() * 1000))
        unique_id = uuid.uuid4().hex[:8]
        validated_data['ad_id'] = f"ad_{timestamp}_{unique_id}"
        return super().create(validated_data)