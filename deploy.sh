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

echo "=========================================="
echo "デプロイを開始します..."
echo "=========================================="

# 1. 最新コードを取得
echo -e "${GREEN}[1/8]${NC} 最新コードを取得中..."
git pull origin main

# 2. 環境変数の確認
echo -e "${GREEN}[2/8]${NC} 環境変数を確認中..."
if [ ! -f .env ]; then
    echo -e "${RED}⚠️  .envファイルが見つかりません。env.exampleからコピーしてください。${NC}"
    echo "cp env.example .env"
    exit 1
fi

# 3. 変更されたファイルを確認
echo -e "${GREEN}[3/8]${NC} 変更されたファイルを確認中..."
git diff --name-only HEAD@{1} HEAD

# 4. Dockerコンテナを停止
echo -e "${GREEN}[4/8]${NC} 既存のDockerコンテナを停止中..."
docker-compose -f docker-compose.prod.yml down

# 5. Dockerイメージを再構築
echo -e "${GREEN}[5/8]${NC} Dockerイメージを再構築中..."
docker-compose -f docker-compose.prod.yml build

# 6. コンテナを起動
echo -e "${GREEN}[6/8]${NC} コンテナを起動中..."
docker-compose -f docker-compose.prod.yml up -d

# 7. データベースマイグレーション
echo -e "${GREEN}[7/8]${NC} データベースマイグレーションを実行中..."
sleep 10  # DBの起動を待つ
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py migrate

# 8. 静的ファイルの収集
echo -e "${GREEN}[8/8]${NC} 静的ファイルを収集中..."
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput

echo ""
echo "=========================================="
echo -e "${GREEN}✅ デプロイが完了しました！${NC}"
echo "=========================================="
echo ""
echo "確認コマンド:"
echo "  docker-compose -f docker-compose.prod.yml ps          # コンテナの状態確認"
echo "  docker-compose -f docker-compose.prod.yml logs -f     # ログを確認"
echo "  curl http://localhost/health                           # ヘルスチェック"
echo ""

