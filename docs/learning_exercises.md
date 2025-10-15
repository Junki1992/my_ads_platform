# 🎓 実践演習問題集

このドキュメントには、learning_roadmap.md の各フェーズで取り組むべき具体的な演習問題と解答例があります。

---

## フェーズ 1: Django基礎 - 演習問題

### 演習 1-1: 新しいモデルの作成

**目標**: データベース設計の基礎を学ぶ

**課題**: `Note` モデルを作成し、キャンペーンにメモを紐付ける

```python
# backend/apps/campaigns/models.py に追加

class Note(models.Model):
    """キャンペーンに関するメモ"""
    campaign = models.ForeignKey(
        'Campaign',
        on_delete=models.CASCADE,
        related_name='notes'
    )
    content = models.TextField(verbose_name='メモ内容')
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        verbose_name='作成者'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='作成日時')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新日時')
    
    class Meta:
        db_table = 'campaign_notes'
        ordering = ['-created_at']
        verbose_name = 'キャンペーンメモ'
        verbose_name_plural = 'キャンペーンメモ'
    
    def __str__(self):
        return f"{self.campaign.name} - {self.content[:30]}"
```

**実行手順**:
```bash
cd backend
source venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings_dev

# マイグレーションファイル作成
python manage.py makemigrations

# 生成されたファイルを確認
cat apps/campaigns/migrations/0008_note.py

# データベースに適用
python manage.py migrate

# 確認
python manage.py dbshell
> .schema campaign_notes
> .exit
```

**検証**:
```bash
python manage.py shell

>>> from apps.campaigns.models import Campaign, Note
>>> from apps.accounts.models import User
>>> 
>>> campaign = Campaign.objects.first()
>>> user = User.objects.first()
>>> 
>>> # メモを作成
>>> note = Note.objects.create(
...     campaign=campaign,
...     content="このキャンペーンの予算を来月から増額予定",
...     created_by=user
... )
>>> 
>>> # 取得
>>> campaign.notes.all()
>>> print(note)
```

---

### 演習 1-2: シリアライザの作成

**目標**: APIレスポンスの形を定義する

```python
# backend/apps/campaigns/serializers.py に追加

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
            'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        # リクエストユーザーを自動設定
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
```

**テスト**:
```python
# Django shell で
from apps.campaigns.serializers import NoteSerializer
from apps.campaigns.models import Note

note = Note.objects.first()
serializer = NoteSerializer(note)
print(serializer.data)
```

---

### 演習 1-3: ViewSetの作成

**目標**: CRUD APIエンドポイントを実装する

```python
# backend/apps/campaigns/views.py に追加

from rest_framework import viewsets, permissions
from .models import Note
from .serializers import NoteSerializer

class NoteViewSet(viewsets.ModelViewSet):
    """
    キャンペーンメモのCRUD API
    
    list: メモ一覧取得
    create: メモ作成
    retrieve: メモ詳細取得
    update: メモ更新
    destroy: メモ削除
    """
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # 自分のキャンペーンのメモのみ
        user = self.request.user
        return Note.objects.filter(
            campaign__user=user
        ).select_related('campaign', 'created_by')
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
```

**URL設定**:
```python
# backend/apps/campaigns/urls.py に追加

from rest_framework.routers import DefaultRouter
from .views import NoteViewSet

router = DefaultRouter()
router.register(r'notes', NoteViewSet, basename='note')

urlpatterns = [
    # 既存のパターン...
]

urlpatterns += router.urls
```

**APIテスト（Postman or curl）**:
```bash
# 1. ログインしてトークン取得
curl -X POST http://localhost:8000/api/accounts/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# 2. トークンを使ってメモ作成
curl -X POST http://localhost:8000/api/campaigns/notes/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{"campaign":1,"content":"新しいメモ"}'

# 3. メモ一覧取得
curl -X GET http://localhost:8000/api/campaigns/notes/ \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

---

## フェーズ 2: React基礎 - 演習問題

### 演習 2-1: 新しいコンポーネントの作成

**目標**: Reactコンポーネントの基本を学ぶ

**課題**: メモ表示コンポーネントを作成

```tsx
// frontend/src/components/CampaignNotes.tsx

import React, { useState, useEffect } from 'react';
import { Card, List, Input, Button, message, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface Note {
  id: number;
  content: string;
  created_by_name: string;
  created_at: string;
}

interface CampaignNotesProps {
  campaignId: number;
}

const CampaignNotes: React.FC<CampaignNotesProps> = ({ campaignId }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);

  // メモ一覧取得
  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:8000/api/campaigns/notes/?campaign=${campaignId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );
      const data = await response.json();
      setNotes(data.results || data);
    } catch (error) {
      message.error('メモの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // メモ作成
  const handleAddNote = async () => {
    if (!newNote.trim()) {
      message.warning('メモ内容を入力してください');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/campaigns/notes/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          campaign: campaignId,
          content: newNote,
        }),
      });

      if (response.ok) {
        message.success('メモを追加しました');
        setNewNote('');
        fetchNotes(); // 再取得
      } else {
        message.error('メモの追加に失敗しました');
      }
    } catch (error) {
      message.error('エラーが発生しました');
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [campaignId]);

  return (
    <Card title="メモ" size="small">
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 新規メモ入力 */}
        <div>
          <TextArea
            rows={3}
            placeholder="メモを入力..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddNote}
            style={{ marginTop: 8 }}
          >
            追加
          </Button>
        </div>

        {/* メモ一覧 */}
        <List
          loading={loading}
          dataSource={notes}
          renderItem={(note) => (
            <List.Item>
              <List.Item.Meta
                title={note.created_by_name}
                description={
                  <>
                    <div>{note.content}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      {dayjs(note.created_at).format('YYYY/MM/DD HH:mm')}
                    </div>
                  </>
                }
              />
            </List.Item>
          )}
        />
      </Space>
    </Card>
  );
};

export default CampaignNotes;
```

**使い方**:
```tsx
// frontend/src/pages/Campaigns.tsx に追加

import CampaignNotes from '../components/CampaignNotes';

// キャンペーン詳細モーダル内で使用
<Modal title="キャンペーン詳細" ...>
  {/* 既存の内容 */}
  
  {/* メモコンポーネント追加 */}
  <CampaignNotes campaignId={selectedCampaign.id} />
</Modal>
```

---

### 演習 2-2: カスタムHookの作成

**目標**: ロジックの再利用を学ぶ

```tsx
// frontend/src/hooks/useNotes.ts

import { useState, useEffect } from 'react';
import { message } from 'antd';
import axios from 'axios';

interface Note {
  id: number;
  content: string;
  created_by_name: string;
  created_at: string;
}

export const useNotes = (campaignId: number) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `/api/campaigns/notes/?campaign=${campaignId}`
      );
      setNotes(response.data.results || response.data);
    } catch (error) {
      message.error('メモの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const addNote = async (content: string) => {
    try {
      await axios.post('/api/campaigns/notes/', {
        campaign: campaignId,
        content,
      });
      message.success('メモを追加しました');
      fetchNotes();
    } catch (error) {
      message.error('メモの追加に失敗しました');
    }
  };

  const deleteNote = async (noteId: number) => {
    try {
      await axios.delete(`/api/campaigns/notes/${noteId}/`);
      message.success('メモを削除しました');
      fetchNotes();
    } catch (error) {
      message.error('メモの削除に失敗しました');
    }
  };

  useEffect(() => {
    if (campaignId) {
      fetchNotes();
    }
  }, [campaignId]);

  return {
    notes,
    loading,
    addNote,
    deleteNote,
    refresh: fetchNotes,
  };
};
```

**使い方**:
```tsx
// コンポーネント内で
import { useNotes } from '../hooks/useNotes';

const CampaignNotes: React.FC<CampaignNotesProps> = ({ campaignId }) => {
  const { notes, loading, addNote, deleteNote } = useNotes(campaignId);
  
  // あとはUIだけ書けばOK
  return (...)
};
```

---

## フェーズ 3: API連携 - 演習問題

### 演習 3-1: エラーハンドリングの実装

**課題**: 適切なエラーメッセージを表示する

```typescript
// frontend/src/services/api.ts

import axios, { AxiosError } from 'axios';
import { message } from 'antd';

// エラーハンドラー
export const handleApiError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    
    if (axiosError.response) {
      // サーバーからのエラーレスポンス
      const status = axiosError.response.status;
      const data = axiosError.response.data;
      
      switch (status) {
        case 400:
          message.error(data.detail || 'リクエストが不正です');
          break;
        case 401:
          message.error('認証が必要です。ログインしてください。');
          // ログイン画面にリダイレクト
          window.location.href = '/login';
          break;
        case 403:
          message.error('この操作を実行する権限がありません');
          break;
        case 404:
          message.error('リソースが見つかりません');
          break;
        case 500:
          message.error('サーバーエラーが発生しました');
          break;
        default:
          message.error('エラーが発生しました');
      }
    } else if (axiosError.request) {
      // リクエストは送信されたがレスポンスがない
      message.error('サーバーに接続できません');
    }
  } else {
    // Axios以外のエラー
    message.error('予期しないエラーが発生しました');
  }
};

// 使用例
export const getNotes = async (campaignId: number) => {
  try {
    const response = await axios.get(`/api/campaigns/notes/?campaign=${campaignId}`);
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};
```

---

### 演習 3-2: リトライ機能の実装

**課題**: ネットワークエラー時に自動リトライ

```typescript
// frontend/src/services/api.ts

import axios from 'axios';

export const fetchWithRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries - 1) {
        console.log(`リトライ ${i + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

// 使用例
const data = await fetchWithRetry(() => 
  axios.get('/api/campaigns/notes/')
);
```

---

## フェーズ 4: 認証 - 演習問題

### 演習 4-1: トークンリフレッシュの実装

**課題**: アクセストークン期限切れ時に自動更新

```typescript
// frontend/src/services/auth.ts

import axios from 'axios';

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
};

// Axiosインターセプター
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // リフレッシュ中なら待機
        return new Promise(resolve => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(axios(originalRequest));
          });
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post('/api/accounts/token/refresh/', {
          refresh: refreshToken,
        });
        
        const newAccessToken = response.data.access;
        localStorage.setItem('access_token', newAccessToken);
        
        axios.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        
        onTokenRefreshed(newAccessToken);
        isRefreshing = false;
        
        return axios(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        // リフレッシュ失敗 → ログアウト
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

---

## フェーズ 7: テスト - 演習問題

### 演習 7-1: バックエンドのテスト

**課題**: Note APIのテストを書く

```python
# backend/tests/test_notes.py

import pytest
from django.urls import reverse
from rest_framework import status
from apps.campaigns.models import Campaign, Note
from apps.accounts.models import User

@pytest.mark.django_db
class TestNoteAPI:
    
    def test_create_note(self, authenticated_client, test_user):
        """メモ作成テスト"""
        campaign = Campaign.objects.create(
            name='テストキャンペーン',
            user=test_user
        )
        
        url = reverse('note-list')
        data = {
            'campaign': campaign.id,
            'content': 'テストメモ'
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['content'] == 'テストメモ'
        assert Note.objects.count() == 1
    
    def test_list_notes(self, authenticated_client, test_user):
        """メモ一覧取得テスト"""
        campaign = Campaign.objects.create(
            name='テストキャンペーン',
            user=test_user
        )
        Note.objects.create(
            campaign=campaign,
            content='メモ1',
            created_by=test_user
        )
        Note.objects.create(
            campaign=campaign,
            content='メモ2',
            created_by=test_user
        )
        
        url = reverse('note-list')
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 2
    
    def test_cannot_access_others_notes(self, authenticated_client, test_user):
        """他人のメモにアクセスできないことを確認"""
        other_user = User.objects.create_user(
            email='other@example.com',
            password='password'
        )
        other_campaign = Campaign.objects.create(
            name='他人のキャンペーン',
            user=other_user
        )
        Note.objects.create(
            campaign=other_campaign,
            content='他人のメモ',
            created_by=other_user
        )
        
        url = reverse('note-list')
        response = authenticated_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 0
    
    def test_delete_note(self, authenticated_client, test_user):
        """メモ削除テスト"""
        campaign = Campaign.objects.create(
            name='テストキャンペーン',
            user=test_user
        )
        note = Note.objects.create(
            campaign=campaign,
            content='削除するメモ',
            created_by=test_user
        )
        
        url = reverse('note-detail', args=[note.id])
        response = authenticated_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert Note.objects.count() == 0
```

**実行**:
```bash
cd backend
pytest tests/test_notes.py -v
```

---

### 演習 7-2: フロントエンドのテスト

**課題**: CampaignNotesコンポーネントのテスト

```tsx
// frontend/src/components/CampaignNotes.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import CampaignNotes from './CampaignNotes';

// Mock API Server
const server = setupServer(
  rest.get('http://localhost:8000/api/campaigns/notes/', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 1,
          content: 'テストメモ1',
          created_by_name: 'テストユーザー',
          created_at: '2024-01-01T00:00:00Z',
        },
      ])
    );
  }),
  rest.post('http://localhost:8000/api/campaigns/notes/', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 2,
        content: '新しいメモ',
        created_by_name: 'テストユーザー',
        created_at: '2024-01-02T00:00:00Z',
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('CampaignNotes', () => {
  test('メモ一覧が表示される', async () => {
    render(<CampaignNotes campaignId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('テストメモ1')).toBeInTheDocument();
    });
  });
  
  test('メモを追加できる', async () => {
    render(<CampaignNotes campaignId={1} />);
    
    const textarea = screen.getByPlaceholderText('メモを入力...');
    const addButton = screen.getByText('追加');
    
    fireEvent.change(textarea, { target: { value: '新しいメモ' } });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText('新しいメモ')).toBeInTheDocument();
    });
  });
  
  test('空のメモは追加できない', () => {
    render(<CampaignNotes campaignId={1} />);
    
    const addButton = screen.getByText('追加');
    fireEvent.click(addButton);
    
    expect(screen.getByText('メモ内容を入力してください')).toBeInTheDocument();
  });
});
```

**実行**:
```bash
cd frontend
npm test -- CampaignNotes.test.tsx
```

---

## 追加チャレンジ課題

### チャレンジ 1: リアルタイム通知
WebSocketを使ってリアルタイムでメモ更新を通知

### チャレンジ 2: マークダウン対応
メモをMarkdown形式で書けるようにする

### チャレンジ 3: ファイル添付
メモに画像やファイルを添付できるようにする

### チャレンジ 4: タグ機能
メモにタグを付けて分類・検索できるようにする

### チャレンジ 5: コメント機能
メモに対してコメントできるようにする（ネスト構造）

---

## 答え合わせ・ヘルプ

各演習で困ったときは：
1. エラーメッセージをよく読む
2. 公式ドキュメントを参照
3. ブラウザのDevToolsで確認
4. print/console.logでデバッグ
5. Stack Overflowで検索

それでも解決しない場合は、遠慮なく質問してください！

頑張ってください！ 💪

