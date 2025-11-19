import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import authService, { User, LoginCredentials, RegisterData } from '../services/authService';
import { message } from 'antd';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
      const storedUser = authService.getStoredUser();
      if (storedUser && authService.isAuthenticated()) {
        try {
            // タイムアウトを5秒に設定
            const timeoutPromise = new Promise<User>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 5000)
            );
            const currentUser = await Promise.race([
              authService.getCurrentUser(),
              timeoutPromise
            ]);
          setUser(currentUser);
        } catch (error) {
          console.error('Failed to fetch user:', error);
            // エラーが発生した場合は認証情報をクリア
            try {
              await authService.logout();
            } catch (logoutError) {
              // ログアウトエラーは無視
              console.error('Logout error:', logoutError);
            }
            setUser(null);
          }
        }
      } finally {
        // 必ずローディングを終了
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await authService.login(credentials);
      setUser(response.user);
      message.success('ログインしました');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'ログインに失敗しました');
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await authService.register(data);
      setUser(response.user);
      message.success('登録が完了しました');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || '登録に失敗しました';
      message.error(errorMsg);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      message.success('ログアウトしました');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUser = async (data: Partial<User>) => {
    try {
      const updatedUser = await authService.updateProfile(data);
      setUser(updatedUser);
      message.success('プロフィールを更新しました');
    } catch (error: any) {
      message.error('更新に失敗しました');
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};