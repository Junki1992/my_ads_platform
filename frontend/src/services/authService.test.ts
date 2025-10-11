import axios from 'axios';
import { login, logout, register } from './authService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    test('ログインが成功する', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 1,
            email: 'test@example.com',
            username: 'testuser',
          },
          tokens: {
            access: 'mock_access_token',
            refresh: 'mock_refresh_token',
          },
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await login('test@example.com', 'password123');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/accounts/auth/login/',
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

      await expect(login('test@example.com', 'wrongpassword')).rejects.toEqual(
        mockError
      );
    });
  });

  describe('logout', () => {
    test('ログアウトが成功する', async () => {
      const mockResponse = {
        data: {
          message: 'Successfully logged out',
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await logout('mock_refresh_token');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/accounts/auth/logout/',
        {
          refresh: 'mock_refresh_token',
        }
      );
      expect(result).toEqual(mockResponse.data);
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
        first_name: 'New',
        last_name: 'User',
      };

      const result = await register(userData);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/accounts/auth/register/',
        userData
      );
      expect(result).toEqual(mockResponse.data);
    });
  });
});

