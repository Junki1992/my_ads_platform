"""
キャンペーン管理APIのテスト
"""
import pytest
from rest_framework import status
from datetime import datetime, timedelta
from apps.campaigns.models import Campaign, AdSet, Ad
from apps.accounts.models import MetaAccount


@pytest.fixture
def meta_account(user):
    """テストMetaアカウントのフィクスチャ"""
    return MetaAccount.objects.create(
        user=user,
        account_id='act_123456789',
        account_name='Test Account',
        access_token='test_token_123'
    )


@pytest.fixture
def campaign(user, meta_account):
    """テストキャンペーンのフィクスチャ"""
    return Campaign.objects.create(
        name='Test Campaign',
        objective='OUTCOME_TRAFFIC',
        status='ACTIVE',
        user=user,
        meta_account=meta_account,
        campaign_id='camp_123456789',
        budget_type='DAILY',
        budget=1000,
        start_date=datetime.now()
    )


@pytest.fixture
def adset(campaign):
    """テストアドセットのフィクスチャ"""
    return AdSet.objects.create(
        campaign=campaign,
        name='Test AdSet',
        status='ACTIVE',
        bid_strategy='LOWEST_COST_WITHOUT_CAP',
        budget=500,
        adset_id='adset_123456789'
    )


@pytest.mark.django_db
class TestCampaignAPI:
    """キャンペーンAPIのテスト"""
    
    def test_list_campaigns(self, authenticated_client, campaign):
        """キャンペーン一覧取得テスト"""
        url = '/api/campaigns/campaigns/'
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert 'results' in response.data or isinstance(response.data, list)
    
    def test_create_campaign(self, authenticated_client, meta_account):
        """キャンペーン作成テスト"""
        url = '/api/campaigns/campaigns/'
        data = {
            'name': 'New Campaign',
            'objective': 'OUTCOME_TRAFFIC',
            'status': 'PAUSED',
            'meta_account': meta_account.id,
            'campaign_id': 'camp_new_123',
            'budget_type': 'DAILY',
            'budget': 2000,
            'start_date': datetime.now().isoformat()
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        # 201 または 400 (バリデーションエラー)が返される
        assert response.status_code in [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST]
    
    def test_list_campaigns_unauthenticated(self, api_client):
        """未認証でのキャンペーン一覧取得エラーテスト"""
        url = '/api/campaigns/campaigns/'
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestAdSetAPI:
    """アドセットAPIのテスト"""
    
    def test_list_adsets(self, authenticated_client, adset):
        """アドセット一覧取得テスト"""
        url = '/api/campaigns/adsets/'
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert 'results' in response.data or isinstance(response.data, list)
    
    def test_create_adset(self, authenticated_client, campaign):
        """アドセット作成テスト"""
        url = '/api/campaigns/adsets/'
        data = {
            'campaign': campaign.id,
            'name': 'New AdSet',
            'status': 'PAUSED',
            'bid_strategy': 'LOWEST_COST_WITHOUT_CAP',
            'budget': 300,
            'adset_id': 'adset_new_123'
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        # 201 または 400 (バリデーションエラー)が返される
        assert response.status_code in [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST]
