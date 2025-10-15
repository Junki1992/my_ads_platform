# フィーチャーフラグ設定ガイド

## 📋 概要

本プロジェクトでは、環境変数によるフィーチャーフラグを使用して、環境ごとに機能を有効/無効にすることができます。

---

## 🚩 利用可能なフィーチャーフラグ

### ENABLE_BILLING（決済機能）

**用途**: 決済機能の有効/無効を制御

**設定値**:
- `True` - 決済機能を有効化（開発環境推奨）
- `False` - 決済機能を無効化（本番環境初期推奨）

**影響範囲**:
- バックエンド: 決済関連エンドポイントへのアクセス
- フロントエンド: 決済関連UIの表示/非表示

---

## ⚙️ 設定方法

### バックエンド（Django）

#### 1. 環境変数を設定

```bash
# .env ファイル
ENABLE_BILLING=False
```

#### 2. 本番環境（GCP VM）での設定

**方法A: .envファイル**
```bash
# SSH接続
ssh your-vm-instance

# .envファイルを編集
cd /path/to/my_ads_platform
nano .env

# 決済機能を無効に設定
ENABLE_BILLING=False
```

**方法B: systemdサービスファイル**
```ini
# /etc/systemd/system/myads.service
[Service]
Environment="ENABLE_BILLING=False"
```

**方法C: Dockerコンテナ**
```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - ENABLE_BILLING=False
```

#### 3. 設定反映

```bash
# Djangoサーバーを再起動
sudo systemctl restart myads

# またはDocker
docker-compose restart backend
```

---

### フロントエンド（React）

#### 1. 環境変数を設定

```bash
# .env ファイル
REACT_APP_ENABLE_BILLING=false
```

#### 2. ビルド時に反映

```bash
# 開発環境
npm start

# 本番ビルド
REACT_APP_ENABLE_BILLING=false npm run build
```

#### 3. 本番環境での設定

**Vercel/Netlify**:
- 環境変数設定画面で `REACT_APP_ENABLE_BILLING=false` を設定

**Docker**:
```yaml
# docker-compose.yml
services:
  frontend:
    environment:
      - REACT_APP_ENABLE_BILLING=false
```

---

## 📊 環境別推奨設定

### 開発環境（ローカル）
```bash
# バックエンド
ENABLE_BILLING=True

# フロントエンド
REACT_APP_ENABLE_BILLING=true
```
**目的**: 決済機能の開発・テスト

---

### 本番環境（初期）
```bash
# バックエンド
ENABLE_BILLING=False  # ⭐ 無効化

# フロントエンド
REACT_APP_ENABLE_BILLING=false  # ⭐ 無効化
```
**目的**: 既存機能のみ提供、決済機能は非表示

---

### 本番環境（機能リリース後）
```bash
# バックエンド
ENABLE_BILLING=True  # ⭐ 有効化

# フロントエンド
REACT_APP_ENABLE_BILLING=true  # ⭐ 有効化
```
**目的**: 決済機能をリリース

---

## 🔍 動作確認

### バックエンド確認

```bash
# Djangoシェルで確認
python manage.py shell

>>> from django.conf import settings
>>> print(f"ENABLE_BILLING: {settings.ENABLE_BILLING}")
ENABLE_BILLING: False
```

### APIアクセステスト

```bash
# 決済機能が無効の場合
curl http://localhost:8000/api/billing/subscriptions/
# → 503 Service Unavailable

# 決済機能が有効の場合
curl http://localhost:8000/api/billing/subscriptions/
# → 200 OK（認証エラーまたは正常なレスポンス）
```

### フロントエンド確認

ブラウザのコンソールで：
```javascript
import config from './config';
console.log(config.features.billingEnabled);
// false または true
```

---

## 🎯 使用例

### フロントエンドでの使用

```typescript
import config from './config';

function PricingPage() {
  // 決済機能が無効な場合、Coming Soonページを表示
  if (!config.features.billingEnabled) {
    return (
      <div>
        <h1>決済機能は準備中です</h1>
        <p>近日公開予定です。お楽しみに！</p>
      </div>
    );
  }
  
  // 決済機能が有効な場合、通常のUI
  return <PricingContent />;
}
```

### バックエンドでの使用（追加チェック）

```python
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

@api_view(['POST'])
def create_subscription(request):
    # 念のためビューレベルでもチェック
    if not settings.ENABLE_BILLING:
        return Response(
            {'error': '決済機能は現在利用できません'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    
    # 決済処理...
```

---

## ⚠️ 注意事項

### 1. 環境変数の変更後は再起動が必要

```bash
# Django
sudo systemctl restart myads

# Docker
docker-compose restart

# React（開発サーバー）
Ctrl+C → npm start
```

### 2. フロントエンドは再ビルドが必要

環境変数はビルド時に埋め込まれるため、変更後は再ビルドが必要です。

```bash
npm run build
```

### 3. 本番環境ではキャッシュをクリア

```bash
# ブラウザのキャッシュクリア
# または
# CloudFrontなどのCDNキャッシュを無効化
```

---

## 🔄 段階的リリース計画

### Phase 1: 本番デプロイ（決済機能OFF）
```bash
ENABLE_BILLING=False
REACT_APP_ENABLE_BILLING=false
```
- 既存ユーザーは通常通り利用可能
- 決済機能は完全に非表示

### Phase 2: 正式リリース
```bash
ENABLE_BILLING=True
REACT_APP_ENABLE_BILLING=true
```
- 全ユーザーに決済機能を公開

---

## 📝 チェックリスト

### 本番デプロイ前
- [ ] `.env`ファイルで`ENABLE_BILLING=False`を設定
- [ ] フロントエンドで`REACT_APP_ENABLE_BILLING=false`を設定
- [ ] 動作確認（決済APIが503を返すこと）
- [ ] フロントエンドに決済UIが表示されないこと

### 決済機能リリース前
- [ ] 決済システムの設定完了
- [ ] テスト決済の実施
- [ ] 利用規約・プライバシーポリシーの最終確認
- [ ] `ENABLE_BILLING=True`に変更
- [ ] `REACT_APP_ENABLE_BILLING=true`に変更
- [ ] 再デプロイ

---

**作成日**: 2025-10-11  
**更新日**: 2025-10-11

