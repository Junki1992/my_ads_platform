#!/bin/bash

# ==============================================================================
# GCP VM デプロイスクリプト（本番環境用）
# ==============================================================================

set -e  # エラーが発生したら即座に終了

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compose V2 は「docker compose」、V1 は「docker-compose」
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker-compose)
else
  echo -e "${RED}Docker Compose が見つかりません。Docker Compose プラグイン（docker compose）を入れるか docker-compose をインストールしてください。${NC}"
  exit 1
fi

echo "=========================================="
echo "デプロイを開始します..."
echo "=========================================="

# 1. 最新コードを取得
echo -e "${GREEN}[1/9]${NC} 最新コードを取得中..."
git pull origin main

# 2. 環境変数の確認
echo -e "${GREEN}[2/9]${NC} 環境変数を確認中..."
if [ ! -f .env ]; then
    echo -e "${RED}⚠️  .envファイルが見つかりません。env.exampleからコピーしてください。${NC}"
    echo "cp env.example .env"
    exit 1
fi

# 3. 変更されたファイルを確認
echo -e "${GREEN}[3/9]${NC} 変更されたファイルを確認中..."
git diff --name-only HEAD@{1} HEAD

# 4. フロントエンドビルド（本番 nginx は ./frontend/build をマウント。Docker だけでは React は更新されない）
echo -e "${GREEN}[4/9]${NC} フロントエンドをビルド中..."
if command -v npm >/dev/null 2>&1 && [ -f frontend/package.json ]; then
  (cd frontend && npm ci && npm run build)
else
  echo -e "${YELLOW}⚠️  npm が無いか frontend/package.json がありません。${NC}"
  echo -e "${YELLOW}   別マシンで build した frontend/build を配置するか、Node.js を入れてから再実行してください。${NC}"
  exit 1
fi

# 5. Dockerコンテナを停止
echo -e "${GREEN}[5/9]${NC} 既存のDockerコンテナを停止中..."
"${DOCKER_COMPOSE[@]}" -f docker-compose.prod.yml down

# 6. Dockerイメージを再構築
echo -e "${GREEN}[6/9]${NC} Dockerイメージを再構築中..."
"${DOCKER_COMPOSE[@]}" -f docker-compose.prod.yml build

# 7. コンテナを起動
echo -e "${GREEN}[7/9]${NC} コンテナを起動中..."
"${DOCKER_COMPOSE[@]}" -f docker-compose.prod.yml up -d

# 8. データベースマイグレーション
echo -e "${GREEN}[8/9]${NC} データベースマイグレーションを実行中..."
sleep 10  # DBの起動を待つ
"${DOCKER_COMPOSE[@]}" -f docker-compose.prod.yml exec -T backend python manage.py migrate

# 9. 静的ファイルの収集
echo -e "${GREEN}[9/9]${NC} 静的ファイルを収集中..."
"${DOCKER_COMPOSE[@]}" -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput

echo ""
echo "=========================================="
echo -e "${GREEN}✅ デプロイが完了しました！${NC}"
echo "=========================================="
echo ""
echo "確認コマンド:"
echo "  ${DOCKER_COMPOSE[*]} -f docker-compose.prod.yml ps          # コンテナの状態確認"
echo "  ${DOCKER_COMPOSE[*]} -f docker-compose.prod.yml logs -f     # ログを確認"
echo "  curl http://localhost/health                           # ヘルスチェック"
echo ""
