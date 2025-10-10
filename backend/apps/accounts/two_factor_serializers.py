"""
二要素認証(2FA)関連のシリアライザ
"""
from rest_framework import serializers
from .models import User


class TwoFactorEnableSerializer(serializers.Serializer):
    """2FA有効化リクエスト"""
    password = serializers.CharField(write_only=True, required=True)


class TwoFactorVerifySerializer(serializers.Serializer):
    """2FA検証リクエスト"""
    token = serializers.CharField(required=True, min_length=6, max_length=6)


class TwoFactorDisableSerializer(serializers.Serializer):
    """2FA無効化リクエスト"""
    password = serializers.CharField(write_only=True, required=True)
    token = serializers.CharField(required=True, min_length=6, max_length=6)


class BackupCodeVerifySerializer(serializers.Serializer):
    """バックアップコード検証リクエスト"""
    backup_code = serializers.CharField(required=True)

