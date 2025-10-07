"""
管理者パスワード設定スクリプト
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings_dev')
django.setup()

from apps.accounts.models import User

# 管理者ユーザーを取得してパスワードを設定
admin = User.objects.get(username='admin')
admin.set_password('admin123')  # 開発環境用の簡単なパスワード
admin.save()

print("Admin password set successfully!")
print("Email: admin@example.com")
print("Password: admin123")
