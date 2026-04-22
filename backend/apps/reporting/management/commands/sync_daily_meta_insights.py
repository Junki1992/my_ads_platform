from django.core.management.base import BaseCommand

from apps.reporting.tasks import run_daily_meta_ad_insights


class Command(BaseCommand):
    help = 'Meta 広告の日次インサイト（広告単位）を取得して DB に保存する。'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=str,
            default=None,
            help='対象日 YYYY-MM-DD（省略時は前日 JST）',
        )

    def handle(self, *args, **options):
        d = options.get('date')
        self.stdout.write(f'同期開始: date={d or "前日(JST)"}')
        result = run_daily_meta_ad_insights(stat_date=d)
        self.stdout.write(str(result))
