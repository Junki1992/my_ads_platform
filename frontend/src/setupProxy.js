/**
 * 開発時のみ: /api を Django へプロキシする。
 * - ホストで npm start: 既定 http://127.0.0.1:8000
 * - Docker compose: BACKEND_PROXY=http://backend:8000
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const target = process.env.BACKEND_PROXY || 'http://127.0.0.1:8000';
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );
};
