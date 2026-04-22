from apps.reporting.meta_insights_service import (
    normalize_ad_account_id,
    parse_insight_row,
)


def test_normalize_ad_account_id():
    assert normalize_ad_account_id('12345') == 'act_12345'
    assert normalize_ad_account_id('act_999') == 'act_999'
    assert normalize_ad_account_id('  act_1  ') == 'act_1'


def test_parse_insight_row_purchase():
    row = {
        'ad_id': '123',
        'campaign_name': 'C',
        'adset_name': 'A',
        'ad_name': 'Ad',
        'impressions': '100',
        'clicks': '5',
        'ctr': '5',
        'cpc': '10.5',
        'spend': '52.5',
        'actions': [{'action_type': 'offsite_conversion.fb_pixel_purchase', 'value': '3'}],
        'cost_per_action_type': [
            {'action_type': 'offsite_conversion.fb_pixel_purchase', 'value': '17.5'}
        ],
    }
    parsed = parse_insight_row(row)
    assert parsed is not None
    assert parsed['meta_ad_id'] == '123'
    assert parsed['impressions'] == 100
    assert parsed['conversions'] == 3.0
    assert parsed['cpa'] is not None
    assert float(parsed['cpa']) == 17.5


def test_parse_insight_row_missing_ad():
    assert parse_insight_row({'impressions': '1'}) is None
