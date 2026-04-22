#!/usr/bin/env bash
# ==============================================================================
# キャンペーンを広告アカウント別に括る UI ＋複数 Meta アカウント選択まわりだけを本番へ反映する。
#
# - backend: 下記パスのみ tar で VM の $DEPLOY_DIR に上書き（Docker イメージ再ビルドなし・ボリューム反映）
# - frontend: 変更元は同じく下記 src のみだが、nginx は build のみ参照するため
#   手元で npm run build した frontend/build 一式を配置する（バンドル都合で build は全体）
#
# 使い方: リポジトリルートから
#   ./scripts/deploy-campaign-meta-account-only.sh
#
# 環境変数: DEPLOY_HOST, DEPLOY_ZONE, DEPLOY_DIR, REACT_APP_API_URL（既定は deploy-frontend-only と同じ）
# SKIP_NPM_BUILD=1  … 直前に手元で build 済みならビルドを飛ばす
# ==============================================================================
set -eo pipefail
# set -u は付けない（npm / react-scripts 内で未定義変数参照があり nounset で落ちることがある）

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# macOS の tar が xattr 拡張ヘッダを付けないようにする（Linux 側の警告抑止）
export COPYFILE_DISABLE=1

DEPLOY_HOST="${DEPLOY_HOST:-meta_ads_platform1008@ads-web-prod}"
DEPLOY_ZONE="${DEPLOY_ZONE:-asia-northeast1-a}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/my_ads_platform}"
REACT_APP_API_URL="${REACT_APP_API_URL:-https://lots-of-love.top/api}"
REMOTE_FE_STAGING="${REMOTE_FE_STAGING:-frontend_build_staging}"
GCLOUD_SSH_FLAGS=(--ssh-flag=-oServerAliveInterval=30 --ssh-flag=-oServerAliveCountMax=120)

BACKEND_PATHS=(
  backend/apps/accounts/models.py
  backend/apps/accounts/serializers.py
  backend/apps/accounts/views.py
  backend/apps/accounts/migrations/0008_metaaccount_business.py
  backend/apps/campaigns/serializers.py
  backend/apps/campaigns/views.py
)

# ビルド入力として触っているのはこの一覧のみ（他ページは含めない）
FRONTEND_SRC_FOR_COMMENT=(
  frontend/src/pages/Campaigns.tsx
  frontend/src/pages/Settings.tsx
  frontend/src/services/campaignService.ts
  frontend/src/services/metaAccountService.ts
  frontend/src/utils/metaAccountBusinessGroups.ts
  frontend/src/services/api.ts
  frontend/src/config.ts
  frontend/src/i18n/locales/en.json
  frontend/src/i18n/locales/ja.json
  frontend/src/i18n/locales/ko.json
  frontend/src/i18n/locales/zh.json
)

echo "=========================================="
echo "キャンペーン括り・複数アカウントのみ本番反映"
echo "=========================================="
echo "ホスト: $DEPLOY_HOST  ゾーン: $DEPLOY_ZONE  先: $DEPLOY_DIR/"
echo ""

for f in "${BACKEND_PATHS[@]}"; do
  if [[ ! -e "$ROOT/$f" ]]; then
    echo "エラー: 存在しません: $f" >&2
    exit 1
  fi
done
for f in "${FRONTEND_SRC_FOR_COMMENT[@]}"; do
  if [[ ! -e "$ROOT/$f" ]]; then
    echo "エラー: 存在しません: $f" >&2
    exit 1
  fi
done

echo "[1/4] backend（${#BACKEND_PATHS[@]} ファイル）のみ tar で転送..."
(
  cd "$ROOT"
  COPYFILE_DISABLE=1 tar czf - "${BACKEND_PATHS[@]}"
) | gcloud compute ssh "$DEPLOY_HOST" \
  --zone="$DEPLOY_ZONE" \
  "${GCLOUD_SSH_FLAGS[@]}" \
  --command="set -e; mkdir -p \"$DEPLOY_DIR\"; cd \"$DEPLOY_DIR\" && tar xzf -"

if [[ -z "${SKIP_NPM_BUILD:-}" ]]; then
  _fe_api_url="${REACT_APP_API_URL:-https://lots-of-love.top/api}"
  printf '%s\n' "[2/4] 手元で frontend をビルド (REACT_APP_API_URL=${_fe_api_url})..."
  (cd "$ROOT/frontend" && env REACT_APP_API_URL="${_fe_api_url}" npm run build)
else
  echo "[2/4] SKIP_NPM_BUILD=1 のためビルド省略（$ROOT/frontend/build をそのまま使う）"
  if [[ ! -f "$ROOT/frontend/build/index.html" ]]; then
    echo "エラー: frontend/build が無いので SKIP_NPM_BUILD できません" >&2
    exit 1
  fi
fi

echo "[3/4] frontend/build を VM に配置（nginx 用）..."
FE_STAGING="$(mktemp -d "${TMPDIR:-/tmp}/my_ads_fe_camp_only.XXXXXX")"
cleanup() { rm -rf "$FE_STAGING"; }
trap cleanup EXIT
cp -a "$ROOT/frontend/build/." "$FE_STAGING/"
gcloud compute scp --recurse "$FE_STAGING" "${DEPLOY_HOST}:${REMOTE_FE_STAGING}" --zone="$DEPLOY_ZONE"

gcloud compute ssh "$DEPLOY_HOST" \
  --zone="$DEPLOY_ZONE" \
  "${GCLOUD_SSH_FLAGS[@]}" \
  --command="set -e; STAGING=\$HOME/${REMOTE_FE_STAGING}; if [ -f \"\$STAGING/index.html\" ]; then ST=\"\$STAGING\"; else ST=\"\$STAGING/\$(ls -1 \"\$STAGING\" | head -1)\"; fi; sudo find ${DEPLOY_DIR}/frontend/build -mindepth 1 -maxdepth 1 -exec rm -rf {} +; sudo cp -a \"\$ST/.\" ${DEPLOY_DIR}/frontend/build/; rm -rf \"\$STAGING\""

echo "[4/4] accounts マイグレーション + コンテナ再起動..."
gcloud compute ssh "$DEPLOY_HOST" \
  --zone="$DEPLOY_ZONE" \
  "${GCLOUD_SSH_FLAGS[@]}" \
  --command="set -e; cd \"$DEPLOY_DIR\" && docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate accounts --noinput && docker compose -f docker-compose.prod.yml restart backend celery celery-beat nginx"

echo ""
echo "完了。反映した backend パス:"
printf '  %s\n' "${BACKEND_PATHS[@]}"
echo "フロントは上記 src を入力にした frontend/build を配置済み。"
echo ""
