# My Ads Platform

Meta（Facebook/Instagram）広告管理プラットフォーム

## 機能

- ✅ ユーザー認証（JWT）
- ✅ 多言語対応（日本語、英語、中国語、韓国語）
- 🚧 広告キャンペーン管理
- 🚧 一括入稿
- 🚧 レポート機能
- 🚧 Meta API連携

## 技術スタック

### Backend
- Django 4.2
- Django REST Framework
- PostgreSQL / SQLite
- Celery + Redis
- JWT認証

### Frontend
- React 18
- TypeScript
- Ant Design
- i18next

## セットアップ

### 環境変数

```bash
cp .env.example .env
# .envファイルを編集して必要な設定を追加
```

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

### 認証
- `POST /api/accounts/auth/register/` - ユーザー登録
- `POST /api/accounts/auth/login/` - ログイン
- `POST /api/accounts/auth/logout/` - ログアウト
- `POST /api/accounts/token/refresh/` - トークンリフレッシュ

### ユーザー
- `GET /api/accounts/users/me/` - 現在のユーザー情報取得
- `PUT /api/accounts/users/update_profile/` - プロフィール更新
- `POST /api/accounts/users/change_password/` - パスワード変更

### 開発環境の認証情報

```
Email: admin@example.com
Password: admin123
```

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
# Backend
python manage.py test

# Frontend
npm test
```

## デプロイ

### 本番環境設定

1. `.env`ファイルで本番環境の設定を行う
2. `DEBUG=False`に設定
3. `SECRET_KEY`と`JWT_SECRET_KEY`を変更
4. PostgreSQLデータベースを設定
5. Redisを設定
6. 静的ファイルを収集: `python manage.py collectstatic`

### セキュリティチェックリスト

- [ ] SECRET_KEYを変更
- [ ] DEBUG=Falseに設定
- [ ] ALLOWED_HOSTSを設定
- [ ] HTTPS/SSL設定
- [ ] CORS設定の確認
- [ ] データベース認証情報の保護
- [ ] Sentryの設定（エラー監視）

## ライセンス

Proprietary

## 作者

Junki Hayashi
