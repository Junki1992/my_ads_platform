from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    カスタム例外ハンドラー
    すべてのエラーレスポンスを統一フォーマットで返す
    """
    # DRFのデフォルト例外ハンドラーを呼び出す
    response = exception_handler(exc, context)
    
    # ロギング
    logger.error(
        f"Exception: {exc.__class__.__name__}, "
        f"Message: {str(exc)}, "
        f"Context: {context['request'].path}"
    )
    
    if response is not None:
        # カスタムレスポンスフォーマット
        custom_response = {
            'error': {
                'code': response.status_code,
                'message': get_error_message(exc, response),
                'details': response.data if isinstance(response.data, dict) else {'detail': response.data}
            }
        }
        response.data = custom_response
    else:
        # ハンドリングされていない例外
        custom_response = {
            'error': {
                'code': status.HTTP_500_INTERNAL_SERVER_ERROR,
                'message': 'Internal server error',
                'details': {'detail': str(exc)}
            }
        }
        response = Response(custom_response, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return response


def get_error_message(exc, response):
    """
    例外からユーザーフレンドリーなエラーメッセージを取得
    """
    error_messages = {
        400: 'Bad request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not found',
        405: 'Method not allowed',
        429: 'Too many requests',
        500: 'Internal server error',
        503: 'Service unavailable',
    }
    
    status_code = response.status_code
    
    # カスタムメッセージがある場合
    if hasattr(exc, 'default_detail'):
        return str(exc.default_detail)
    
    # ステータスコードに基づくデフォルトメッセージ
    return error_messages.get(status_code, 'An error occurred')
