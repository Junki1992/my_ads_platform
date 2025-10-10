import React, { useState } from 'react';
import { Form, Input, Button, Card, Tabs, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      await login({
        email: values.email,
        password: values.password,
      });
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
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
    </div>
  );
};

export default Login;