# GCP VMへのデプロイ手順

## 前提条件

- GCP VMインスタンス（my-ads-platform）が起動していること
- Docker と Docker Compose がインストールされていること
- GitHubリポジトリへのアクセス権があること

## 初回デプロイ

### 1. VMに接続

```bash
# GCP Cloud Shellから
gcloud compute ssh my-ads-platform --zone=asia-northeast1-a

# またはローカルから
ssh -i ~/.ssh/your-key username@136.110.83.25
```

### 2. 必要なツールをインストール（初回のみ）

```bash
# Dockerのインストール
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Gitのインストール
sudo apt-get install -y git

# ログアウトして再ログイン（Dockerグループを有効化）
exit
# 再度SSH接続
```

### 3. リポジトリをクローン（初回のみ）

```bash
cd ~
git clone https://github.com/Junki1992/my_ads_platform.git
cd my_ads_platform
```

### 4. 環境変数ファイルを作成

```bash
cp env.example .env
nano .env  # または vi .env
```

**重要な設定項目：**

```bash
# セキュリティ
SECRET_KEY=本番用の長いランダム文字列に変更
DEBUG=False
ALLOWED_HOSTS=136.110.83.25,your-domain.com

# データベース
DB_ENGINE=django.db.backends.postgresql
DB_NAME=my_ads_platform
DB_USER=postgres
DB_PASSWORD=強力なパスワードに変更

# Meta API
META_APP_ID=あなたのMeta App ID
META_APP_SECRET=あなたのMeta App Secret

# フロントエンドURL
FRONTEND_URL=http://136.110.83.25

# SSL（本番環境）
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

### 5. 初回デプロイ実行

```bash
# 本番用Docker Composeで起動
docker-compose -f docker-compose.prod.yml up -d --build

# データベースマイグレーション
docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate

# 静的ファイル収集
docker-compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput

# 管理者ユーザー作成
docker-compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

### 6. 動作確認

```bash
# コンテナの状態確認
docker-compose -f docker-compose.prod.yml ps

# ログ確認
docker-compose -f docker-compose.prod.yml logs -f backend

# ブラウザでアクセス
# http://136.110.83.25/
```

---

## 更新デプロイ（2回目以降）

**Compose の書き方**: Docker 公式は **V2** で `docker compose`（スペース区切り）です。古い `docker-compose` 単体コマンドが無い VM が多いです。次の手順では **`docker compose`** で統一しています（`deploy.sh` はどちらも自動検出します）。

### 方法1: 自動デプロイスクリプト（推奨）

```bash
cd ~/my_ads_platform   # または /opt/my_ads_platform（リポジトリのルート。frontend 直下ではない）
chmod +x deploy.sh
./deploy.sh
```

### 方法2: 手動デプロイ

```bash
cd ~/my_ads_platform

# 1. 最新コードを取得
git pull origin main

# 2. 【重要】フロントをビルド（省略すると UI が古いまま）
# docker-compose.prod.yml はホストの ./frontend/build を nginx にマウントしているだけで、
# docker compose build は React をビルドしません。
cd frontend && npm ci && npm run build && cd ..

# 3. コンテナを停止（V2: docker compose）
docker compose -f docker-compose.prod.yml down

# 4. イメージを再構築して起動
docker compose -f docker-compose.prod.yml up -d --build

# 5. マイグレーション実行
docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate

# 6. 静的ファイル収集（Django 管理画面用など）
docker compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput

# 7. 動作確認
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

---

## トラブルシューティング

### 本番で React の変更（ボタン・文言など）が反映されない

**原因**: 上記のとおり **必ず `frontend` で `npm run build`** して `frontend/build` を更新してください。ブラウザのキャッシュも疑う場合はスーパーリロード（キャッシュ無効の再読み込み）を試してください。

VM に Node.js が無い場合は、ローカルや CI で `npm run build` した `build` フォルダをサーバーの `frontend/build` に同期する運用にしてください。

### コンテナが起動しない

```bash
# ログを確認
docker compose -f docker-compose.prod.yml logs backend
docker compose -f docker-compose.prod.yml logs nginx

# コンテナの状態確認
docker ps -a

# すべてクリーンアップして再起動
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build
```

### データベース接続エラー

```bash
# データベースコンテナのログ確認
docker compose -f docker-compose.prod.yml logs db

# データベースに直接接続して確認
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d my_ads_platform
```

### ポートが使用中

```bash
# 使用中のポートを確認
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :8000

# プロセスを停止
sudo kill -9 <PID>
```

### 管理者パスワードのリセット

```bash
docker-compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from apps.accounts.models import User
admin = User.objects.get(username='admin')
admin.set_password('new_password')
admin.save()
print('Password updated!')
"
```

---

## メンテナンスコマンド

### ログの確認

```bash
# 全サービスのログ
docker-compose -f docker-compose.prod.yml logs -f

# 特定サービスのログ
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### バックアップ

```bash
# データベースバックアップ
docker-compose -f docker-compose.prod.yml exec db pg_dump -U postgres my_ads_platform > backup_$(date +%Y%m%d).sql

# メディアファイルのバックアップ
tar -czf media_backup_$(date +%Y%m%d).tar.gz backend/media/
```

### リストア

```bash
# データベースリストア
cat backup_20250110.sql | docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres my_ads_platform

# メディアファイルリストア
tar -xzf media_backup_20250110.tar.gz
```

---

## SSL証明書の設定（オプション）

### Let's Encryptを使用する場合

```bash
# Certbotのインストール
sudo apt-get install -y certbot python3-certbot-nginx

# 証明書の取得
sudo certbot --nginx -d your-domain.com

# Nginx設定を更新してHTTPSを有効化
# nginx/conf.d/default.confのHTTPS設定のコメントを外す

# コンテナを再起動
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## 監視とアラート

### システムリソースの監視

```bash
# CPU、メモリ使用率
docker stats

# ディスク使用量
df -h
du -sh ~/my_ads_platform/*
```

### ヘルスチェック

```bash
# APIヘルスチェック
curl http://localhost/health

# バックエンドの動作確認
curl http://localhost/api/accounts/auth/login/
```

---

## CI/CDの設定（今後の改善）

GitHub Actionsを使った自動デプロイも検討できます。

```yaml
# .github/workflows/deploy.yml
name: Deploy to GCP
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        run: |
          ssh user@136.110.83.25 "cd ~/my_ads_platform && ./deploy.sh"
```

---

## お問い合わせ

デプロイに関する質問があれば、GitHubのIssuesでお知らせください。

