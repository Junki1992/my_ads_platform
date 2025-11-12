#!/bin/bash

# ==============================================================================
# バックエンドのみデプロイスクリプト（高速版）
# ==============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "バックエンドのみデプロイを開始します..."
echo "=========================================="

# VMでデプロイ実行
echo -e "${GREEN}[1/3]${NC} 最新コードを取得してバックエンドを再構築中..."
gcloud compute ssh meta_ads_platform1008@my-ads-platform \
  --zone=asia-northeast1-a \
  --command="cd ~/my_ads_platform && \
    git pull origin main && \
    docker compose -f docker-compose.prod.yml up -d --build --no-deps backend celery celery-beat"

# マイグレーション実行
echo -e "${GREEN}[2/3]${NC} データベースマイグレーション実行中..."
gcloud compute ssh meta_ads_platform1008@my-ads-platform \
  --zone=asia-northeast1-a \
  --command="cd ~/my_ads_platform && \
    docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate"

# 静的ファイル収集
echo -e "${GREEN}[3/3]${NC} 静的ファイル収集中..."
gcloud compute ssh meta_ads_platform1008@my-ads-platform \
  --zone=asia-northeast1-a \
  --command="cd ~/my_ads_platform && \
    docker compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput"

# 完了
echo ""
echo "=========================================="
echo -e "${GREEN}✅ デプロイが完了しました！${NC}"
echo "=========================================="
echo ""

