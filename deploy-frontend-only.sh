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
export REACT_APP_API_URL=http://136.110.83.25
npm run build
cd ..

# 2. ビルドファイルをVMにアップロード
echo -e "${GREEN}[2/4]${NC} ビルドファイルをVMにアップロード中..."
gcloud compute scp --recurse \
  frontend/build/* \
  meta_ads_platform1008@my-ads-platform:~/my_ads_platform/frontend/build/ \
  --zone=asia-northeast1-a

# 3. VMでNginxを再起動
echo -e "${GREEN}[3/4]${NC} Nginxを再起動中..."
gcloud compute ssh meta_ads_platform1008@my-ads-platform \
  --zone=asia-northeast1-a \
  --command="cd ~/my_ads_platform && docker compose -f docker-compose.prod.yml restart nginx"

# 4. 完了
echo ""
echo "=========================================="
echo -e "${GREEN}✅ デプロイが完了しました！${NC}"
echo "=========================================="
echo ""
echo "フロントエンド: http://136.110.83.25"
echo ""

