from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db import transaction
import logging
import requests

from .models import User, MetaAccount
from .serializers import (
    UserSerializer,
    UserRegisterSerializer,
    UserLoginSerializer,
    ChangePasswordSerializer,
    MetaAccountSerializer
)
from .two_factor import TwoFactorAuthService
from .two_factor_serializers import (
    TwoFactorEnableSerializer,
    TwoFactorVerifySerializer,
    TwoFactorDisableSerializer,
    BackupCodeVerifySerializer
)

logger = logging.getLogger(__name__)


class AuthViewSet(viewsets.GenericViewSet):
    """認証関連のViewSet"""
    permission_classes = [permissions.AllowAny]
    serializer_class = UserSerializer
    
    @action(detail=False, methods=['post'])
    def register(self, request):
        """ユーザー登録"""
        serializer = UserRegisterSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                with transaction.atomic():
                    user = serializer.save()
                    
                    # JWTトークンの生成
                    refresh = RefreshToken.for_user(user)
                    
                    logger.info(f"New user registered: {user.email}")
                    
                    return Response({
                        'user': UserSerializer(user).data,
                        'tokens': {
                            'refresh': str(refresh),
                            'access': str(refresh.access_token),
                        }
                    }, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"User registration failed: {str(e)}")
                return Response({
                    'error': 'Registration failed. Please try again.'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def login(self, request):
        """ログイン"""
        serializer = UserLoginSerializer(data=request.data)
        
        if serializer.is_valid():
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']
            two_factor_token = request.data.get('two_factor_token')  # 2FAトークン（オプション）
            backup_code = request.data.get('backup_code')  # バックアップコード（オプション）
            
            # ユーザー認証
            user = authenticate(request, username=email, password=password)
            
            if user is not None:
                # 2FAが有効かチェック
                if user.two_factor_enabled:
                    # バックアップコードが提供されている場合
                    if backup_code:
                        if TwoFactorAuthService.verify_backup_code(user, backup_code):
                            # バックアップコード検証成功 - トークンを発行
                            refresh = RefreshToken.for_user(user)
                            logger.info(f"User logged in with backup code: {user.email}")
                            
                            return Response({
                                'user': UserSerializer(user).data,
                                'tokens': {
                                    'refresh': str(refresh),
                                    'access': str(refresh.access_token),
                                }
                            }, status=status.HTTP_200_OK)
                        else:
                            return Response({
                                'error': 'Invalid backup code'
                            }, status=status.HTTP_401_UNAUTHORIZED)
                    
                    # 2FAトークンが提供されている場合、検証
                    elif two_factor_token:
                        # トークンを検証
                        if TwoFactorAuthService.verify_token(user.two_factor_secret, two_factor_token):
                            # 検証成功 - トークンを発行
                            refresh = RefreshToken.for_user(user)
                            logger.info(f"User logged in with 2FA: {user.email}")
                            
                            return Response({
                                'user': UserSerializer(user).data,
                                'tokens': {
                                    'refresh': str(refresh),
                                    'access': str(refresh.access_token),
                                }
                            }, status=status.HTTP_200_OK)
                        else:
                            return Response({
                                'error': 'Invalid 2FA token'
                            }, status=status.HTTP_401_UNAUTHORIZED)
                    else:
                        # 2FAトークンが提供されていない - 2FAが必要であることを通知
                        return Response({
                            'requires_2fa': True,
                            'message': '2段階認証が必要です'
                        }, status=status.HTTP_202_ACCEPTED)
                
                # 2FAが無効 - 通常のログイン
                refresh = RefreshToken.for_user(user)
                logger.info(f"User logged in: {user.email}")
                
                return Response({
                    'user': UserSerializer(user).data,
                    'tokens': {
                        'refresh': str(refresh),
                        'access': str(refresh.access_token),
                    }
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'Invalid email or password'
                }, status=status.HTTP_401_UNAUTHORIZED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def logout(self, request):
        """ログアウト"""
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            logger.info(f"User logged out: {request.user.email}")
            
            return Response({
                'message': 'Successfully logged out'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Logout failed: {str(e)}")
            return Response({
                'error': 'Logout failed'
            }, status=status.HTTP_400_BAD_REQUEST)


class UserViewSet(viewsets.ModelViewSet):
    """ユーザー管理ViewSet"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """自分のユーザー情報のみ取得可能"""
        if self.request.user.is_staff:
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """現在のユーザー情報を取得"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['put', 'patch'])
    def update_profile(self, request):
        """プロフィール更新"""
        user = request.user
        serializer = self.get_serializer(user, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            logger.info(f"Profile updated: {user.email}")
            return Response(serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """パスワード変更"""
        user = request.user
        serializer = ChangePasswordSerializer(data=request.data)
        
        if serializer.is_valid():
            # 旧パスワードの確認
            if not user.check_password(serializer.validated_data['old_password']):
                return Response({
                    'old_password': ['Wrong password']
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 新しいパスワードを設定
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            logger.info(f"Password changed: {user.email}")
            
            return Response({
                'message': 'Password changed successfully'
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def enable_2fa(self, request):
        """二要素認証を有効化"""
        user = request.user
        serializer = TwoFactorEnableSerializer(data=request.data)
        
        if serializer.is_valid():
            # パスワード確認
            if not user.check_password(serializer.validated_data['password']):
                return Response({
                    'error': 'Invalid password'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # すでに有効化されている場合
            if user.two_factor_enabled:
                return Response({
                    'error': '2FA is already enabled'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 2FAを有効化
            result = TwoFactorAuthService.enable_2fa(user)
            
            logger.info(f"2FA enabled for user: {user.email}")
            
            return Response({
                'message': '2FA enabled successfully',
                'qr_code': result['qr_code'],
                'backup_codes': result['backup_codes']
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def verify_2fa(self, request):
        """二要素認証トークンを検証"""
        user = request.user
        serializer = TwoFactorVerifySerializer(data=request.data)
        
        if serializer.is_valid():
            if not user.two_factor_enabled:
                return Response({
                    'error': '2FA is not enabled'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            token = serializer.validated_data['token']
            
            # トークンを検証
            if TwoFactorAuthService.verify_token(user.two_factor_secret, token):
                return Response({
                    'message': 'Token verified successfully',
                    'valid': True
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'Invalid token',
                    'valid': False
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def verify_backup_code(self, request):
        """バックアップコードを検証"""
        user = request.user
        serializer = BackupCodeVerifySerializer(data=request.data)
        
        if serializer.is_valid():
            if not user.two_factor_enabled:
                return Response({
                    'error': '2FA is not enabled'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            backup_code = serializer.validated_data['backup_code']
            
            # バックアップコードを検証
            if TwoFactorAuthService.verify_backup_code(user, backup_code):
                logger.info(f"Backup code used by user: {user.email}")
                return Response({
                    'message': 'Backup code verified successfully',
                    'valid': True
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'Invalid backup code',
                    'valid': False
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def disable_2fa(self, request):
        """二要素認証を無効化"""
        user = request.user
        serializer = TwoFactorDisableSerializer(data=request.data)
        
        if serializer.is_valid():
            # パスワード確認
            if not user.check_password(serializer.validated_data['password']):
                return Response({
                    'error': 'Invalid password'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 2FAが有効でない場合
            if not user.two_factor_enabled:
                return Response({
                    'error': '2FA is not enabled'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # トークン確認
            token = serializer.validated_data['token']
            if not TwoFactorAuthService.verify_token(user.two_factor_secret, token):
                return Response({
                    'error': 'Invalid token'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 2FAを無効化
            TwoFactorAuthService.disable_2fa(user)
            
            logger.info(f"2FA disabled for user: {user.email}")
            
            return Response({
                'message': '2FA disabled successfully'
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def get_2fa_status(self, request):
        """二要素認証の状態を取得"""
        user = request.user
        return Response({
            'enabled': user.two_factor_enabled,
            'has_backup_codes': bool(user.backup_codes)
        }, status=status.HTTP_200_OK)


class MetaAccountViewSet(viewsets.ModelViewSet):
    """Meta アカウント管理ViewSet"""
    serializer_class = MetaAccountSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """自分のMetaアカウントのみ取得可能"""
        return MetaAccount.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """Metaアカウント作成時にユーザーを自動設定"""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def exchange_token(self, request):
        """短期トークンを長期トークンに変換"""
        short_token = request.data.get('short_token')
        app_id = request.data.get('app_id')
        app_secret = request.data.get('app_secret')
        
        if not all([short_token, app_id, app_secret]):
            return Response({
                'error': 'short_token, app_id, app_secret are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Meta APIで長期トークンを取得
            url = 'https://graph.facebook.com/v18.0/oauth/access_token'
            params = {
                'grant_type': 'fb_exchange_token',
                'client_id': app_id,
                'client_secret': app_secret,
                'fb_exchange_token': short_token
            }
            
            response = requests.get(url, params=params)
            data = response.json()
            
            if 'access_token' in data:
                logger.info(f"Long-lived token generated for user: {request.user.email}")
                return Response({
                    'access_token': data['access_token'],
                    'expires_in': data.get('expires_in', 5184000)  # デフォルト60日
                }, status=status.HTTP_200_OK)
            else:
                error_message = data.get('error', {}).get('message', 'Token exchange failed')
                logger.error(f"Token exchange failed: {error_message}")
                return Response({
                    'error': error_message
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Token exchange error: {str(e)}")
            return Response({
                'error': f'Token exchange failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def validate_token(self, request):
        """アクセストークンの有効性を検証"""
        access_token = request.data.get('access_token')
        
        if not access_token:
            return Response({
                'error': 'access_token is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Meta APIでトークンを検証
            url = 'https://graph.facebook.com/v18.0/me'
            params = {
                'access_token': access_token,
                'fields': 'id,name'
            }
            
            response = requests.get(url, params=params)
            data = response.json()
            
            if 'id' in data:
                return Response({
                    'valid': True,
                    'user_id': data['id'],
                    'user_name': data.get('name')
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'valid': False,
                    'error': data.get('error', {}).get('message', 'Invalid token')
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            return Response({
                'valid': False,
                'error': f'Validation failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def fetch_accounts(self, request):
        """アクセストークンから広告アカウント一覧と有効期限を取得"""
        access_token = request.data.get('access_token')
        
        if not access_token:
            return Response({
                'error': 'access_token is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # トークンのデバッグ情報（有効期限含む）を取得
            debug_url = 'https://graph.facebook.com/v18.0/debug_token'
            debug_params = {
                'input_token': access_token,
                'access_token': access_token
            }
            debug_response = requests.get(debug_url, params=debug_params)
            debug_data = debug_response.json()
            
            token_info = {}
            if 'data' in debug_data:
                token_data = debug_data['data']
                token_info = {
                    'expires_at': token_data.get('expires_at', 0),
                    'is_valid': token_data.get('is_valid', False),
                    'issued_at': token_data.get('issued_at', 0),
                    'data_access_expires_at': token_data.get('data_access_expires_at', 0)
                }
            
            # Meta APIでユーザーのアカウント一覧を取得
            url = 'https://graph.facebook.com/v18.0/me/adaccounts'
            params = {
                'access_token': access_token,
                'fields': 'id,name,account_id,currency,timezone_name,account_status'
            }
            
            response = requests.get(url, params=params)
            data = response.json()
            
            if 'data' in data:
                accounts = []
                for account in data['data']:
                    accounts.append({
                        'id': account.get('id'),
                        'account_id': account.get('account_id'),
                        'name': account.get('name'),
                        'currency': account.get('currency'),
                        'timezone': account.get('timezone_name'),
                        'status': account.get('account_status')
                    })
                
                logger.info(f"Fetched {len(accounts)} ad accounts for user: {request.user.email}")
                return Response({
                    'accounts': accounts,
                    'token_info': token_info
                }, status=status.HTTP_200_OK)
            else:
                error_message = data.get('error', {}).get('message', 'Failed to fetch accounts')
                logger.error(f"Fetch accounts failed: {error_message}")
                return Response({
                    'error': error_message
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Fetch accounts error: {str(e)}")
            return Response({
                'error': f'Failed to fetch accounts: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
