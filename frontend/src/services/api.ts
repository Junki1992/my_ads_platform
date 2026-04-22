import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

/** 本番は Nginx の /api。ローカルは package.json の proxy 経由で同じ /api（CORS・HTTPS リダイレクトを避ける） */
export const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : '/api');

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
    
    if (error.response?.status === 401 && !originalRequest._retry && !isBoxAccountError) {
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