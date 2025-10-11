# My Ads Platform - Frontend

Meta（Facebook/Instagram）広告管理プラットフォームのフロントエンド

## 🚀 技術スタック

- **React 18** - UIライブラリ
- **TypeScript** - 型安全性
- **Ant Design** - UIコンポーネントライブラリ
- **React Router** - ルーティング
- **Axios** - HTTPクライアント
- **i18next** - 多言語対応
- **Recharts** - データ可視化

## 📦 テスト

### テストフレームワーク
- **Jest** - テストランナー
- **React Testing Library** - コンポーネントテスト
- **@testing-library/user-event** - ユーザーインタラクションテスト

### テスト実行

```bash
# テストを実行（watch モード）
npm test

# カバレッジ付きでテストを実行
npm run test:coverage

# 全テストを1回実行（CI用）
npm test -- --watchAll=false
```

### テストカバレッジ目標
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### テストファイルの場所
```
src/
├── contexts/
│   └── AuthContext.test.tsx
├── components/
│   └── PrivateRoute.test.tsx
├── pages/
│   └── Login.test.tsx
├── services/
│   └── authService.test.ts
└── test-utils.tsx
```

## 🏗️ セットアップ

### 前提条件
- Node.js 16.x 以上
- npm 7.x 以上

### インストール

```bash
# 依存関係をインストール
npm install
```

### 開発サーバー起動

```bash
# 開発サーバーを起動（http://localhost:3000）
npm start
```

### ビルド

```bash
# 本番用ビルドを作成
npm run build
```

## 🌐 多言語対応

サポートされている言語：
- 🇯🇵 日本語
- 🇺🇸 英語
- 🇨🇳 中国語
- 🇰🇷 韓国語

言語ファイルの場所: `src/i18n/locales/`

## 📁 プロジェクト構造

```
frontend/
├── public/              # 静的ファイル
├── src/
│   ├── components/      # 再利用可能なコンポーネント
│   ├── contexts/        # React Context
│   ├── pages/           # ページコンポーネント
│   ├── services/        # API通信
│   ├── i18n/            # 多言語対応
│   ├── test-utils.tsx   # テストユーティリティ
│   ├── setupTests.ts    # テスト設定
│   ├── App.tsx          # ルートコンポーネント
│   └── index.tsx        # エントリーポイント
├── package.json
└── tsconfig.json
```

## 🧪 テスト作成ガイド

### 基本的なコンポーネントテスト

```typescript
import { render, screen } from '../test-utils';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  test('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### ユーザーインタラクションのテスト

```typescript
import { render, screen, fireEvent } from '../test-utils';
import MyButton from './MyButton';

test('handles click event', () => {
  const handleClick = jest.fn();
  render(<MyButton onClick={handleClick} />);
  
  fireEvent.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### 非同期処理のテスト

```typescript
import { render, screen, waitFor } from '../test-utils';
import AsyncComponent from './AsyncComponent';

test('loads data', async () => {
  render(<AsyncComponent />);
  
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });
});
```

## 🔧 環境変数

環境変数は `.env` ファイルで管理します：

```bash
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENABLE_BILLING=false
```

## 📝 コーディング規約

- TypeScriptの型定義を必ず使用
- コンポーネントは関数コンポーネントで作成
- CSSはモジュールCSSまたはAnt Designのスタイルを使用
- 新機能追加時はテストも作成

## 🚀 デプロイ

### ビルドファイルの作成

```bash
npm run build
```

ビルドファイルは `build/` ディレクトリに生成されます。

### 静的ホスティング

- **Vercel** - 推奨
- **Netlify**
- **AWS S3 + CloudFront**
- **GCP Cloud Storage**

## 🔒 セキュリティ

- JWTトークンは `localStorage` に保存
- APIリクエストには認証トークンを自動付与
- CSRF対策実装済み

## 📞 サポート

問題が発生した場合は、GitHubのIssueを作成してください。

## 📄 ライセンス

MIT License

