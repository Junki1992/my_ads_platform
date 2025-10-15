# 📚 完全学習ロードマップ - ゼロからフルスタック開発者へ

このプロジェクトを教材として、基礎から体系的にスキルを習得するための完全ガイドです。

## 🎯 学習の進め方

このロードマップは**段階的な学習**を想定しています：
1. 各フェーズを順番に進める
2. 実際にコードを書いて試す（読むだけでなく）
3. 既存コードを改変してみる（壊して学ぶ）
4. 小さな機能を自分で追加してみる

---

## フェーズ 0: 環境構築と基本概念の理解（1-2週間）

### 目標
プロジェクトを動かし、全体像を把握する

### 学習内容

#### 1. 開発環境のセットアップ
```bash
# 1. プロジェクトのクローン確認
pwd  # /Users/junkihayashi/Documents/Python/my_ads_platform

# 2. Pythonバージョン確認
python3 --version  # 3.9以上推奨

# 3. Node.jsバージョン確認
node --version  # 18以上推奨
npm --version
```

#### 2. 基本概念の理解

**アーキテクチャ図を描いてみる：**
```
[ブラウザ] 
    ↓ (HTTPリクエスト)
[React Frontend :3000]
    ↓ (API呼び出し)
[Django Backend :8000]
    ↓
[SQLite/PostgreSQL データベース]
[Redis] ← [Celery Worker] (非同期タスク)
```

**理解すべき用語：**
- **フロントエンド**: ユーザーが見る画面（React）
- **バックエンド**: データ処理・ビジネスロジック（Django）
- **API**: フロントとバックエンドの橋渡し（REST API）
- **データベース**: データの永続化（SQLite）
- **認証**: ユーザーが誰かを確認（JWT）

### 実践課題

#### 課題 0-1: プロジェクトを起動する
```bash
# バックエンド起動
cd backend
source venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings_dev
python manage.py runserver

# 別のターミナルでフロントエンド起動
cd frontend
npm start
```

**確認：**
- http://localhost:3000 でログイン画面が表示される
- http://localhost:8000/admin でDjango管理画面が表示される

#### 課題 0-2: プロジェクト構造を理解する
```bash
# ファイル構造を確認
tree -L 2 -I 'node_modules|venv|__pycache__'
```

**ノート作成：**
各ディレクトリの役割をメモする：
- `backend/apps/` → 各機能モジュール
- `backend/config/` → プロジェクト設定
- `frontend/src/pages/` → 画面コンポーネント
- `frontend/src/services/` → API呼び出しロジック

---

## フェーズ 1: Python + Django基礎（2-4週間）

### 目標
バックエンドの基本を理解し、簡単なAPIを作れるようになる

### 1.1 Python基礎の復習

#### 必須知識
- データ型（str, int, list, dict）
- 関数とクラス
- デコレータ
- 例外処理
- ファイルI/O

#### 実践：既存コードを読む
```python
# backend/apps/accounts/models.py を開く
# User モデルを理解する
```

**課題 1-1: カスタムユーザーモデルを理解する**
- `models.py` の `User` クラスを読む
- どんなフィールドがあるか書き出す
- なぜ `AbstractUser` を継承しているのか調べる

### 1.2 Djangoの基本概念

#### MTV（Model-Template-View）パターン
Django は **MTV** パターン：
- **Model**: データベース構造（`models.py`）
- **Template**: HTML（今回はReactなので使わない）
- **View**: ロジック処理（`views.py`）

#### URL → View の流れ
```python
# 1. urls.py でURLパターンを定義
# backend/apps/accounts/urls.py
path('users/me/', views.UserProfileView.as_view(), name='user-profile'),

# 2. views.py でリクエスト処理
# backend/apps/accounts/views.py
class UserProfileView(APIView):
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

# 3. serializers.py でデータ整形
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'username']
```

### 1.3 Django REST Framework（DRF）

#### 基本コンポーネント
1. **Serializer**: Pythonオブジェクト ↔ JSON変換
2. **APIView**: 基本的なビュー
3. **ViewSet**: CRUD操作をまとめたビュー
4. **Router**: URL自動生成

#### 実践：既存のAPIを読む

**課題 1-2: ログインAPIの流れを追跡**
```python
# 1. frontend/src/services/authService.ts
# login() 関数を見る → どこにリクエストしている？

# 2. backend/config/urls.py
# /api/accounts/ のルーティングを確認

# 3. backend/apps/accounts/urls.py
# login エンドポイントを探す

# 4. backend/apps/accounts/views.py
# LoginView を読む
```

**デバッグ実践：**
```python
# views.py にprint文を入れて動作確認
class LoginView(APIView):
    def post(self, request):
        print("🔍 受信データ:", request.data)  # ← 追加
        email = request.data.get('email')
        password = request.data.get('password')
        print(f"🔍 Email: {email}")  # ← 追加
        # ... 残りのコード
```

フロントエンドでログイン → ターミナルでprint出力確認

### 1.4 データベース（モデル設計）

#### 基本概念
```python
# モデル = データベーステーブルの設計図
class Campaign(models.Model):
    name = models.CharField(max_length=255)  # 文字列
    budget = models.DecimalField(max_digits=10, decimal_places=2)  # 数値
    user = models.ForeignKey(User, on_delete=models.CASCADE)  # リレーション
    created_at = models.DateTimeField(auto_now_add=True)  # 日時
```

**課題 1-3: Campaignモデルを理解する**
```bash
# 1. モデル定義を読む
# backend/apps/campaigns/models.py

# 2. データベースを直接見る
cd backend
python manage.py dbshell
> .tables  # テーブル一覧
> .schema campaigns_campaign  # スキーマ確認
> SELECT * FROM campaigns_campaign LIMIT 5;  # データ確認
> .exit
```

#### マイグレーションの理解
```bash
# モデル変更をデータベースに反映する仕組み

# 1. マイグレーションファイル作成
python manage.py makemigrations

# 2. データベースに適用
python manage.py migrate

# 3. マイグレーション履歴確認
python manage.py showmigrations
```

**課題 1-4: 新しいフィールドを追加してみる**
```python
# backend/apps/campaigns/models.py
class Campaign(models.Model):
    # 既存のフィールド...
    
    # 新しいフィールドを追加
    notes = models.TextField(blank=True, default='')  # メモ欄
```

```bash
# マイグレーション実行
python manage.py makemigrations
python manage.py migrate

# DBを確認
python manage.py dbshell
> .schema campaigns_campaign  # notes フィールドが追加されている
```

### 実践プロジェクト（フェーズ1）

**プロジェクト 1: 「タグ機能」を実装する**

要件：
- キャンペーンに複数のタグを付けられる
- タグでフィルタリングできる

実装手順：
1. `Tag` モデルを作成
2. `Campaign` と多対多リレーション
3. シリアライザにタグフィールド追加
4. APIエンドポイント実装

---

## フェーズ 2: React + TypeScript基礎（2-4週間）

### 目標
フロントエンドの基本を理解し、画面を作れるようになる

### 2.1 JavaScript/TypeScript基礎

#### 必須知識
- 変数（let, const）
- アロー関数
- Promise / async-await
- 分割代入
- スプレッド構文
- 型システム（TypeScript）

```typescript
// 実際のプロジェクトコードから学ぶ
// frontend/src/services/authService.ts

// 型定義
interface LoginCredentials {
  email: string;
  password: string;
}

// 非同期関数
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await api.post('/auth/login/', credentials);
  return response.data;
};
```

### 2.2 Reactの基本概念

#### コンポーネント
React = **再利用可能なUIパーツ**

```tsx
// 関数コンポーネント
const MyButton = () => {
  return <button>クリック</button>;
};
```

#### State（状態管理）
```tsx
import { useState } from 'react';

const Counter = () => {
  const [count, setCount] = useState(0);  // state宣言
  
  return (
    <div>
      <p>カウント: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
};
```

#### useEffect（副作用）
```tsx
import { useEffect, useState } from 'react';

const UserProfile = () => {
  const [user, setUser] = useState(null);
  
  // コンポーネントマウント時に実行
  useEffect(() => {
    // APIからユーザー情報取得
    fetchUser().then(data => setUser(data));
  }, []);  // 空配列 = 初回のみ実行
  
  return <div>{user?.name}</div>;
};
```

**課題 2-1: Loginコンポーネントを理解する**
```bash
# frontend/src/pages/Login.tsx を開く
```

読み解くポイント：
1. どんなstateがある？（useState）
2. フォーム送信時に何が起こる？（handleSubmit）
3. APIをどう呼んでいる？（authService.login）
4. ログイン成功後の処理は？（navigate）

### 2.3 実践：コンポーネントを改造する

**課題 2-2: ログイン画面のメッセージを変更**
```tsx
// frontend/src/pages/Login.tsx

// 変更前
<h2>ログイン</h2>

// 変更後
<h2>🚀 My Ads Platform - ログイン</h2>
```

保存 → ブラウザで確認

**課題 2-3: 新しいボタンを追加**
```tsx
// Login.tsx の return 内に追加
<Button
  type="default"
  onClick={() => alert('デモ機能は開発中です')}
  block
>
  デモアカウントでログイン
</Button>
```

### 2.4 TypeScriptの型システム

#### 基本的な型
```typescript
// プリミティブ型
const name: string = "太郎";
const age: number = 25;
const isActive: boolean = true;

// 配列
const tags: string[] = ["広告", "キャンペーン"];

// オブジェクト
interface User {
  id: number;
  email: string;
  name?: string;  // オプショナル
}

const user: User = {
  id: 1,
  email: "test@example.com"
};
```

**課題 2-4: 型定義を追加する**
```typescript
// frontend/src/services/campaignService.ts

// 新しい型を定義
export interface CampaignTag {
  id: number;
  name: string;
  color: string;
}

export interface Campaign {
  id: number;
  name: string;
  // 既存のフィールド...
  tags: CampaignTag[];  // ← 追加
}
```

### 2.5 Ant Design（UIライブラリ）

このプロジェクトでは**Ant Design**を使用しています。

```tsx
import { Button, Input, Form, Table } from 'antd';

// フォーム
<Form onFinish={handleSubmit}>
  <Form.Item name="email" label="メールアドレス">
    <Input />
  </Form.Item>
  <Button type="primary" htmlType="submit">送信</Button>
</Form>

// テーブル
<Table dataSource={campaigns} columns={columns} />
```

**課題 2-5: Ant Designのドキュメントを見る**
- https://ant.design/components/overview/
- よく使うコンポーネントを試す（Button, Modal, Notification）

### 実践プロジェクト（フェーズ2）

**プロジェクト 2: 「キャンペーンメモ機能」のフロントエンド**

要件：
- キャンペーン詳細画面にメモ欄を追加
- メモを編集・保存できる

実装手順：
1. Campaigns.tsx にメモ表示エリアを追加
2. 編集用のTextAreaコンポーネント配置
3. 保存ボタンでAPI呼び出し
4. エラーハンドリング

---

## フェーズ 3: フロントエンド ↔ バックエンド連携（2週間）

### 目標
APIを通じてデータをやり取りする仕組みを完全に理解する

### 3.1 HTTP通信の基礎

#### HTTPメソッド
- **GET**: データ取得（読み取り専用）
- **POST**: データ作成
- **PUT/PATCH**: データ更新
- **DELETE**: データ削除

#### ステータスコード
- **200**: 成功
- **201**: 作成成功
- **400**: リクエストエラー
- **401**: 認証エラー
- **404**: 見つからない
- **500**: サーバーエラー

### 3.2 Axiosでの通信

```typescript
// frontend/src/services/campaignService.ts

import axios from 'axios';

// GETリクエスト
export const getCampaigns = async () => {
  const response = await axios.get('/api/campaigns/');
  return response.data;
};

// POSTリクエスト
export const createCampaign = async (data: CreateCampaignData) => {
  const response = await axios.post('/api/campaigns/', data);
  return response.data;
};
```

### 3.3 認証トークンの流れ

```
1. ログイン
   [Frontend] POST /api/auth/login/ → [Backend]
   
2. トークン受信
   [Backend] → { access: "eyJ...", refresh: "eyJ..." } → [Frontend]
   
3. localStorageに保存
   localStorage.setItem('access_token', token);
   
4. 以降のリクエストでトークンを送信
   headers: { Authorization: `Bearer ${token}` }
```

**課題 3-1: ネットワークタブで確認**
1. ブラウザのDevToolsを開く（F12）
2. Networkタブに移動
3. ログインする
4. リクエスト/レスポンスを確認

**確認項目：**
- リクエストURL
- HTTPメソッド
- Request Headers
- Request Payload
- Response Status
- Response Data

### 3.4 APIのデバッグ

**課題 3-2: PostmanでAPIを叩く**

```bash
# 1. ログインして、トークンを取得
POST http://localhost:8000/api/accounts/auth/login/
Body: {
  "email": "admin@example.com",
  "password": "admin123"
}

# 2. トークンをコピー

# 3. キャンペーン一覧取得
GET http://localhost:8000/api/campaigns/campaigns/
Headers:
  Authorization: Bearer <トークン>
```

### 3.5 エラーハンドリング

```typescript
// 良い例
try {
  const data = await getCampaigns();
  setCampaigns(data);
} catch (error) {
  if (error.response?.status === 401) {
    // 認証エラー → ログイン画面へ
    navigate('/login');
  } else {
    // その他エラー → エラーメッセージ表示
    message.error('キャンペーンの取得に失敗しました');
  }
}
```

### 実践プロジェクト（フェーズ3）

**プロジェクト 3: エンドツーエンドで機能実装**

要件：「お気に入りキャンペーン機能」
1. バックエンド: `is_favorite` フィールド追加
2. API: お気に入り切り替えエンドポイント
3. フロントエンド: ★ボタンで切り替え

---

## フェーズ 4: 認証とセキュリティ（1-2週間）

### 目標
認証の仕組みとセキュリティのベストプラクティスを理解する

### 4.1 JWT認証の仕組み

#### JWT（JSON Web Token）とは
```
Header.Payload.Signature
eyJhbGci...  .eyJ1c2Vy...  .SflKxwRJ...
```

**デコードしてみる：**
- https://jwt.io にアクセス
- 自分のトークンを貼り付け
- Payloadに何が入っているか確認

### 4.2 二要素認証（2FA）

**課題 4-1: 2FAの流れを追う**
```python
# backend/apps/accounts/two_factor.py を読む

# 1. QRコード生成
# 2. ユーザーがGoogle Authenticatorでスキャン
# 3. 6桁コード入力
# 4. 検証
```

実際に試す：
1. 設定画面から2FAを有効化
2. Google Authenticatorアプリで登録
3. ログアウト → 再ログイン
4. 2FAコード入力

### 4.3 Rate Limiting（レート制限）

**課題 4-2: 攻撃対策を理解する**
```python
# backend/apps/accounts/middleware.py

# ログインAPIを連続で叩くとブロックされる
# → DoS攻撃対策
```

### 実践プロジェクト（フェーズ4）

**プロジェクト 4: パスワードリセット機能**
1. 「パスワードを忘れた」リンク
2. メールアドレス入力 → トークン生成
3. メール送信（開発環境ではコンソール出力）
4. トークンでパスワードリセット

---

## フェーズ 5: データベース設計とマイグレーション（1週間）

### 5.1 リレーションの理解

#### 一対多（ForeignKey）
```python
class Campaign(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    # 1人のユーザーが複数のキャンペーンを持つ
```

#### 多対多（ManyToManyField）
```python
class Campaign(models.Model):
    tags = models.ManyToManyField('Tag')
    # 1つのキャンペーンが複数のタグを持つ
    # 1つのタグが複数のキャンペーンに属する
```

**課題 5-1: ER図を描く**
- User, Campaign, AdSet, Ad の関係を図示
- どこにForeignKeyがあるか確認

### 5.2 クエリの最適化

```python
# 悪い例（N+1問題）
campaigns = Campaign.objects.all()
for campaign in campaigns:
    print(campaign.user.email)  # 毎回DB問い合わせ

# 良い例
campaigns = Campaign.objects.select_related('user').all()
for campaign in campaigns:
    print(campaign.user.email)  # 1回のクエリで取得
```

### 実践プロジェクト（フェーズ5）

**プロジェクト 5: パフォーマンス分析**
1. Django Debug Toolbarをインストール
2. N+1問題を見つける
3. select_related/prefetch_relatedで最適化

---

## フェーズ 6: 非同期処理（Celery）（1週間）

### 6.1 Celeryの基本

```python
# backend/apps/campaigns/tasks.py

from celery import shared_task

@shared_task
def sync_campaign_with_meta(campaign_id):
    # 時間のかかる処理
    campaign = Campaign.objects.get(id=campaign_id)
    # Meta APIと同期...
    return "完了"
```

**なぜ非同期が必要？**
- APIレスポンスが遅くなるのを防ぐ
- バックグラウンドでデータ同期
- 定期実行（cron的な）

### 6.2 Celeryを動かす

```bash
# Redisを起動（別ターミナル）
redis-server

# Celeryワーカーを起動（別ターミナル）
cd backend
celery -A config worker --loglevel=info
```

**課題 6-1: タスクを実行してみる**
```python
# Django shellで
from apps.campaigns.tasks import sync_campaign_with_meta
result = sync_campaign_with_meta.delay(1)
print(result.id)  # タスクID

# 結果確認
result.ready()  # 完了？
result.get()    # 結果取得
```

### 実践プロジェクト（フェーズ6）

**プロジェクト 6: メール通知タスク**
1. キャンペーン作成時にメール送信
2. Celeryタスクで非同期処理
3. 失敗時のリトライ設定

---

## フェーズ 7: テストの書き方（1-2週間）

### 7.1 pytestの基本

```python
# backend/tests/test_campaigns.py

def test_create_campaign(authenticated_client, test_user):
    data = {
        'name': 'テストキャンペーン',
        'budget': '10000.00',
    }
    response = authenticated_client.post('/api/campaigns/', data)
    assert response.status_code == 201
    assert response.data['name'] == 'テストキャンペーン'
```

**課題 7-1: テストを実行**
```bash
cd backend
pytest tests/test_campaigns.py -v
```

### 7.2 カバレッジ測定

```bash
pytest --cov=apps --cov-report=html
open htmlcov/index.html  # カバレッジレポート表示
```

### 7.3 フロントエンドのテスト

```typescript
// frontend/src/pages/Login.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import Login from './Login';

test('ログインフォームが表示される', () => {
  render(<Login />);
  expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
});
```

### 実践プロジェクト（フェーズ7）

**プロジェクト 7: テストカバレッジ80%達成**
1. 未テストの関数を見つける
2. テストケースを追加
3. エッジケース（エラー時）もテスト

---

## フェーズ 8: 外部API連携（Meta API）（1週間）

### 8.1 Meta APIの基礎

```python
# backend/apps/integrations/ を読む

from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.campaign import Campaign

# API初期化
FacebookAdsApi.init(app_id, app_secret, access_token)

# キャンペーン取得
campaigns = Account(account_id).get_campaigns()
```

### 8.2 OAuth認証フロー

**課題 8-1: Meta Developerアカウント作成**
1. https://developers.facebook.com/ でアカウント作成
2. アプリ作成
3. アクセストークン取得

### 実践プロジェクト（フェーズ8）

**プロジェクト 8: Instagram API連携**
- Instagram アカウントと連携
- 投稿一覧取得
- 画像アップロード

---

## フェーズ 9: 決済機能（Stripe）（1-2週間）

### 9.1 Stripeの基礎

```python
# backend/apps/billing/stripe_service.py

import stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

# サブスクリプション作成
subscription = stripe.Subscription.create(
    customer=customer_id,
    items=[{'price': price_id}],
)
```

### 9.2 Webhookの処理

```python
# Stripeからのイベント通知を受け取る
@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META['HTTP_STRIPE_SIGNATURE']
    
    event = stripe.Webhook.construct_event(
        payload, sig_header, webhook_secret
    )
    
    if event['type'] == 'payment_intent.succeeded':
        # 支払い成功処理
        pass
```

### 実践プロジェクト（フェーズ9）

**プロジェクト 9: 無料トライアル機能**
1. 新規登録時に14日間無料
2. トライアル期間表示
3. 期限切れ前に通知

---

## フェーズ 10: Docker + デプロイ（1週間）

### 10.1 Dockerの基礎

```dockerfile
# backend/Dockerfile を読む

FROM python:3.9
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
```

### 10.2 Docker Composeで起動

```bash
# プロジェクト全体をコンテナで起動
docker-compose up -d

# ログ確認
docker-compose logs -f backend

# コンテナに入る
docker-compose exec backend bash
```

### 10.3 デプロイ準備

**課題 10-1: 本番環境設定**
```python
# backend/config/settings.py

DEBUG = False
ALLOWED_HOSTS = ['yourdomain.com']
SECURE_SSL_REDIRECT = True
```

### 実践プロジェクト（フェーズ10）

**プロジェクト 10: Heroku/AWSにデプロイ**
1. 本番用のDocker設定
2. 環境変数の管理
3. PostgreSQL設定
4. 静的ファイル配信（S3など）

---

## フェーズ 11: パフォーマンス最適化（1週間）

### 11.1 バックエンド最適化

- **データベースインデックス**
- **クエリ最適化**
- **キャッシュ（Redis）**
- **ページネーション**

### 11.2 フロントエンド最適化

- **コード分割（lazy loading）**
- **画像最適化**
- **メモ化（useMemo, useCallback）**
- **バンドルサイズ削減**

### 実践プロジェクト（フェーズ11）

**プロジェクト 11: パフォーマンス監査**
1. Lighthouse スコア測定
2. ボトルネックの特定
3. 最適化実施
4. ビフォーアフター比較

---

## フェーズ 12: 自分だけの機能を追加（2-4週間）

### 目標
学んだことを統合して、オリジナル機能を実装

### アイデア例

#### 1. ダッシュボード強化
- リアルタイムチャート
- カスタムレポート
- データエクスポート（PDF）

#### 2. コラボレーション機能
- チーム管理
- 権限設定
- アクティビティログ

#### 3. AI/ML機能
- 予算最適化提案
- 異常検知アラート
- パフォーマンス予測

#### 4. モバイルアプリ
- React Nativeで同じバックエンドを使用
- プッシュ通知

---

## 🛠️ 日々の学習Tips

### 1. コードリーディングの習慣
毎日1つのファイルを完全に理解するまで読む

### 2. 写経（コードを書き写す）
既存コードを手で打ち直す → 理解が深まる

### 3. ペアプログラミング
友人やオンラインコミュニティで一緒にコーディング

### 4. ブログに記録
学んだことをアウトプット → 記憶定着

### 5. GitHubのコミット習慣
毎日少しでも良いのでコミット（草を生やす）

---

## 📚 参考リソース

### 公式ドキュメント
- [Django Docs](https://docs.djangoproject.com/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [React Docs](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### 学習サイト
- [Real Python](https://realpython.com/) - Django/Python
- [freeCodeCamp](https://www.freecodecamp.org/) - フロントエンド
- [Udemy](https://www.udemy.com/) - 体系的なコース

### コミュニティ
- Stack Overflow - 質問・回答
- Qiita - 日本語記事
- Discord - リアルタイムチャット

---

## ✅ 習得度チェックリスト

### Python/Django
- [ ] モデルを設計できる
- [ ] マイグレーションを理解している
- [ ] RESTful APIを作れる
- [ ] 認証を実装できる
- [ ] クエリ最適化ができる
- [ ] Celeryタスクを作れる
- [ ] テストを書ける

### React/TypeScript
- [ ] コンポーネント設計ができる
- [ ] Hooks（useState, useEffect）を使える
- [ ] 型定義ができる
- [ ] API通信を実装できる
- [ ] ルーティングを理解している
- [ ] 状態管理ができる（Context API）

### フルスタック
- [ ] フロント↔バック連携を実装できる
- [ ] 認証フローを完全に理解している
- [ ] エラーハンドリングができる
- [ ] デバッグができる
- [ ] Dockerを使える
- [ ] デプロイできる

### 上級
- [ ] パフォーマンス最適化ができる
- [ ] セキュリティ対策を実装できる
- [ ] 外部API連携ができる
- [ ] テストカバレッジ80%以上
- [ ] CI/CD構築ができる

---

## 🎯 6ヶ月後のゴール

1. **ポートフォリオとして説明できる**
   - 全機能を理解している
   - アーキテクチャを図示できる
   - 技術選定理由を説明できる

2. **似たプロジェクトを一から作れる**
   - 要件定義 → 設計 → 実装 → デプロイ
   - 独力で判断・実装できる

3. **実務レベルのコードが書ける**
   - ベストプラクティスに従える
   - コードレビューができる
   - チーム開発の流れを理解している

---

## 最後に

**焦らず、一歩ずつ進めば必ず習得できます。**

このプロジェクトは、あなたが実際に動くアプリケーションを題材に学べる最高の教材です。
失敗を恐れず、積極的にコードを書いて、壊して、直して、学んでください。

何か困ったことがあれば、いつでも質問してくださいね！

頑張ってください！ 🚀

