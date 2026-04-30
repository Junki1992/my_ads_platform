FROM node:18-alpine

WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# アプリケーションコードをコピー
COPY . .

# 開発サーバー用ポート（package.json の PORT と一致）
EXPOSE 3002

# 開発サーバーを起動
CMD ["npm", "start"]
