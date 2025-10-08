import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Select, DatePicker, Button, Table, Tag, message, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { DownloadOutlined, SyncOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import campaignService from '../services/campaignService';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface ReportingData {
  campaigns: any[];
  summary: {
    total_campaigns: number;
    total_spend: number;
    total_impressions: number;
    total_clicks: number;
  };
}

const Reporting: React.FC = () => {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportingData, setReportingData] = useState<ReportingData | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [dateRange, setDateRange] = useState<any>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<string>('impressions');

  // 画面サイズの検出
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // レポートデータを取得
  const fetchReportingData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      
      if (selectedCampaign !== 'all') {
        params.campaign_id = selectedCampaign;
      }
      
      if (dateRange) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      
      params.metrics = selectedMetrics;
      
      const data = await campaignService.getReportingData(params);
      setReportingData(data);
    } catch (error) {
      message.error(t('reportingDataFetchError'));
      console.error('Failed to fetch reporting data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初期データ取得
  useEffect(() => {
    fetchReportingData();
  }, []);

  // チャート用データを生成
  const generateChartData = () => {
    if (!reportingData || !reportingData.campaigns.length) {
      return [];
    }

    return reportingData.campaigns.map((campaign, index) => ({
      name: campaign.campaign_name, // 実際のキャンペーン名をそのまま表示
      impressions: campaign.impressions,
      clicks: campaign.clicks,
      spend: campaign.spend,
      ctr: campaign.ctr,
    }));
  };

  // テーブルカラム定義
  const columns = [
    {
      title: t('campaignName'),
      dataIndex: 'campaign_name',
      key: 'campaign_name',
      width: 200,
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'orange'}>
          {status === 'ACTIVE' ? t('active') : t('paused')}
        </Tag>
      ),
    },
    {
      title: t('budget'),
      dataIndex: 'budget',
      key: 'budget',
      width: 120,
      render: (budget: number) => `¥${budget.toLocaleString()}`,
    },
    {
      title: t('spend'),
      dataIndex: 'spend',
      key: 'spend',
      width: 120,
      render: (spend: number) => `¥${spend.toLocaleString()}`,
    },
    {
      title: t('impressions'),
      dataIndex: 'impressions',
      key: 'impressions',
      width: 120,
      render: (impressions: number) => impressions.toLocaleString(),
    },
    {
      title: t('clicks'),
      dataIndex: 'clicks',
      key: 'clicks',
      width: 100,
      render: (clicks: number) => clicks.toLocaleString(),
    },
    {
      title: t('ctr'),
      dataIndex: 'ctr',
      key: 'ctr',
      width: 80,
      render: (ctr: number) => `${ctr.toFixed(2)}%`,
    },
    {
      title: t('cpc'),
      dataIndex: 'cpc',
      key: 'cpc',
      width: 80,
      render: (cpc: number) => cpc > 0 ? `¥${cpc.toFixed(2)}` : '-',
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" />
        <p style={{ marginTop: 20 }}>{t('loadingReportingData')}</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      <Card title={t('report')} style={{ marginBottom: 24 }}>
        <Row gutter={isMobile ? [8, 12] : 16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Select 
              placeholder={t('selectCampaign')} 
              style={{ width: '100%' }}
              size={isMobile ? 'small' : 'middle'}
              value={selectedCampaign}
              onChange={setSelectedCampaign}
            >
              <Option value="all">{t('allCampaigns')}</Option>
              {reportingData?.campaigns.map(campaign => (
                <Option key={campaign.campaign_id} value={campaign.campaign_id.toString()}>
                  {campaign.campaign_name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <RangePicker 
              style={{ width: '100%' }}
              size={isMobile ? 'small' : 'middle'}
              value={dateRange}
              onChange={setDateRange}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select 
              placeholder={t('selectMetrics')} 
              style={{ width: '100%' }}
              size={isMobile ? 'small' : 'middle'}
              value={selectedMetrics}
              onChange={setSelectedMetrics}
            >
              <Option value="impressions">{t('impressions')}</Option>
              <Option value="clicks">{t('clicks')}</Option>
              <Option value="spend">{t('spend')}</Option>
              <Option value="ctr">{t('ctr')}</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Button 
              type="primary" 
              icon={<SyncOutlined />}
              size={isMobile ? 'small' : 'middle'}
              style={{ width: isMobile ? '100%' : 'auto' }}
              onClick={fetchReportingData}
              loading={loading}
            >
              {t('syncFromMetaApi')}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* サマリー統計 */}
      {reportingData && (
        <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                  {reportingData.summary.total_campaigns}
                </div>
                <div style={{ color: '#666' }}>{t('totalCampaigns')}</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                  ¥{reportingData.summary.total_spend.toLocaleString()}
                </div>
                <div style={{ color: '#666' }}>{t('totalSpend')}</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                  {reportingData.summary.total_impressions.toLocaleString()}
                </div>
                <div style={{ color: '#666' }}>{t('totalImpressions')}</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f5222d' }}>
                  {reportingData.summary.total_clicks.toLocaleString()}
                </div>
                <div style={{ color: '#666' }}>{t('totalClicks')}</div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={isMobile ? 8 : 16}>
        <Col xs={24} lg={12}>
          <Card title={t('campaignList')}>
            <Table
              dataSource={reportingData?.campaigns || []}
              columns={columns}
              rowKey="campaign_id"
              pagination={false}
              scroll={{ x: 800 }}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={t('performanceComparison')}>
            <ResponsiveContainer 
              width="100%" 
              height={isMobile ? 300 : 400}
            >
              <BarChart data={generateChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  fontSize={isMobile ? 10 : 12}
                  angle={isMobile ? -45 : 0}
                  textAnchor={isMobile ? 'end' : 'middle'}
                />
                <YAxis fontSize={isMobile ? 10 : 12} />
                <Tooltip 
                  labelStyle={{ fontSize: isMobile ? 11 : 12 }}
                  contentStyle={isMobile ? { fontSize: 11 } : { fontSize: 12 }}
                />
                <Bar 
                  dataKey="impressions" 
                  fill="#8884d8" 
                  name={t('impressions')}
                />
                <Bar 
                  dataKey="clicks" 
                  fill="#82ca9d" 
                  name={t('clicks')}
                />
                <Bar 
                  dataKey="spend" 
                  fill="#ffc658" 
                  name={t('spend')}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Reporting;

