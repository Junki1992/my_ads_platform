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

# CORS設定（開発環境）
CORS_ALLOW_ALL_ORIGINS = True

# Celery設定（開発環境）
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
