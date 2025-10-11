import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import { AuthProvider } from '../contexts/AuthContext';

// Axiosのモック
jest.mock('../services/api', () => ({
  setAuthToken: jest.fn(),
}));

const TestComponent = () => <div>Protected Content</div>;

const renderWithRouter = (isAuthenticated: boolean) => {
  // localStorageをモック
  if (isAuthenticated) {
    localStorage.setItem('access_token', 'mock_token');
  } else {
    localStorage.clear();
  }

  return render(
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <PrivateRoute>
                <TestComponent />
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('PrivateRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('認証済みの場合、保護されたコンテンツが表示される', () => {
    renderWithRouter(true);
    
    // 保護されたコンテンツが表示されることを確認
    expect(screen.queryByText('Protected Content')).toBeInTheDocument();
  });

  test('未認証の場合、リダイレクトされる', () => {
    renderWithRouter(false);
    
    // 保護されたコンテンツが表示されないことを確認
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});

