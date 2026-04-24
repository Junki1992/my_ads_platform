import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

/** 本番は Nginx の /api。ローカルは package.json の proxy 経由で同じ /api（CORS・HTTPS リダイレクトを避ける） */
export const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : '/api');

/** 本番の DRF / カスタム例外形式のどちらでも、ユーザー向け1行にまとめる */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: unknown } };
  const data = err.response?.data;
  if (!data || typeof data !== 'object') {
    return fallback;
  }
  const d = data as Record<string, unknown>;
  if (typeof d.error === 'string' && d.error) {
    return d.error;
  }
  if (d.error && typeof d.error === 'object') {
    const e = d.error as Record<string, unknown>;
    if (typeof e.message === 'string' && e.message) {
      return e.message;
    }
    if (e.details && typeof e.details === 'object') {
      return flattenFieldErrors(e.details as Record<string, unknown>) || fallback;
    }
  }
  if (typeof d.detail === 'string' && d.detail) {
    return d.detail;
  }
  return flattenFieldErrors(d) || fallback;
}

function flattenFieldErrors(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === 'error' && v && typeof v === 'object') {
      const nested = flattenFieldErrors(v as Record<string, unknown>);
      if (nested) {
        parts.push(nested);
      }
      continue;
    }
    if (Array.isArray(v) && v[0] != null) {
      parts.push(String(v[0]));
    } else if (typeof v === 'string') {
      parts.push(v);
    }
  }
  return parts.join(' ');
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // タイムアウトを300秒（5分）に延長（Boxファイル検索に時間がかかる場合があるため）
  headers: {
    'Content-Type': 'application/json',
  },
});

// リクエストインターセプター
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Boxアカウント関連の401エラー（再認証が必要）の場合はログアウトしない
    const isBoxAccountError = originalRequest?.url?.includes('/box-accounts/') && 
                              error.response?.data && 
                              typeof error.response.data === 'object' &&
                              'requires_reauth' in (error.response.data as any);
    
    // ログイン/新規登録/refresh 自身の 401 では再試行しない（誤パスワード等でリフレッシュ失敗→強制遷移を防ぐ）
    const url = originalRequest?.url || '';
    const isAuthAnonOrRefresh =
      url.includes('auth/login') ||
      url.includes('auth/register') ||
      url.includes('token/refresh');

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isBoxAccountError &&
      !isAuthAnonOrRefresh
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/accounts/token/refresh/`, {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access}`;
          }
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;