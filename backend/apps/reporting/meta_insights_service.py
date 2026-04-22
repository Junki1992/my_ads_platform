"""
Meta Marketing API: ad account insights (ad level) with pagination.
"""
from __future__ import annotations

import json
import logging
from decimal import Decimal, InvalidOperation
from typing import Any, List, Optional

import requests

logger = logging.getLogger(__name__)

GRAPH_API_VERSION = 'v22.0'
BASE_URL = f'https://graph.facebook.com/{GRAPH_API_VERSION}'

PURCHASE_ACTION = 'offsite_conversion.fb_pixel_purchase'

INSIGHT_FIELDS = (
    'campaign_name,adset_name,ad_name,ad_id,impressions,clicks,ctr,cpc,spend,'
    'actions,cost_per_action_type'
)


def normalize_ad_account_id(account_id: str) -> str:
    account_id = (account_id or '').strip()
    if not account_id.startswith('act_'):
        return f'act_{account_id}'
    return account_id


def _to_decimal(val: Any, default: Decimal = Decimal('0')) -> Decimal:
    if val is None or val == '':
        return default
    try:
        return Decimal(str(val))
    except (InvalidOperation, ValueError):
        return default


def _to_float(val: Any, default: float = 0.0) -> float:
    if val is None or val == '':
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _to_int(val: Any, default: int = 0) -> int:
    if val is None or val == '':
        return default
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return default


def _extract_purchase_metrics(row: dict) -> tuple[float, Optional[Decimal]]:
    conversions = 0.0
    cpa: Optional[Decimal] = None

    for action in row.get('actions') or []:
        if action.get('action_type') == PURCHASE_ACTION:
            conversions = _to_float(action.get('value'), 0.0)
            break

    for item in row.get('cost_per_action_type') or []:
        if item.get('action_type') == PURCHASE_ACTION:
            raw = item.get('value')
            if raw is None or raw == '':
                cpa = None
            else:
                cpa = _to_decimal(raw)
            break

    return conversions, cpa


def parse_insight_row(row: dict) -> Optional[dict[str, Any]]:
    ad_id = row.get('ad_id')
    if not ad_id:
        logger.warning('Insight row missing ad_id: %s', row)
        return None

    conversions, cpa = _extract_purchase_metrics(row)

    return {
        'meta_ad_id': str(ad_id),
        'campaign_name': row.get('campaign_name') or '',
        'adset_name': row.get('adset_name') or '',
        'ad_name': row.get('ad_name') or '',
        'impressions': _to_int(row.get('impressions')),
        'clicks': _to_int(row.get('clicks')),
        'ctr': _to_float(row.get('ctr')),
        'cpc': _to_decimal(row.get('cpc')),
        'spend': _to_decimal(row.get('spend')),
        'conversions': conversions,
        'cpa': cpa,
    }


def fetch_ad_level_insights_for_day(
    ad_account_id: str,
    access_token: str,
    date_str: str,
    timeout: int = 120,
) -> List[dict[str, Any]]:
    """
    Fetch all ad-level insight rows for a single calendar day (time_range since=until=date_str).
    """
    act = normalize_ad_account_id(ad_account_id)
    headers = {'Authorization': f'Bearer {access_token}'}
    time_range = json.dumps({'since': date_str, 'until': date_str})
    params: dict[str, Any] = {
        'fields': INSIGHT_FIELDS,
        'level': 'ad',
        'time_range': time_range,
        'limit': 500,
    }

    url = f'{BASE_URL}/{act}/insights'
    out: List[dict[str, Any]] = []
    request_params: Optional[dict[str, Any]] = params

    while url:
        resp = requests.get(
            url,
            headers=headers,
            params=request_params,
            timeout=timeout,
        )
        if resp.status_code != 200:
            logger.error(
                'Meta insights error act=%s status=%s body=%s',
                act,
                resp.status_code,
                resp.text[:2000],
            )
            resp.raise_for_status()

        payload = resp.json()
        for row in payload.get('data') or []:
            parsed = parse_insight_row(row)
            if parsed:
                out.append(parsed)

        next_url = (payload.get('paging') or {}).get('next')
        url = next_url
        request_params = None

    return out
