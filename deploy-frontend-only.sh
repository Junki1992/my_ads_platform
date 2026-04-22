#!/bin/bash

# ==============================================================================
# フロントエンドのみデプロイスクリプト（高速版）
# ==============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "フロントエンドのみデプロイを開始します..."
echo "=========================================="

# 1. ローカルでビルド
echo -e "${GREEN}[1/4]${NC} ローカルでフロントエンドをビルド中..."
cd frontend
export REACT_APP_API_URL=https://lots-of-love.top/api
npm run build
cd ..

# 2. ビルドファイルをVMにアップロード（/opt は root 所有のためホーム経由で sudo 反映）
DEPLOY_HOST="${DEPLOY_HOST:-meta_ads_platform1008@ads-web-prod}"
DEPLOY_ZONE="${DEPLOY_ZONE:-asia-northeast1-a}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/my_ads_platform}"
REMOTE_DIR="frontend_build_staging"

echo -e "${GREEN}[2/4]${NC} ビルドファイルをVMにアップロード中..."
FE_STAGING="$(mktemp -d "${TMPDIR:-/tmp}/my_ads_fe_build.XXXXXX")"
trap 'rm -rf "$FE_STAGING"' EXIT
cp -a frontend/build/. "${FE_STAGING}/"
gcloud compute scp --recurse "${FE_STAGING}" "${DEPLOY_HOST}:${REMOTE_DIR}" --zone="${DEPLOY_ZONE}"

# 3. VMで配置して Nginx を再起動
echo -e "${GREEN}[3/4]${NC} 静的ファイルを配置し Nginx を再起動中..."
gcloud compute ssh "${DEPLOY_HOST}" \
  --zone="${DEPLOY_ZONE}" \
  --command="set -e; STAGING=\$HOME/${REMOTE_DIR}; if [ -f \"\$STAGING/index.html\" ]; then ST=\"\$STAGING\"; else ST=\"\$STAGING/\$(ls -1 \"\$STAGING\" | head -1)\"; fi; sudo find ${DEPLOY_DIR}/frontend/build -mindepth 1 -maxdepth 1 -exec rm -rf {} +; sudo cp -a \"\$ST/.\" ${DEPLOY_DIR}/frontend/build/; rm -rf \"\$STAGING\"; cd ${DEPLOY_DIR} && sudo docker compose -f docker-compose.prod.yml restart nginx"

# 4. 完了
echo ""
echo "=========================================="
echo -e "${GREEN}✅ デプロイが完了しました！${NC}"
echo "=========================================="
echo ""
echo "フロントエンド: https://lots-of-love.top"
echo ""

