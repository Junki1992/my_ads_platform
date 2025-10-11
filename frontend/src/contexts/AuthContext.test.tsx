import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { ReactNode } from 'react';

// Axiosのモック
jest.mock('../services/api', () => ({
  setAuthToken: jest.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('初期状態ではユーザーがnull', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  test('loginでユーザー情報が設定される', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
    };
    
    const mockTokens = {
      access: 'mock_access_token',
      refresh: 'mock_refresh_token',
    };

    await act(async () => {
      result.current.login(mockUser, mockTokens);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('access_token')).toBe('mock_access_token');
    expect(localStorage.getItem('refresh_token')).toBe('mock_refresh_token');
  });

  test('logoutでユーザー情報がクリアされる', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
    };
    
    const mockTokens = {
      access: 'mock_access_token',
      refresh: 'mock_refresh_token',
    };

    // ログイン
    await act(async () => {
      result.current.login(mockUser, mockTokens);
    });

    expect(result.current.isAuthenticated).toBe(true);

    // ログアウト
    await act(async () => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  test('updateUserでユーザー情報が更新される', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
    };
    
    const mockTokens = {
      access: 'mock_access_token',
      refresh: 'mock_refresh_token',
    };

    await act(async () => {
      result.current.login(mockUser, mockTokens);
    });

    const updatedUser = {
      ...mockUser,
      first_name: 'Updated',
      last_name: 'Name',
    };

    await act(async () => {
      result.current.updateUser(updatedUser);
    });

    expect(result.current.user?.first_name).toBe('Updated');
    expect(result.current.user?.last_name).toBe('Name');
  });
});

