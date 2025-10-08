import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  TimePicker,
  message,
  Tag,
  Space,
  Divider,
  Statistic,
  Progress,
  Tabs,
  Badge,
  Tooltip,
  Popconfirm
} from 'antd';
import { useTranslation } from 'react-i18next';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BellOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import alertService, { AlertRule, AlertNotification, AlertSettings, AlertStats } from '../services/alertService';
import campaignService from '../services/campaignService';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

interface Campaign {
  id: number;
  name: string;
}

const Alerts: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('rules');
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [alertSettings, setAlertSettings] = useState<AlertSettings | null>(null);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form] = Form.useForm();

  // データ取得
  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesData, notificationsData, settingsData, statsData, campaignsData] = await Promise.all([
        alertService.getAlertRules(),
        alertService.getRecentNotifications(),
        alertService.getAlertSettings(),
        alertService.getAlertStats(),
        campaignService.getCampaigns()
      ]);
      
      setAlertRules(Array.isArray(rulesData) ? rulesData : []);
      setNotifications(Array.isArray(notificationsData) ? notificationsData : []);
      setAlertSettings(settingsData);
      setAlertStats(statsData);
      setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
    } catch (error) {
      message.error(t('dataFetchError'));
      console.error('Failed to fetch data:', error);
      // エラー時は空配列を設定
      setAlertRules([]);
      setNotifications([]);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // アラートルール作成・更新
  const handleSaveRule = async (values: any) => {
    try {
      const ruleData: AlertRule = {
        ...values,
        target_campaigns: values.target_campaigns || [],
        email_notification: values.email_notification || false,
        chatwork_message_template: values.chatwork_message_template || 
          t('alertMessageTemplate'),
        slack_message_template: values.slack_message_template || 
          t('alertMessageTemplateSlack')
      };

      if (editingRule?.id) {
        await alertService.updateAlertRule(editingRule.id, ruleData);
        message.success(t('alertRuleUpdated'));
      } else {
        await alertService.createAlertRule(ruleData);
        message.success(t('alertRuleCreated'));
      }

      setModalVisible(false);
      setEditingRule(null);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error(t('alertRuleSaveFailed'));
      console.error('Failed to save rule:', error);
    }
  };

  // アラートルール削除
  const handleDeleteRule = async (id: number) => {
    try {
      await alertService.deleteAlertRule(id);
      message.success(t('alertRuleDeleted'));
      fetchData();
    } catch (error) {
      message.error(t('alertRuleDeleteFailed'));
      console.error('Failed to delete rule:', error);
    }
  };

  // アラートルール有効/無効切り替え
  const handleToggleRule = async (id: number) => {
    try {
      const result = await alertService.toggleAlertRule(id);
      message.success(result.message);
      fetchData();
    } catch (error) {
      message.error(t('alertRuleToggleFailed'));
      console.error('Failed to toggle rule:', error);
    }
  };

  // テスト通知送信
  const handleTestRule = async (id: number) => {
    try {
      const result = await alertService.testAlertRule(id, {
        test_message: t('testNotification'),
        test_channels: ['DASHBOARD']
      });
      message.success(result.message);
      fetchData();
    } catch (error) {
      message.error(t('testNotificationFailed'));
      console.error('Failed to test rule:', error);
    }
  };

  // アラート設定更新
  const handleSaveSettings = async (values: any) => {
    try {
      const settingsData: AlertSettings = {
        ...values,
        quiet_hours_start: values.quiet_hours_start ? values.quiet_hours_start.format('HH:mm') : undefined,
        quiet_hours_end: values.quiet_hours_end ? values.quiet_hours_end.format('HH:mm') : undefined
      };
      
      await alertService.updateAlertSettings(settingsData);
      message.success(t('alertSettingsUpdated'));
      fetchData();
    } catch (error) {
      message.error(t('alertSettingsUpdateFailed'));
      console.error('Failed to save settings:', error);
    }
  };

  // アラートルールテーブルの列定義
  const ruleColumns = [
    {
      title: t('ruleName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: AlertRule) => (
        <Space direction="vertical" size={0}>
          <strong>{text}</strong>
          <Tag color={record.is_active ? 'green' : 'default'}>
            {record.is_active ? t('active') : t('inactive')}
          </Tag>
        </Space>
      )
    },
    {
      title: t('alertType'),
      dataIndex: 'alert_type',
      key: 'alert_type',
      render: (type: string) => {
        const typeMap: { [key: string]: { color: string; text: string } } = {
          'BUDGET_THRESHOLD': { color: 'orange', text: t('budgetThreshold') },
          'PERFORMANCE_DROP': { color: 'red', text: t('performanceDrop') },
          'CAMPAIGN_PAUSED': { color: 'blue', text: t('campaignPaused') },
          'API_ERROR': { color: 'red', text: t('apiError') },
          'BULK_UPLOAD_COMPLETE': { color: 'green', text: t('bulkUploadComplete') },
          'BULK_UPLOAD_FAILED': { color: 'red', text: t('bulkUploadFailed') },
          'CUSTOM': { color: 'purple', text: t('custom') }
        };
        const config = typeMap[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: t('condition'),
      dataIndex: 'condition',
      key: 'condition',
      render: (condition: string, record: AlertRule) => (
        <span>{record.threshold_value} {condition === 'GREATER_THAN' ? t('greaterThan') : 
              condition === 'LESS_THAN' ? t('lessThan') : 
              condition === 'EQUALS' ? t('equals') : 
              condition === 'NOT_EQUALS' ? t('notEquals') : condition}</span>
      )
    },
    {
      title: t('notificationFrequency'),
      dataIndex: 'notification_frequency',
      key: 'notification_frequency',
      render: (frequency: string) => {
        const freqMap: { [key: string]: string } = {
          'IMMEDIATE': t('immediate'),
          'HOURLY': t('hourly'),
          'DAILY': t('daily'),
          'WEEKLY': t('weekly')
        };
        return freqMap[frequency] || frequency;
      }
    },
    {
      title: t('notificationTarget'),
      key: 'channels',
      render: (record: AlertRule) => (
        <Space size={4}>
          {record.chatwork_webhook_url && <Tag color="blue">Chatwork</Tag>}
          {record.slack_webhook_url && <Tag color="green">Slack</Tag>}
          {record.email_notification && <Tag color="orange">メール</Tag>}
          <Tag color="gray">ダッシュボード</Tag>
        </Space>
      )
    },
    {
      title: t('lastExecution'),
      dataIndex: 'last_triggered',
      key: 'last_triggered',
      render: (date: string) => date ? dayjs(date).format('MM/DD HH:mm') : '-'
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (record: AlertRule) => (
        <Space>
          <Tooltip title="テスト通知">
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => handleTestRule(record.id!)}
            />
          </Tooltip>
          <Tooltip title={record.is_active ? t('disable') : t('enable')}>
            <Button
              type="text"
              icon={record.is_active ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handleToggleRule(record.id!)}
            />
          </Tooltip>
          <Tooltip title="編集">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingRule(record);
                form.setFieldsValue(record);
                setModalVisible(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="このアラートルールを削除しますか？"
            onConfirm={() => handleDeleteRule(record.id!)}
            okText="削除"
            cancelText="キャンセル"
          >
            <Tooltip title="削除">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 通知履歴テーブルの列定義
  const notificationColumns = [
    {
      title: t('dateTime'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('MM/DD HH:mm:ss')
    },
    {
      title: t('alertRule'),
      dataIndex: 'alert_rule_name',
      key: 'alert_rule_name'
    },
    {
      title: t('campaign'),
      dataIndex: 'campaign_name',
      key: 'campaign_name',
      render: (name: string) => name || t('system')
    },
    {
      title: t('channel'),
      dataIndex: 'channel',
      key: 'channel',
      render: (channel: string) => {
        const channelMap: { [key: string]: { color: string; text: string } } = {
          'CHATWORK': { color: 'blue', text: 'Chatwork' },
          'SLACK': { color: 'green', text: 'Slack' },
          'EMAIL': { color: 'orange', text: t('email') },
          'DASHBOARD': { color: 'gray', text: t('dashboard') }
        };
        const config = channelMap[channel] || { color: 'default', text: channel };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: { [key: string]: { color: string; text: string; icon: React.ReactNode } } = {
          'SENT': { color: 'success', text: t('sent'), icon: <CheckCircleOutlined /> },
          'PENDING': { color: 'processing', text: t('pending'), icon: <ClockCircleOutlined /> },
          'FAILED': { color: 'error', text: t('failed'), icon: <ExclamationCircleOutlined /> }
        };
        const config = statusMap[status] || { color: 'default', text: status, icon: null };
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      }
    },
    {
      title: t('value'),
      key: 'values',
      render: (record: AlertNotification) => (
        <span>{record.current_value} / {record.threshold_value}</span>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('totalAlertRules')}
              value={alertStats?.total_rules || 0}
              prefix={<BellOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('activeRules')}
              value={alertStats?.active_rules || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('todayNotifications')}
              value={alertStats?.notifications_today || 0}
              prefix={<BellOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('successRate')}
              value={alertStats?.success_rate || 0}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={t('alertRules')} key="rules">
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingRule(null);
                  form.resetFields();
                  setModalVisible(true);
                }}
              >
                {t('createAlertRule')}
              </Button>
            </div>
            
            <Table
              columns={ruleColumns}
              dataSource={alertRules || []}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>

          <TabPane tab={t('notificationHistory')} key="notifications">
            <Table
              columns={notificationColumns}
              dataSource={notifications || []}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>

          <TabPane tab={t('settings')} key="settings">
            {alertSettings && (
              <Form
                layout="vertical"
                initialValues={{
                  ...alertSettings,
                  quiet_hours_start: alertSettings.quiet_hours_start ? dayjs(alertSettings.quiet_hours_start, 'HH:mm') : null,
                  quiet_hours_end: alertSettings.quiet_hours_end ? dayjs(alertSettings.quiet_hours_end, 'HH:mm') : null
                }}
                onFinish={handleSaveSettings}
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Card title={t('basicSettings')}>
                      <Form.Item
                        name="global_notifications_enabled"
                        label="全体的な通知"
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>

                      <Form.Item
                        name="default_chatwork_webhook"
                        label="デフォルト Chatwork Webhook URL"
                      >
                        <Input placeholder="https://api.chatwork.com/v2/webhooks/xxx" />
                      </Form.Item>

                      <Form.Item
                        name="default_slack_webhook"
                        label="デフォルト Slack Webhook URL"
                      >
                        <Input placeholder="https://hooks.slack.com/services/xxx" />
                      </Form.Item>

                      <Form.Item
                        name="default_email"
                        label="デフォルト通知メールアドレス"
                      >
                        <Input type="email" placeholder="alert@example.com" />
                      </Form.Item>
                    </Card>
                  </Col>

                  <Col xs={24} md={12}>
                    <Card title="通知制限">
                      <Form.Item
                        name="quiet_hours_start"
                        label="通知停止開始時間"
                      >
                        <TimePicker format="HH:mm" />
                      </Form.Item>

                      <Form.Item
                        name="quiet_hours_end"
                        label="通知停止終了時間"
                      >
                        <TimePicker format="HH:mm" />
                      </Form.Item>

                      <Form.Item
                        name="max_notifications_per_hour"
                        label="時間あたりの最大通知数"
                      >
                        <InputNumber min={1} max={100} />
                      </Form.Item>

                      <Form.Item
                        name="max_notifications_per_day"
                        label="日あたりの最大通知数"
                      >
                        <InputNumber min={1} max={1000} />
                      </Form.Item>
                    </Card>
                  </Col>
                </Row>

                <div style={{ textAlign: 'right', marginTop: 16 }}>
                  <Button type="primary" htmlType="submit">
                    {t('saveSettings')}
                  </Button>
                </div>
              </Form>
            )}
          </TabPane>
        </Tabs>
      </Card>

      {/* アラートルール作成・編集モーダル */}
      <Modal
        title={editingRule ? t('editAlertRule') : t('createAlertRule')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingRule(null);
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveRule}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="ルール名"
                rules={[{ required: true, message: t('ruleNameRequired') }]}
              >
                <Input placeholder="予算不足アラート" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="alert_type"
                label="アラートタイプ"
                rules={[{ required: true, message: t('alertTypeRequired') }]}
              >
                <Select placeholder="アラートタイプを選択">
                  <Option value="BUDGET_THRESHOLD">予算閾値</Option>
                  <Option value="PERFORMANCE_DROP">パフォーマンス低下</Option>
                  <Option value="CAMPAIGN_PAUSED">キャンペーン停止</Option>
                  <Option value="API_ERROR">API エラー</Option>
                  <Option value="BULK_UPLOAD_COMPLETE">一括入稿完了</Option>
                  <Option value="BULK_UPLOAD_FAILED">一括入稿失敗</Option>
                  <Option value="CUSTOM">カスタム</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="condition"
                label="条件"
                rules={[{ required: true, message: t('conditionRequired') }]}
              >
                <Select placeholder="条件を選択">
                  <Option value="GREATER_THAN">より大きい</Option>
                  <Option value="LESS_THAN">より小さい</Option>
                  <Option value="EQUALS">等しい</Option>
                  <Option value="NOT_EQUALS">等しくない</Option>
                  <Option value="CONTAINS">含む</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="threshold_value"
                label="閾値"
                rules={[{ required: true, message: t('thresholdRequired') }]}
              >
                <Input placeholder="80" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="notification_frequency"
                label="通知頻度"
                rules={[{ required: true, message: t('frequencyRequired') }]}
              >
                <Select placeholder="通知頻度を選択">
                  <Option value="IMMEDIATE">即座</Option>
                  <Option value="HOURLY">1時間毎</Option>
                  <Option value="DAILY">1日毎</Option>
                  <Option value="WEEKLY">1週間毎</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="target_campaigns"
                label="対象キャンペーン（空の場合は全キャンペーン）"
              >
                <Select
                  mode="multiple"
                  placeholder="キャンペーンを選択"
                  allowClear
                >
                  {campaigns.map(campaign => (
                    <Option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="description"
                label="説明"
              >
                <TextArea rows={3} placeholder={t('alertRuleDescription')} />
              </Form.Item>
            </Col>
          </Row>

          <Divider>{t('notificationSettings')}</Divider>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="chatwork_webhook_url"
                label="Chatwork Webhook URL"
              >
                <Input placeholder="https://api.chatwork.com/v2/webhooks/xxx" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="slack_webhook_url"
                label="Slack Webhook URL"
              >
                <Input placeholder="https://hooks.slack.com/services/xxx" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="email_notification"
                label="メール通知"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="email_addresses"
                label="通知先メールアドレス"
                extra={t('multipleEmailsNote')}
              >
                <TextArea
                  rows={4}
                  placeholder="alert@example.com&#10;manager@example.com&#10;team@example.com"
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="chatwork_message_template"
                label="Chatwork メッセージテンプレート"
              >
                <TextArea
                  rows={4}
                  placeholder="🚨 アラート: {alert_name}&#10;📊 キャンペーン: {campaign_name}&#10;📈 値: {current_value}&#10;🎯 閾値: {threshold_value}"
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="slack_message_template"
                label="Slack メッセージテンプレート"
              >
                <TextArea
                  rows={4}
                  placeholder="🚨 *アラート: {alert_name}*&#10;📊 *キャンペーン:* {campaign_name}&#10;📈 *値:* {current_value}&#10;🎯 *閾値:* {threshold_value}"
                />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Button
              style={{ marginRight: 8 }}
              onClick={() => {
                setModalVisible(false);
                setEditingRule(null);
                form.resetFields();
              }}
            >
              キャンセル
            </Button>
            <Button type="primary" htmlType="submit">
              {editingRule ? t('update') : t('create')}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Alerts;
