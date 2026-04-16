from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db import transaction
from django.shortcuts import redirect
from django.conf import settings
import logging
import requests

from .models import User, MetaAccount, BoxAccount
from .serializers import (
    UserSerializer,
    UserRegisterSerializer,
    UserLoginSerializer,
    ChangePasswordSerializer,
    MetaAccountSerializer,
    BoxAccountSerializer
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
                # 認証失敗
                logger.warning(f"Login failed for email: {email} - Invalid credentials")
                return Response({
                    'error': 'メールアドレスまたはパスワードが正しくありません',
                    'detail': 'Invalid email or password'
                }, status=status.HTTP_401_UNAUTHORIZED)
        
        # バリデーションエラー
        logger.warning(f"Login validation failed: {serializer.errors}")
        return Response({
            'error': '入力データが正しくありません',
            'detail': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
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
    
    def destroy(self, request, *args, **kwargs):
        """Metaアカウント削除（パスワード確認必須）"""
        password = request.data.get('password')
        
        if not password:
            return Response({
                'error': 'パスワードの入力が必要です'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # パスワード検証
        if not request.user.check_password(password):
            return Response({
                'error': 'パスワードが正しくありません'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # パスワード検証成功後、削除を実行
        instance = self.get_object()
        account_name = instance.account_name
        self.perform_destroy(instance)
        
        logger.info(f"Meta account deleted: {account_name} (user: {request.user.email})")
        
        return Response({
            'message': f'{account_name} を削除しました'
        }, status=status.HTTP_200_OK)
    
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

    @action(detail=False, methods=['get'])
    def oauth_authorize(self, request):
        """Meta OAuth認証URLを生成"""
        from django.conf import settings
        import secrets
        import jwt
        from datetime import datetime, timedelta
        
        # ランダムなstateパラメータを生成（CSRF攻撃防止）
        state = secrets.token_urlsafe(32)
        
        # JWTトークンでstateをエンコード（セッションの代わり）
        jwt_secret = getattr(settings, 'SECRET_KEY', 'fallback-secret')
        payload = {
            'state': state,
            'user_id': request.user.id,
            'exp': datetime.utcnow() + timedelta(minutes=10)  # 10分で有効期限切れ
        }
        encoded_state = jwt.encode(payload, jwt_secret, algorithm='HS256')
        
        # プラットフォーム統一のMeta App IDを使用
        app_id = getattr(settings, 'META_APP_ID', None)
        
        if not app_id:
            logger.error("META_APP_ID is not configured in settings")
            return Response({
                'error': 'Meta App IDが設定されていません。管理者に連絡してください。'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        redirect_uri = f"{request.scheme}://{request.get_host()}/api/accounts/meta-accounts/oauth_callback/"
        scope = 'ads_management,ads_read,business_management'
        
        auth_url = (
            f"https://www.facebook.com/v18.0/dialog/oauth?"
            f"client_id={app_id}&"
            f"redirect_uri={redirect_uri}&"
            f"scope={scope}&"
            f"state={encoded_state}&"
            f"response_type=code"
        )
        
        logger.info(f"Generated OAuth URL for user: {request.user.email}")
        return Response({
            'auth_url': auth_url
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['get'])
    def oauth_authorize_account(self, request, pk=None):
        """特定のMetaアカウント用OAuth認証URLを生成"""
        from django.conf import settings
        import secrets
        import jwt
        from datetime import datetime, timedelta
        
        # アカウントの存在確認
        try:
            account = self.get_object()
        except MetaAccount.DoesNotExist:
            return Response({
                'error': 'Account not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # ランダムなstateパラメータを生成（CSRF攻撃防止）
        state = secrets.token_urlsafe(32)
        
        # JWTトークンでstateをエンコード（セッションの代わり）
        jwt_secret = getattr(settings, 'SECRET_KEY', 'fallback-secret')
        payload = {
            'state': state,
            'user_id': request.user.id,
            'target_account_id': account.id,  # 対象アカウントIDを保存
            'exp': datetime.utcnow() + timedelta(minutes=10)  # 10分で有効期限切れ
        }
        encoded_state = jwt.encode(payload, jwt_secret, algorithm='HS256')
        
        # Meta OAuth認証URLを構築
        app_id = getattr(settings, 'META_APP_ID', None)
        if not app_id:
            return Response({
                'error': 'META_APP_ID is not configured'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        redirect_uri = f"{request.scheme}://{request.get_host()}/api/accounts/meta-accounts/oauth_callback/"
        scope = 'ads_management,ads_read,business_management'
        
        auth_url = (
            f"https://www.facebook.com/v18.0/dialog/oauth?"
            f"client_id={app_id}&"
            f"redirect_uri={redirect_uri}&"
            f"scope={scope}&"
            f"state={encoded_state}&"
            f"response_type=code"
        )
        
        logger.info(f"Generated OAuth URL for specific account: {account.account_id} (user: {request.user.email})")
        return Response({
            'auth_url': auth_url,
            'account_id': account.account_id,
            'account_name': account.account_name
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], permission_classes=[])
    def oauth_callback(self, request):
        """Meta OAuth認証コールバック処理"""
        from django.conf import settings
        from django.shortcuts import redirect
        from rest_framework.permissions import AllowAny
        import jwt
        
        # フロントエンドURLを取得
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        
        code = request.GET.get('code')
        state = request.GET.get('state')
        error = request.GET.get('error')
        
        # エラーハンドリング
        if error:
            logger.error(f"OAuth error: {error}")
            return redirect(f"{frontend_url}/settings?error=oauth_error&message={error}")
        
        # stateパラメータの検証（JWTトークンから復号化）
        try:
            jwt_secret = getattr(settings, 'SECRET_KEY', 'fallback-secret')
            decoded_payload = jwt.decode(state, jwt_secret, algorithms=['HS256'])
            user_id = decoded_payload.get('user_id')
            target_account_id = decoded_payload.get('target_account_id')
            
            # JWTからユーザーを取得
            from .models import User
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                logger.error(f"User not found: {user_id}")
                return redirect(f"{frontend_url}/settings?error=user_not_found")
                
        except jwt.ExpiredSignatureError:
            logger.error("OAuth state token expired")
            return redirect(f"{frontend_url}/settings?error=expired_state")
        except jwt.InvalidTokenError:
            logger.error("Invalid OAuth state token")
            return redirect(f"{frontend_url}/settings?error=invalid_state")
        
        if not code:
            logger.error("No authorization code received")
            return redirect(f"{frontend_url}/settings?error=no_code")
        
        try:
            # プラットフォーム統一のMeta App ID/Secretを使用
            app_id = getattr(settings, 'META_APP_ID', None)
            app_secret = getattr(settings, 'META_APP_SECRET', None)
            
            if not app_id or not app_secret:
                logger.error("META_APP_ID or META_APP_SECRET is not configured in settings")
                return redirect(f"{frontend_url}/settings?error=config_error")
            
            redirect_uri = f"{request.scheme}://{request.get_host()}/api/accounts/meta-accounts/oauth_callback/"
            
            # アクセストークンを取得
            token_url = 'https://graph.facebook.com/v18.0/oauth/access_token'
            token_params = {
                'client_id': app_id,
                'client_secret': app_secret,
                'redirect_uri': redirect_uri,
                'code': code
            }
            
            token_response = requests.get(token_url, params=token_params)
            token_data = token_response.json()
            
            if 'access_token' not in token_data:
                error_message = token_data.get('error', {}).get('message', 'Token exchange failed')
                logger.error(f"Token exchange failed: {error_message}")
                return redirect(f"{frontend_url}/settings?error=token_exchange_failed&message={error_message}")
            
            access_token = token_data['access_token']
            
            # 長期トークンに変換
            long_token_url = 'https://graph.facebook.com/v18.0/oauth/access_token'
            long_token_params = {
                'grant_type': 'fb_exchange_token',
                'client_id': app_id,
                'client_secret': app_secret,
                'fb_exchange_token': access_token
            }
            
            long_token_response = requests.get(long_token_url, params=long_token_params)
            long_token_data = long_token_response.json()
            
            if 'access_token' not in long_token_data:
                error_message = long_token_data.get('error', {}).get('message', 'Long token exchange failed')
                logger.error(f"Long token exchange failed: {error_message}")
                return redirect(f"{frontend_url}/settings?error=long_token_failed&message={error_message}")
            
            long_access_token = long_token_data['access_token']
            
            # ユーザー情報を取得
            user_url = 'https://graph.facebook.com/v18.0/me'
            user_params = {
                'access_token': long_access_token,
                'fields': 'id,name'
            }
            
            user_response = requests.get(user_url, params=user_params)
            user_data = user_response.json()
            
            if 'id' not in user_data:
                logger.error("Failed to get user info from Meta")
                return redirect(f"{frontend_url}/settings?error=user_info_failed")
            
            # 広告アカウント一覧を取得
            accounts_url = 'https://graph.facebook.com/v18.0/me/adaccounts'
            accounts_params = {
                'access_token': long_access_token,
                'fields': 'id,name,account_id,currency,timezone_name,account_status'
            }
            
            accounts_response = requests.get(accounts_url, params=accounts_params)
            accounts_data = accounts_response.json()
            
            # 特定のアカウントを更新するか、全アカウントを保存するかを判定
            saved_accounts = []
            
            if target_account_id:
                # 特定のアカウントのトークンを更新
                try:
                    target_account = MetaAccount.objects.get(
                        id=target_account_id,
                        user=user
                    )
                    target_account.access_token = long_access_token
                    target_account.is_active = True
                    target_account.save()
                    saved_accounts.append(target_account)
                    
                    logger.info(f"Updated token for specific account: {target_account.account_id}")
                except MetaAccount.DoesNotExist:
                    logger.error(f"Target account not found: {target_account_id}")
                    return redirect(f"{frontend_url}/settings?error=account_not_found")
            else:
                # 全アカウントを保存（従来の動作）
                if 'data' in accounts_data:
                    for account in accounts_data['data']:
                        # 既存のアカウントかチェック
                        existing_account = MetaAccount.objects.filter(
                            user=user,
                            account_id=account.get('account_id')
                        ).first()
                        
                        if existing_account:
                            # 既存アカウントのトークンを更新
                            existing_account.access_token = long_access_token
                            existing_account.account_name = account.get('name', '')
                            existing_account.is_active = True
                            existing_account.save()
                            saved_accounts.append(existing_account)
                        else:
                            # 新しいアカウントを作成
                            new_account = MetaAccount.objects.create(
                                user=user,
                                account_id=account.get('account_id'),
                                account_name=account.get('name', ''),
                                access_token=long_access_token,
                                is_active=True
                            )
                            saved_accounts.append(new_account)
            
            # JWTトークンは自動的に有効期限切れになるため、削除処理は不要
            
            logger.info(f"OAuth authentication successful for user: {user.email}, saved {len(saved_accounts)} accounts")
            
            # 成功ページにリダイレクト
            if target_account_id:
                return redirect(f"{frontend_url}/settings?success=oauth_account_updated&account_id={saved_accounts[0].account_id if saved_accounts else ''}")
            else:
                return redirect(f"{frontend_url}/settings?success=oauth_success&accounts={len(saved_accounts)}")
                
        except Exception as e:
            logger.error(f"OAuth callback error: {str(e)}")
            return redirect(f"{frontend_url}/settings?error=callback_error&message={str(e)}")
    
    @action(detail=False, methods=['post'])
    def create_demo_accounts(self, request):
        """開発用：ダミーのMetaアカウントを作成"""
        import random
        import string
        
        # 既存のアカウント数をチェック
        existing_count = MetaAccount.objects.filter(user=request.user).count()
        if existing_count > 0:
            return Response({
                'error': '既にアカウントが存在します。削除してから再試行してください。'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # ダミーアカウントを作成
        demo_accounts = [
            {
                'account_id': f"act_{''.join(random.choices(string.digits, k=10))}",
                'account_name': 'テスト広告アカウント 1',
                'access_token': f"EAA{''.join(random.choices(string.ascii_letters + string.digits, k=200))}"
            },
            {
                'account_id': f"act_{''.join(random.choices(string.digits, k=10))}",
                'account_name': 'テスト広告アカウント 2',
                'access_token': f"EAA{''.join(random.choices(string.ascii_letters + string.digits, k=200))}"
            }
        ]
        
        created_accounts = []
        for account_data in demo_accounts:
            account = MetaAccount.objects.create(
                user=request.user,
                account_id=account_data['account_id'],
                account_name=account_data['account_name'],
                access_token=account_data['access_token'],
                is_active=True
            )
            created_accounts.append(account)
        
        logger.info(f"Created {len(created_accounts)} demo accounts for user: {request.user.email}")
        
        return Response({
            'message': f'{len(created_accounts)}個のダミーアカウントを作成しました',
            'accounts': len(created_accounts)
        }, status=status.HTTP_201_CREATED)
    
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


class BoxAccountViewSet(viewsets.ModelViewSet):
    """Box アカウント管理ViewSet"""
    serializer_class = BoxAccountSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_permissions(self):
        """oauth_callbackとthumbnailは認証不要（画像タグからのリクエストのため）"""
        if self.action in ['oauth_callback', 'thumbnail']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]
    
    def get_queryset(self):
        """自分のBoxアカウントのみ取得可能"""
        return BoxAccount.objects.filter(user=self.request.user)
    
    def _ensure_box_access_token(self, box_account):
        """必要に応じてBoxアクセストークンを更新"""
        client_id = getattr(settings, 'BOX_CLIENT_ID', None)
        client_secret = getattr(settings, 'BOX_CLIENT_SECRET', None)
        
        if not client_id or not client_secret:
            raise Exception("Boxアプリのクライアント情報が設定されていません")
        
        # アクセストークンが存在し、まだ有効な場合はそのまま返す（有効期限チェックは省略し、常にリフレッシュしてもよい）
        if box_account.access_token and box_account.refresh_token:
            # Box APIにアクセスして401が返るケースがあるため、常にリフレッシュ
            pass
        elif not box_account.refresh_token:
            raise Exception("Boxアカウントにリフレッシュトークンが保存されていません")
        
        token_url = "https://api.box.com/oauth2/token"
        token_data = {
            'grant_type': 'refresh_token',
            'refresh_token': box_account.refresh_token,
            'client_id': client_id,
            'client_secret': client_secret
        }
        
        response = requests.post(token_url, data=token_data)
        data = response.json()
        
        if response.status_code != 200 or 'access_token' not in data:
            error_message = data.get('error_description', data.get('error', 'Token refresh failed'))
            raise Exception(error_message)
        
        box_account.access_token = data['access_token']
        box_account.refresh_token = data.get('refresh_token', box_account.refresh_token)
        box_account.save(update_fields=['access_token', 'refresh_token', 'updated_at'])
        return box_account.access_token
    
    def perform_create(self, serializer):
        """Boxアカウント作成時にユーザーを自動設定"""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def oauth_authorize(self, request):
        """Box OAuth認証URLを生成"""
        from django.conf import settings
        import secrets
        import jwt
        from datetime import datetime, timedelta
        
        # ランダムなstateパラメータを生成（CSRF攻撃防止）
        state = secrets.token_urlsafe(32)
        
        # JWTトークンでstateをエンコード（セッションの代わり）
        jwt_secret = getattr(settings, 'SECRET_KEY', 'fallback-secret')
        payload = {
            'state': state,
            'user_id': request.user.id,
            'exp': datetime.utcnow() + timedelta(minutes=10)  # 10分で有効期限切れ
        }
        encoded_state = jwt.encode(payload, jwt_secret, algorithm='HS256')
        
        # Box App設定を取得
        client_id = getattr(settings, 'BOX_CLIENT_ID', None)
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        
        if not client_id:
            logger.error("BOX_CLIENT_ID is not configured in settings")
            return Response({
                'error': 'Box Client IDが設定されていません。管理者に連絡してください。'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Box OAuth認証URLを生成
        redirect_uri = (
            getattr(settings, 'BOX_REDIRECT_URI', None)
            or f"{request.scheme}://{request.get_host()}/api/accounts/box-accounts/oauth_callback/"
        )
        # URLエンコード
        from urllib.parse import quote
        redirect_uri_encoded = quote(redirect_uri, safe='')
        
        # Box OAuth認証に必要なスコープを指定
        scope = 'root_readwrite'  # ファイル読み書き権限
        
        auth_url = (
            f"https://account.box.com/api/oauth2/authorize?"
            f"response_type=code&"
            f"client_id={client_id}&"
            f"redirect_uri={redirect_uri_encoded}&"
            f"state={encoded_state}&"
            f"scope={scope}"
        )
        
        logger.info(f"Box OAuth authorization URL generated for user: {request.user.email}")
        
        return Response({
            'auth_url': auth_url,
            'state': encoded_state
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def oauth_callback(self, request):
        """Box OAuth認証コールバック"""
        from django.conf import settings
        import jwt
        
        code = request.query_params.get('code')
        state = request.query_params.get('state')
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        
        if not code or not state:
            logger.error("Box OAuth callback missing code or state")
            return redirect(f"{frontend_url}/settings?error=box_oauth_missing_params")
        
        try:
            # JWTトークンからstateを検証
            jwt_secret = getattr(settings, 'SECRET_KEY', 'fallback-secret')
            decoded = jwt.decode(state, jwt_secret, algorithms=['HS256'])
            user_id = decoded.get('user_id')
            
            # ユーザーを取得
            user = User.objects.get(id=user_id)
            
            # Box APIでアクセストークンを取得
            client_id = getattr(settings, 'BOX_CLIENT_ID', None)
            client_secret = getattr(settings, 'BOX_CLIENT_SECRET', None)
            redirect_uri = (
                getattr(settings, 'BOX_REDIRECT_URI', None)
                or f"{request.scheme}://{request.get_host()}/api/accounts/box-accounts/oauth_callback/"
            )
            
            if not client_id or not client_secret:
                logger.error("Box credentials not configured")
                return redirect(f"{frontend_url}/settings?error=box_credentials_not_configured")
            
            # トークン交換
            token_url = "https://api.box.com/oauth2/token"
            token_data = {
                'grant_type': 'authorization_code',
                'code': code,
                'client_id': client_id,
                'client_secret': client_secret,
                'redirect_uri': redirect_uri
            }
            
            token_response = requests.post(token_url, data=token_data)
            token_data_response = token_response.json()
            
            if 'access_token' not in token_data_response:
                error_message = token_data_response.get('error_description', 'Token exchange failed')
                logger.error(f"Box token exchange failed: {error_message}")
                return redirect(f"{frontend_url}/settings?error=box_token_exchange_failed&message={error_message}")
            
            access_token = token_data_response['access_token']
            refresh_token = token_data_response.get('refresh_token', '')
            
            # Box APIでユーザー情報を取得
            user_info_url = "https://api.box.com/2.0/users/me"
            headers = {'Authorization': f'Bearer {access_token}'}
            user_info_response = requests.get(user_info_url, headers=headers)
            user_info = user_info_response.json()
            
            if 'id' not in user_info:
                logger.error("Failed to fetch Box user info")
                return redirect(f"{frontend_url}/settings?error=box_user_info_failed")
            
            # Boxアカウントを保存または更新
            account_id = str(user_info['id'])
            account_name = user_info.get('name', 'Box User')
            
            box_account, created = BoxAccount.objects.update_or_create(
                user=user,
                account_id=account_id,
                defaults={
                    'account_name': account_name,
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'is_active': True
                }
            )
            
            logger.info(f"Box OAuth authentication successful for user: {user.email}, account: {account_name}")
            
            return redirect(f"{frontend_url}/settings?success=box_oauth_success&account_id={box_account.id}")
            
        except jwt.ExpiredSignatureError:
            logger.error("Box OAuth state token expired")
            return redirect(f"{frontend_url}/settings?error=box_oauth_expired")
        except jwt.InvalidTokenError:
            logger.error("Box OAuth invalid state token")
            return redirect(f"{frontend_url}/settings?error=box_oauth_invalid")
        except Exception as e:
            logger.error(f"Box OAuth callback error: {str(e)}")
            return redirect(f"{frontend_url}/settings?error=box_oauth_callback_error&message={str(e)}")
    
    @action(detail=True, methods=['get'])
    def get_access_token(self, request, pk=None):
        """Boxアカウントのアクセストークンを取得（Content Picker用）"""
        box_account = self.get_object()
        try:
            access_token = self._ensure_box_access_token(box_account)
            return Response({
                'access_token': access_token,
                'account_id': box_account.account_id,
                'account_name': box_account.account_name
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed to refresh Box access token: {str(e)}")
            return Response({'error': 'Boxアクセストークンの更新に失敗しました。Boxアカウントを再連携してください。'},
                            status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def list_files(self, request, pk=None):
        """Boxアカウントのファイル一覧を取得"""
        from boxsdk import Client, OAuth2
        from django.core.cache import cache
        from django.utils import timezone
        import json
        
        box_account = self.get_object()
        
        # キャッシュキーを生成（BoxアカウントIDと最終更新日時を含める）
        cache_key = f"box_files_{box_account.id}_{box_account.updated_at.timestamp()}"
        
        # キャッシュから取得を試みる（5分間キャッシュ）
        cached_files = cache.get(cache_key)
        if cached_files is not None:
            logger.info(f"Returning cached file list for Box account {box_account.id} ({len(cached_files)} files)")
            return Response({
                'files': cached_files,
                'total_count': len(cached_files),
                'cached': True
            }, status=status.HTTP_200_OK)
        
        try:
            # アクセストークンを確認・必要に応じて更新
            try:
                self._ensure_box_access_token(box_account)
            except Exception as token_error:
                error_msg = str(token_error)
                logger.error(f"Failed to refresh Box access token for list_files: {error_msg}")
                
                # リフレッシュトークンが期限切れの場合は、再認証が必要
                if 'expired' in error_msg.lower() or 'invalid' in error_msg.lower():
                    logger.error(f"Box refresh token has expired for account {box_account.id}. Re-authentication required.")
                    return Response({
                        'error': 'Boxアカウントの認証が期限切れです。設定画面でBoxアカウントを再連携してください。',
                        'details': 'Refresh token has expired',
                        'requires_reauth': True
                    }, status=status.HTTP_401_UNAUTHORIZED)
                else:
                    return Response({
                        'error': f'Boxアクセストークンの更新に失敗しました: {error_msg}',
                        'details': error_msg
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Box SDKでクライアントを作成
            oauth2 = OAuth2(
                client_id=getattr(settings, 'BOX_CLIENT_ID', ''),
                client_secret=getattr(settings, 'BOX_CLIENT_SECRET', ''),
                access_token=box_account.access_token,
                refresh_token=box_account.refresh_token
            )
            client = Client(oauth2)
            
            # ルートフォルダと1階層のサブフォルダから画像・動画ファイルを取得（すべてのファイルを取得）
            folder_id = '0'  # ルートフォルダ
            files = []
            image_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']
            video_extensions = ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v']
            media_extensions = image_extensions + video_extensions
            
            def process_folder(folder_id, folder_name='root'):
                """フォルダ内の画像・動画ファイルを処理（すべて取得）"""
                try:
                    folder_media_count = 0
                    
                    # Box SDKのget_itemsはイテレータを返すので、全件取得
                    # representationsフィールドを含めて取得（サムネイルURL取得のため）
                    try:
                        items = client.folder(folder_id).get_items(fields=['id', 'name', 'type', 'size', 'modified_at', 'representations'])
                        item_count = 0
                        file_count = 0
                        media_count = 0
                        for item in items:
                            item_count += 1
                            try:
                                if item.type == 'file':
                                    file_count += 1
                                    # 画像・動画ファイルをフィルタリング
                                    file_ext = item.name.split('.')[-1] if '.' in item.name else ''
                                    file_ext_lower = file_ext.lower()
                                    
                                    # デバッグ: 最初の10個のファイル情報をログに記録
                                    if file_count <= 10:
                                        logger.debug(f"File {file_count}: {item.name}, ext: {file_ext_lower}, matches: {file_ext_lower in media_extensions}")
                                    
                                    if file_ext_lower in media_extensions:
                                        media_count += 1
                                        file_size = getattr(item, 'size', 0)
                                        
                                        # サムネイルURLを取得（representationsから直接取得を試みる）
                                        thumbnail_url = None
                                        try:
                                            # representationsフィールドからサムネイルURLを取得
                                            if hasattr(item, 'representations') and item.representations:
                                                representations = item.representations
                                                # サムネイル表現を探す（画像・動画両方に対応）
                                                for rep in representations.get('entries', []):
                                                    if rep.get('status') == 'success':
                                                        rep_type = rep.get('representation', '').lower()
                                                        # サムネイル表現を探す（画像・動画の両方）
                                                        if 'thumbnail' in rep_type or 'jpg_thumb' in rep_type or 'mp4_thumb' in rep_type:
                                                            thumbnail_url = rep.get('content', {}).get('url_template', '').replace('{+asset_path}', '')
                                                            break
                                        except Exception as rep_error:
                                            logger.debug(f"Could not get thumbnail from representations for {item.id}: {str(rep_error)}")
                                        
                                        # representationsから取得できなかった場合は、プロキシエンドポイントを使用
                                        if not thumbnail_url:
                                            thumbnail_url = f"/api/accounts/box-accounts/{box_account.id}/thumbnail/{item.id}/"
                                        
                                        # modified_atの処理（文字列またはdatetimeオブジェクトの両方に対応）
                                        modified_at_str = None
                                        if hasattr(item, 'modified_at') and item.modified_at:
                                            if isinstance(item.modified_at, str):
                                                modified_at_str = item.modified_at
                                            else:
                                                try:
                                                    modified_at_str = item.modified_at.isoformat()
                                                except AttributeError:
                                                    modified_at_str = str(item.modified_at)
                                        
                                        files.append({
                                            'id': item.id,
                                            'name': item.name,
                                            'size': file_size or 0,
                                            'modified_at': modified_at_str,
                                            'download_url': f"/api/accounts/box-accounts/{box_account.id}/download-file/{item.id}/",
                                            'thumbnail_url': thumbnail_url,
                                            'file_type': 'video' if file_ext_lower in video_extensions else 'image'
                                        })
                                        folder_media_count += 1
                            except Exception as item_error:
                                logger.warning(f"Error processing item in {folder_name}: {str(item_error)}")
                                continue
                        
                        # デバッグ情報をログに記録
                        logger.debug(f"Folder {folder_name}: processed {item_count} items ({file_count} files, {media_count} media files)")
                    except Exception as iter_error:
                        logger.warning(f"Error iterating items in {folder_name}: {str(iter_error)}")
                        # フォールバック: limitを指定して取得を試みる
                        try:
                            items = list(client.folder(folder_id).get_items(limit=1000))
                            for item in items:
                                try:
                                    if item.type == 'file':
                                        file_ext = item.name.split('.')[-1] if '.' in item.name else ''
                                        file_ext_lower = file_ext.lower()
                                        if file_ext_lower in media_extensions:
                                            file_size = getattr(item, 'size', 0)
                                            thumbnail_url = f"/api/accounts/box-accounts/{box_account.id}/thumbnail/{item.id}/"
                                            
                                            # modified_atの処理（文字列またはdatetimeオブジェクトの両方に対応）
                                            modified_at_str = None
                                            if hasattr(item, 'modified_at') and item.modified_at:
                                                if isinstance(item.modified_at, str):
                                                    modified_at_str = item.modified_at
                                                else:
                                                    try:
                                                        modified_at_str = item.modified_at.isoformat()
                                                    except AttributeError:
                                                        modified_at_str = str(item.modified_at)
                                            
                                            files.append({
                                                'id': item.id,
                                                'name': item.name,
                                                'size': file_size or 0,
                                                'modified_at': modified_at_str,
                                                'download_url': f"/api/accounts/box-accounts/{box_account.id}/download-file/{item.id}/",
                                                'thumbnail_url': thumbnail_url,
                                                'file_type': 'video' if file_ext_lower in video_extensions else 'image'
                                            })
                                            folder_media_count += 1
                                except:
                                    continue
                        except:
                            pass
                    
                    return folder_media_count
                except Exception as e:
                    logger.warning(f"Error processing folder {folder_name}: {str(e)}")
                    return 0
            
            try:
                # 1. ルートフォルダの画像・動画ファイルを取得（すべて）
                logger.info("Starting to fetch files from root folder...")
                logger.info(f"Box account ID: {box_account.id}, Account name: {box_account.account_name}")
                root_count = process_folder(folder_id, 'root')
                logger.info(f"Found {root_count} media files in root folder (total: {len(files)} files)")
                
                # デバッグ: ルートフォルダの全アイテムを確認
                try:
                    root_items_debug = list(client.folder(folder_id).get_items(limit=100))
                    logger.info(f"Root folder contains {len(root_items_debug)} items (files + folders)")
                    file_count = sum(1 for item in root_items_debug if item.type == 'file')
                    folder_count = sum(1 for item in root_items_debug if item.type == 'folder')
                    logger.info(f"Root folder breakdown: {file_count} files, {folder_count} folders")
                    
                    # 画像ファイルの拡張子を持つファイルを確認
                    image_files_found = []
                    for item in root_items_debug:
                        if item.type == 'file':
                            file_ext = item.name.split('.')[-1] if '.' in item.name else ''
                            file_ext_lower = file_ext.lower()
                            if file_ext_lower in image_extensions:
                                image_files_found.append(item.name)
                    logger.info(f"Image files found in root (by extension): {len(image_files_found)} files")
                    if image_files_found:
                        logger.info(f"Sample image files: {image_files_found[:5]}")
                except Exception as debug_error:
                    logger.warning(f"Debug info collection failed: {str(debug_error)}")
                
                # 2. サブフォルダも検索（すべてのサブフォルダを検索）
                try:
                    logger.info("Starting to search subfolders...")
                    root_items = client.folder(folder_id).get_items()
                    folders_searched = 0
                    total_folders = 0
                    
                    # まずフォルダ数をカウント（進捗表示用）
                    root_items_list = list(root_items)
                    total_folders = sum(1 for item in root_items_list if item.type == 'folder')
                    logger.info(f"Found {total_folders} subfolders to search")
                    
                    # 各フォルダを処理
                    for item in root_items_list:
                        if item.type == 'folder':
                            sub_count = process_folder(item.id, item.name)
                            folders_searched += 1
                            logger.info(f"Processed folder {folders_searched}/{total_folders}: {item.name} ({sub_count} files, total: {len(files)} files)")
                except Exception as sub_error:
                    logger.warning(f"Error searching subfolders: {str(sub_error)}")
                    # フォールバック: limitを指定して取得を試みる
                    try:
                        root_items = list(client.folder(folder_id).get_items(limit=1000))
                        folders_searched = 0
                        total_folders = sum(1 for item in root_items if item.type == 'folder')
                        logger.info(f"Using fallback method: Found {total_folders} subfolders to search")
                        for item in root_items:
                            if item.type == 'folder':
                                sub_count = process_folder(item.id, item.name)
                                folders_searched += 1
                                logger.info(f"Processed folder {folders_searched}/{total_folders}: {item.name} ({sub_count} media files, total: {len(files)} files)")
                        logger.info(f"Searched {folders_searched} subfolders")
                    except Exception as fallback_error:
                        logger.error(f"Fallback method also failed: {str(fallback_error)}")
                        pass
                        
            except Exception as e:
                logger.error(f"Error listing files: {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
                raise
            
            logger.info(f"Successfully fetched {len(files)} image files from Box for user: {request.user.email}")
            
            # キャッシュに保存（5分間）
            cache.set(cache_key, files, 300)  # 300秒 = 5分
            
            return Response({
                'files': files,
                'total_count': len(files),
                'cached': False
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            logger.error(f"Box list files error: {str(e)}")
            logger.error(f"Traceback: {error_trace}")
            return Response({
                'error': f'Failed to list files: {str(e)}',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'], url_path='thumbnail/(?P<file_id>[^/.]+)')
    def thumbnail(self, request, pk=None, file_id=None):
        """Boxファイルのサムネイルを取得（認証不要 - 画像タグからのリクエストのため）"""
        from boxsdk import Client, OAuth2
        from django.http import HttpResponse
        from django.core.cache import cache
        import requests
        import time
        
        # 認証不要だが、Boxアカウントの所有者を確認するため、オブジェクトを取得
        # ただし、認証されていない場合は、BoxアカウントIDから直接取得を試みる
        try:
            if request.user.is_authenticated:
                box_account = self.get_object()
            else:
                # 認証されていない場合でも、BoxアカウントIDから取得を試みる
                # セキュリティ上の懸念があるが、サムネイルのみなので許容
                try:
                    box_account = BoxAccount.objects.get(id=pk)
                except BoxAccount.DoesNotExist:
                    return HttpResponse(b'', content_type='image/png', status=404)
        except Exception as e:
            logger.error(f"Failed to get BoxAccount: {str(e)}")
            return HttpResponse(b'', content_type='image/png', status=404)
        
        # レート制限を回避するため、短い待機時間を追加（サムネイル取得は頻繁に呼ばれるため）
        # ただし、最初のリクエストは即座に処理
        cache_key_rate = f"thumbnail_rate_{file_id}"
        last_request_time = cache.get(cache_key_rate)
        if last_request_time:
            elapsed = time.time() - last_request_time
            if elapsed < 0.1:  # 100ms未満の場合は待機
                time.sleep(0.1 - elapsed)
        cache.set(cache_key_rate, time.time(), 1)  # 1秒間キャッシュ
        
        try:
            # アクセストークンを確認・必要に応じて更新
            access_token = None
            try:
                access_token = self._ensure_box_access_token(box_account)
                logger.debug(f"Successfully refreshed access token for thumbnail")
            except Exception as token_error:
                error_msg = str(token_error)
                logger.error(f"Failed to refresh Box access token for thumbnail: {error_msg}")
                
                # リフレッシュトークンが期限切れの場合は、再認証が必要
                if 'expired' in error_msg.lower() or 'invalid' in error_msg.lower():
                    logger.error(f"Box refresh token has expired for account {box_account.id}. Re-authentication required.")
                    # 期限切れの場合は、空の画像を返す（フロントエンドで適切に処理される）
                    return HttpResponse(b'', content_type='image/png', status=401)
                
                # トークン更新に失敗した場合は、保存されているトークンを試す
                if box_account.access_token:
                    access_token = box_account.access_token
                    logger.warning(f"Using stored access token (may be expired)")
                else:
                    logger.error(f"No access token available for Box account {box_account.id}")
                    return HttpResponse(b'', content_type='image/png', status=401)
            
            if not access_token:
                logger.error(f"No valid access token for Box account {box_account.id}")
                return HttpResponse(b'', content_type='image/png', status=401)
            
            # Box SDKでクライアントを作成
            oauth2 = OAuth2(
                client_id=getattr(settings, 'BOX_CLIENT_ID', ''),
                client_secret=getattr(settings, 'BOX_CLIENT_SECRET', ''),
                access_token=access_token
            )
            client = Client(oauth2)
            
            # 方法1: Box APIの直接サムネイルエンドポイントを使用
            try:
                logger.debug(f"Attempting to get thumbnail for file {file_id} using direct thumbnail endpoint")
                thumbnail_url = f"https://api.box.com/2.0/files/{file_id}/thumbnail.128"
                headers = {'Authorization': f'Bearer {access_token}'}
                thumb_response = requests.get(thumbnail_url, headers=headers, timeout=10, params={'min_width': '128', 'min_height': '128'})
                
                if thumb_response.status_code == 200:
                    response = HttpResponse(thumb_response.content, content_type='image/png')
                    response['Cache-Control'] = 'public, max-age=604800'
                    response['ETag'] = f'"{file_id}"'
                    logger.debug(f"Successfully got thumbnail for file {file_id} using direct thumbnail endpoint")
                    return response
                elif thumb_response.status_code == 202:
                    # 202 = サムネイル生成中 - 待機して再試行
                    logger.debug(f"Thumbnail generation in progress for file {file_id}, waiting...")
                    import time
                    time.sleep(2)
                    thumb_response = requests.get(thumbnail_url, headers=headers, timeout=10, params={'min_width': '128', 'min_height': '128'})
                    if thumb_response.status_code == 200:
                        response = HttpResponse(thumb_response.content, content_type='image/png')
                        response['Cache-Control'] = 'public, max-age=604800'
                        response['ETag'] = f'"{file_id}"'
                        logger.debug(f"Successfully got thumbnail for file {file_id} after waiting")
                        return response
                elif thumb_response.status_code == 400:
                    # 400 = サムネイルが利用できない（requested_preview_unavailable）
                    error_data = thumb_response.json() if thumb_response.content else {}
                    error_code = error_data.get('code', '')
                    logger.debug(f"Thumbnail unavailable for file {file_id}: {error_code}")
                    # 次の方法を試すために続行
            except Exception as thumb_error:
                logger.warning(f"Direct thumbnail endpoint failed for file {file_id}: {str(thumb_error)}")
            
            # 方法2: Box APIの直接呼び出し（representationsエンドポイントを使用）
            try:
                logger.debug(f"Attempting to get thumbnail for file {file_id} using representations API")
                # Box APIのrepresentationsエンドポイントを使用
                api_url = f"https://api.box.com/2.0/files/{file_id}?fields=representations"
                headers = {'Authorization': f'Bearer {access_token}'}
                api_response = requests.get(api_url, headers=headers, timeout=10)
                
                if api_response.status_code == 200:
                    file_data = api_response.json()
                    representations = file_data.get('representations', {})
                    entries = representations.get('entries', [])
                    
                    # サムネイル表現を探す（優先順位: jpg_thumb > jpg > png）
                    thumbnail_entries = []
                    for entry in entries:
                        if entry.get('status') == 'success':
                            rep_type = entry.get('representation', '')
                            content = entry.get('content', {})
                            url_template = content.get('url_template', '')
                            if url_template:
                                # 優先順位を設定
                                priority = 0
                                if 'jpg_thumb' in rep_type.lower():
                                    priority = 3
                                elif 'jpg' in rep_type.lower() and 'thumb' in rep_type.lower():
                                    priority = 2
                                elif 'jpg' in rep_type.lower() or 'png' in rep_type.lower():
                                    priority = 1
                                
                                if priority > 0:
                                    thumbnail_entries.append((priority, url_template, rep_type))
                    
                    # 優先順位の高いものから試す
                    thumbnail_entries.sort(key=lambda x: x[0], reverse=True)
                    
                    for priority, url_template, rep_type in thumbnail_entries:
                        try:
                            # URLテンプレートから実際のURLを生成
                            # {+asset_path}を空文字列に置換（Box APIの仕様に従う）
                            thumbnail_url = url_template.replace('{+asset_path}', '')
                            # サムネイル画像を取得
                            thumb_response = requests.get(thumbnail_url, headers=headers, timeout=10)
                            if thumb_response.status_code == 200:
                                # Content-Typeを確認
                                content_type = thumb_response.headers.get('Content-Type', 'image/png')
                                response = HttpResponse(thumb_response.content, content_type=content_type)
                                response['Cache-Control'] = 'public, max-age=604800'
                                response['ETag'] = f'"{file_id}"'
                                logger.debug(f"Successfully got thumbnail for file {file_id} using representations API ({rep_type})")
                                return response
                        except Exception as url_error:
                            logger.debug(f"Failed to get thumbnail from {rep_type}: {str(url_error)}")
                            continue
            except Exception as api_error:
                logger.warning(f"Representations API call failed for file {file_id}: {str(api_error)}")
            
            # 方法3: Box SDKのget_thumbnail_representationを試す
            try:
                logger.debug(f"Attempting to get thumbnail for file {file_id} using get_thumbnail_representation")
                thumbnail_content = client.file(file_id).get_thumbnail_representation('128', '128')
                if thumbnail_content:
                    response = HttpResponse(thumbnail_content, content_type='image/png')
                    response['Cache-Control'] = 'public, max-age=604800'
                    response['ETag'] = f'"{file_id}"'
                    logger.debug(f"Successfully got thumbnail for file {file_id} using get_thumbnail_representation")
                    return response
            except Exception as rep_error:
                logger.warning(f"get_thumbnail_representation failed for file {file_id}: {str(rep_error)}")
            
            # 方法4: 画像ファイルの場合は、ファイル自体をダウンロードしてリサイズ（最後の手段）
            try:
                logger.debug(f"Attempting to download and resize file {file_id} as fallback")
                # ファイル情報を取得して、画像・動画ファイルかどうかを確認
                file_info = client.file(file_id).get()
                file_name = file_info.name.lower()
                image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
                video_extensions = ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v']
                media_extensions = image_extensions + video_extensions
                is_media = any(file_name.endswith(ext) for ext in media_extensions)
                is_image = any(file_name.endswith(ext) for ext in image_extensions)
                
                if is_media:
                    # 動画ファイルの場合は、Box APIの動画サムネイル機能を使用
                    if not is_image:
                        # 動画ファイルのサムネイルはBox APIが提供する場合がある
                        # ここでは動画ファイルのサムネイル生成はスキップ（Box APIに依存）
                        logger.debug(f"Video file {file_id} thumbnail generation skipped (Box API may provide it)")
                    else:
                        # 画像ファイルの場合は、PILでリサイズ
                        from io import BytesIO
                        try:
                            from PIL import Image
                            # Box SDKのcontent()メソッドを使用してファイルをダウンロード
                            # ただし、大きなファイルの場合は時間がかかるため、タイムアウトを設定
                            file_content = client.file(file_id).content()
                            
                            # PILで画像をリサイズ
                            img = Image.open(BytesIO(file_content))
                            img.thumbnail((128, 128), Image.Resampling.LANCZOS)
                            
                            # リサイズした画像を返す
                            output = BytesIO()
                            # 元の画像形式を保持（PNGに変換）
                            if img.format == 'JPEG':
                                img.save(output, format='JPEG', quality=85)
                                content_type = 'image/jpeg'
                            elif img.format == 'PNG':
                                img.save(output, format='PNG')
                                content_type = 'image/png'
                            else:
                                img.save(output, format='PNG')
                                content_type = 'image/png'
                            output.seek(0)
                            
                            response = HttpResponse(output.read(), content_type=content_type)
                            response['Cache-Control'] = 'public, max-age=604800'
                            response['ETag'] = f'"{file_id}"'
                            logger.debug(f"Successfully created thumbnail for file {file_id} by resizing")
                            return response
                        except ImportError:
                            logger.warning("PIL (Pillow) is not installed. Cannot resize images for thumbnails.")
                        except Exception as resize_error:
                            logger.warning(f"Failed to resize image for file {file_id}: {str(resize_error)}")
            except Exception as download_error:
                logger.warning(f"Failed to download file {file_id} for thumbnail: {str(download_error)}")
            
            # すべての方法が失敗した場合
            logger.error(f"All thumbnail methods failed for file {file_id}")
            return HttpResponse(b'', content_type='image/png', status=404)
            
        except Exception as e:
            import traceback
            logger.error(f"Box thumbnail error for file {file_id}: {str(e)}")
            logger.error(traceback.format_exc())
            return HttpResponse(b'', content_type='image/png', status=404)
    
    @action(detail=True, methods=['get'], url_path='download-file/(?P<file_id>[^/.]+)')
    def download_file(self, request, pk=None, file_id=None):
        """Boxからファイルをダウンロード"""
        from boxsdk import Client, OAuth2
        from django.http import HttpResponse
        import io
        
        box_account = self.get_object()
        
        try:
            # Box SDKでクライアントを作成
            oauth2 = OAuth2(
                client_id='',
                client_secret='',
                access_token=box_account.access_token
            )
            client = Client(oauth2)
            
            # ファイルをダウンロード
            file_content = client.file(file_id).content()
            
            # ファイル情報を取得
            file_info = client.file(file_id).get()
            file_name = file_info.name
            
            # レスポンスを作成
            response = HttpResponse(file_content, content_type='application/octet-stream')
            response['Content-Disposition'] = f'attachment; filename="{file_name}"'
            
            logger.info(f"Downloaded file {file_name} from Box for user: {request.user.email}")
            
            return response
            
        except Exception as e:
            logger.error(f"Box download file error: {str(e)}")
            return Response({
                'error': f'Failed to download file: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
