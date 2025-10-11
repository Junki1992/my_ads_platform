# 課金システム設計書

## 📋 概要

My Ads Platform のサブスクリプション型課金システムの設計書です。

---

## 💰 プランティア

### Free プラン（無料）
**価格**: ¥0/月

**機能制限**:
- ✅ キャンペーン数: 最大3個
- ✅ 月間広告費上限: ¥50,000
- ✅ API呼び出し: 1,000回/日
- ✅ ユーザー数: 1人
- ✅ レポート保存期間: 30日
- ✅ サポート: コミュニティフォーラムのみ
- ❌ 一括入稿機能
- ❌ 自動化ルール
- ❌ カスタムレポート
- ❌ API連携

**対象ユーザー**:
- 個人事業主
- スタートアップ
- 試用ユーザー

---

### Pro プラン（プロフェッショナル）
**価格**: ¥9,800/月 または ¥98,000/年（2ヶ月分お得）

**機能制限**:
- ✅ キャンペーン数: 無制限
- ✅ 月間広告費上限: ¥500,000
- ✅ API呼び出し: 10,000回/日
- ✅ ユーザー数: 5人まで
- ✅ レポート保存期間: 1年
- ✅ 一括入稿機能
- ✅ 自動化ルール: 10個まで
- ✅ カスタムレポート
- ✅ API連携
- ✅ サポート: メールサポート（48時間以内）
- ✅ 二要素認証

**対象ユーザー**:
- 中小企業
- マーケティング代理店（小規模）
- グロース中のスタートアップ

---

### Enterprise プラン（エンタープライズ）
**価格**: ¥49,800/月 または ¥498,000/年（2ヶ月分お得）

**機能制限**:
- ✅ キャンペーン数: 無制限
- ✅ 月間広告費上限: 無制限
- ✅ API呼び出し: 100,000回/日
- ✅ ユーザー数: 無制限
- ✅ レポート保存期間: 無制限
- ✅ 一括入稿機能
- ✅ 自動化ルール: 無制限
- ✅ カスタムレポート
- ✅ API連携
- ✅ 専用アカウントマネージャー
- ✅ サポート: 24時間対応（1時間以内）
- ✅ 二要素認証
- ✅ SLA保証（99.9%）
- ✅ カスタム統合サポート
- ✅ 優先的な新機能アクセス

**対象ユーザー**:
- 大企業
- 大手マーケティング代理店
- エンタープライズ顧客

---

## 📊 機能比較マトリクス

| 機能 | Free | Pro | Enterprise |
|------|------|-----|------------|
| **基本機能** |
| キャンペーン数 | 3個 | 無制限 | 無制限 |
| 月間広告費上限 | ¥50,000 | ¥500,000 | 無制限 |
| ユーザー数 | 1人 | 5人 | 無制限 |
| **データ管理** |
| レポート保存期間 | 30日 | 1年 | 無制限 |
| データエクスポート | CSV | CSV, Excel | CSV, Excel, API |
| **自動化** |
| 一括入稿 | ❌ | ✅ | ✅ |
| 自動化ルール | ❌ | 10個 | 無制限 |
| スケジュール配信 | ❌ | ✅ | ✅ |
| **分析・レポート** |
| 基本レポート | ✅ | ✅ | ✅ |
| カスタムレポート | ❌ | ✅ | ✅ |
| ダッシュボードカスタマイズ | ❌ | ✅ | ✅ |
| **API・連携** |
| API呼び出し数/日 | 1,000 | 10,000 | 100,000 |
| Webhook | ❌ | ✅ | ✅ |
| 外部ツール連携 | ❌ | ✅ | ✅ |
| **セキュリティ** |
| 二要素認証 | ❌ | ✅ | ✅ |
| IP制限 | ❌ | ❌ | ✅ |
| 監査ログ | ❌ | ❌ | ✅ |
| **サポート** |
| サポート | フォーラム | メール | 24時間対応 |
| 対応時間 | - | 48時間以内 | 1時間以内 |
| 専任担当者 | ❌ | ❌ | ✅ |
| SLA保証 | ❌ | ❌ | 99.9% |

---

## 💳 決済フロー

### 1. プラン選択
```
ユーザー → プラン選択ページ → プラン選択
```

### 2. Stripe Checkout
```
プラン選択 → Stripe Checkout画面 → カード情報入力 → 決済処理
```

### 3. サブスクリプション作成
```
決済成功 → Webhook受信 → DBに記録 → ユーザーへ通知
```

### 4. 定期課金
```
毎月/毎年 → Stripe自動課金 → Webhook受信 → 利用継続
```

### 5. プラン変更
```
アップグレード: 即時適用 + 日割り計算
ダウングレード: 次回更新時に適用
```

### 6. キャンセル
```
キャンセル申請 → 現在の期間終了まで利用可能 → 自動停止
```

---

## 🔄 使用量制限の実装

### キャンペーン数チェック
```python
def can_create_campaign(user):
    subscription = user.subscription
    plan = subscription.plan
    
    if plan == 'free':
        return user.campaigns.count() < 3
    else:
        return True  # Pro/Enterprise は無制限
```

### API呼び出し制限
```python
def check_api_rate_limit(user):
    subscription = user.subscription
    limits = {
        'free': 1000,
        'pro': 10000,
        'enterprise': 100000
    }
    
    daily_calls = get_daily_api_calls(user)
    return daily_calls < limits[subscription.plan]
```

---

## 📊 データベース設計

### Subscription（サブスクリプション）
```python
class Subscription(models.Model):
    user = ForeignKey(User)
    plan = CharField(choices=['free', 'pro', 'enterprise'])
    stripe_subscription_id = CharField(unique=True, null=True)
    stripe_customer_id = CharField(unique=True, null=True)
    status = CharField(choices=[
        'active',      # 有効
        'trialing',    # トライアル中
        'past_due',    # 支払い遅延
        'canceled',    # キャンセル済み
        'unpaid'       # 未払い
    ])
    current_period_start = DateTimeField()
    current_period_end = DateTimeField()
    cancel_at_period_end = BooleanField(default=False)
    trial_end = DateTimeField(null=True)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

### Payment（支払い履歴）
```python
class Payment(models.Model):
    user = ForeignKey(User)
    subscription = ForeignKey(Subscription, null=True)
    stripe_payment_intent_id = CharField(unique=True)
    amount = DecimalField(max_digits=10, decimal_places=2)
    currency = CharField(default='jpy')
    status = CharField(choices=[
        'succeeded',
        'pending',
        'failed',
        'refunded'
    ])
    payment_method = CharField()  # card, bank_transfer, etc.
    created_at = DateTimeField(auto_now_add=True)
```

### UsageMetrics（使用量メトリクス）
```python
class UsageMetrics(models.Model):
    user = ForeignKey(User)
    date = DateField()
    campaign_count = IntegerField(default=0)
    api_calls = IntegerField(default=0)
    ad_spend = DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = DateTimeField(auto_now_add=True)
```

---

## 🔐 セキュリティ考慮事項

### 1. Webhook署名検証
```python
def verify_stripe_webhook(payload, signature):
    stripe.Webhook.construct_event(
        payload, signature, STRIPE_WEBHOOK_SECRET
    )
```

### 2. 冪等性キー
```python
stripe.PaymentIntent.create(
    amount=9800,
    currency='jpy',
    idempotency_key=f'sub_{user.id}_{timestamp}'
)
```

### 3. 機密情報の保護
- Stripeキーは環境変数で管理
- カード情報はStripeに保存（PCI DSS準拠）
- 支払い履歴は暗号化

---

## 📈 KPI・モニタリング

### ビジネスメトリクス
- MRR（月次経常収益）
- ARR（年次経常収益）
- Churn Rate（解約率）
- LTV（顧客生涯価値）
- CAC（顧客獲得コスト）

### 技術メトリクス
- Webhook処理成功率
- 決済成功率
- API応答時間
- エラー率

---

## 🚀 リリース計画

### Phase 1: MVP（最小限の実装）
- ✅ Free/Proの2プラン
- ✅ クレジットカード決済のみ
- ✅ 月額課金のみ

### Phase 2: 機能拡張
- ✅ Enterpriseプラン追加
- ✅ 年額課金オプション
- ✅ クーポン・割引機能

### Phase 3: 最適化
- ✅ 請求書払い対応
- ✅ チーム管理機能
- ✅ 使用量ベース課金

---

## 💡 今後の検討事項

1. **トライアル期間**: 14日間無料トライアル
2. **クーポン機能**: 初回割引、紹介割引
3. **アドオン**: 追加ユーザー、追加API呼び出し
4. **請求書払い**: 大企業向け
5. **リファラルプログラム**: 紹介報酬

---

**作成日**: 2025-10-11  
**バージョン**: 1.0  
**作成者**: Development Team

