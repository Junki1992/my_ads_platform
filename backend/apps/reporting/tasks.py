"""
日次 Meta 広告インサイト取り込み（全アクティブ MetaAccount）。
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import MetaAccount

from .meta_insights_service import fetch_ad_level_insights_for_day
from .models import DailyAdInsight

logger = logging.getLogger(__name__)

JST = ZoneInfo('Asia/Tokyo')


def _yesterday_date_str_in_jst(now=None) -> str:
    if now is None:
        now = timezone.now()
    jst_now = now.astimezone(JST)
    y = (jst_now.date() - timedelta(days=1))
    return y.isoformat()


def run_daily_meta_ad_insights(stat_date: str | None = None) -> dict:
    """
    前日（JST）分の広告単位インサイトを、紐づく全アクティブ Meta アカウントから取得して保存する。
    stat_date を 'YYYY-MM-DD' で渡すとその日を対象にする（手動バックフィル用）。
    Celery タスクと management コマンドの両方から呼ぶ。
    """
    if stat_date:
        target_str = stat_date
    else:
        target_str = _yesterday_date_str_in_jst()

    target_day = date.fromisoformat(target_str)

    accounts = MetaAccount.objects.filter(is_active=True).select_related('user')
    total_accounts = accounts.count()
    logger.info(
        'run_daily_meta_ad_insights start target=%s accounts=%s',
        target_str,
        total_accounts,
    )

    results = {
        'target_date': target_str,
        'accounts_ok': 0,
        'accounts_failed': 0,
        'errors': [],
    }

    for ma in accounts.iterator():
        label = f'{ma.account_name}({ma.account_id})'
        try:
            rows = fetch_ad_level_insights_for_day(ma.account_id, ma.access_token, target_str)
            with transaction.atomic():
                DailyAdInsight.objects.filter(meta_account=ma, stat_date=target_day).delete()
                bulk = []
                for r in rows:
                    bulk.append(
                        DailyAdInsight(
                            meta_account=ma,
                            stat_date=target_day,
                            meta_ad_id=r['meta_ad_id'],
                            campaign_name=r['campaign_name'][:512],
                            adset_name=r['adset_name'][:512],
                            ad_name=r['ad_name'][:512],
                            impressions=r['impressions'],
                            clicks=r['clicks'],
                            ctr=r['ctr'],
                            cpc=r['cpc'],
                            spend=r['spend'],
                            conversions=float(r['conversions'] or 0),
                            cpa=r['cpa'],
                        )
                    )
                if bulk:
                    DailyAdInsight.objects.bulk_create(bulk, batch_size=500)
            logger.info(
                'run_daily_meta_ad_insights ok account=%s rows=%s',
                label,
                len(rows),
            )
            results['accounts_ok'] += 1
        except Exception as exc:
            logger.exception('run_daily_meta_ad_insights failed account=%s', label)
            results['accounts_failed'] += 1
            results['errors'].append({'account': ma.account_id, 'error': str(exc)})

    logger.info('run_daily_meta_ad_insights done %s', results)
    return results


@shared_task(
    bind=True,
    soft_time_limit=25 * 60,
    time_limit=30 * 60,
)
def fetch_daily_meta_ad_insights(self, stat_date: str | None = None):
    return run_daily_meta_ad_insights(stat_date=stat_date)
