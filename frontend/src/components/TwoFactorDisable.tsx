import React, { useState } from 'react';
import { Modal, Form, Input, Button, Alert, Space, message } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import twoFactorService from '../services/twoFactorService';

interface TwoFactorDisableProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TwoFactorDisable: React.FC<TwoFactorDisableProps> = ({ visible, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values: { password: string; token: string }) => {
    setLoading(true);
    try {
      await twoFactorService.disable(values.password, values.token);
      message.success('2段階認証を無効化しました');
      onSuccess();
      handleClose();
    } catch (error: any) {
      message.error(error.response?.data?.error || '2段階認証の無効化に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <WarningOutlined style={{ color: '#ff4d4f' }} />
          <span>2段階認証を無効化</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
    >
      <Form form={form} onFinish={handleSubmit} layout="vertical">
        <Alert
          message="セキュリティが低下します"
          description="2段階認証を無効化すると、アカウントのセキュリティレベルが低下します。本当に無効化しますか？"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form.Item
          label="現在のパスワード"
          name="password"
          rules={[{ required: true, message: 'パスワードを入力してください' }]}
        >
          <Input.Password placeholder="パスワードを入力" />
        </Form.Item>

        <Form.Item
          label="認証アプリの6桁コード"
          name="token"
          rules={[
            { required: true, message: '認証コードを入力してください' },
            { len: 6, message: '6桁のコードを入力してください' },
          ]}
        >
          <Input
            placeholder="123456"
            maxLength={6}
            style={{ fontSize: '24px', textAlign: 'center', letterSpacing: '8px' }}
          />
        </Form.Item>

        <Form.Item>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button onClick={handleClose}>
              キャンセル
            </Button>
            <Button type="primary" danger htmlType="submit" loading={loading}>
              無効化する
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default TwoFactorDisable;

