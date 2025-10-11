import axios from 'axios';
import authService from './authService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('login', () => {
    test('ログインが成功する', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 1,
            email: 'test@example.com',
            username: 'testuser',
            language: 'ja',
            timezone: 'Asia/Tokyo',
          },
          tokens: {
            access: 'mock_access_token',
            refresh: 'mock_refresh_token',
          },
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/accounts/auth/login/',
        {
          email: 'test@example.com',
          password: 'password123',
        }
      );
      expect(result).toEqual(mockResponse.data);
    });

    test('ログインが失敗する', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Invalid credentials',
          },
        },
      };

      mockedAxios.post.mockRejectedValue(mockError);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toEqual(mockError);
    });
  });

  describe('logout', () => {
    test('ログアウトが成功する', async () => {
      localStorage.setItem('refresh_token', 'mock_refresh_token');
      
      const mockResponse = {
        data: {
          message: 'Successfully logged out',
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await authService.logout();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/accounts/auth/logout/',
        {
          refresh: 'mock_refresh_token',
        }
      );
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });
  });

  describe('register', () => {
    test('ユーザー登録が成功する', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 1,
            email: 'newuser@example.com',
            username: 'newuser',
            language: 'ja',
            timezone: 'Asia/Tokyo',
          },
          tokens: {
            access: 'mock_access_token',
            refresh: 'mock_refresh_token',
          },
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const userData = {
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'password123',
        password_confirm: 'password123',
        first_name: 'New',
        last_name: 'User',
      };

      const result = await authService.register(userData);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/accounts/auth/register/',
        userData
      );
      expect(result).toEqual(mockResponse.data);
    });
  });
});

