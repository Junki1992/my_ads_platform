import React, { useState, useEffect, useMemo } from 'react';
import { Card, Form, Input, Select, Button, Switch, Divider, Table, Space, Modal, Alert, Tabs, Badge, message, Typography, Collapse } from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import metaAccountService, { MetaAccount, MetaAccountCreate, MetaAdAccount } from '../services/metaAccountService';
import boxAccountService, { BoxAccount } from '../services/boxAccountService';
import twoFactorService from '../services/twoFactorService';
import { EditOutlined, DeleteOutlined, SaveOutlined, SwapOutlined, PlusOutlined, CheckCircleOutlined, SafetyOutlined, CloudOutlined } from '@ant-design/icons';
import TwoFactorSetup from '../components/TwoFactorSetup';
import TwoFactorDisable from '../components/TwoFactorDisable';
import { groupByMetaBusiness } from '../utils/metaAccountBusinessGroups';

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
  const [boxAccounts, setBoxAccounts] = useState<BoxAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<MetaAccount | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [initialSettings, setInitialSettings] = useState<SettingsData | null>(null);
  
  // Token Exchange Modal
  const [tokenExchangeModalVisible, setTokenExchangeModalVisible] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [longLivedToken, setLongLivedToken] = useState('');
  const [isValidatingLongLivedToken, setIsValidatingLongLivedToken] = useState(false);

  // Fetch Accounts Modal
  const [fetchedAccounts, setFetchedAccounts] = useState<MetaAdAccount[]>([]);
  const [fetchingAccounts, setFetchingAccounts] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<any>(null);

  const watchedSelectedAccounts = Form.useWatch('selected_account', metaAccountForm);
  const selectedFetchedAccountIds = useMemo((): string[] => {
    const w = watchedSelectedAccounts;
    if (w === undefined || w === null) return [];
    return Array.isArray(w) ? w : [w];
  }, [watchedSelectedAccounts]);

  const registeredMetaAccountIds = useMemo(
    () => new Set(metaAccounts.map((m) => m.account_id)),
    [metaAccounts]
  );
  
  // 2FA関連
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorSetupVisible, setTwoFactorSetupVisible] = useState(false);
  const [twoFactorDisableVisible, setTwoFactorDisableVisible] = useState(false);
  
  // 削除確認モーダル（1件 or 複数）
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<MetaAccount[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [selectedMetaAccountIds, setSelectedMetaAccountIds] = useState<number[]>([]);
  /** Meta 一覧 Collapse：データ後から入るので defaultActiveKey ではなく制御する */
  const [metaCollapseActiveKeys, setMetaCollapseActiveKeys] = useState<string[]>([]);

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
    loadBoxAccounts();
    loadTwoFactorStatus();
    
    // URLパラメータからOAuth結果をチェック
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const errorParam = urlParams.get('error');
    const accounts = urlParams.get('accounts');
    const messageParam = urlParams.get('message');
    
    if (success === 'oauth_success') {
      // Meta OAuth認証成功
      loadMetaAccounts(); // アカウント一覧を再読み込み
      // URLパラメータをクリア
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (success === 'box_oauth_success') {
      // Box OAuth認証成功
      loadBoxAccounts(); // Boxアカウント一覧を再読み込み
      message.success('Boxアカウントの連携に成功しました');
      // URLパラメータをクリア
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorParam) {
      // OAuth認証エラー
      console.error('OAuth error:', errorParam, messageParam);
      if (errorParam.startsWith('box_')) {
        message.error('Boxアカウントの連携に失敗しました');
      }
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

  const loadBoxAccounts = async () => {
    try {
      const accounts = await boxAccountService.fetchBoxAccounts();
      setBoxAccounts(accounts);
    } catch (error) {
      console.error('Failed to load Box accounts:', error);
    }
  };

  const handleBoxOAuthLogin = async () => {
    try {
      const response = await boxAccountService.getOAuthUrl();
      window.location.href = response.auth_url;
    } catch (error: any) {
      console.error('Failed to get Box OAuth URL:', error);
      message.error('Box認証URLの取得に失敗しました');
    }
  };

  const handleDeleteBoxAccount = async (accountId: number) => {
    try {
      await boxAccountService.deleteBoxAccount(accountId);
      message.success('Boxアカウントを削除しました');
      loadBoxAccounts();
    } catch (error: any) {
      console.error('Failed to delete Box account:', error);
      const errorMessage = error.response?.data?.error || 'Boxアカウントの削除に失敗しました';
      message.error(errorMessage);
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
    const raw = values.selected_account;
    const ids: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (ids.length === 0) return;

    setLoading(true);
    try {
      if (editingAccount) {
        if (ids.length !== 1) {
          message.error(t('selectAccountRequired'));
          return;
        }
        const acc = fetchedAccounts.find((a) => a.account_id === ids[0]);
        if (!acc) return;
        const createData: MetaAccountCreate = {
          account_id: acc.account_id,
          account_name: acc.name,
          access_token: values.access_token,
          business_id: acc.business_id,
          business_name: acc.business_name,
        };
        await metaAccountService.updateMetaAccount(editingAccount.id, createData);
        message.success(t('saveApiSettings'));
      } else {
        let successCount = 0;
        const failures: string[] = [];
        for (const accountId of ids) {
          const acc = fetchedAccounts.find((a) => a.account_id === accountId);
          if (!acc) continue;
          try {
            await metaAccountService.createMetaAccount({
              account_id: acc.account_id,
              account_name: acc.name,
              access_token: values.access_token,
              business_id: acc.business_id,
              business_name: acc.business_name,
            });
            successCount += 1;
          } catch (err: any) {
            const detail =
              err.response?.data?.account_id?.[0] ||
              err.response?.data?.detail ||
              err.response?.data?.error ||
              err.message;
            failures.push(`${acc.name}: ${detail}`);
          }
        }
        if (successCount > 0) {
          message.success(t('metaAccountsBulkRegisterSuccess', { count: successCount }));
        }
        if (failures.length > 0) {
          message.warning(
            t('metaAccountsBulkRegisterFailures', {
              count: failures.length,
              detail: failures.slice(0, 5).join(' / '),
            })
          );
        }
      }

      setIsModalVisible(false);
      metaAccountForm.resetFields();
      setEditingAccount(null);
      setFetchedAccounts([]);
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
    metaAccountForm.resetFields();
    setFetchedAccounts([]);
    setTokenInfo(null);
    setIsModalVisible(true);
  };

  const handleDeleteClick = (account: MetaAccount) => {
    setDeleteTargets([account]);
    setDeletePassword('');
    setDeleteModalVisible(true);
  };

  const handleBulkDeleteClick = () => {
    const rows = metaAccounts.filter((a) => selectedMetaAccountIds.includes(a.id));
    if (rows.length === 0) return;
    setDeleteTargets(rows);
    setDeletePassword('');
    setDeleteModalVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTargets.length === 0) return;

    if (!deletePassword) {
      message.error('パスワードを入力してください');
      return;
    }

    setDeleting(true);
    try {
      if (deleteTargets.length === 1) {
        const response = await metaAccountService.deleteMetaAccount(deleteTargets[0].id, deletePassword);
        message.success(response.message || 'アカウントを削除しました');
      } else {
        const response = await metaAccountService.bulkDeleteMetaAccounts(
          deleteTargets.map((a) => a.id),
          deletePassword
        );
        message.success(response.message || t('metaAccountsBulkDeleteSuccess', { count: response.deleted }));
      }
      setDeleteModalVisible(false);
      setDeleteTargets([]);
      setDeletePassword('');
      setSelectedMetaAccountIds([]);
      loadMetaAccounts();
    } catch (error: any) {
      console.error('Failed to delete Meta account(s):', error);
      const errorMessage =
        error.response?.data?.error || error.response?.data?.detail || 'アカウントの削除に失敗しました';
      message.error(errorMessage);
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
    setIsValidatingLongLivedToken(true);
    try {
      const response = await metaAccountService.validateToken(longLivedToken);
      if (response.valid) {
        message.success(
          t('tokenValidationSuccess', {
            name: response.user_name || response.user_id || '—',
          })
        );
      } else {
        message.error(response.error || t('tokenValidationFailed'));
      }
    } catch (error: any) {
      const errMsg =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message;
      message.error(errMsg || t('tokenValidationFailed'));
      console.error('Token validation failed:', error);
    } finally {
      setIsValidatingLongLivedToken(false);
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
    const raw = metaAccountForm.getFieldValue('access_token');
    const accessToken = typeof raw === 'string' ? raw.trim() : '';
    if (!accessToken) {
      message.warning(t('enterAccessToken'));
      return;
    }

    setFetchingAccounts(true);
    try {
      const response = await metaAccountService.fetchAccounts(accessToken);
      setFetchedAccounts(response.accounts);
      setTokenInfo(response.token_info);
      metaAccountForm.setFieldsValue({
        selected_account: editingAccount ? undefined : [],
      });
      if (response.accounts?.length) {
        message.success(t('fetchAccountsSuccess', { count: response.accounts.length }));
      } else {
        message.info(t('fetchAccountsEmpty'));
      }
    } catch (error: any) {
      console.error('Failed to fetch accounts:', error);
      setFetchedAccounts([]);
      setTokenInfo(null);
      const errMsg =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message;
      message.error(errMsg || t('fetchAccountsError'));
    } finally {
      setFetchingAccounts(false);
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

  const metaAccountGroups = useMemo(
    () => groupByMetaBusiness(metaAccounts, t('metaAccountsGroupNoBusiness')),
    [metaAccounts, t]
  );

  const metaAccountGroupKeySet = useMemo(
    () => new Set(metaAccountGroups.map((g) => g.key)),
    [metaAccountGroups]
  );

  useEffect(() => {
    setMetaCollapseActiveKeys((prev) => prev.filter((k) => metaAccountGroupKeySet.has(k)));
  }, [metaAccountGroupKeySet]);

  const metaAccountRowColumns = [
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
      render: (date: string) =>
        new Date(date).toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : 'en-US'),
    },
    {
      title: t('actions'),
      key: 'action',
      render: (_: unknown, record: MetaAccount) => (
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
                setTokenInfo(null);
                setIsModalVisible(true);
                if (longLivedToken) {
                  metaAccountForm.setFieldsValue({ access_token: longLivedToken });
                }
              }}
            >
              <span className="button-text">+ {t('addMetaAccount')}</span>
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={selectedMetaAccountIds.length === 0}
              onClick={handleBulkDeleteClick}
            >
              <span className="button-text">{t('metaAccountsBulkDelete')}</span>
            </Button>
          </Space>
        </div>

        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {t('metaAccountsGroupedHint')}
        </Typography.Paragraph>

        {metaAccounts.length === 0 ? (
          <Table<MetaAccount>
            columns={metaAccountRowColumns}
            dataSource={[]}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: t('metaAccountNotRegistered') }}
          />
        ) : (
          <Collapse
            bordered
            activeKey={metaCollapseActiveKeys}
            onChange={(k) =>
              setMetaCollapseActiveKeys(Array.isArray(k) ? k : k != null ? [String(k)] : [])
            }
            style={{ background: '#fafafa' }}
            items={metaAccountGroups.map((g) => ({
              key: g.key,
              label: (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    gap: 8,
                    width: '100%',
                    paddingRight: 8,
                  }}
                >
                  <Typography.Text strong>{g.title}</Typography.Text>
                  {g.subtitle ? (
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {g.subtitle}
                    </Typography.Text>
                  ) : null}
                  <Typography.Text type="secondary" style={{ marginLeft: 'auto' }}>
                    {t('metaAccountsInGroup', { count: g.accounts.length })}
                  </Typography.Text>
                </div>
              ),
              children: (() => {
                const inGroup = new Set(g.accounts.map((a) => a.id));
                return (
                  <Table<MetaAccount>
                    rowSelection={{
                      selectedRowKeys: selectedMetaAccountIds.filter((id) => inGroup.has(id)),
                      onChange: (keys) => {
                        const picked = keys.map((k) => Number(k));
                        setSelectedMetaAccountIds((prev) => {
                          const rest = prev.filter((id) => !inGroup.has(id));
                          return [...rest, ...picked];
                        });
                      },
                      columnWidth: 40,
                    }}
                    columns={metaAccountRowColumns}
                    dataSource={g.accounts}
                    rowKey="id"
                    pagination={g.accounts.length > 8 ? { pageSize: 8 } : false}
                    size="small"
                  />
                );
              })(),
            }))}
          />
        )}
      </Card>

      <Card 
        title={
          <Space>
            <CloudOutlined />
            <span>Boxアカウント管理</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Alert
          message="Boxアカウント連携について"
          description={
            <div>
              <p>Boxアカウントを連携することで、広告入稿時にBoxから直接画像を選択できます。</p>
              <p style={{ color: '#ff4d4f', fontWeight: 'bold', marginTop: 8 }}>
                <strong>注意: Boxアカウントの連携にはBox for Developersでのアプリ登録が必要です</strong>
              </p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button 
            type="primary"
            icon={<CloudOutlined />}
            onClick={handleBoxOAuthLogin}
            style={{ backgroundColor: '#0061d5', borderColor: '#0061d5' }}
          >
            <span className="button-text">Boxアカウントを連携</span>
          </Button>
        </div>

        <Table
          columns={[
            {
              title: 'アカウント名',
              dataIndex: 'account_name',
              key: 'account_name',
            },
            {
              title: 'アカウントID',
              dataIndex: 'account_id',
              key: 'account_id',
            },
            {
              title: 'ステータス',
              dataIndex: 'is_active',
              key: 'is_active',
              render: (isActive: boolean) => (
                <span style={{ color: isActive ? 'green' : 'red' }}>
                  {isActive ? '有効' : '無効'}
                </span>
              ),
            },
            {
              title: '作成日',
              dataIndex: 'created_at',
              key: 'created_at',
              render: (date: string) => new Date(date).toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : 'en-US'),
            },
            {
              title: '操作',
              key: 'action',
              render: (_: any, record: BoxAccount) => (
                <Space>
                  <Button 
                    type="link" 
                    danger 
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      Modal.confirm({
                        title: 'Boxアカウントの削除',
                        content: `「${record.account_name}」を削除してもよろしいですか？`,
                        okText: '削除',
                        cancelText: 'キャンセル',
                        okType: 'danger',
                        onOk: () => handleDeleteBoxAccount(record.id),
                      });
                    }}
                  >
                    削除
                  </Button>
                </Space>
              ),
            },
          ]}
          dataSource={boxAccounts}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          locale={{ emptyText: 'Boxアカウントが登録されていません' }}
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
                label={editingAccount ? t('selectAccount') : t('selectAccountsMultiple')}
                name="selected_account"
                rules={[
                  {
                    validator: (_: unknown, value: string | string[] | undefined) => {
                      if (editingAccount) {
                        return value
                          ? Promise.resolve()
                          : Promise.reject(new Error(t('selectAccountRequired')));
                      }
                      if (Array.isArray(value) && value.length > 0) return Promise.resolve();
                      return Promise.reject(new Error(t('selectAccountRequired')));
                    },
                  },
                ]}
              >
                <Select 
                  mode={editingAccount ? undefined : 'multiple'}
                  placeholder={t('selectAccountPlaceholder')} 
                  size="large"
                  optionLabelProp="label"
                  allowClear
                  maxTagCount="responsive"
                >
                  {fetchedAccounts.map((account) => {
                    const alreadyRegistered = registeredMetaAccountIds.has(account.account_id);
                    const isEditingThis =
                      !!editingAccount && editingAccount.account_id === account.account_id;
                    return (
                      <Option 
                        key={account.account_id} 
                        value={account.account_id}
                        label={account.name}
                        disabled={alreadyRegistered && !isEditingThis}
                      >
                        <div style={{ padding: '8px 0' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                            {account.name}
                            {alreadyRegistered && !isEditingThis && (
                              <span style={{ color: '#999', fontWeight: 'normal', marginLeft: 8 }}>
                                ({t('metaAccountAlreadyRegistered')})
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {account.business_name ? (
                              <span>{t('metaBusinessParent')}: {account.business_name} · </span>
                            ) : null}
                            ID: {account.account_id} | {account.currency} | {account.timezone}
                            {account.status !== 1 && <span style={{ color: 'orange', marginLeft: 8 }}>⚠ {t('inactiveStatus')}</span>}
                          </div>
                        </div>
                      </Option>
                    );
                  })}
                </Select>
              </Form.Item>

              {selectedFetchedAccountIds.length > 0 && (
                <Alert
                  message={t('selectedAccount')}
                  description={
                    <div style={{ lineHeight: 1.8 }}>
                      {selectedFetchedAccountIds.map((id) => {
                        const acc = fetchedAccounts.find((a) => a.account_id === id);
                        if (!acc) return null;
                        return (
                          <div key={id} style={{ marginBottom: 8 }}>
                            <div><strong>{acc.name}</strong></div>
                            {acc.business_name ? (
                              <div>
                                {t('metaBusinessParent')}: {acc.business_name}
                              </div>
                            ) : null}
                            <div>ID: {acc.account_id}</div>
                            <div>{t('currency')}: {acc.currency} | {t('timezone')}: {acc.timezone}</div>
                          </div>
                        );
                      })}
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
                setTokenInfo(null);
              }}>
                {t('cancel')}
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                disabled={selectedFetchedAccountIds.length === 0}
                size="large"
              >
                {editingAccount ? t('saveApiSettings') : t('addSelectedMetaAccounts')}
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
              <Button onClick={handleValidateToken} loading={isValidatingLongLivedToken}>
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
          setDeleteTargets([]);
        }}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              setDeleteModalVisible(false);
              setDeleteTargets([]);
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
            {deleteTargets.length > 1 ? t('metaAccountsBulkDeleteConfirm') : t('delete')}
          </Button>,
        ]}
        width={600}
      >
        {deleteTargets.length > 0 && (
          <div>
            <Alert
              message={
                deleteTargets.length > 1
                  ? t('metaAccountsBulkDeleteWarning', { count: deleteTargets.length })
                  : t('metaAccountDeleteWarningSingle')
              }
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Card
              size="small"
              style={{ marginBottom: 16, backgroundColor: '#fafafa', maxHeight: 220, overflow: 'auto' }}
            >
              {deleteTargets.map((acc) => (
                <div key={acc.id} style={{ marginBottom: deleteTargets.length > 1 ? 10 : 0 }}>
                  <Typography.Text strong>{t('accountName')}:</Typography.Text>{' '}
                  <Typography.Text>{acc.account_name}</Typography.Text>
                  <br />
                  <Typography.Text strong>{t('accountId')}:</Typography.Text>{' '}
                  <Typography.Text>{acc.account_id}</Typography.Text>
                </div>
              ))}
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

            <Typography.Paragraph style={{ marginTop: 16, marginBottom: 8 }}>
              削除を実行するには、ログインパスワードを入力してください：
            </Typography.Paragraph>
            
            <Input.Password
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="ログインパスワード"
              size="large"
              disabled={deleting}
              onPressEnter={handleDeleteConfirm}
            />
          </div>
        )}
      </Modal>

    </div>
  );
};

export default Settings;
