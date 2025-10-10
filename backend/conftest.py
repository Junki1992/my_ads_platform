import pytest
from rest_framework.test import APIClient
from apps.accounts.models import User


@pytest.fixture
def api_client():
    """APIクライアントのフィクスチャ"""
    return APIClient()


@pytest.fixture
def user(db):
    """テストユーザーのフィクスチャ"""
    return User.objects.create_user(
        email='test@example.com',
        password='testpass123',
        username='testuser',
        first_name='Test',
        last_name='User'
    )


@pytest.fixture
def authenticated_client(api_client, user):
    """認証済みクライアントのフィクスチャ"""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def admin_user(db):
    """管理者ユーザーのフィクスチャ"""
    return User.objects.create_superuser(
        email='admin@example.com',
        password='adminpass123',
        username='admin'
    )


@pytest.fixture
def authenticated_admin_client(api_client, admin_user):
    """認証済み管理者クライアントのフィクスチャ"""
    api_client.force_authenticate(user=admin_user)
    return api_client

