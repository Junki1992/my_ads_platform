import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { ReactNode } from 'react';
import authService from '../services/authService';

// authServiceのモック
jest.mock('../services/authService');

const mockedAuthService = authService as jest.Mocked<typeof authService>;

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('初期状態ではユーザーがnull', async () => {
    mockedAuthService.getStoredUser.mockReturnValue(null);
    mockedAuthService.isAuthenticated.mockReturnValue(false);

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('loginでユーザー情報が設定される', async () => {
    mockedAuthService.getStoredUser.mockReturnValue(null);
    mockedAuthService.isAuthenticated.mockReturnValue(false);

    const mockResponse = {
      user: {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        language: 'ja',
        timezone: 'Asia/Tokyo',
      },
      tokens: {
        access: 'mock_access_token',
        refresh: 'mock_refresh_token',
      },
    };

    mockedAuthService.login.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    expect(result.current.user).toEqual(mockResponse.user);
    expect(result.current.isAuthenticated).toBe(true);
  });

  test('logoutでユーザー情報がクリアされる', async () => {
    mockedAuthService.getStoredUser.mockReturnValue(null);
    mockedAuthService.isAuthenticated.mockReturnValue(false);

    const mockResponse = {
      user: {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        language: 'ja',
        timezone: 'Asia/Tokyo',
      },
      tokens: {
        access: 'mock_access_token',
        refresh: 'mock_refresh_token',
      },
    };

    mockedAuthService.login.mockResolvedValue(mockResponse);
    mockedAuthService.logout.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // ログイン
    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    expect(result.current.isAuthenticated).toBe(true);

    // ログアウト
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('updateUserでユーザー情報が更新される', async () => {
    mockedAuthService.getStoredUser.mockReturnValue(null);
    mockedAuthService.isAuthenticated.mockReturnValue(false);

    const mockLoginResponse = {
      user: {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        language: 'ja',
        timezone: 'Asia/Tokyo',
      },
      tokens: {
        access: 'mock_access_token',
        refresh: 'mock_refresh_token',
      },
    };

    const updatedUser = {
      ...mockLoginResponse.user,
      first_name: 'Updated',
      last_name: 'Name',
    };

    mockedAuthService.login.mockResolvedValue(mockLoginResponse);
    mockedAuthService.updateProfile.mockResolvedValue(updatedUser);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    await act(async () => {
      await result.current.updateUser({
        first_name: 'Updated',
        last_name: 'Name',
      });
    });

    expect(result.current.user?.first_name).toBe('Updated');
    expect(result.current.user?.last_name).toBe('Name');
  });
});

