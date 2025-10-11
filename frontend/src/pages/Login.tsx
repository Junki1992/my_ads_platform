import React, { useState } from 'react';
import { Form, Input, Button, Card, Tabs, message, Modal, Space, Alert } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [twoFactorModalVisible, setTwoFactorModalVisible] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState<{ email: string; password: string } | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      const credentials = {
        email: values.email,
        password: values.password,
      };
      
      // 直接APIを呼び出して2FAチェック
      const response = await api.post('/accounts/auth/login/', credentials);
      
      // 202レスポンス = 2FAが必要
      if (response.status === 202 || response.data.requires_2fa) {
        setLoginCredentials(credentials);
        setTwoFactorModalVisible(true);
        setLoading(false);
        return;
      }
      
      // 通常のログイン成功（2FA無効ユーザー）
      const { user, tokens } = response.data;
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);
      localStorage.setItem('user', JSON.stringify(user));
      
      message.success('ログインしました');
      window.location.href = '/';
    } catch (error: any) {
      // ステータス202もキャッチされるので、ここでもチェック
      if (error.response?.status === 202 || error.response?.data?.requires_2fa) {
        setLoginCredentials({
          email: values.email,
          password: values.password,
        });
        setTwoFactorModalVisible(true);
        setLoading(false);
        return;
      }
      
      message.error(error.response?.data?.error || 'ログインに失敗しました');
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handle2FAVerify = async (values: { token: string }) => {
    if (!loginCredentials) return;
    
    setLoading(true);
    try {
      // 2FAトークン付きで再度ログイン
      const response = await api.post('/accounts/auth/login/', {
        ...loginCredentials,
        two_factor_token: values.token,
      });
      
      // トークンを保存してログイン完了
      const { user, tokens } = response.data;
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);
      localStorage.setItem('user', JSON.stringify(user));
      
      message.success('ログインしました');
      setTwoFactorModalVisible(false);
      
      // ページをリロードして認証状態を反映
      window.location.href = '/';
    } catch (error: any) {
      message.error(error.response?.data?.error || '認証コードが正しくありません');
    } finally {
      setLoading(false);
    }
  };
  
  const handleBackupCodeVerify = async (values: { backup_code: string }) => {
    if (!loginCredentials) return;
    
    setLoading(true);
    try {
      // バックアップコード付きで直接ログイン
      const response = await api.post('/accounts/auth/login/', {
        ...loginCredentials,
        backup_code: values.backup_code,
      });
      
      // トークンを保存してログイン完了
      const { user, tokens } = response.data;
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);
      localStorage.setItem('user', JSON.stringify(user));
      
      message.success('バックアップコードでログインしました');
      setTwoFactorModalVisible(false);
      
      // ページをリロードして認証状態を反映
      window.location.href = '/';
    } catch (error: any) {
      message.error(error.response?.data?.error || 'バックアップコードが正しくありません');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    if (values.password !== values.password_confirm) {
      message.error('パスワードが一致しません');
      return;
    }

    setLoading(true);
    try {
      await register({
        email: values.email,
        username: values.username,
        password: values.password,
        password_confirm: values.password_confirm,
        first_name: values.first_name,
        last_name: values.last_name,
        company: values.company,
        phone: values.phone,
      });
      navigate('/');
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const LoginForm = () => (
    <Form onFinish={handleLogin} size="large">
      <Form.Item
        name="email"
        rules={[
          { required: true, message: 'メールアドレスを入力してください' },
          { type: 'email', message: '有効なメールアドレスを入力してください' },
        ]}
      >
        <Input
          prefix={<MailOutlined />}
          placeholder="メールアドレス"
        />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[{ required: true, message: 'パスワードを入力してください' }]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="パスワード"
        />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          ログイン
        </Button>
      </Form.Item>
    </Form>
  );

  const RegisterForm = () => (
    <Form onFinish={handleRegister} size="large">
      <Form.Item
        name="email"
        rules={[
          { required: true, message: 'メールアドレスを入力してください' },
          { type: 'email', message: '有効なメールアドレスを入力してください' },
        ]}
      >
        <Input
          prefix={<MailOutlined />}
          placeholder="メールアドレス"
        />
      </Form.Item>

      <Form.Item
        name="username"
        rules={[{ required: true, message: 'ユーザー名を入力してください' }]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="ユーザー名"
        />
      </Form.Item>

      <Form.Item
        name="first_name"
      >
        <Input placeholder="名" />
      </Form.Item>

      <Form.Item
        name="last_name"
      >
        <Input placeholder="姓" />
      </Form.Item>

      <Form.Item
        name="company"
      >
        <Input placeholder="会社名" />
      </Form.Item>

      <Form.Item
        name="phone"
      >
        <Input
          prefix={<PhoneOutlined />}
          placeholder="電話番号"
        />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[
          { required: true, message: 'パスワードを入力してください' },
          { min: 8, message: 'パスワードは8文字以上である必要があります' },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="パスワード"
        />
      </Form.Item>

      <Form.Item
        name="password_confirm"
        rules={[
          { required: true, message: 'パスワード（確認）を入力してください' },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="パスワード（確認）"
        />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          登録
        </Button>
      </Form.Item>
    </Form>
  );

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: '#f0f2f5'
    }}>
      <Card style={{ width: 450 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1>My Ads Platform</h1>
        </div>
        <Tabs
          items={[
            {
              key: 'login',
              label: 'ログイン',
              children: <LoginForm />,
            },
            {
              key: 'register',
              label: '新規登録',
              children: <RegisterForm />,
            },
          ]}
        />
      </Card>

      {/* 2段階認証モーダル */}
      <Modal
        title={
          <Space>
            <SafetyOutlined />
            <span>2段階認証</span>
          </Space>
        }
        open={twoFactorModalVisible}
        onCancel={() => {
          setTwoFactorModalVisible(false);
          setUseBackupCode(false);
        }}
        footer={null}
        width={450}
      >
        {!useBackupCode ? (
          <Form onFinish={handle2FAVerify} layout="vertical">
            <Alert
              message="認証コードを入力してください"
              description="認証アプリに表示されている6桁のコードを入力してください。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Form.Item
              name="token"
              rules={[
                { required: true, message: '認証コードを入力してください' },
                { len: 6, message: '6桁のコードを入力してください' },
              ]}
            >
              <Input
                placeholder="123456"
                maxLength={6}
                autoFocus
                style={{ 
                  fontSize: '32px', 
                  textAlign: 'center', 
                  letterSpacing: '12px',
                  height: '60px'
                }}
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                確認
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Button type="link" onClick={() => setUseBackupCode(true)}>
                バックアップコードを使用
              </Button>
            </div>
          </Form>
        ) : (
          <Form onFinish={handleBackupCodeVerify} layout="vertical">
            <Alert
              message="バックアップコードを入力してください"
              description="保存していたバックアップコードのいずれかを入力してください。"
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Form.Item
              name="backup_code"
              rules={[{ required: true, message: 'バックアップコードを入力してください' }]}
            >
              <Input
                placeholder="1234-5678"
                autoFocus
                style={{ fontSize: '18px', textAlign: 'center' }}
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                確認
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Button type="link" onClick={() => setUseBackupCode(false)}>
                認証コードを使用
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default Login;