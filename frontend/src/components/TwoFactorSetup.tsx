import React, { useState } from 'react';
import { Modal, Form, Input, Button, Alert, Typography, Space, Card, Divider, message } from 'antd';
import { SafetyOutlined, CopyOutlined, QrcodeOutlined } from '@ant-design/icons';
import twoFactorService from '../services/twoFactorService';

const { Title, Text, Paragraph } = Typography;

interface TwoFactorSetupProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ visible, onClose, onSuccess }) => {
  const [step, setStep] = useState<'password' | 'qrcode' | 'verify'>('password');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [form] = Form.useForm();

  const handlePasswordSubmit = async (values: { password: string }) => {
    setLoading(true);
    try {
      const response = await twoFactorService.enable(values.password);
      setQrCode(response.qr_code);
      setBackupCodes(response.backup_codes);
      setStep('qrcode');
      message.success('QRコードを生成しました');
    } catch (error: any) {
      message.error(error.response?.data?.error || '2FAの有効化に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (values: { token: string }) => {
    setLoading(true);
    try {
      await twoFactorService.verify(values.token);
      message.success('2段階認証が有効になりました！');
      onSuccess();
      handleClose();
    } catch (error: any) {
      message.error('コードが正しくありません');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('password');
    setQrCode('');
    setBackupCodes([]);
    form.resetFields();
    onClose();
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    message.success('バックアップコードをコピーしました');
  };

  const downloadBackupCodes = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '2fa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    message.success('バックアップコードをダウンロードしました');
  };

  return (
    <Modal
      title={
        <Space>
          <SafetyOutlined />
          <span>2段階認証を有効化</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={600}
    >
      {step === 'password' && (
        <Form form={form} onFinish={handlePasswordSubmit} layout="vertical">
          <Alert
            message="セキュリティを強化します"
            description="2段階認証を有効にすると、ログイン時にパスワードに加えて、スマートフォンアプリで生成される6桁のコードが必要になります。"
            type="info"
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

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              次へ
            </Button>
          </Form.Item>
        </Form>
      )}

      {step === 'qrcode' && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            message="手順1: 認証アプリでQRコードをスキャン"
            description="Google AuthenticatorまたはAuthyなどの認証アプリでこのQRコードをスキャンしてください。"
            type="info"
            showIcon
          />

          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <img src={qrCode} alt="QR Code" style={{ maxWidth: '100%', height: 'auto' }} />
          </div>

          <Divider>手順2: バックアップコードを保存</Divider>

          <Alert
            message="重要: バックアップコードを安全な場所に保存してください"
            description="スマートフォンを紛失した場合、これらのコードを使用してログインできます。各コードは1回のみ使用できます。"
            type="warning"
            showIcon
          />

          <Card size="small">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {backupCodes.map((code, index) => (
                <Text key={index} code copyable>
                  {code}
                </Text>
              ))}
            </Space>
          </Card>

          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button icon={<CopyOutlined />} onClick={copyBackupCodes}>
              コピー
            </Button>
            <Button onClick={downloadBackupCodes}>
              ダウンロード
            </Button>
          </Space>

          <Divider>手順3: 認証コードで確認</Divider>

          <Form form={form} onFinish={handleVerify} layout="vertical">
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
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                2段階認証を有効化
              </Button>
            </Form.Item>
          </Form>
        </Space>
      )}
    </Modal>
  );
};

export default TwoFactorSetup;

