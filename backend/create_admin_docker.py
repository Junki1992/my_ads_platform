"""
Docker環境用の管理者作成スクリプト
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User

# 既存のadminユーザーを削除
User.objects.filter(email='admin@example.com').delete()

# 新しい管理者ユーザーを作成
admin = User.objects.create_superuser(
    username='admin',  # usernameも指定
    email='admin@example.com',
    password='admin123'
)

print("✅ Admin user created successfully in Docker PostgreSQL!")
print("Email: admin@example.com")
print("Password: admin123")
