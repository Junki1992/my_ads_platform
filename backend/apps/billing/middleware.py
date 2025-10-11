"""
課金機能アクセス制御ミドルウェア
"""
from django.conf import settings
from django.http import JsonResponse


class BillingFeatureMiddleware:
    """
    課金機能へのアクセスを制御するミドルウェア
    ENABLE_BILLING=Falseの場合、課金APIへのアクセスをブロック
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # 課金APIへのアクセスをチェック
        if request.path.startswith('/api/billing/'):
            if not settings.ENABLE_BILLING:
                return JsonResponse(
                    {
                        'error': '課金機能は現在利用できません',
                        'detail': 'Billing feature is currently disabled'
                    },
                    status=503  # Service Unavailable
                )
        
        return self.get_response(request)

