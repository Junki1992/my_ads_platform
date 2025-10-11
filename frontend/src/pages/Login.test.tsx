import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from './Login';
import { AuthProvider } from '../contexts/AuthContext';
import authService from '../services/authService';

// サービスのモック
jest.mock('../services/authService');
jest.mock('../services/api', () => ({
  setAuthToken: jest.fn(),
}));

const mockedAuthService = authService as jest.Mocked<typeof authService>;

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Login Page', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('ログインフォームが表示される', () => {
    renderLogin();
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  test('メールアドレスとパスワードを入力できる', () => {
    renderLogin();
    
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');
  });

  test('ログインが成功する', async () => {
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

    renderLogin();
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /login/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(mockedAuthService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  test('ログインが失敗した場合エラーメッセージが表示される', async () => {
    mockedAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

    renderLogin();
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /login/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  test('必須フィールドが空の場合バリデーションエラーが表示される', async () => {
    renderLogin();
    
    const loginButton = screen.getByRole('button', { name: /login/i });
    
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(screen.getByText(/please input your email/i)).toBeInTheDocument();
      expect(screen.getByText(/please input your password/i)).toBeInTheDocument();
    });
  });
});

