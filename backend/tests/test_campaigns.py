"""
キャンペーン管理APIのテスト
"""
import pytest
from django.urls import reverse
from rest_framework import status
from apps.campaigns.models import Campaign, AdSet, Ad


@pytest.fixture
def campaign(user):
    """テストキャンペーンのフィクスチャ"""
    return Campaign.objects.create(
        name='Test Campaign',
        objective='OUTCOME_TRAFFIC',
        status='ACTIVE',
        user=user,
        account_id='act_123456789'
    )


@pytest.fixture
def adset(campaign):
    """テストアドセットのフィクスチャ"""
    return AdSet.objects.create(
        campaign=campaign,
        name='Test AdSet',
        status='ACTIVE',
        bid_strategy='LOWEST_COST_WITHOUT_CAP',
        daily_budget=1000
    )


@pytest.mark.django_db
class TestCampaignAPI:
    """キャンペーンAPIのテスト"""
    
    def test_list_campaigns(self, authenticated_client, campaign):
        """キャンペーン一覧取得テスト"""
        url = reverse('campaigns:campaign-list')
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) > 0
    
    def test_create_campaign(self, authenticated_client):
        """キャンペーン作成テスト"""
        url = reverse('campaigns:campaign-list')
        data = {
            'name': 'New Campaign',
            'objective': 'OUTCOME_TRAFFIC',
            'status': 'ACTIVE',
            'account_id': 'act_123456789'
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert Campaign.objects.filter(name='New Campaign').exists()
    
    def test_get_campaign_detail(self, authenticated_client, campaign):
        """キャンペーン詳細取得テスト"""
        url = reverse('campaigns:campaign-detail', kwargs={'pk': campaign.pk})
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == campaign.name
    
    def test_update_campaign(self, authenticated_client, campaign):
        """キャンペーン更新テスト"""
        url = reverse('campaigns:campaign-detail', kwargs={'pk': campaign.pk})
        data = {'name': 'Updated Campaign Name'}
        
        response = authenticated_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        campaign.refresh_from_db()
        assert campaign.name == 'Updated Campaign Name'
    
    def test_delete_campaign(self, authenticated_client, campaign):
        """キャンペーン削除テスト"""
        url = reverse('campaigns:campaign-detail', kwargs={'pk': campaign.pk})
        
        response = authenticated_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Campaign.objects.filter(pk=campaign.pk).exists()
    
    def test_list_campaigns_unauthenticated(self, api_client):
        """未認証でのキャンペーン一覧取得エラーテスト"""
        url = reverse('campaigns:campaign-list')
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_create_campaign_unauthorized_user(self, authenticated_client, campaign, user):
        """他ユーザーのキャンペーン編集エラーテスト"""
        # 別のユーザーのキャンペーンを作成
        from apps.accounts.models import User
        other_user = User.objects.create_user(
            email='other@example.com',
            password='otherpass123',
            username='otheruser'
        )
        other_campaign = Campaign.objects.create(
            name='Other Campaign',
            objective='OUTCOME_TRAFFIC',
            status='ACTIVE',
            user=other_user,
            account_id='act_987654321'
        )
        
        url = reverse('campaigns:campaign-detail', kwargs={'pk': other_campaign.pk})
        data = {'name': 'Hacked Campaign'}
        
        response = authenticated_client.patch(url, data, format='json')
        
        # 404または403が返される（実装による）
        assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN]


@pytest.mark.django_db
class TestAdSetAPI:
    """アドセットAPIのテスト"""
    
    def test_list_adsets(self, authenticated_client, adset):
        """アドセット一覧取得テスト"""
        url = reverse('campaigns:adset-list')
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) > 0
    
    def test_create_adset(self, authenticated_client, campaign):
        """アドセット作成テスト"""
        url = reverse('campaigns:adset-list')
        data = {
            'campaign': campaign.id,
            'name': 'New AdSet',
            'status': 'ACTIVE',
            'bid_strategy': 'LOWEST_COST_WITHOUT_CAP',
            'daily_budget': 2000
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert AdSet.objects.filter(name='New AdSet').exists()
    
    def test_update_adset_budget(self, authenticated_client, adset):
        """アドセット予算更新テスト"""
        url = reverse('campaigns:adset-detail', kwargs={'pk': adset.pk})
        data = {'daily_budget': 5000}
        
        response = authenticated_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        adset.refresh_from_db()
        assert adset.daily_budget == 5000


@pytest.mark.django_db
class TestBulkOperations:
    """一括操作のテスト"""
    
    def test_bulk_pause_campaigns(self, authenticated_client, user):
        """複数キャンペーンの一括停止テスト"""
        # 複数のキャンペーンを作成
        campaigns = [
            Campaign.objects.create(
                name=f'Campaign {i}',
                objective='OUTCOME_TRAFFIC',
                status='ACTIVE',
                user=user,
                account_id='act_123456789'
            )
            for i in range(3)
        ]
        
        url = reverse('campaigns:campaign-bulk-update-status')
        data = {
            'campaign_ids': [c.id for c in campaigns],
            'status': 'PAUSED'
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        
        # すべてのキャンペーンが停止されていることを確認
        for campaign in campaigns:
            campaign.refresh_from_db()
            assert campaign.status == 'PAUSED'

