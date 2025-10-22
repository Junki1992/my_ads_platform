import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, Switch, Divider, Table, Space, Modal, Alert, Tabs, Badge, message, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import metaAccountService, { MetaAccount, MetaAccountCreate, MetaAdAccount } from '../services/metaAccountService';
import twoFactorService from '../services/twoFactorService';
import { EditOutlined, DeleteOutlined, SaveOutlined, SwapOutlined, PlusOutlined, CheckCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import TwoFactorSetup from '../components/TwoFactorSetup';
import TwoFactorDisable from '../components/TwoFactorDisable';

const { Option } = Select;
const { TabPane } = Tabs;

interface SettingsData {
  company_name: string;
  email: string;
  phone: string;
  language: string;
  timezone: string;
  notifications: boolean;
}

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  const [metaAccountForm] = Form.useForm();
  const [tokenExchangeForm] = Form.useForm();
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<MetaAccount | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [initialSettings, setInitialSettings] = useState<SettingsData | null>(null);
  
  // Token Exchange Modal
  const [tokenExchangeModalVisible, setTokenExchangeModalVisible] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [longLivedToken, setLongLivedToken] = useState('');
  
  // Fetch Accounts Modal
  const [fetchedAccounts, setFetchedAccounts] = useState<MetaAdAccount[]>([]);
  const [fetchingAccounts, setFetchingAccounts] = useState(false);
  const [selectedFetchedAccount, setSelectedFetchedAccount] = useState<MetaAdAccount | null>(null);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  
  // 2FA関連
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorSetupVisible, setTwoFactorSetupVisible] = useState(false);
  const [twoFactorDisableVisible, setTwoFactorDisableVisible] = useState(false);
  
  // 削除確認モーダル
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<MetaAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        // バックエンドから現在のユーザー情報を取得
        const response = await api.get('/accounts/users/me/');
        const user = response.data;
        
        const settings: SettingsData = {
          company_name: user.company || '',
          email: user.email || '',
          phone: user.phone || '',
          language: user.language || i18n.language,
          timezone: user.timezone || 'Asia/Tokyo',
          notifications: true,
        };
        
        setInitialSettings(settings);
        form.setFieldsValue(settings);
      } catch (error) {
        console.error('Failed to load user settings:', error);
        // エラー時はデフォルト値を使用
        const settings: SettingsData = {
          company_name: '',
          email: '',
          phone: '',
          language: i18n.language,
          timezone: 'Asia/Tokyo',
          notifications: true,
        };
        setInitialSettings(settings);
        form.setFieldsValue(settings);
      }
    };
    
    loadUserSettings();
    loadMetaAccounts();
    loadTwoFactorStatus();
    
    // URLパラメータからOAuth結果をチェック
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    const accounts = urlParams.get('accounts');
    const message = urlParams.get('message');
    
    if (success === 'oauth_success') {
      // OAuth認証成功
      loadMetaAccounts(); // アカウント一覧を再読み込み
      // URLパラメータをクリア
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      // OAuth認証エラー
      console.error('OAuth error:', error, message);
      // URLパラメータをクリア
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [form, i18n.language]);
  
  const loadTwoFactorStatus = async () => {
    try {
      const status = await twoFactorService.getStatus();
      setTwoFactorEnabled(status.enabled);
    } catch (error) {
      console.error('Failed to load 2FA status:', error);
    }
  };

  const loadMetaAccounts = async () => {
    try {
      const accounts = await metaAccountService.getMetaAccounts();
      setMetaAccounts(accounts);
    } catch (error) {
      console.error('Failed to load Meta accounts:', error);
    }
  };

  const handleSubmit = async (values: SettingsData) => {
    setLoading(true);
    try {
      // バックエンドに設定を保存
      await api.put('/accounts/users/update_profile/', {
        company: values.company_name,
        phone: values.phone,
        language: values.language,
        timezone: values.timezone,
      });
      
      // 言語を更新
      await i18n.changeLanguage(values.language);
      
      console.log('Settings saved successfully');
      
      // 初期設定を更新して編集モードを終了
      setInitialSettings(values);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (initialSettings) {
      form.setFieldsValue(initialSettings);
    }
    setIsEditing(false);
  };

  const handleMetaAccountSubmit = async (values: any) => {
    if (!selectedFetchedAccount) return;
    
    setLoading(true);
    try {
      const createData: MetaAccountCreate = {
        account_id: selectedFetchedAccount.account_id,
        account_name: selectedFetchedAccount.name,
        access_token: values.access_token,
      };

      if (editingAccount) {
        await metaAccountService.updateMetaAccount(editingAccount.id, createData);
      } else {
        await metaAccountService.createMetaAccount(createData);
      }

      setIsModalVisible(false);
      metaAccountForm.resetFields();
      setEditingAccount(null);
      setFetchedAccounts([]);
      setSelectedFetchedAccount(null);
      setTokenInfo(null);
      loadMetaAccounts();
    } catch (error) {
      console.error('Failed to save Meta account:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditMetaAccount = (account: MetaAccount) => {
    setEditingAccount(account);
    setIsModalVisible(true);
  };

  const handleDeleteClick = (account: MetaAccount) => {
    setDeletingAccount(account);
    setDeleteModalVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAccount) return;
    
    setDeleting(true);
    try {
      await metaAccountService.deleteMetaAccount(deletingAccount.id);
      message.success('アカウントを削除しました');
      setDeleteModalVisible(false);
      setDeletingAccount(null);
      loadMetaAccounts();
    } catch (error) {
      console.error('Failed to delete Meta account:', error);
      message.error('アカウントの削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };


  const handleOAuthLoginForAccount = async (accountId: number) => {
    try {
      const response = await metaAccountService.getOAuthUrlForAccount(accountId);
      // Meta公式認証ページにリダイレクト
      window.location.href = response.auth_url;
    } catch (error) {
      console.error('Failed to get OAuth URL for account:', error);
    }
  };

  const handleOAuthLogin = async () => {
    try {
      // 直接OAuth認証を開始
      const response = await metaAccountService.getOAuthUrl();
      window.location.href = response.auth_url;
    } catch (error: any) {
      console.error('Failed to get OAuth URL:', error);
      message.error('認証URLの取得に失敗しました');
    }
  };

  const handleTokenExchange = async (values: any) => {
    setExchanging(true);
    try {
      const response = await metaAccountService.exchangeToken(values);
      setLongLivedToken(response.access_token);
      
      // Reset form
      tokenExchangeForm.resetFields();
    } catch (error) {
      console.error('Token exchange failed:', error);
    } finally {
      setExchanging(false);
    }
  };

  const handleValidateToken = async () => {
    if (!longLivedToken) return;
    
    try {
      const response = await metaAccountService.validateToken();
      console.log('Token validation result:', response);
      // Show validation result to user
    } catch (error) {
      console.error('Token validation failed:', error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Show success message
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleFetchAccounts = async () => {
    const accessToken = metaAccountForm.getFieldValue('access_token');
    if (!accessToken) return;

    setFetchingAccounts(true);
    try {
      const response = await metaAccountService.fetchAccounts(accessToken);
      setFetchedAccounts(response.accounts);
      setTokenInfo(response.token_info);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      setFetchedAccounts([]);
      setTokenInfo(null);
    } finally {
      setFetchingAccounts(false);
    }
  };

  const handleSelectFetchedAccount = (accountId: string) => {
    const account = fetchedAccounts.find(acc => acc.account_id === accountId);
    if (account) {
      setSelectedFetchedAccount(account);
      metaAccountForm.setFieldsValue({
        account_id: account.account_id,
        account_name: account.name
      });
    }
  };

  const formatExpiryDate = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return t('permanentValid');
    const date = new Date(timestamp * 1000);
    return date.toLocaleString(i18n.language === 'ja' ? 'ja-JP' : 'en-US');
  };

  const getExpiryStatus = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return { text: t('permanentValid'), color: 'green' };
    const now = Date.now() / 1000;
    const daysRemaining = Math.floor((timestamp - now) / 86400);
    
    if (daysRemaining < 0) return { text: t('expired'), color: 'red' };
    if (daysRemaining < 7) return { text: t('daysRemaining', { count: daysRemaining }), color: 'orange' };
    if (daysRemaining < 30) return { text: t('daysRemaining', { count: daysRemaining }), color: 'blue' };
    return { text: t('daysRemaining', { count: daysRemaining }), color: 'green' };
  };

  const columns = [
    {
      title: t('accountName'),
      dataIndex: 'account_name',
      key: 'account_name',
    },
    {
      title: t('accountId'),
      dataIndex: 'account_id',
      key: 'account_id',
    },
    {
      title: t('status'),
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <span style={{ color: isActive ? 'green' : 'red' }}>
          {isActive ? t('activeStatus') : t('inactiveStatus')}
        </span>
      ),
    },
    {
      title: t('creationDate'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : 'en-US'),
    },
    {
      title: t('actions'),
      key: 'action',
      render: (_: any, record: MetaAccount) => (
        <Space>
          <Button
            type="link"
            icon={<CheckCircleOutlined />}
            onClick={() => handleOAuthLoginForAccount(record.id)}
            style={{ color: '#1877f2' }}
          >
            認証更新
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditMetaAccount(record)}
          >
            {t('edit')}
          </Button>
          <Button 
            type="link" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteClick(record)}
          >
            {t('delete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title={t('accountSettings')} style={{ marginBottom: 24 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="company_name"
            label={t('companyName')}
            rules={[{ required: true, message: t('enterCompanyName') }]}
          >
            <Input 
              placeholder={t('enterCompanyName')} 
              readOnly={!isEditing}
              className={!isEditing ? 'readonly-input' : ''}
              style={{ cursor: isEditing ? 'text' : 'default' }}
            />
          </Form.Item>

          <Form.Item
            name="email"
            label={t('emailAddress')}
            rules={[{ required: true, message: t('enterEmailAddress') }]}
          >
            <Input 
              placeholder={t('enterEmailAddress')} 
              readOnly={!isEditing}
              className={!isEditing ? 'readonly-input' : ''}
              style={{ cursor: isEditing ? 'text' : 'default' }}
            />
          </Form.Item>

          <Form.Item
            name="phone"
            label={t('phoneNumber')}
            rules={[{ required: true, message: t('enterPhoneNumber') }]}
          >
            <Input 
              placeholder={t('enterPhoneNumber')} 
              readOnly={!isEditing}
              className={!isEditing ? 'readonly-input' : ''}
              style={{ cursor: isEditing ? 'text' : 'default' }}
            />
          </Form.Item>

          <Form.Item
            name="language"
            label={t('language')}
            rules={[{ required: true, message: t('languageRequired') }]}
          >
            <Select 
              onChange={(value) => i18n.changeLanguage(value)}
              open={isEditing ? undefined : false}
              className={!isEditing ? 'readonly-select' : ''}
              style={{ cursor: isEditing ? 'pointer' : 'default' }}
            >
              <Option value="ja">{t('japanese')}</Option>
              <Option value="en">{t('english')}</Option>
              <Option value="zh">{t('chinese')}</Option>
              <Option value="ko">{t('korean')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="timezone"
            label={t('timezone')}
          >
            <Select
              open={isEditing ? undefined : false}
              className={!isEditing ? 'readonly-select' : ''}
              style={{ cursor: isEditing ? 'pointer' : 'default' }}
            >
              <Option value="Asia/Tokyo">Asia/Tokyo</Option>
              <Option value="UTC">UTC</Option>
              <Option value="America/New_York">America/New_York</Option>
            </Select>
          </Form.Item>

          <Divider />

          <Form.Item
            name="notifications"
            label={t('notificationSettings')}
            valuePropName="checked"
          >
            <Switch 
              disabled={!isEditing}
              style={{
                opacity: 1,
                cursor: isEditing ? 'pointer' : 'not-allowed'
              }}
            />
          </Form.Item>

          <Form.Item>
            {!isEditing ? (
              <Button type="primary" onClick={handleEdit} icon={<EditOutlined />}>
                <span className="button-text">{t('edit')}</span>
              </Button>
            ) : (
              <Space>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                  <span className="button-text">{t('saveSettings')}</span>
                </Button>
                <Button onClick={handleCancel} disabled={loading}>
                  <span className="button-text">{t('cancel')}</span>
                </Button>
              </Space>
            )}
          </Form.Item>
        </Form>
      </Card>

      <Card 
        title={
          <Space>
            <SafetyOutlined />
            <span>{t('securitySettings')}</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <div style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Space>
                    <strong>{t('twoFactorAuthentication')}</strong>
                    {twoFactorEnabled && (
                      <Badge status="success" text={t('twoFactorEnabled')} />
                    )}
                  </Space>
                  <div style={{ color: '#666', fontSize: '14px', marginTop: 8 }}>
                    {twoFactorEnabled
                      ? t('twoFactorDescription')
                      : t('twoFactorDescriptionDisabled')}
                  </div>
                </div>
                <div>
                  {twoFactorEnabled ? (
                    <Button danger onClick={() => setTwoFactorDisableVisible(true)}>
                      {t('disableTwoFactor')}
                    </Button>
                  ) : (
                    <Button type="primary" onClick={() => setTwoFactorSetupVisible(true)}>
                      {t('enableTwoFactor')}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            <div style={{ color: '#666', fontSize: '14px' }}>
              <SafetyOutlined style={{ marginRight: 8, color: '#1890ff' }} />
              <strong>{t('recommended')}: </strong>
              {t('securityRecommendation')}
            </div>
          </Space>
        </div>
      </Card>

      <Card 
        title={t('metaApiSettings')}
        style={{ marginBottom: 24 }}
      >
        <Alert
          message={t('metaApiSubmissionInfo')}
          description={
            <div>
              <p><strong>1. {t('step1CreateApp')}</strong></p>
              <p><strong>2. {t('step2GetToken')}</strong></p>
              <p><strong>3. {t('step3RegisterAccount')}</strong></p>
              <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                <strong>{t('noteValidTokenRequired')}</strong>
              </p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Space wrap>
            <Button 
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleOAuthLogin}
              style={{ backgroundColor: '#1877f2', borderColor: '#1877f2' }}
            >
              <span className="button-text">Meta公式認証で自動取得</span>
            </Button>
            <Button 
              icon={<SwapOutlined />}
              onClick={() => {
                setTokenExchangeModalVisible(true);
                setLongLivedToken('');
                tokenExchangeForm.resetFields();
              }}
            >
              <span className="button-text">{t('tokenGeneration')}</span>
            </Button>
            <Button 
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingAccount(null);
                metaAccountForm.resetFields();
                setFetchedAccounts([]);
                setSelectedFetchedAccount(null);
                setTokenInfo(null);
                setIsModalVisible(true);
              }}
            >
              <span className="button-text">+ {t('addMetaAccount')}</span>
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={metaAccounts}
          rowKey="id"
          pagination={{ pageSize: 5 }}
        />
      </Card>

      {/* Metaアカウント追加・編集モーダル */}
      <Modal
        title={t('addMetaAccount')}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          metaAccountForm.resetFields();
          setEditingAccount(null);
          setFetchedAccounts([]);
          setSelectedFetchedAccount(null);
          setTokenInfo(null);
        }}
        footer={null}
        width="90%"
        style={{ maxWidth: 700 }}
      >
        <Form
          form={metaAccountForm}
          layout="vertical"
          onFinish={handleMetaAccountSubmit}
        >
          <Alert
            message={t('fetchFromTokenTitle')}
            description={t('fetchFromTokenDesc')}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form.Item
            name="access_token"
            label={t('longTermToken')}
            rules={[{ required: true, message: t('enterAccessToken') }]}
          >
            <Input.TextArea 
              placeholder="EAAxxxxxxxx..." 
              rows={4}
              autoSize={{ minRows: 4, maxRows: 8 }}
            />
          </Form.Item>

          <Form.Item>
            <Button 
              onClick={handleFetchAccounts} 
              loading={fetchingAccounts}
              block
              type="primary"
              size="large"
              icon={<SwapOutlined />}
            >
              {t('fetchAccounts')}
            </Button>
          </Form.Item>

          {tokenInfo && tokenInfo.is_valid !== undefined && (
            <Alert
              message={t('tokenInfo')}
              description={
                <div>
                  <div>{t('expiresAt')}: {formatExpiryDate(tokenInfo.expires_at)}</div>
                  <div>
                    {t('status')}: <span style={{ color: getExpiryStatus(tokenInfo.expires_at).color, fontWeight: 'bold' }}>
                      {getExpiryStatus(tokenInfo.expires_at).text}
                    </span>
                  </div>
                </div>
              }
              type={tokenInfo.is_valid ? 'success' : 'error'}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {fetchedAccounts.length > 0 && (
            <>
              <Alert
                message={t('foundAccountsCount', { count: fetchedAccounts.length })}
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <Form.Item 
                label={t('selectAccount')}
                name="selected_account"
                rules={[{ required: true, message: t('selectAccountRequired') }]}
              >
                <Select 
                  placeholder={t('selectAccountPlaceholder')} 
                  onChange={handleSelectFetchedAccount}
                  size="large"
                  optionLabelProp="label"
                >
                  {fetchedAccounts.map(account => (
                    <Option 
                      key={account.account_id} 
                      value={account.account_id}
                      label={account.name}
                    >
                      <div style={{ padding: '8px 0' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                          {account.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          ID: {account.account_id} | {account.currency} | {account.timezone}
                          {account.status !== 1 && <span style={{ color: 'orange', marginLeft: 8 }}>⚠ {t('inactiveStatus')}</span>}
                        </div>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {selectedFetchedAccount && (
                <Alert
                  message={t('selectedAccount')}
                  description={
                    <div style={{ lineHeight: 1.8 }}>
                      <div><strong>{selectedFetchedAccount.name}</strong></div>
                      <div>ID: {selectedFetchedAccount.account_id}</div>
                      <div>{t('currency')}: {selectedFetchedAccount.currency} | {t('timezone')}: {selectedFetchedAccount.timezone}</div>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}
            </>
          )}

          <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setIsModalVisible(false);
                metaAccountForm.resetFields();
                setEditingAccount(null);
                setFetchedAccounts([]);
                setSelectedFetchedAccount(null);
                setTokenInfo(null);
              }}>
                {t('cancel')}
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                disabled={!selectedFetchedAccount}
                size="large"
              >
                {t('addThisAccount')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 長期アクセストークン生成モーダル */}
      <Modal
        title={t('tokenGeneration')}
        open={tokenExchangeModalVisible}
        onCancel={() => {
          setTokenExchangeModalVisible(false);
          setLongLivedToken('');
          tokenExchangeForm.resetFields();
        }}
        footer={null}
        width="90%"
        style={{ maxWidth: 600 }}
      >
        <div style={{ marginBottom: 16, fontSize: 14, color: '#666', lineHeight: 1.6 }}>
          <ol style={{ paddingLeft: 20 }}>
            <li>{t('step1')}</li>
            <li>{t('step2')}</li>
          </ol>
        </div>

        <Form
          form={tokenExchangeForm}
          layout="vertical"
          onFinish={handleTokenExchange}
        >
          <Form.Item
            name="app_id"
            label={t('appId')}
            rules={[{ required: true, message: t('enterAppId') }]}
          >
            <Input placeholder="123456789012345" />
          </Form.Item>

          <Form.Item
            name="app_secret"
            label={t('appSecret')}
            rules={[{ required: true, message: t('enterAppSecret') }]}
          >
            <Input.Password placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
          </Form.Item>

          <Form.Item
            name="short_token"
            label={t('shortTermToken')}
            rules={[{ required: true, message: t('enterShortTerm') }]}
          >
            <Input.TextArea 
              placeholder="EAAxxxxxxxx..." 
              rows={3}
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={exchanging} block>
              {t('convertToLongTerm')}
            </Button>
          </Form.Item>
        </Form>

        {longLivedToken && (
          <div style={{ marginTop: 24, padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20, marginRight: 8 }} />
              <strong>{t('longTermTokenValid')}</strong>
            </div>
            <Input.TextArea
              value={longLivedToken}
              readOnly
              rows={4}
              autoSize={{ minRows: 4, maxRows: 8 }}
              style={{ marginBottom: 8 }}
            />
            <Space>
              <Button onClick={() => copyToClipboard(longLivedToken)}>
                {t('copyToClipboard')}
              </Button>
              <Button onClick={handleValidateToken}>
                {t('validateToken')}
              </Button>
            </Space>
          </div>
        )}
      </Modal>

      <TwoFactorSetup
        visible={twoFactorSetupVisible}
        onClose={() => setTwoFactorSetupVisible(false)}
        onSuccess={() => {
          loadTwoFactorStatus();
        }}
      />

      <TwoFactorDisable
        visible={twoFactorDisableVisible}
        onClose={() => setTwoFactorDisableVisible(false)}
        onSuccess={() => {
          loadTwoFactorStatus();
        }}
      />

      <Modal
        title={
          <span style={{ color: '#ff4d4f' }}>
            <DeleteOutlined /> アカウント削除の確認
          </span>
        }
        open={deleteModalVisible}
        onCancel={() => {
          setDeleteModalVisible(false);
          setDeletingAccount(null);
        }}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              setDeleteModalVisible(false);
              setDeletingAccount(null);
            }}
          >
            キャンセル
          </Button>,
          <Button 
            key="delete" 
            type="primary" 
            danger 
            loading={deleting}
            onClick={handleDeleteConfirm}
          >
            削除する
          </Button>,
        ]}
        width={600}
      >
        {deletingAccount && (
          <div>
            <Alert
              message="以下のアカウントを削除しようとしています"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Card size="small" style={{ marginBottom: 16, backgroundColor: '#fafafa' }}>
              <Typography.Text strong>アカウント名：</Typography.Text>
              <Typography.Text>{deletingAccount.account_name}</Typography.Text>
              <br />
              <Typography.Text strong>アカウントID：</Typography.Text>
              <Typography.Text>{deletingAccount.account_id}</Typography.Text>
            </Card>

            <Alert
              message="削除すると以下のデータも削除されます"
              description={
                <div>
                  <ul style={{ marginTop: 8, marginBottom: 0 }}>
                    <li><strong>このアカウントに紐づくすべてのキャンペーン</strong></li>
                    <li><strong>キャンペーンに含まれる広告セット</strong></li>
                    <li><strong>広告セットに含まれる広告</strong></li>
                    <li><strong>関連するパフォーマンスデータ</strong></li>
                  </ul>
                  <Divider style={{ margin: '12px 0' }} />
                  <Typography.Text type="danger" strong>
                    ⚠️ この操作は取り消せません
                  </Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                    ※ Meta広告マネージャー上の広告は削除されません
                  </Typography.Text>
                </div>
              }
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Typography.Paragraph style={{ marginBottom: 0 }}>
              本当に削除してもよろしいですか？
            </Typography.Paragraph>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default Settings;
