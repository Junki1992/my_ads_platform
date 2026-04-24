"""
保存済み Meta トークンで、OAuth 周りの権限と /me/adaccounts の business 取得可否を確認する。

例:
  python manage.py debug_meta_oauth --email user@example.com
  python manage.py debug_meta_oauth --email user@example.com --meta-pk 3
"""

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import MetaAccount, User
from apps.accounts.views import (
    GRAPH_VERSION,
    _graph_me_adaccounts_json,
    _is_business_field_permission_error,
    _parse_business_from_adaccount_node,
)


class Command(BaseCommand):
    help = (
        '保存済み MetaAccount のトークンで debug_token と '
        'me/adaccounts（business 付き）を確認する（フォールバック有無の切り分け用）。'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            required=True,
            help='対象ユーザーのメールアドレス',
        )
        parser.add_argument(
            '--meta-pk',
            type=int,
            default=None,
            help='MetaAccount の DB 上の id（省略時はそのユーザーの is_active な先頭1件）',
        )

    def handle(self, *args, **options):
        email = options['email'].strip()
        meta_pk = options['meta_pk']

        app_id = getattr(settings, 'META_APP_ID', None) or ''
        app_secret = getattr(settings, 'META_APP_SECRET', None) or ''
        if not app_id or not app_secret:
            raise CommandError('settings に META_APP_ID / META_APP_SECRET がありません。')

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist as e:
            raise CommandError(f'ユーザーが見つかりません: {email}') from e

        qs = MetaAccount.objects.filter(user=user, is_active=True).order_by('id')
        if meta_pk is not None:
            qs = qs.filter(pk=meta_pk)
        acc = qs.first()
        if not acc:
            raise CommandError('対象の MetaAccount がありません（--meta-pk を確認）。')

        token = (acc.access_token or '').strip()
        if not token:
            raise CommandError(f'MetaAccount pk={acc.pk} の access_token が空です。')

        self.stdout.write(self.style.NOTICE(f'User: {user.email} (id={user.id})'))
        self.stdout.write(
            f'MetaAccount: pk={acc.pk} account_id={acc.account_id} name={acc.account_name!r}'
        )
        self.stdout.write(
            f'DB business_id={acc.business_id!r} business_name={acc.business_name!r}\n'
        )
        self.stdout.write(
            f'settings の META_APP_ID（debug_token の viewing app）: {app_id!r}\n'
        )

        # --- debug_token ---
        app_access = f'{app_id}|{app_secret}'
        debug_url = f'https://graph.facebook.com/{GRAPH_VERSION}/debug_token'
        dr = requests.get(
            debug_url,
            params={'input_token': token, 'access_token': app_access},
            timeout=30,
        )
        dd = dr.json()
        if dr.status_code != 200 or 'data' not in dd:
            self.stdout.write(self.style.ERROR(f'debug_token HTTP {dr.status_code}: {dd}'))
            err_msg = (dd.get('error') or {}).get('message', '') if isinstance(dd, dict) else ''
            if 'App_id in the input_token did not match' in err_msg:
                self.stdout.write(
                    self.style.WARNING(
                        '→ DB にあるトークンは「別の Meta アプリ」で発行されたものです。'
                        '.env の META_APP_ID / META_APP_SECRET を、その OAuth で使っているアプリに揃えるか、'
                        'いまの settings のアプリで設定画面から Meta を再接続してください。'
                    )
                )
        else:
            td = dd['data']
            self.stdout.write(self.style.SUCCESS('--- debug_token ---'))
            self.stdout.write(f"is_valid: {td.get('is_valid')}")
            self.stdout.write(f"type: {td.get('type')}")
            self.stdout.write(f"app_id: {td.get('app_id')}")
            scopes = td.get('scopes') or td.get('granular_scopes') or []
            self.stdout.write(f'scopes / granular: {scopes}')
            for name in ('ads_read', 'ads_management', 'business_management'):
                ok = name in (td.get('scopes') or [])
                tag = 'OK' if ok else 'MISSING'
                style = self.style.SUCCESS if ok else self.style.WARNING
                self.stdout.write(style(f'  [{tag}] {name}'))
            self.stdout.write('')

        # --- 本番と同じ _graph_me_adaccounts_json（フォールバック込み）---
        self.stdout.write(self.style.NOTICE('--- me/adaccounts（_graph_me_adaccounts_json と同一）---'))
        bundle = _graph_me_adaccounts_json(token)
        if 'error' in bundle and 'data' not in bundle:
            self.stdout.write(self.style.ERROR(str(bundle.get('error'))))
        elif 'data' in bundle:
            rows = bundle['data']
            self.stdout.write(f'件数: {len(rows)}')
            with_biz = 0
            for row in rows[:15]:
                bid, bname = _parse_business_from_adaccount_node(row)
                if bid or bname:
                    with_biz += 1
            self.stdout.write(f'先頭15件のうち business あり: {with_biz}')
            if rows:
                r0 = rows[0]
                bid, bname = _parse_business_from_adaccount_node(r0)
                self.stdout.write(f'先頭1件 account_id={r0.get("account_id")} business=({bid!r}, {bname!r})')
        else:
            self.stdout.write(self.style.WARNING(str(bundle)))

        # --- フォールバックが走るか（初回リクエストのみ）---
        self.stdout.write('')
        self.stdout.write(self.style.NOTICE('--- 初回のみ business{{name}} 付き（フォールバック判定）---'))
        url = f'https://graph.facebook.com/{GRAPH_VERSION}/me/adaccounts'
        base_fields = 'id,name,account_id,currency,timezone_name,account_status'
        r1 = requests.get(
            url,
            params={'access_token': token, 'fields': f'{base_fields},business{{name}}'},
            timeout=30,
        )
        d1 = r1.json()
        if isinstance(d1, dict) and 'data' in d1:
            self.stdout.write(
                self.style.SUCCESS(
                    '初回リクエストで data 取得済み → このトークンでは business 付き一覧は成功しています。'
                )
            )
        elif _is_business_field_permission_error(d1):
            self.stdout.write(
                self.style.WARNING(
                    '権限エラーと判定 → 本番コードは business なしで再試行（フォールバック）します。'
                )
            )
            self.stdout.write(self.style.WARNING(str(d1.get('error'))))
        else:
            self.stdout.write(self.style.ERROR(f'想定外の応答: HTTP {r1.status_code} {d1}'))

        self.stdout.write('')
        self.stdout.write(
            '次の手順: business_management が MISSING なら Meta 開発者コンソールの権限と '
            'ユーザーへの再 OAuth（許可画面ですべて許可）を確認してください。'
        )
