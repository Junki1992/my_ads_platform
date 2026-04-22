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

# VMでデプロイ実行（本番 VM 名・パスは環境に合わせて変更してください）
DEPLOY_HOST="${DEPLOY_HOST:-meta_ads_platform1008@ads-web-prod}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/my_ads_platform}"

echo -e "${GREEN}[1/4]${NC} 最新コードを取得してバックエンドを再構築中..."
gcloud compute ssh "$DEPLOY_HOST" \
  --zone=asia-northeast1-a \
  --command="cd $DEPLOY_DIR && \
    git pull origin main && \
    docker compose -f docker-compose.prod.yml up -d --build --no-deps backend celery celery-beat"

# マイグレーション実行
echo -e "${GREEN}[2/4]${NC} データベースマイグレーション実行中..."
gcloud compute ssh "$DEPLOY_HOST" \
  --zone=asia-northeast1-a \
  --command="cd $DEPLOY_DIR && \
    docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --noinput"

# 静的ファイル収集
echo -e "${GREEN}[3/4]${NC} 静的ファイル収集中..."
gcloud compute ssh "$DEPLOY_HOST" \
  --zone=asia-northeast1-a \
  --command="cd $DEPLOY_DIR && \
    docker compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput"

# backend のコンテナ IP が変わると nginx の upstream が古いまま 502 になるため必ず再起動
echo -e "${GREEN}[4/4]${NC} Nginx を再起動（upstream 更新）..."
gcloud compute ssh "$DEPLOY_HOST" \
  --zone=asia-northeast1-a \
  --command="cd $DEPLOY_DIR && \
    docker compose -f docker-compose.prod.yml restart nginx"

# 完了
echo ""
echo "=========================================="
echo -e "${GREEN}✅ デプロイが完了しました！${NC}"
echo "=========================================="
echo ""

