from __future__ import absolute_import, unicode_literals
import os
from celery import Celery

# Django設定を読み込み
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')

# Django設定からCelery設定を読み込み
app.config_from_object('django.conf:settings', namespace='CELERY')

# アプリケーションからタスクを自動検出
app.autodiscover_tasks()

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
