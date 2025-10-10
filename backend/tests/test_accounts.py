"""
認証API（ユーザー登録・ログイン・ログアウト）のテスト
"""
import pytest
from django.urls import reverse
from rest_framework import status
from apps.accounts.models import User


@pytest.mark.django_db
class TestUserRegistration:
    """ユーザー登録のテスト"""
    
    def test_user_registration_success(self, api_client):
        """正常なユーザー登録テスト"""
        url = reverse('accounts:register')
        data = {
            'email': 'newuser@example.com',
            'password': 'securepass123',
            'username': 'newuser',
            'first_name': 'New',
            'last_name': 'User'
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert 'access' in response.data
        assert 'refresh' in response.data
        assert User.objects.filter(email='newuser@example.com').exists()
    
    def test_user_registration_duplicate_email(self, api_client, user):
        """重複メールアドレスでの登録エラーテスト"""
        url = reverse('accounts:register')
        data = {
            'email': user.email,
            'password': 'securepass123',
            'username': 'anotheruser',
            'first_name': 'Another',
            'last_name': 'User'
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_user_registration_weak_password(self, api_client):
        """脆弱なパスワードでの登録エラーテスト"""
        url = reverse('accounts:register')
        data = {
            'email': 'newuser@example.com',
            'password': '123',  # 短すぎるパスワード
            'username': 'newuser',
            'first_name': 'New',
            'last_name': 'User'
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_user_registration_missing_required_fields(self, api_client):
        """必須フィールド欠落時のエラーテスト"""
        url = reverse('accounts:register')
        data = {
            'email': 'newuser@example.com',
            # passwordが欠落
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestUserLogin:
    """ユーザーログインのテスト"""
    
    def test_login_success(self, api_client, user):
        """正常なログインテスト"""
        url = reverse('accounts:login')
        data = {
            'email': 'test@example.com',
            'password': 'testpass123'
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data
    
    def test_login_invalid_credentials(self, api_client, user):
        """間違った認証情報でのログインエラーテスト"""
        url = reverse('accounts:login')
        data = {
            'email': 'test@example.com',
            'password': 'wrongpassword'
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_login_nonexistent_user(self, api_client):
        """存在しないユーザーでのログインエラーテスト"""
        url = reverse('accounts:login')
        data = {
            'email': 'nonexistent@example.com',
            'password': 'somepassword'
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_login_missing_fields(self, api_client):
        """必須フィールド欠落時のエラーテスト"""
        url = reverse('accounts:login')
        data = {
            'email': 'test@example.com'
            # passwordが欠落
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestUserProfile:
    """ユーザープロフィールのテスト"""
    
    def test_get_current_user_profile(self, authenticated_client, user):
        """現在のユーザー情報取得テスト"""
        url = reverse('accounts:user-me')
        
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['email'] == user.email
        assert response.data['username'] == user.username
    
    def test_get_profile_unauthenticated(self, api_client):
        """未認証でのプロフィール取得エラーテスト"""
        url = reverse('accounts:user-me')
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_update_user_profile(self, authenticated_client, user):
        """ユーザープロフィール更新テスト"""
        url = reverse('accounts:user-update-profile')
        data = {
            'first_name': 'Updated',
            'last_name': 'Name'
        }
        
        response = authenticated_client.put(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.first_name == 'Updated'
        assert user.last_name == 'Name'


@pytest.mark.django_db
class TestPasswordChange:
    """パスワード変更のテスト"""
    
    def test_change_password_success(self, authenticated_client, user):
        """正常なパスワード変更テスト"""
        url = reverse('accounts:user-change-password')
        data = {
            'old_password': 'testpass123',
            'new_password': 'newsecurepass456'
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.check_password('newsecurepass456')
    
    def test_change_password_wrong_old_password(self, authenticated_client, user):
        """間違った旧パスワードでのエラーテスト"""
        url = reverse('accounts:user-change-password')
        data = {
            'old_password': 'wrongpassword',
            'new_password': 'newsecurepass456'
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_change_password_weak_new_password(self, authenticated_client, user):
        """脆弱な新パスワードでのエラーテスト"""
        url = reverse('accounts:user-change-password')
        data = {
            'old_password': 'testpass123',
            'new_password': '123'  # 短すぎるパスワード
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestTokenRefresh:
    """トークンリフレッシュのテスト"""
    
    def test_token_refresh_success(self, api_client, user):
        """正常なトークンリフレッシュテスト"""
        # まずログインしてリフレッシュトークンを取得
        login_url = reverse('accounts:login')
        login_data = {
            'email': 'test@example.com',
            'password': 'testpass123'
        }
        login_response = api_client.post(login_url, login_data, format='json')
        refresh_token = login_response.data['refresh']
        
        # リフレッシュトークンで新しいアクセストークンを取得
        refresh_url = reverse('accounts:token-refresh')
        refresh_data = {'refresh': refresh_token}
        
        response = api_client.post(refresh_url, refresh_data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
    
    def test_token_refresh_invalid_token(self, api_client):
        """無効なトークンでのリフレッシュエラーテスト"""
        refresh_url = reverse('accounts:token-refresh')
        refresh_data = {'refresh': 'invalid_token'}
        
        response = api_client.post(refresh_url, refresh_data, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

