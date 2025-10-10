"""
二要素認証(2FA)サービス
"""
import pyotp
import qrcode
import io
import base64
import json
import secrets
from django.conf import settings


class TwoFactorAuthService:
    """二要素認証サービス"""
    
    @staticmethod
    def generate_secret():
        """
        TOTP秘密鍵を生成
        """
        return pyotp.random_base32()
    
    @staticmethod
    def generate_qr_code(user, secret):
        """
        QRコードを生成
        
        Args:
            user: ユーザーオブジェクト
            secret: TOTP秘密鍵
            
        Returns:
            base64エンコードされたQRコード画像
        """
        # TOTP URIを生成
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name='My Ads Platform'
        )
        
        # QRコードを生成
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # バイトストリームに変換
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        
        # base64エンコード
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"
    
    @staticmethod
    def verify_token(secret, token):
        """
        TOTPトークンを検証
        
        Args:
            secret: TOTP秘密鍵
            token: ユーザーが入力した6桁のコード
            
        Returns:
            bool: トークンが有効ならTrue
        """
        totp = pyotp.TOTP(secret)
        return totp.verify(token, valid_window=1)  # 前後30秒の猶予
    
    @staticmethod
    def generate_backup_codes(count=8):
        """
        バックアップコードを生成
        
        Args:
            count: 生成するコード数
            
        Returns:
            list: バックアップコードのリスト
        """
        codes = []
        for _ in range(count):
            # 8桁のランダムコードを生成
            code = ''.join([str(secrets.randbelow(10)) for _ in range(8)])
            # 4桁ずつハイフンで区切る
            formatted_code = f"{code[:4]}-{code[4:]}"
            codes.append(formatted_code)
        return codes
    
    @staticmethod
    def verify_backup_code(user, code):
        """
        バックアップコードを検証
        
        Args:
            user: ユーザーオブジェクト
            code: バックアップコード
            
        Returns:
            bool: コードが有効ならTrue
        """
        if not user.backup_codes:
            return False
        
        try:
            backup_codes = json.loads(user.backup_codes)
        except json.JSONDecodeError:
            return False
        
        # コードを正規化（ハイフンを削除して比較）
        normalized_code = code.replace('-', '').replace(' ', '')
        
        for stored_code in backup_codes:
            normalized_stored = stored_code.replace('-', '').replace(' ', '')
            if normalized_code == normalized_stored:
                # 使用済みコードを削除
                backup_codes.remove(stored_code)
                user.backup_codes = json.dumps(backup_codes)
                user.save()
                return True
        
        return False
    
    @staticmethod
    def enable_2fa(user):
        """
        ユーザーの2FAを有効化
        
        Args:
            user: ユーザーオブジェクト
            
        Returns:
            dict: 秘密鍵、QRコード、バックアップコード
        """
        # 秘密鍵を生成
        secret = TwoFactorAuthService.generate_secret()
        
        # QRコードを生成
        qr_code = TwoFactorAuthService.generate_qr_code(user, secret)
        
        # バックアップコードを生成
        backup_codes = TwoFactorAuthService.generate_backup_codes()
        
        # ユーザーに保存
        user.two_factor_secret = secret
        user.backup_codes = json.dumps(backup_codes)
        user.two_factor_enabled = True
        user.save()
        
        return {
            'secret': secret,
            'qr_code': qr_code,
            'backup_codes': backup_codes
        }
    
    @staticmethod
    def disable_2fa(user):
        """
        ユーザーの2FAを無効化
        
        Args:
            user: ユーザーオブジェクト
        """
        user.two_factor_enabled = False
        user.two_factor_secret = ''
        user.backup_codes = ''
        user.save()

