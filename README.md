# My Ads Platform

Meta（Facebook/Instagram）広告管理プラットフォーム

## 機能

### 認証・セキュリティ
- ✅ ユーザー認証（JWT）
- ✅ 二要素認証（2FA/TOTP）
- ✅ Rate Limiting（DoS攻撃対策）
- ✅ パスワード変更機能

### 多言語・国際化
- ✅ 多言語対応（日本語、英語、中国語、韓国語）

### 広告管理
- ✅ 広告キャンペーン管理（CRUD）
- ✅ アドセット管理
- ✅ 一括入稿機能
- ✅ Meta API連携

### その他
- ✅ アラート機能
- 🚧 レポート機能
- 🚧 課金システム（開発中）

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
- Stripe決済（開発中）

### Frontend
- React 18
- TypeScript
- Ant Design
- i18next（多言語対応）

### DevOps & Testing
- pytest（テストカバレッジ80%目標）
- pytest-django
- factory-boy（テストフィクスチャ）
- Docker & Docker Compose
- Git（バージョン管理）

## セットアップ

### 環境変数

```bash
cp env.example .env
# .envファイルを編集して必要な設定を追加
```

**重要な環境変数**:
- `SECRET_KEY`: Django シークレットキー
- `JWT_SECRET_KEY`: JWT トークン用シークレットキー
- `META_APP_ID`, `META_APP_SECRET`: Meta API認証情報
- `REDIS_URL`: Redis接続URL
- `SENTRY_DSN`: エラー監視（オプション）

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

### 二要素認証
- `POST /api/accounts/users/enable_2fa/` - 2FA有効化
- `POST /api/accounts/users/verify_2fa/` - トークン検証
- `POST /api/accounts/users/verify_backup_code/` - バックアップコード検証
- `POST /api/accounts/users/disable_2fa/` - 2FA無効化
- `GET /api/accounts/users/get_2fa_status/` - 2FA状態確認

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

### 本番環境設定

1. `.env`ファイルで本番環境の設定を行う
2. `DEBUG=False`に設定
3. `SECRET_KEY`と`JWT_SECRET_KEY`を変更
4. PostgreSQLデータベースを設定
5. Redisを設定
6. フィーチャーフラグを適切に設定
7. 静的ファイルを収集: `python manage.py collectstatic`

### セキュリティチェックリスト

- [ ] SECRET_KEYとJWT_SECRET_KEYを変更
- [ ] DEBUG=Falseに設定
- [ ] ALLOWED_HOSTSを設定
- [ ] HTTPS/SSL設定
- [ ] CORS設定の確認
- [ ] データベース認証情報の保護
- [ ] Sentryの設定（エラー監視）
- [x] Rate Limiting実装済み
- [x] 二要素認証実装済み
- [ ] 決済システム設定（本番環境）
- [ ] バックアップ戦略の確立

## ポートフォリオ

このプロジェクトは技術力の証明として作成されたポートフォリオです。

**実装した技術要素：**
- フルスタック開発（Django + React）
- RESTful API設計
- JWT認証システム
- **二要素認証（2FA/TOTP）** 🔐
- **Rate Limiting（DoS攻撃対策）** 🛡️
- **包括的テストカバレッジ（pytest）** ✅
- 多言語対応（i18next）
- レスポンシブデザイン
- バックエンド非同期処理（Celery）
- ファイルアップロード・バリデーション
- Meta API連携

**セキュリティ機能：**
- IPベースのRate Limiting
- TOTP方式の二要素認証
- バックアップコード生成
- JWTトークンブラックリスト
- パスワードハッシュ化（Django標準）

**テスト：**
- 30+のテストケース実装
- 認証フロー完全カバレッジ
- pytest + pytest-django
- テストカバレッジ80%目標

**注意事項：**
- このリポジトリは商用化を目指した開発プロジェクトです
- 実際のMeta APIキーは含まれていません
- 本番環境での使用には適切なセキュリティ設定が必要です
- 現在開発中の機能: 決済システム、サブスクリプション管理

## ⚠️ 免責事項

このプロジェクトは**学習・ポートフォリオ用途**として作成されています。

**重要な免責事項：**
- 本プロジェクトをクローン・フォークして運用した場合に発生するいかなる損害についても、作者は一切の責任を負いません
- 本番環境での使用は自己責任で行ってください
- セキュリティ設定、データ保護、法的要件の遵守は使用者の責任です
- Meta API、決済システム等の外部サービスの利用規約を必ず確認してください
- 商用利用の場合は、適切な法的審査とセキュリティ監査を実施してください

**推奨事項：**
- 本番環境での使用前に、必ずセキュリティテストを実施してください
- 機密情報（APIキー、データベース認証情報等）の適切な管理を行ってください
- 定期的なセキュリティアップデートとバックアップを実施してください

## ライセンス

MIT License

**使用条件：**
- 学習・ポートフォリオ用途での使用を許可します
- 商用利用は可能ですが、上記免責事項が適用されます
- 本プロジェクトの使用により生じるいかなる損害についても作者は責任を負いません

## 作者

Junki Hayashi
