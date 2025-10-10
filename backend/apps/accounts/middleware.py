"""
Rate Limiting Middleware
APIリクエストのレート制限を実装
"""
from django.core.cache import cache
from django.http import JsonResponse
from rest_framework import status
import time


class RateLimitMiddleware:
    """
    レート制限ミドルウェア
    IPアドレスごとにリクエスト数を制限
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
        # 設定値（環境変数から取得可能）
        self.rate_limit_per_minute = 60  # 1分あたりのリクエスト数
        self.rate_limit_per_hour = 1000  # 1時間あたりのリクエスト数
        
    def __call__(self, request):
        # 管理画面とヘルスチェックは除外
        if request.path.startswith('/admin/') or request.path == '/health/':
            return self.get_response(request)
        
        # IPアドレスを取得
        ip_address = self.get_client_ip(request)
        
        # レート制限チェック
        if not self.check_rate_limit(ip_address):
            return JsonResponse(
                {
                    'error': 'レート制限を超えました。しばらく待ってから再試行してください。',
                    'detail': 'Too many requests. Please try again later.'
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        
        response = self.get_response(request)
        return response
    
    def get_client_ip(self, request):
        """クライアントのIPアドレスを取得"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    def check_rate_limit(self, ip_address):
        """レート制限チェック"""
        current_time = int(time.time())
        
        # 1分間のレート制限チェック
        minute_key = f'rate_limit_minute:{ip_address}:{current_time // 60}'
        minute_count = cache.get(minute_key, 0)
        
        if minute_count >= self.rate_limit_per_minute:
            return False
        
        # 1時間のレート制限チェック
        hour_key = f'rate_limit_hour:{ip_address}:{current_time // 3600}'
        hour_count = cache.get(hour_key, 0)
        
        if hour_count >= self.rate_limit_per_hour:
            return False
        
        # カウントを増加
        cache.set(minute_key, minute_count + 1, 60)  # 60秒で期限切れ
        cache.set(hour_key, hour_count + 1, 3600)  # 3600秒で期限切れ
        
        return True

