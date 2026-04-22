/**
 * アプリケーション設定
 * 環境変数から設定を読み込む
 */

export const config = {
  // API URL（末尾 /api は含めない想定。本番は同一オリジン）
  apiUrl:
    process.env.REACT_APP_API_URL?.replace(/\/api\/?$/, '') ||
    (process.env.NODE_ENV === 'production' ? '' : ''),
  
  // フィーチャーフラグ
  features: {
    billingEnabled: process.env.REACT_APP_ENABLE_BILLING === 'true',
  },
  
  // Analytics
  analytics: {
    googleAnalyticsId: process.env.REACT_APP_GOOGLE_ANALYTICS_ID || '',
    sentryDsn: process.env.REACT_APP_SENTRY_DSN || '',
  },
};

export default config;

