"""
デモユーザー作成スクリプト
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User

def create_demo_user():
    # 既存のデモユーザーを削除
    User.objects.filter(email='demo@example.com').delete()
    
    # 新しいデモユーザーを作成
    demo_user = User.objects.create_user(
        username='demo',
        email='demo@example.com',
        password='demo123',
        first_name='デモ',
        last_name='ユーザー',
        company='デモ会社',
        phone='+81-90-1234-5678',
        language='ja',
        timezone='Asia/Tokyo',
        is_demo_user=True,
        is_active=True
    )
    
    print("✅ Demo user created successfully!")
    print("=" * 50)
    print("📝 デモアカウント情報")
    print("=" * 50)
    print(f"📧 Email: {demo_user.email}")
    print(f"🔑 Password: demo123")
    print(f"🏢 Company: {demo_user.company}")
    print(f"👤 Name: {demo_user.first_name} {demo_user.last_name}")
    print(f"🌐 Language: {demo_user.language}")
    print(f"🕐 Timezone: {demo_user.timezone}")
    print(f"🎯 Demo User: {demo_user.is_demo_user}")
    print("=" * 50)
    print("💡 このアカウントでログインすると、デモ制限機能が有効になります")

if __name__ == '__main__':
    create_demo_user()
