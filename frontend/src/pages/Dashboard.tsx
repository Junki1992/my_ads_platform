import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Progress, message, Spin, Divider, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  DollarOutlined,
  EyeOutlined,
  AimOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import campaignService, { DashboardStats } from '../services/campaignService';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const data = await campaignService.getDashboardStats();
      setStats(data);
    } catch (error) {
      message.error('データの取得に失敗しました');
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" />
        <p style={{ marginTop: 20 }}>データを読み込んでいます...</p>
      </div>
    );
  }

  if (!stats || !stats.summary) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <p>データがありません</p>
      </div>
    );
  }

  const summary = stats.summary;
  const recentCampaigns = stats.recent_campaigns || [];

  const columns = [
    {
      title: t('campaignName'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <span style={{ 
          color: status === 'ACTIVE' ? '#52c41a' : '#faad14' 
        }}>
          {status === 'ACTIVE' ? t('active') : t('paused')}
        </span>
      ),
    },
    {
      title: t('budget'),
      dataIndex: 'budget',
      key: 'budget',
      render: (value: number) => `¥${Math.round(value).toLocaleString()}`,
    },
    {
      title: t('spend'),
      dataIndex: 'spend',
      key: 'spend',
      render: (value: number) => `¥${Math.round(value).toLocaleString()}`,
    },
    {
      title: t('impressions'),
      dataIndex: 'impressions',
      key: 'impressions',
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: t('clicks'),
      dataIndex: 'clicks',
      key: 'clicks',
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: t('ctr'),
      dataIndex: 'ctr',
      key: 'ctr',
      render: (value: number) => `${value.toFixed(2)}%`,
    },
    {
      title: 'CPC',
      dataIndex: 'cpc',
      key: 'cpc',
      render: (value: number) => value > 0 ? `¥${value.toFixed(2)}` : '-',
    },
    {
      title: 'CPM',
      dataIndex: 'cpm',
      key: 'cpm',
      render: (value: number) => value > 0 ? `¥${value.toFixed(2)}` : '-',
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button 
          type="primary" 
          icon={<SyncOutlined />}
          onClick={fetchDashboardData}
          loading={loading}
        >
          Meta APIから同期
        </Button>
      </div>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('totalBudget')}
              value={Math.round(summary.total_budget)}
              prefix={<DollarOutlined />}
              suffix={t('yen')}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('totalSpend')}
              value={Math.round(summary.total_spend)}
              prefix={<DollarOutlined />}
              suffix={t('yen')}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('totalImpressions')}
              value={summary.total_impressions}
              prefix={<EyeOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('totalClicks')}
              value={summary.total_clicks}
              prefix={<AimOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title={t('campaignList')}>
            <Table
              dataSource={recentCampaigns}
              columns={columns}
              rowKey="campaign_id"
              pagination={false}
              scroll={{ x: 800 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={t('budgetUsage')}>
            <Progress
              type="circle"
              percent={Math.round((summary.total_spend / summary.total_budget) * 100)}
              format={percent => `${percent}%`}
              style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}
            />
            <Divider />
            <div style={{ textAlign: 'center' }}>
              <p>{t('budget')}: ¥{Math.round(summary.total_budget).toLocaleString()}</p>
              <p>{t('spend')}: ¥{Math.round(summary.total_spend).toLocaleString()}</p>
              <p>{t('remaining')}: ¥{Math.round(summary.total_budget - summary.total_spend).toLocaleString()}</p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;