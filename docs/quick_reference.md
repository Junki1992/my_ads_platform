# 🔖 クイックリファレンス

学習中に頻繁に使うコマンドとコードスニペット集

---

## 📌 よく使うコマンド

### プロジェクト起動

```bash
# バックエンド起動
cd backend
source venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings_dev
python manage.py runserver

# フロントエンド起動（別ターミナル）
cd frontend
npm start

# Redis起動（Celery使用時）
redis-server

# Celeryワーカー起動（別ターミナル）
cd backend
source venv/bin/activate
celery -A config worker --loglevel=info
```

---

## 🗄️ Django コマンド

### マイグレーション

```bash
# マイグレーションファイル作成
python manage.py makemigrations

# 特定のアプリのみ
python manage.py makemigrations campaigns

# マイグレーション適用
python manage.py migrate

# マイグレーション状態確認
python manage.py showmigrations

# マイグレーションを戻す
python manage.py migrate campaigns 0001

# マイグレーションのSQL確認
python manage.py sqlmigrate campaigns 0001
```

### ユーザー管理

```bash
# スーパーユーザー作成
python manage.py createsuperuser

# 管理画面用のパスワード変更
python manage.py changepassword admin@example.com
```

### データベース

```bash
# データベースシェル
python manage.py dbshell

# データベースをリセット（開発環境のみ！）
rm db.sqlite3
python manage.py migrate
```

### Django Shell

```bash
# シェル起動
python manage.py shell

# IPython使用（推奨）
pip install ipython
python manage.py shell
```

### その他

```bash
# 静的ファイル収集（本番環境）
python manage.py collectstatic

# 開発サーバーを別ポートで起動
python manage.py runserver 8001

# 全IPアドレスで起動
python manage.py runserver 0.0.0.0:8000
```

---

## 🧪 テストコマンド

### Backend（pytest）

```bash
cd backend

# 全テスト実行
pytest

# 詳細表示
pytest -v

# 特定のファイルのみ
pytest tests/test_campaigns.py

# 特定のテストのみ
pytest tests/test_campaigns.py::test_create_campaign

# カバレッジ測定
pytest --cov=apps --cov-report=html

# カバレッジレポート表示
open htmlcov/index.html

# テスト失敗時に即座に停止
pytest -x

# print文を表示
pytest -s
```

### Frontend（Jest）

```bash
cd frontend

# 全テスト実行
npm test

# カバレッジ付き
npm run test:coverage

# 特定のファイルのみ
npm test -- Login.test.tsx

# Watch モード無効
npm test -- --watchAll=false
```

---

## 🐙 Git コマンド

```bash
# 状態確認
git status

# 変更を確認
git diff

# ステージング
git add .
git add backend/apps/campaigns/models.py

# コミット
git commit -m "キャンペーンメモ機能を追加"

# ログ確認
git log --oneline -10

# ブランチ作成・切替
git checkout -b feature/add-notes
git checkout main

# 変更を一時退避
git stash
git stash pop

# 最後のコミットを修正
git commit --amend

# 変更を取り消す（コミット前）
git checkout -- ファイル名

# マージ
git merge feature/add-notes
```

---

## 🐳 Docker コマンド

```bash
# コンテナ起動
docker-compose up -d

# ログ表示
docker-compose logs -f
docker-compose logs -f backend

# コンテナ停止
docker-compose down

# 再ビルド
docker-compose build
docker-compose up -d --build

# コンテナに入る
docker-compose exec backend bash
docker-compose exec frontend sh

# データベースリセット（開発環境）
docker-compose down -v
docker-compose up -d
```

---

## 📝 Djangoコードスニペット

### モデル定義

```python
from django.db import models

class MyModel(models.Model):
    # 文字列フィールド
    name = models.CharField(max_length=255, verbose_name='名前')
    
    # テキスト
    description = models.TextField(blank=True, default='')
    
    # 数値
    count = models.IntegerField(default=0)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # 真偽値
    is_active = models.BooleanField(default=True)
    
    # 日時
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # リレーション
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='mymodels'
    )
    tags = models.ManyToManyField('Tag', blank=True)
    
    class Meta:
        db_table = 'my_models'
        ordering = ['-created_at']
        verbose_name = 'マイモデル'
        verbose_name_plural = 'マイモデル'
    
    def __str__(self):
        return self.name
```

### Serializer

```python
from rest_framework import serializers

class MyModelSerializer(serializers.ModelSerializer):
    # 読み取り専用フィールド追加
    user_name = serializers.CharField(
        source='user.username',
        read_only=True
    )
    
    # カスタムフィールド
    total_count = serializers.SerializerMethodField()
    
    class Meta:
        model = MyModel
        fields = [
            'id',
            'name',
            'description',
            'user',
            'user_name',
            'total_count',
            'created_at',
        ]
        read_only_fields = ['user', 'created_at']
    
    def get_total_count(self, obj):
        # カスタムロジック
        return obj.count * 2
    
    def validate_name(self, value):
        # フィールド検証
        if len(value) < 3:
            raise serializers.ValidationError('名前は3文字以上必要です')
        return value
    
    def create(self, validated_data):
        # カスタム作成ロジック
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
```

### ViewSet

```python
from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response

class MyModelViewSet(viewsets.ModelViewSet):
    serializer_class = MyModelSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'name']
    
    def get_queryset(self):
        # ユーザー自身のデータのみ
        return MyModel.objects.filter(
            user=self.request.user
        ).select_related('user').prefetch_related('tags')
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    # カスタムエンドポイント
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        obj = self.get_object()
        obj.is_active = True
        obj.save()
        return Response({'status': 'activated'})
```

### クエリ例

```python
# 全件取得
MyModel.objects.all()

# フィルタ
MyModel.objects.filter(is_active=True)
MyModel.objects.filter(name__icontains='test')  # LIKE検索
MyModel.objects.filter(created_at__gte='2024-01-01')  # 日時比較

# 除外
MyModel.objects.exclude(is_active=False)

# 並び替え
MyModel.objects.order_by('-created_at')
MyModel.objects.order_by('name', '-created_at')

# 最初/最後
MyModel.objects.first()
MyModel.objects.last()

# 件数
MyModel.objects.count()

# 存在確認
MyModel.objects.filter(name='test').exists()

# 取得または作成
obj, created = MyModel.objects.get_or_create(
    name='test',
    defaults={'description': 'デフォルト値'}
)

# 更新
MyModel.objects.filter(is_active=False).update(is_active=True)

# 削除
MyModel.objects.filter(name='test').delete()

# リレーション（select_related - ForeignKey）
MyModel.objects.select_related('user').all()

# リレーション（prefetch_related - ManyToMany）
MyModel.objects.prefetch_related('tags').all()

# 集計
from django.db.models import Count, Sum, Avg
MyModel.objects.aggregate(total=Sum('count'))
MyModel.objects.values('user').annotate(count=Count('id'))
```

---

## ⚛️ Reactコードスニペット

### 基本コンポーネント

```tsx
import React, { useState, useEffect } from 'react';

interface MyComponentProps {
  id: number;
  name: string;
  onUpdate?: (data: any) => void;
}

const MyComponent: React.FC<MyComponentProps> = ({ id, name, onUpdate }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [id]); // idが変わったら再実行

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/data/${id}`);
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラー: {error}</div>;

  return (
    <div>
      <h2>{name}</h2>
      <ul>
        {data.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default MyComponent;
```

### カスタムHook

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

interface UseDataOptions {
  initialFetch?: boolean;
}

export const useData = <T,>(url: string, options: UseDataOptions = {}) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(url);
      setData(response.data);
    } catch (err) {
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.initialFetch !== false) {
      fetchData();
    }
  }, [url]);

  return { data, loading, error, refetch: fetchData };
};

// 使い方
const { data, loading, error, refetch } = useData<Campaign>('/api/campaigns/');
```

### フォームハンドリング

```tsx
import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';

const MyForm: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/mymodel/', values);
      message.success('保存しました');
      form.resetFields();
    } catch (error) {
      message.error('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} onFinish={handleSubmit} layout="vertical">
      <Form.Item
        name="name"
        label="名前"
        rules={[
          { required: true, message: '名前は必須です' },
          { min: 3, message: '3文字以上入力してください' },
        ]}
      >
        <Input />
      </Form.Item>

      <Form.Item name="description" label="説明">
        <Input.TextArea rows={4} />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          送信
        </Button>
      </Form.Item>
    </Form>
  );
};
```

---

## 🔍 デバッグ方法

### Backend（Django）

```python
# 1. print文
def my_view(request):
    print(f"📝 リクエストデータ: {request.data}")
    print(f"🔑 ユーザー: {request.user}")

# 2. Django Shell
python manage.py shell
>>> from apps.campaigns.models import Campaign
>>> Campaign.objects.all()

# 3. ログ出力
import logging
logger = logging.getLogger(__name__)
logger.debug('デバッグメッセージ')
logger.info('情報メッセージ')
logger.error('エラーメッセージ')

# 4. Django Debug Toolbar（推奨）
pip install django-debug-toolbar
# settings.py に追加
INSTALLED_APPS = [
    'debug_toolbar',
]
MIDDLEWARE = [
    'debug_toolbar.middleware.DebugToolbarMiddleware',
]
```

### Frontend（React）

```typescript
// 1. console.log
console.log('データ:', data);
console.log('エラー:', error);

// 2. React DevTools
// ブラウザ拡張をインストール

// 3. debugger文
const handleSubmit = (values: any) => {
  debugger; // ここで停止
  console.log(values);
};

// 4. エラーバウンダリ
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('エラー:', error, errorInfo);
  }
  render() {
    return this.props.children;
  }
}
```

---

## 🔐 認証関連

### トークン取得

```bash
# ログインしてトークン取得
curl -X POST http://localhost:8000/api/accounts/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

### トークンを使ったAPI呼び出し

```bash
# curl
curl -X GET http://localhost:8000/api/campaigns/campaigns/ \
  -H "Authorization: Bearer <YOUR_TOKEN>"

# JavaScript/TypeScript
const response = await axios.get('/api/campaigns/', {
  headers: {
    Authorization: `Bearer ${localStorage.getItem('access_token')}`
  }
});
```

---

## 📦 パッケージ管理

### Backend

```bash
# パッケージインストール
pip install package-name

# requirements.txt に保存
pip freeze > requirements.txt

# requirements.txt からインストール
pip install -r requirements.txt

# パッケージアップデート
pip install --upgrade package-name

# アンインストール
pip uninstall package-name
```

### Frontend

```bash
# パッケージインストール
npm install package-name

# 開発用
npm install --save-dev package-name

# package.json からインストール
npm install

# パッケージアップデート
npm update package-name

# アンインストール
npm uninstall package-name

# セキュリティ脆弱性チェック
npm audit
npm audit fix
```

---

## 🌐 API テスト（curl）

```bash
# GET
curl http://localhost:8000/api/campaigns/

# POST
curl -X POST http://localhost:8000/api/campaigns/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"name":"New Campaign","budget":"10000"}'

# PUT
curl -X PUT http://localhost:8000/api/campaigns/1/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"name":"Updated Name"}'

# DELETE
curl -X DELETE http://localhost:8000/api/campaigns/1/ \
  -H "Authorization: Bearer <TOKEN>"

# レスポンスを整形
curl ... | python -m json.tool
```

---

## 📊 よく使うSQL（SQLite）

```sql
-- テーブル一覧
.tables

-- テーブル構造
.schema campaigns_campaign

-- データ確認
SELECT * FROM campaigns_campaign;
SELECT * FROM campaigns_campaign LIMIT 10;

-- 条件付き検索
SELECT * FROM campaigns_campaign WHERE user_id = 1;

-- JOIN
SELECT c.name, u.email
FROM campaigns_campaign c
JOIN accounts_user u ON c.user_id = u.id;

-- 件数
SELECT COUNT(*) FROM campaigns_campaign;

-- グループ化
SELECT user_id, COUNT(*) as count
FROM campaigns_campaign
GROUP BY user_id;

-- 並び替え
SELECT * FROM campaigns_campaign ORDER BY created_at DESC;

-- 削除
DELETE FROM campaigns_campaign WHERE id = 1;

-- 更新
UPDATE campaigns_campaign SET name = 'New Name' WHERE id = 1;
```

---

## 🎨 よく使うAnt Designコンポーネント

```tsx
import {
  Button,
  Input,
  Form,
  Table,
  Modal,
  message,
  Space,
  Card,
  List,
  Tag,
  Popconfirm,
} from 'antd';

// ボタン
<Button type="primary">プライマリ</Button>
<Button type="default">デフォルト</Button>
<Button type="link">リンク</Button>
<Button danger>危険</Button>

// メッセージ
message.success('成功');
message.error('エラー');
message.warning('警告');
message.info('情報');

// モーダル
const [visible, setVisible] = useState(false);
<Modal
  title="タイトル"
  visible={visible}
  onOk={() => setVisible(false)}
  onCancel={() => setVisible(false)}
>
  内容
</Modal>

// 確認ダイアログ
<Popconfirm
  title="本当に削除しますか？"
  onConfirm={handleDelete}
  okText="削除"
  cancelText="キャンセル"
>
  <Button danger>削除</Button>
</Popconfirm>

// テーブル
<Table
  dataSource={data}
  columns={[
    { title: '名前', dataIndex: 'name', key: 'name' },
    { title: '予算', dataIndex: 'budget', key: 'budget' },
  ]}
  rowKey="id"
  loading={loading}
/>
```

---

## 🚨 トラブルシューティング

### ポートが使用中

```bash
# プロセスを見つける
lsof -i :8000
lsof -i :3000

# プロセスを終了
kill -9 <PID>
```

### マイグレーションエラー

```bash
# マイグレーションをリセット
python manage.py migrate --fake campaigns zero
python manage.py migrate campaigns

# データベースをリセット（開発環境のみ！）
rm db.sqlite3
python manage.py migrate
```

### npm エラー

```bash
# node_modules を削除して再インストール
rm -rf node_modules package-lock.json
npm install

# キャッシュクリア
npm cache clean --force
```

### CORS エラー

```python
# backend/config/settings.py
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
]
```

---

このリファレンスを見ながら学習を進めてください！

困ったときはまずここを確認 → 解決しなければ質問 🙋

