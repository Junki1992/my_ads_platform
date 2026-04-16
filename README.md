# My Ads Platform

Meta（Facebook/Instagram）広告管理プラットフォーム

## 機能

### 認証・セキュリティ
- ✅ ユーザー認証（JWT）
- ✅ 二要素認証（2FA/TOTP）
- ✅ Rate Limiting（DoS攻撃対策）
- ✅ パスワード変更機能
- ✅ Metaアカウント削除時のパスワード確認（誤削除防止）

### 多言語・国際化
- ✅ 多言語対応（日本語、英語、中国語、韓国語）

### 広告管理
- ✅ 広告キャンペーン管理（CRUD）
- ✅ アドセット管理
- ✅ 一括入稿機能
- ✅ Meta API連携

### Metaアカウント管理
- ✅ Meta OAuth 2.0認証（公式認証フロー）
- ✅ 複数Metaアカウント管理
- ✅ アクセストークン自動更新
- ✅ 広告アカウント一覧取得
- ✅ 削除時のパスワード確認（セキュリティ強化）

### Box連携
- ✅ Box OAuth 2.0認証
- ✅ 複数Boxアカウント管理
- ✅ Boxファイル一覧取得（画像・動画ファイル対応）
- ✅ 画像ファイルサポート（jpg, jpeg, png, gif, webp）
- ✅ 動画ファイルサポート（mp4, mov, avi, mkv, wmv, flv, webm, m4v）
- ✅ サムネイル表示機能（Box API + 画像リサイズ対応）
- ✅ Boxからクリエイティブ画像・動画を選択して入稿
- ✅ アクセストークン自動更新

### その他
- ✅ アラート機能
- 🚧 レポート機能

## 技術スタック

### Backend
- Django 4.2
- Django REST Framework
- PostgreSQL / SQLite
- Celery + Redis
- JWT認証（Simple JWT）
- 二要素認証（pyotp + qrcode）
- Rate Limiting（django-ratelimit）
- テスト（pytest + pytest-django）

### Frontend
- React 18
- TypeScript
- Ant Design
- i18next（多言語対応）

### DevOps & Testing
- pytest（テストカバレッジ80%目標）
- pytest-django
- factory-boy（テストフィクスチャ）
- Docker & Docker Compose（本番環境対応）
- Nginx（リバースプロキシ + 静的ファイル配信）
- Gunicorn（WSGIサーバー）
- Let's Encrypt（SSL/HTTPS）
- Git（バージョン管理）
- GCP Compute Engine（デプロイ環境）

本番を GCP（Cloud SQL + Compute Engine）で運用する手順は [docs/deployment-gcp.md](docs/deployment-gcp.md) を参照してください。

## セットアップ

### 環境変数

```bash
cp env.example .env
# .envファイルを編集して必要な設定を追加
```

**重要な環境変数**:
- `SECRET_KEY`: Django シークレットキー
- `JWT_SECRET_KEY`: JWT トークン用シークレットキー
- `META_APP_ID`, `META_APP_SECRET`: Meta API認証情報（プラットフォーム共通）
- `META_ACCESS_TOKEN`: Meta長期アクセストークン（オプション）
- `BOX_CLIENT_ID`, `BOX_CLIENT_SECRET`, `BOX_REDIRECT_URI`: Box API認証情報とリダイレクトURI（Box連携を使用する場合）
- `FRONTEND_URL`: フロントエンドURL（OAuth認証時のリダイレクト先）
- `ALLOWED_HOSTS`: 許可するホスト名（カンマ区切り）
- `REDIS_URL`: Redis接続URL
- `SENTRY_DSN`: エラー監視（オプション）

**本番環境追加設定**:
- `DEBUG`: `False`に設定
- `SECURE_SSL_REDIRECT`: `True`（HTTPS強制）
- `SECURE_PROXY_SSL_HEADER`: Nginxリバースプロキシ対応

### Backend

```bash
cd backend

# 仮想環境の作成と有効化
python3 -m venv venv
source venv/bin/activate  # Mac/Linux
# venv\Scripts\activate  # Windows

# パッケージのインストール
pip install -r requirements.txt

# マイグレーション（開発環境）
export DJANGO_SETTINGS_MODULE=config.settings_dev
python manage.py migrate

# スーパーユーザー作成
python manage.py createsuperuser

# 開発サーバー起動
python manage.py runserver
```

### Frontend

```bash
cd frontend

# パッケージのインストール
npm install

# 開発サーバー起動
npm start
```

## API エンドポイント

### Box連携

- `GET /api/accounts/box-accounts/` - Boxアカウント一覧取得
- `GET /api/accounts/box-accounts/oauth_authorize/` - Box OAuth認証URL取得
- `GET /api/accounts/box-accounts/oauth_callback/` - Box OAuth認証コールバック（`BOX_REDIRECT_URI` と一致させる必要あり）
- `GET /api/accounts/box-accounts/{id}/list_files/` - Boxファイル一覧取得（画像・動画ファイル）
- `GET /api/accounts/box-accounts/{id}/thumbnail/{file_id}/` - Boxファイルサムネイル取得
- `GET /api/accounts/box-accounts/{id}/download-file/{file_id}/` - Boxファイルダウンロード
- `GET /api/accounts/box-accounts/{id}/get_access_token/` - Boxアクセストークン取得（Content Picker用）
- `DELETE /api/accounts/box-accounts/{id}/` - Boxアカウント削除

### Metaアカウント管理

### 認証
- `POST /api/accounts/auth/register/` - ユーザー登録
- `POST /api/accounts/auth/login/` - ログイン
- `POST /api/accounts/auth/logout/` - ログアウト
- `POST /api/accounts/token/refresh/` - トークンリフレッシュ

### ユーザー
- `GET /api/accounts/users/me/` - 現在のユーザー情報取得
- `PUT /api/accounts/users/update_profile/` - プロフィール更新
- `POST /api/accounts/users/change_password/` - パスワード変更

### 二要素認証
- `POST /api/accounts/users/enable_2fa/` - 2FA有効化
- `POST /api/accounts/users/verify_2fa/` - トークン検証
- `POST /api/accounts/users/verify_backup_code/` - バックアップコード検証
- `POST /api/accounts/users/disable_2fa/` - 2FA無効化
- `GET /api/accounts/users/get_2fa_status/` - 2FA状態確認

### Metaアカウント管理
- `GET /api/accounts/meta-accounts/` - Metaアカウント一覧取得
- `POST /api/accounts/meta-accounts/` - Metaアカウント作成
- `PUT /api/accounts/meta-accounts/{id}/` - Metaアカウント更新
- `DELETE /api/accounts/meta-accounts/{id}/` - Metaアカウント削除（パスワード確認必須）
- `GET /api/accounts/meta-accounts/oauth_authorize/` - OAuth認証URL取得
- `GET /api/accounts/meta-accounts/{id}/oauth_authorize_account/` - 特定アカウントのOAuth認証URL取得
- `GET /api/accounts/meta-accounts/oauth_callback/` - OAuth認証コールバック処理
- `POST /api/accounts/meta-accounts/exchange_token/` - 短期トークンを長期トークンに変換
- `POST /api/accounts/meta-accounts/fetch_accounts/` - Meta広告アカウント一覧取得

### 開発環境での認証

初回セットアップ後は、`python manage.py createsuperuser`で作成したアカウントでログインしてください。

## 開発

### コード品質

```bash
# Linting
flake8 backend/
eslint frontend/src/

# Formatting
black backend/
prettier --write frontend/src/
```

### テスト

```bash
# Backend（pytest）
cd backend
source venv/bin/activate
pytest

# テストカバレッジ付き
pytest --cov=apps --cov-report=html

# 特定のテストファイルのみ実行
pytest tests/test_accounts.py

# Frontend
cd frontend
npm test
```

## フィーチャーフラグ

開発中の機能はフィーチャーフラグで制御されています。

詳細は [docs/feature_flags.md](docs/feature_flags.md) を参照。

---

## デプロイ

### Docker Compose（本番環境）

本番環境用のデプロイスクリプトを提供しています。

**クイックデプロイ**:
```bash
# 完全デプロイ（バックエンド + フロントエンド）
./deploy.sh

# バックエンドのみデプロイ
./deploy-backend-only.sh

# フロントエンドのみデプロイ（高速）
./deploy-frontend-only.sh
```

**本番環境構成**:
- **Nginx**: リバースプロキシ + 静的ファイル配信（HTTPS対応）
- **Backend**: Django + Gunicorn（ポート8000）
- **Frontend**: React（ビルド済み静的ファイル）
- **PostgreSQL**: データベース
- **Redis**: キャッシュ + Celeryブローカー
- **Celery**: 非同期タスク実行
- **Celery Beat**: 定期タスクスケジューラ

### 本番環境設定

1. `.env`ファイルで本番環境の設定を行う
2. `DEBUG=False`に設定
3. `SECRET_KEY`と`JWT_SECRET_KEY`を変更
4. `FRONTEND_URL`を本番環境のURLに設定（例: `https://yourdomain.com`）
5. `ALLOWED_HOSTS`にドメイン名を追加
6. PostgreSQLデータベースを設定
7. Redisを設定
8. フィーチャーフラグを適切に設定
9. 静的ファイルを収集: `python manage.py collectstatic`

### GCP VM デプロイ

**前提条件**:
- GCP VMインスタンスが作成済み
- Docker、Docker Composeがインストール済み
- ドメイン名が設定済み（SSL証明書用）

**デプロイ手順**:
```bash
# 1. VMにSSH接続
gcloud compute ssh your-instance --zone=your-zone

# 2. リポジトリをクローン
git clone https://github.com/yourusername/my_ads_platform.git
cd my_ads_platform

# 3. 環境変数設定
cp env.example .env
nano .env  # 必要な設定を追加

# 4. SSL証明書取得（Let's Encrypt）
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# 5. Docker Composeで起動
docker compose -f docker-compose.prod.yml up -d --build

# 6. マイグレーション実行
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate

# 7. 静的ファイル収集
docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput

# 8. スーパーユーザー作成
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

**デプロイ後の更新**:
```bash
# ローカルから簡単デプロイ
./deploy.sh  # 全体デプロイ
./deploy-frontend-only.sh  # フロントエンドのみ（高速）
./deploy-backend-only.sh  # バックエンドのみ
```

### セキュリティチェックリスト

- [ ] SECRET_KEYとJWT_SECRET_KEYを変更
- [ ] DEBUG=Falseに設定
- [ ] ALLOWED_HOSTSを設定
- [ ] FRONTEND_URLを本番環境のURLに設定
- [ ] HTTPS/SSL設定（Let's Encrypt推奨）
- [ ] Nginxリバースプロキシ設定
- [ ] SECURE_PROXY_SSL_HEADERの設定
- [ ] CORS設定の確認
- [ ] データベース認証情報の保護
- [ ] Meta API認証情報の保護
- [ ] Sentryの設定（エラー監視）
- [x] Rate Limiting実装済み
- [x] 二要素認証実装済み
- [x] パスワード確認による削除保護実装済み
- [ ] 決済システム設定（本番環境）
- [ ] バックアップ戦略の確立
- [ ] Docker自動再起動設定（`restart: always`）

## ポートフォリオ

このプロジェクトは技術力の証明として作成された学習用プロジェクトです。

**実装した技術要素：**
- フルスタック開発（Django + React）
- RESTful API設計
- JWT認証システム
- **二要素認証（2FA/TOTP）** 🔐
- **Rate Limiting（DoS攻撃対策）** 🛡️
- **包括的テストカバレッジ（pytest）** ✅
- **Meta OAuth 2.0認証統合** 🔗
- **Docker Compose本番環境デプロイ** 🚀
- **Nginx + Gunicorn + HTTPS** 🔒
- 多言語対応（i18next）
- レスポンシブデザイン
- バックエンド非同期処理（Celery + Redis）
- ファイルアップロード・バリデーション
- Meta API連携（広告アカウント管理）
- **Box API連携（ファイル管理・クリエイティブ選択）** 📦
- **動画ファイルサポート** 🎬
- **サムネイル自動生成・表示** 🖼️
- GCP Compute Engineデプロイ

**セキュリティ機能：**
- IPベースのRate Limiting
- TOTP方式の二要素認証
- バックアップコード生成
- JWTトークンブラックリスト
- パスワードハッシュ化（Django標準）
- **削除操作時のパスワード確認（誤削除防止）** ✅
- HTTPS/SSL（Let's Encrypt）
- Nginxリバースプロキシ
- SECURE_PROXY_SSL_HEADER設定
- CORS保護
- Meta APIトークン暗号化保存
- Box APIトークン暗号化保存
- Boxアカウント認証エラー時の適切なエラーハンドリング

**テスト：**
- 30+のテストケース実装
- 認証フロー完全カバレッジ
- pytest + pytest-django
- テストカバレッジ80%目標

**注意事項：**
- このリポジトリは学習用途のみの開発プロジェクトです
- 実際のMeta APIキーは含まれていません
- 本番環境での使用には適切なセキュリティ設定が必要です

**Meta for Developers設定（OAuth認証を使用する場合）：**
1. [Meta for Developers](https://developers.facebook.com/)でアプリを作成
2. **アプリドメイン**に本番環境のドメインを追加
3. **有効なOAuthリダイレクトURI**に以下を追加：
   - `https://yourdomain.com/api/accounts/meta-accounts/oauth_callback/`
4. **App ID**と**App Secret**を`.env`ファイルに設定
5. 必要な権限を付与：`ads_management`, `ads_read`, `business_management`

**Box for Developers設定（Box連携を使用する場合）：**
1. [Box Developers](https://developer.box.com/)でアプリを作成
2. **OAuth 2.0**を有効化
3. **リダイレクトURI**に以下を追加：
   - 本番環境: `https://yourdomain.com/api/accounts/box-accounts/oauth_callback/`
   - 開発環境: `http://localhost:8000/api/accounts/box-accounts/oauth_callback/`
   - ※ Box Developer Console で登録したURLを `.env` の `BOX_REDIRECT_URI` にも同じ文字列で設定してください
4. **スコープ**に以下を設定：
   - `root_readwrite`（ファイル読み書きに必要）
5. **Client ID**と**Client Secret**を`.env`ファイルに設定：
   - `BOX_CLIENT_ID`
   - `BOX_CLIENT_SECRET`
   - `BOX_REDIRECT_URI`
6. **CORS設定**（Box Content Pickerを使用する場合）：
   - アプリ設定で許可するオリジンを追加（例: `http://localhost:3000`, `https://yourdomain.com`）

## ⚠️ 免責事項

このプロジェクトは**学習用途のみ**として作成されています。

**重要な免責事項：**
- 本プロジェクトをクローン・フォークして運用した場合に発生するいかなる損害についても、作者は一切の責任を負いません
- 本番環境での使用は自己責任で行ってください
- セキュリティ設定、データ保護、法的要件の遵守は使用者の責任です
- Meta API等の外部サービスの利用規約を必ず確認してください

**推奨事項：**
- 本番環境での使用前に、必ずセキュリティテストを実施してください
- 機密情報（APIキー、データベース認証情報等）の適切な管理を行ってください
- 定期的なセキュリティアップデートとバックアップを実施してください

## ライセンス

MIT License

**使用条件：**
- **学習用途のみ**での使用を許可します
- **商用利用は禁止**です
- 本プロジェクトの使用により生じるいかなる損害についても作者は責任を負いません

## 作者

Junki Hayashi
