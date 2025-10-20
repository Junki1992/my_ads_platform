from django.core.management.base import BaseCommand
from apps.accounts.models import User


class Command(BaseCommand):
    help = '指定されたユーザーの2段階認証を無効化します'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='2段階認証を無効化するユーザーのメールアドレス')

    def handle(self, *args, **options):
        email = options['email']
        
        try:
            user = User.objects.get(email=email)
            
            # 現在の状態を表示
            self.stdout.write(f'ユーザー: {user.email}')
            self.stdout.write(f'現在の2FA状態: {user.two_factor_enabled}')
            
            if user.two_factor_enabled:
                # 2段階認証を無効化
                user.two_factor_enabled = False
                user.two_factor_secret = ''
                user.backup_codes = ''
                user.save()
                
                self.stdout.write(
                    self.style.SUCCESS(f'ユーザー {email} の2段階認証を無効化しました')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'ユーザー {email} の2段階認証は既に無効です')
                )
                
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'ユーザー {email} が見つかりません')
            )



