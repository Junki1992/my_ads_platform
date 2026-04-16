"""
開発環境用設定
"""
from .settings import *

# SQLiteを使用（開発環境）
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# デバッグモード
DEBUG = True

# 同一LANの端末から（例: http://192.168.x.x:8000）アクセスする場合の Host ヘッダを許可
# DEBUG=True のときのみ '*' は Django により許容される（本番では使わないこと）
ALLOWED_HOSTS = ['*']

# CORS設定（開発環境）
CORS_ALLOW_ALL_ORIGINS = True

# Celery設定（開発環境）
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# セキュリティ設定を無効化（開発環境）
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
