# 📅 30日間集中学習プラン

このプランは、最初の1ヶ月で基礎を固め、実際にコードを書けるようになるための具体的なカリキュラムです。

**前提**: 1日2-3時間の学習時間を確保することを想定

---

## Week 1: 環境構築とプロジェクト理解（1日目〜7日目）

### 1日目: 環境セットアップとプロジェクト起動

#### 午前: 開発環境の準備
```bash
# ✅ チェックリスト
□ Python 3.9+ インストール確認
□ Node.js 18+ インストール確認
□ Git 設定確認
□ エディタ準備（VSCodeなど）
```

#### 午後: プロジェクトを動かす
```bash
# バックエンド起動
cd backend
source venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings_dev
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# フロントエンド起動（別ターミナル）
cd frontend
npm install
npm start
```

**ゴール**: 
- http://localhost:3000 でアプリが表示される
- ログインできる
- 管理画面（http://localhost:8000/admin）にアクセスできる

**振り返りノート**:
```
今日学んだこと：
- 

つまずいたこと：
- 

明日やること：
- 
```

---

### 2日目: プロジェクト構造の理解

#### 午前: ディレクトリ構造の探索
```bash
# プロジェクト構造を確認
tree -L 3 -I 'node_modules|venv|__pycache__|build'

# 主要ファイルをリストアップ
ls backend/apps/
ls frontend/src/pages/
ls frontend/src/services/
```

**タスク**: 
- 各ディレクトリの役割をメモ
- 主要ファイルの位置を把握

#### 午後: アーキテクチャ図を描く
```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTP Request
┌──────▼──────────────┐
│  React Frontend     │
│  (localhost:3000)   │
└──────┬──────────────┘
       │ API Call
┌──────▼──────────────┐
│  Django Backend     │
│  (localhost:8000)   │
└──────┬──────────────┘
       │
┌──────▼──────────────┐
│  SQLite Database    │
└─────────────────────┘
```

**タスク**: 
- 自分の言葉で図を描き直す
- リクエストの流れを説明できるようにする

---

### 3日目: Django基礎 - Model編

#### 午前: Userモデルを読む
```bash
# ファイルを開く
backend/apps/accounts/models.py
```

**課題**:
1. `User` モデルにどんなフィールドがあるか書き出す
2. `AbstractUser` とは何か調べる
3. `two_factor_enabled` の役割を理解する

#### 午後: Campaignモデルを読む
```bash
backend/apps/campaigns/models.py
```

**課題**:
1. Campaign, AdSet, Ad の関係を図示
2. ForeignKey の意味を理解
3. related_name の役割を調べる

**実践**:
```bash
# Django shell で実験
python manage.py shell

>>> from apps.campaigns.models import Campaign
>>> from apps.accounts.models import User
>>> 
>>> user = User.objects.first()
>>> campaign = Campaign.objects.create(
...     name='テストキャンペーン',
...     user=user,
...     budget=10000
... )
>>> print(campaign)
>>> campaign.user
>>> user.campaigns.all()  # related_name
```

---

### 4日目: Django基礎 - View/Serializer編

#### 午前: ログインAPIを追跡
```python
# 1. フロントエンドのAPIコール
frontend/src/services/authService.ts
→ login() 関数

# 2. URLルーティング
backend/config/urls.py
→ /api/accounts/

backend/apps/accounts/urls.py
→ auth/login/

# 3. View
backend/apps/accounts/views.py
→ LoginView
```

**タスク**: 
- 各ファイルでコメントを入れて理解を深める
- ログインの流れを図にする

#### 午後: デバッグ実践
```python
# views.py にprintを追加
class LoginView(APIView):
    def post(self, request):
        print(f"📝 リクエストデータ: {request.data}")
        # ... 既存コード
        print(f"✅ ログイン成功: {user.email}")
```

実際にログインして、ターミナルの出力を確認

---

### 5日目: データベース操作

#### 午前: SQL基礎
```bash
cd backend
python manage.py dbshell

-- テーブル一覧
.tables

-- スキーマ確認
.schema accounts_user
.schema campaigns_campaign

-- データ確認
SELECT * FROM accounts_user;
SELECT * FROM campaigns_campaign;

-- JOIN
SELECT c.name, u.email
FROM campaigns_campaign c
JOIN accounts_user u ON c.user_id = u.id;

.exit
```

#### 午後: マイグレーション実践
```python
# 新しいフィールドを追加
# backend/apps/campaigns/models.py
class Campaign(models.Model):
    # 既存のフィールド...
    
    # 追加
    notes = models.TextField(blank=True, default='')
```

```bash
# マイグレーション
python manage.py makemigrations
python manage.py migrate

# 確認
python manage.py dbshell
> .schema campaigns_campaign
```

**重要**: 変更を元に戻す
```bash
# マイグレーションを戻す
python manage.py migrate campaigns 前のマイグレーション番号

# マイグレーションファイルを削除
rm backend/apps/campaigns/migrations/000X_*.py
```

---

### 6日目: React基礎 - Component編

#### 午前: Loginコンポーネントを読む
```tsx
frontend/src/pages/Login.tsx
```

**課題**:
1. useState はどこで使われている？
2. フォーム送信時に何が起こる？
3. エラーハンドリングはどうなっている？

#### 午後: 小さな変更をしてみる
```tsx
// ログイン画面のタイトル変更
<h2>ログイン</h2>
↓
<h2>🚀 My Ads Platform へようこそ！</h2>

// ボタンの色を変える
<Button type="primary">ログイン</Button>
↓
<Button type="primary" style={{ backgroundColor: '#52c41a' }}>
  ログイン
</Button>
```

保存 → ブラウザで確認

---

### 7日目: 復習とまとめ

#### 午前: Week1の総復習
- [ ] プロジェクトが起動できる
- [ ] ディレクトリ構造を理解している
- [ ] Djangoのモデルが読める
- [ ] APIの流れが追える
- [ ] SQLが少し書ける
- [ ] Reactコンポーネントが読める

#### 午後: ミニプロジェクト
**課題**: ログイン画面に「パスワードを忘れた」リンクを追加

1. ボタンを追加（機能なし、alertのみ）
2. スタイリング
3. Git commit

```bash
git add .
git commit -m "ログイン画面に「パスワードを忘れた」リンクを追加"
```

---

## Week 2: API実装（8日目〜14日目）

### 8日目: REST API基礎

#### 午前: HTTPメソッドを理解
- **GET**: データ取得
- **POST**: データ作成
- **PUT/PATCH**: データ更新
- **DELETE**: データ削除

**実践**: Postmanをインストール
```bash
# インストール
# https://www.postman.com/downloads/

# ログインAPI を叩く
POST http://localhost:8000/api/accounts/auth/login/
Body (JSON):
{
  "email": "admin@example.com",
  "password": "admin123"
}

# トークンをコピー

# キャンペーン一覧取得
GET http://localhost:8000/api/campaigns/campaigns/
Headers:
  Authorization: Bearer <トークン>
```

#### 午後: ブラウザDevToolsで観察
1. ブラウザでF12を押す
2. Networkタブを開く
3. ログインする
4. リクエスト/レスポンスを確認

**スクリーンショットを保存**

---

### 9日目: 新しいモデルを作る

#### 午前: Noteモデルの設計
```python
# backend/apps/campaigns/models.py

class Note(models.Model):
    campaign = models.ForeignKey(
        'Campaign',
        on_delete=models.CASCADE,
        related_name='notes'
    )
    content = models.TextField()
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'campaign_notes'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.campaign.name} - {self.content[:30]}"
```

#### 午後: マイグレーションとテスト
```bash
python manage.py makemigrations
python manage.py migrate

# Django shellで確認
python manage.py shell
>>> from apps.campaigns.models import Campaign, Note
>>> campaign = Campaign.objects.first()
>>> Note.objects.create(
...     campaign=campaign,
...     content='テストメモ',
...     created_by=campaign.user
... )
>>> campaign.notes.all()
```

---

### 10日目: Serializer作成

```python
# backend/apps/campaigns/serializers.py

class NoteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source='created_by.username',
        read_only=True
    )
    
    class Meta:
        model = Note
        fields = [
            'id',
            'campaign',
            'content',
            'created_by',
            'created_by_name',
            'created_at',
        ]
        read_only_fields = ['created_by', 'created_at']
```

**テスト**:
```python
python manage.py shell

>>> from apps.campaigns.models import Note
>>> from apps.campaigns.serializers import NoteSerializer
>>> note = Note.objects.first()
>>> serializer = NoteSerializer(note)
>>> print(serializer.data)
```

---

### 11日目: ViewSet作成

```python
# backend/apps/campaigns/views.py

class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Note.objects.filter(
            campaign__user=self.request.user
        ).select_related('campaign', 'created_by')
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
```

**URL設定**:
```python
# backend/apps/campaigns/urls.py

from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'notes', NoteViewSet, basename='note')

urlpatterns += router.urls
```

---

### 12日目: Postmanでテスト

```bash
# 1. メモ作成
POST http://localhost:8000/api/campaigns/notes/
Headers:
  Authorization: Bearer <トークン>
  Content-Type: application/json
Body:
{
  "campaign": 1,
  "content": "新しいメモです"
}

# 2. メモ一覧取得
GET http://localhost:8000/api/campaigns/notes/
Headers:
  Authorization: Bearer <トークン>

# 3. メモ削除
DELETE http://localhost:8000/api/campaigns/notes/1/
Headers:
  Authorization: Bearer <トークン>
```

**全てのレスポンスをスクリーンショット保存**

---

### 13日目: フロントエンド - API Service作成

```typescript
// frontend/src/services/noteService.ts

import axios from 'axios';

export interface Note {
  id: number;
  campaign: number;
  content: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export const getNotes = async (campaignId: number): Promise<Note[]> => {
  const response = await axios.get(
    `/api/campaigns/notes/?campaign=${campaignId}`
  );
  return response.data.results || response.data;
};

export const createNote = async (
  campaignId: number,
  content: string
): Promise<Note> => {
  const response = await axios.post('/api/campaigns/notes/', {
    campaign: campaignId,
    content,
  });
  return response.data;
};

export const deleteNote = async (noteId: number): Promise<void> => {
  await axios.delete(`/api/campaigns/notes/${noteId}/`);
};
```

---

### 14日目: 復習とWeek2まとめ

#### やったことリスト
- [ ] 新しいモデル作成
- [ ] Serializer作成
- [ ] ViewSet作成
- [ ] PostmanでAPI確認
- [ ] フロントエンドのService作成

#### ミニテスト
1. RESTful APIの4つの主要メソッドは？
2. Serializerの役割は？
3. ViewSetとAPIViewの違いは？
4. related_nameとは？

**答え合わせ**: learning_roadmap.md を確認

---

## Week 3: React実装（15日目〜21日目）

### 15日目: コンポーネント設計

#### 設計図を描く
```
CampaignNotes コンポーネント
├─ 新規メモ入力エリア
│  ├─ TextArea
│  └─ 追加ボタン
└─ メモ一覧
   └─ NoteItem x N
      ├─ 内容表示
      ├─ 作成者
      ├─ 日時
      └─ 削除ボタン
```

#### Props/State設計
```typescript
// Props
interface CampaignNotesProps {
  campaignId: number;
}

// State
const [notes, setNotes] = useState<Note[]>([]);
const [newNote, setNewNote] = useState('');
const [loading, setLoading] = useState(false);
```

---

### 16日目: コンポーネント実装（前半）

```tsx
// frontend/src/components/CampaignNotes.tsx

import React, { useState, useEffect } from 'react';
import { Card, Input, Button, List, message } from 'antd';
import { getNotes, createNote } from '../services/noteService';

const { TextArea } = Input;

interface CampaignNotesProps {
  campaignId: number;
}

const CampaignNotes: React.FC<CampaignNotesProps> = ({ campaignId }) => {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);

  // TODO: 明日実装
  const fetchNotes = async () => {};
  const handleAddNote = async () => {};

  return (
    <Card title="メモ">
      <TextArea
        rows={3}
        placeholder="メモを入力..."
        value={newNote}
        onChange={(e) => setNewNote(e.target.value)}
      />
      <Button onClick={handleAddNote} style={{ marginTop: 8 }}>
        追加
      </Button>
    </Card>
  );
};

export default CampaignNotes;
```

**今日のゴール**: UIだけ表示

---

### 17日目: コンポーネント実装（後半）

```tsx
// 関数を実装
const fetchNotes = async () => {
  try {
    setLoading(true);
    const data = await getNotes(campaignId);
    setNotes(data);
  } catch (error) {
    message.error('メモの取得に失敗しました');
  } finally {
    setLoading(false);
  }
};

const handleAddNote = async () => {
  if (!newNote.trim()) {
    message.warning('メモ内容を入力してください');
    return;
  }

  try {
    await createNote(campaignId, newNote);
    message.success('メモを追加しました');
    setNewNote('');
    fetchNotes();
  } catch (error) {
    message.error('メモの追加に失敗しました');
  }
};

useEffect(() => {
  fetchNotes();
}, [campaignId]);

// List も追加
<List
  loading={loading}
  dataSource={notes}
  renderItem={(note) => (
    <List.Item>
      <div>{note.content}</div>
    </List.Item>
  )}
/>
```

---

### 18日目: 既存ページに統合

```tsx
// frontend/src/pages/Campaigns.tsx

import CampaignNotes from '../components/CampaignNotes';

// キャンペーン詳細モーダル内
<Modal title="キャンペーン詳細" ...>
  {/* 既存の内容 */}
  
  <CampaignNotes campaignId={selectedCampaign?.id} />
</Modal>
```

**動作確認**:
1. キャンペーン一覧を表示
2. 詳細モーダルを開く
3. メモを追加
4. メモが表示される

---

### 19日目: スタイリング改善

```tsx
// より見やすく
<Card title="📝 メモ" bordered={false}>
  <Space direction="vertical" style={{ width: '100%' }}>
    {/* 入力エリア */}
    <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
      <TextArea
        rows={4}
        placeholder="メモを入力してください..."
        value={newNote}
        onChange={(e) => setNewNote(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNote}>
        追加
      </Button>
    </div>

    {/* メモ一覧 */}
    <List
      loading={loading}
      dataSource={notes}
      renderItem={(note) => (
        <List.Item
          style={{
            background: '#fff',
            padding: 16,
            borderRadius: 8,
            marginBottom: 8,
          }}
        >
          <List.Item.Meta
            title={
              <span style={{ fontWeight: 'bold' }}>
                {note.created_by_name}
              </span>
            }
            description={
              <>
                <p style={{ margin: '8px 0' }}>{note.content}</p>
                <small style={{ color: '#999' }}>
                  {dayjs(note.created_at).format('YYYY/MM/DD HH:mm')}
                </small>
              </>
            }
          />
        </List.Item>
      )}
    />
  </Space>
</Card>
```

---

### 20日目: エラーハンドリング強化

```typescript
// より詳細なエラーハンドリング
const handleAddNote = async () => {
  if (!newNote.trim()) {
    message.warning('メモ内容を入力してください');
    return;
  }

  if (newNote.length > 1000) {
    message.error('メモは1000文字以内で入力してください');
    return;
  }

  try {
    await createNote(campaignId, newNote);
    message.success('メモを追加しました');
    setNewNote('');
    fetchNotes();
  } catch (error: any) {
    if (error.response?.status === 401) {
      message.error('ログインが必要です');
    } else if (error.response?.status === 403) {
      message.error('権限がありません');
    } else {
      message.error('メモの追加に失敗しました');
    }
    console.error('Error adding note:', error);
  }
};
```

---

### 21日目: Week3総復習

#### チェックリスト
- [ ] コンポーネント設計ができる
- [ ] useState/useEffectを使える
- [ ] API通信ができる
- [ ] エラーハンドリングができる
- [ ] Ant Designを使える

#### ミニプロジェクト
**課題**: メモ削除機能を追加

1. deleteNote 関数を実装
2. 削除ボタンを追加
3. 確認モーダル表示
4. 削除成功後にリスト更新

---

## Week 4: テストとデプロイ準備（22日目〜30日目）

### 22-23日目: バックエンドテスト

```python
# backend/tests/test_notes.py

import pytest
from django.urls import reverse
from rest_framework import status

@pytest.mark.django_db
def test_create_note(authenticated_client, test_user):
    # テスト実装（learning_exercises.md 参照）
    pass

@pytest.mark.django_db
def test_list_notes(authenticated_client, test_user):
    pass
```

**実行**:
```bash
pytest tests/test_notes.py -v
pytest --cov=apps --cov-report=html
```

---

### 24-25日目: フロントエンドテスト

```tsx
// frontend/src/components/CampaignNotes.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import CampaignNotes from './CampaignNotes';

test('メモを追加できる', async () => {
  // テスト実装
});
```

---

### 26-27日目: Docker

```bash
# プロジェクト全体をコンテナで起動
docker-compose up -d

# ログ確認
docker-compose logs -f backend

# 停止
docker-compose down
```

---

### 28-29日目: ドキュメント作成

- README更新
- API仕様書
- セットアップガイド

---

### 30日目: 総まとめと振り返り

#### できるようになったこと
- [ ] Djangoでモデル設計
- [ ] REST API実装
- [ ] Reactコンポーネント作成
- [ ] API連携
- [ ] テスト作成
- [ ] Git管理

#### 次の30日でやること
- 認証機能の深堀り
- パフォーマンス最適化
- 外部API連携
- デプロイ

---

## 学習のコツ

### ✅ 毎日やること
1. **コードを書く** - 読むだけでなく、必ず手を動かす
2. **Git commit** - 小さな変更でもコミット
3. **振り返りノート** - 学んだことを記録

### ❌ やってはいけないこと
1. **コピペだけで終わる** - 理解せずに進まない
2. **完璧を求めすぎる** - まず動かす、後で改善
3. **孤独に悩む** - 困ったら質問する

### 📝 振り返りテンプレート
```markdown
## 〇〇日目

### 今日やったこと
- 

### 学んだこと
- 

### つまずいたこと・解決方法
- 

### 明日やること
- 
```

---

## 🎯 30日後のゴール

1. **Noteモデル（メモ機能）を一から実装できる**
   - バックエンド: Model, Serializer, ViewSet
   - フロントエンド: Component, Service
   - テスト: 両方書ける

2. **同じパターンで他の機能も作れる**
   - タグ機能
   - コメント機能
   - お気に入り機能

3. **自信を持って「作れます」と言える**

---

頑張ってください！毎日コツコツ続けることが大切です。

何かわからないことがあれば、いつでも質問してくださいね！ 🚀

