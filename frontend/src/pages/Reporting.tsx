import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Button,
  Table,
  Tag,
  message,
  Spin,
  Alert,
  Empty,
  Typography,
  Space,
  Collapse,
  Pagination,
  Switch,
} from 'antd';
import { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { SyncOutlined } from '@ant-design/icons';
import { XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from 'recharts';
import campaignService from '../services/campaignService';
import reportingService, { DailyAdInsightRow, DailyInsightSummary } from '../services/reportingService';
import { groupByLinkedMetaAdAccount, type MetaAdAccountRow } from '../utils/metaAccountBusinessGroups';
import dayjs, { type Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { Text } = Typography;

function truncateChartLabel(s: string, maxLen: number): string {
  if (!s) return '';
  return s.length <= maxLen ? s : `${s.slice(0, Math.max(1, maxLen - 1))}…`;
}

/** API の spend が文字列・カンマ区切りでも数値化 */
function parseReportSpend(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

interface ReportingData {
  campaigns: any[];
  summary: {
    total_campaigns: number;
    total_spend: number;
    total_impressions: number;
    total_clicks: number;
  };
}

type ReportingFetchOverrides = {
  campaignIds?: number[];
  dateRange?: [Dayjs, Dayjs] | null;
};

const Reporting: React.FC = () => {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportingData, setReportingData] = useState<ReportingData | null>(null);
  /** 内部キャンペーン ID（空＝全件） */
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<number[]>([]);
  type CatalogRow = { id: number; name: string } & MetaAdAccountRow;
  const [campaignCatalog, setCampaignCatalog] = useState<CatalogRow[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  const [dailyRows, setDailyRows] = useState<DailyAdInsightRow[]>([]);
  const [dailySummary, setDailySummary] = useState<DailyInsightSummary | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  /** 本番で reporting 未マイグレーション・URL 未配備などで日次 API だけ失敗した場合 */
  const [dailyApiUnavailable, setDailyApiUnavailable] = useState(false);
  const [dailyPage, setDailyPage] = useState(1);
  const [dailyPageSize, setDailyPageSize] = useState(20);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [dailyCollapseActiveKeys, setDailyCollapseActiveKeys] = useState<string[]>([]);
  const [reportingCollapseActiveKeys, setReportingCollapseActiveKeys] = useState<string[]>([]);
  /** 消化金額が0円のキャンペーンを一覧・グラフ・サマリーから除外 */
  const [hideZeroSpend, setHideZeroSpend] = useState(true);

  // 画面サイズの検出
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { results } = await campaignService.getCampaigns({ page_size: 500 });
        if (!cancelled) {
          setCampaignCatalog(
            results.map((c) => ({
              id: c.id,
              name: c.name,
              meta_account: c.meta_account,
              meta_account_name: c.meta_account_name,
              meta_account_id_str: c.meta_account_id_str,
            }))
          );
        }
      } catch (e) {
        console.error('Failed to load campaign catalog for reporting:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchDailySnapshot = async () => {
    setDailyLoading(true);
    try {
      let start: string;
      let end: string;
      if (dateRange && dateRange[0] && dateRange[1]) {
        start = dateRange[0].format('YYYY-MM-DD');
        end = dateRange[1].format('YYYY-MM-DD');
      } else {
        end = dayjs().format('YYYY-MM-DD');
        start = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
      }
      const data = await reportingService.getDailyInsights({
        start_date: start,
        end_date: end,
        page: dailyPage,
        page_size: dailyPageSize,
      });
      setDailyApiUnavailable(false);
      setDailyRows(data.results || []);
      setDailyTotal(data.count ?? 0);
      setDailySummary(data.summary ?? null);
    } catch (error) {
      const ax = error as AxiosError;
      const status = ax.response?.status;
      // 日次テーブル未作成・API 未デプロイ等ではここだけ 404/500 になり、キャンペーン集計とは独立
      if (status === 404 || status === 500 || status === 502 || status === 503) {
        setDailyApiUnavailable(true);
        setDailyRows([]);
        setDailyTotal(0);
        setDailySummary({
          total_spend: 0,
          total_impressions: 0,
          total_clicks: 0,
          total_conversions: 0,
        });
      } else {
        console.error('Failed to fetch daily insights:', error);
        message.error(t('reportingDataFetchError'));
      }
    } finally {
      setDailyLoading(false);
    }
  };

  // レポートデータを取得
  const fetchReportingData = async (overrides?: ReportingFetchOverrides) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      const ids = overrides?.campaignIds !== undefined ? overrides.campaignIds : selectedCampaignIds;
      const dr = overrides?.dateRange !== undefined ? overrides.dateRange : dateRange;

      if (ids.length > 0) {
        params.campaign_ids = ids.join(',');
      }

      if (dr && dr[0] && dr[1]) {
        params.start_date = dr[0].format('YYYY-MM-DD');
        params.end_date = dr[1].format('YYYY-MM-DD');
      }

      params.metrics = 'impressions,clicks,spend,conversions';

      const data = await campaignService.getReportingData(params);
      setReportingData(data);
    } catch (error) {
      const ax = error as AxiosError<{ detail?: string; error?: string }>;
      console.error('Failed to fetch reporting data:', ax.response?.status, ax.response?.data, error);
      const raw = ax.response?.data;
      let detail = '';
      if (raw && typeof raw === 'object') {
        const o = raw as { detail?: unknown; error?: unknown };
        if (o.detail != null) detail = String(o.detail);
        else if (o.error != null) detail = String(o.error);
      }
      message.error(
        detail
          ? `${t('reportingDataFetchError')} (${detail})`
          : t('reportingDataFetchError'),
      );
    } finally {
      setLoading(false);
    }
  };

  // 初期データ取得
  useEffect(() => {
    void fetchReportingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 初回のみ
  }, []);

  useEffect(() => {
    void fetchDailySnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dateRange / ページと同期
  }, [dateRange, dailyPage, dailyPageSize]);

  /** 間引き後のキャンペーン（グラフ・一覧・サマリー共通） */
  const campaignsForDisplay = useMemo(() => {
    const camps = reportingData?.campaigns || [];
    if (!hideZeroSpend) return camps;
    return camps.filter((c) => parseReportSpend(c.spend) !== 0);
  }, [reportingData?.campaigns, hideZeroSpend]);

  const reportingSummaryDisplay = useMemo(() => {
    if (!reportingData?.summary) return null;
    if (!hideZeroSpend) return reportingData.summary;
    const camps = campaignsForDisplay;
    return {
      total_campaigns: camps.length,
      total_spend: camps.reduce((sum, c) => sum + parseReportSpend(c.spend), 0),
      total_impressions: camps.reduce((sum, c) => sum + (Number(c.impressions) || 0), 0),
      total_clicks: camps.reduce((sum, c) => sum + (Number(c.clicks) || 0), 0),
    };
  }, [reportingData?.summary, hideZeroSpend, campaignsForDisplay]);

  /** グラフ用：支出上位のみ・ラベル短縮（件数多いと軸が破綻するため） */
  const comparisonChart = useMemo(() => {
    const limit = isMobile ? 8 : 14;
    const camps = campaignsForDisplay;
    if (!camps?.length) {
      return { rows: [] as Array<Record<string, string | number>>, total: 0, truncated: false };
    }
    const sorted = [...camps].sort((a, b) => parseReportSpend(b.spend) - parseReportSpend(a.spend));
    const truncated = sorted.length > limit;
    const labelMax = isMobile ? 8 : 12;
    const rows = sorted.slice(0, limit).map((c) => ({
      shortName: truncateChartLabel(c.campaign_name, labelMax),
      fullName: c.campaign_name,
      impressions: Number(c.impressions) || 0,
      clicks: Number(c.clicks) || 0,
      conversions: Number(c.conversions) || 0,
      spend: parseReportSpend(c.spend),
    }));
    return { rows, total: sorted.length, truncated };
  }, [campaignsForDisplay, isMobile]);

  const campaignSelectOptionGroups = useMemo(() => {
    const groups = groupByLinkedMetaAdAccount(campaignCatalog, t('metaAdAccountGroupUngrouped'));
    return groups.map((g) => ({
      label: (
        <span>
          <strong>{g.title}</strong>
          {g.subtitle ? (
            <Text type="secondary" style={{ marginLeft: 8 }}>
              {g.subtitle}
            </Text>
          ) : null}
          <Text type="secondary" style={{ marginLeft: 8 }}>
            ({g.accounts.length})
          </Text>
        </span>
      ),
      options: g.accounts.map((c) => ({ value: c.id, label: c.name })),
    }));
  }, [campaignCatalog, t]);

  const dailyInsightGroups = useMemo(
    () => groupByLinkedMetaAdAccount(dailyRows, t('metaAdAccountGroupUngrouped')),
    [dailyRows, t],
  );

  const reportingCampaignGroups = useMemo(
    () =>
      groupByLinkedMetaAdAccount(
        (campaignsForDisplay || []) as MetaAdAccountRow[],
        t('metaAdAccountGroupUngrouped'),
      ),
    [campaignsForDisplay, t],
  );

  const totalConversionsDisplay = useMemo(
    () => campaignsForDisplay.reduce((sum, c) => sum + (Number(c.conversions) || 0), 0),
    [campaignsForDisplay],
  );

  useEffect(() => {
    setDailyCollapseActiveKeys([]);
  }, [dailyRows]);

  useEffect(() => {
    setReportingCollapseActiveKeys([]);
  }, [campaignsForDisplay]);

  const chartBarWidth = Math.max(480, comparisonChart.rows.length * 52);

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
      title: 'CV数',
      dataIndex: 'conversions',
      key: 'conversions',
      width: 100,
      render: (conversions: number) => conversions.toLocaleString(),
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

  const dailyColumns = [
    { title: t('statDate'), dataIndex: 'stat_date', key: 'stat_date', width: 110 },
    { title: t('metaAccount'), dataIndex: 'meta_account_name', key: 'meta_account_name', width: 140, ellipsis: true },
    { title: t('campaignName'), dataIndex: 'campaign_name', key: 'campaign_name', width: 160, ellipsis: true },
    { title: t('adsetName'), dataIndex: 'adset_name', key: 'adset_name', width: 140, ellipsis: true },
    { title: t('adName'), dataIndex: 'ad_name', key: 'ad_name', width: 160, ellipsis: true },
    {
      title: t('spend'),
      dataIndex: 'spend',
      key: 'spend',
      width: 100,
      render: (v: string) => `¥${Number(v).toLocaleString()}`,
    },
    {
      title: t('impressions'),
      dataIndex: 'impressions',
      key: 'impressions',
      width: 100,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: t('clicks'),
      dataIndex: 'clicks',
      key: 'clicks',
      width: 80,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: 'CV',
      dataIndex: 'conversions',
      key: 'conversions',
      width: 72,
      render: (v: number) => (v != null ? Number(v).toLocaleString() : '0'),
    },
    {
      title: 'CPA',
      dataIndex: 'cpa',
      key: 'cpa',
      width: 88,
      render: (v: string | null) => (v != null && Number(v) > 0 ? `¥${Number(v).toFixed(2)}` : '-'),
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
          <Col xs={24} sm={24} md={10}>
            <Select
              mode="multiple"
              allowClear
              placeholder={t('reportingSelectCampaignsMulti')}
              style={{ width: '100%' }}
              size={isMobile ? 'small' : 'middle'}
              value={selectedCampaignIds}
              onChange={(v) => setSelectedCampaignIds(v)}
              options={campaignSelectOptionGroups}
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
            />
            <Space style={{ marginTop: 8 }} wrap>
              <Button size="small" type="primary" onClick={() => void fetchReportingData()}>
                {t('reportingCampaignFilterApply')}
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setSelectedCampaignIds([]);
                  void fetchReportingData({ campaignIds: [] });
                }}
              >
                {t('reportingCampaignFilterReset')}
              </Button>
            </Space>
            <div style={{ marginTop: 10 }}>
              <Switch
                checked={hideZeroSpend}
                onChange={setHideZeroSpend}
                size={isMobile ? 'small' : 'default'}
              />
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>
                {t('reportingHideZeroSpend')}
              </Text>
              <div style={{ marginTop: 6, paddingLeft: isMobile ? 0 : 48 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: 1.45 }}>
                  {t('reportingHideZeroSpendHint')}
                </Text>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <RangePicker
              style={{ width: '100%' }}
              size={isMobile ? 'small' : 'middle'}
              value={dateRange}
              onChange={(dates) => {
                setDailyPage(1);
                const next = dates as [Dayjs, Dayjs] | null;
                setDateRange(next);
                if (next && next[0] && next[1]) {
                  void fetchReportingData({ dateRange: next });
                }
              }}
            />
          </Col>
          <Col xs={24} sm={24} md={6}>
            <Button 
              type="primary" 
              icon={<SyncOutlined />}
              size={isMobile ? 'small' : 'middle'}
              style={{ width: isMobile ? '100%' : 'auto' }}
              onClick={() => {
                void fetchReportingData();
                void fetchDailySnapshot();
              }}
              loading={loading}
            >
              {t('syncFromMetaApi')}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* サマリー統計 */}
      {reportingData && reportingSummaryDisplay && (
        <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={12} md={4}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                  {reportingSummaryDisplay.total_campaigns}
                </div>
                <div style={{ color: '#666' }}>{t('totalCampaigns')}</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={12} md={4}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                  ¥{reportingSummaryDisplay.total_spend.toLocaleString()}
                </div>
                <div style={{ color: '#666' }}>{t('totalSpend')}</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={12} md={4}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                  {reportingSummaryDisplay.total_impressions.toLocaleString()}
                </div>
                <div style={{ color: '#666' }}>{t('totalImpressions')}</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={12} md={4}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f5222d' }}>
                  {reportingSummaryDisplay.total_clicks.toLocaleString()}
                </div>
                <div style={{ color: '#666' }}>{t('totalClicks')}</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={12} md={4}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>
                  {totalConversionsDisplay.toLocaleString()}
                </div>
                <div style={{ color: '#666' }}>{t('reportingTotalConversions')}</div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={isMobile ? 8 : 16}>
        <Col xs={24} lg={12}>
          <Card title={t('campaignList')}>
            {!campaignsForDisplay?.length ? (
              <Table
                dataSource={[]}
                columns={columns}
                rowKey="campaign_id"
                pagination={false}
                locale={{ emptyText: t('reportingChartNoData') }}
                scroll={{ x: 800 }}
                size="small"
              />
            ) : (
              <Collapse
                bordered
                activeKey={reportingCollapseActiveKeys}
                onChange={(k) =>
                  setReportingCollapseActiveKeys(Array.isArray(k) ? k : k != null ? [String(k)] : [])
                }
                style={{ background: '#fafafa' }}
                items={reportingCampaignGroups.map((g) => ({
                  key: g.key,
                  label: (
                    <span>
                      <strong>{g.title}</strong>
                      {g.subtitle ? (
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>
                          {g.subtitle}
                        </Text>
                      ) : null}
                      <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>
                        ({g.accounts.length})
                      </Text>
                    </span>
                  ),
                  children: (
                    <Table
                      dataSource={g.accounts}
                      columns={columns}
                      rowKey="campaign_id"
                      pagination={false}
                      scroll={{ x: 800 }}
                      size="small"
                    />
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={t('performanceComparison')}
            extra={
              <span style={{ color: '#888', fontSize: 12 }}>
                {t('reportingChartMainMetricsHint')}
              </span>
            }
          >
            {comparisonChart.rows.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reportingChartNoData')} />
            ) : (
              <>
                {comparisonChart.truncated && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message={t('reportingChartTruncatedTitle')}
                    description={t('reportingChartTruncatedDesc', {
                      shown: comparisonChart.rows.length,
                      total: comparisonChart.total,
                    })}
                  />
                )}
                <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                  {t('reportingChartTwoRowsHint')}
                </Text>
                <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                  <div style={{ minWidth: chartBarWidth }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {t('reportingChartRowImpressionsSpend')}
                    </Text>
                    <BarChart
                      width={chartBarWidth}
                      height={isMobile ? 200 : 220}
                      data={comparisonChart.rows}
                      margin={{ top: 4, right: 8, left: 4, bottom: 28 }}
                      barCategoryGap="18%"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="shortName"
                        tick={{ fontSize: isMobile ? 9 : 10 }}
                        interval={0}
                        angle={-32}
                        textAnchor="end"
                        height={56}
                      />
                      <YAxis
                        yAxisId="left"
                        tickFormatter={(v) => Number(v).toLocaleString()}
                        width={44}
                        fontSize={isMobile ? 9 : 11}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickFormatter={(v) => `¥${Number(v).toLocaleString()}`}
                        width={52}
                        fontSize={isMobile ? 9 : 11}
                      />
                      <Tooltip
                        labelFormatter={(_l, p) =>
                          String((p?.[0]?.payload as { fullName?: string })?.fullName || '')
                        }
                        formatter={(value: number, name: string) =>
                          name === t('spend')
                            ? [`¥${Number(value).toLocaleString()}`, name]
                            : [Number(value).toLocaleString(), name]
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} />
                      <Bar
                        yAxisId="left"
                        dataKey="impressions"
                        name={t('impressions')}
                        fill="#8884d8"
                        maxBarSize={22}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="spend"
                        name={t('spend')}
                        fill="#ffc658"
                        maxBarSize={22}
                      />
                    </BarChart>

                    <Text type="secondary" style={{ fontSize: 11, marginTop: 12, display: 'block' }}>
                      {t('reportingChartRowClicksCv')}
                    </Text>
                    <BarChart
                      width={chartBarWidth}
                      height={isMobile ? 180 : 200}
                      data={comparisonChart.rows}
                      margin={{ top: 4, right: 8, left: 4, bottom: 28 }}
                      barCategoryGap="18%"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="shortName"
                        tick={{ fontSize: isMobile ? 9 : 10 }}
                        interval={0}
                        angle={-32}
                        textAnchor="end"
                        height={56}
                      />
                      <YAxis
                        tickFormatter={(v) => Number(v).toLocaleString()}
                        width={44}
                        fontSize={isMobile ? 9 : 11}
                      />
                      <Tooltip
                        labelFormatter={(_l, p) =>
                          String((p?.[0]?.payload as { fullName?: string })?.fullName || '')
                        }
                        formatter={(value: number, name: string) => [Number(value).toLocaleString(), name]}
                      />
                      <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} />
                      <Bar
                        dataKey="clicks"
                        name={t('clicks')}
                        fill="#82ca9d"
                        maxBarSize={22}
                      />
                      <Bar
                        dataKey="conversions"
                        name={t('reportingConversionsShort')}
                        fill="#9b59b6"
                        maxBarSize={22}
                      />
                    </BarChart>
                  </div>
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title={t('dailyAdInsightsTitle')}
        style={{ marginTop: 24 }}
        extra={<span style={{ color: '#888', fontSize: 12 }}>{t('dailyAdInsightsHint')}</span>}
      >
        {dailyApiUnavailable && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={t('reportingDailyApiUnavailableTitle')}
            description={t('reportingDailyApiUnavailableDesc')}
          />
        )}
        {dailySummary && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <div style={{ fontSize: 13, color: '#666' }}>{t('totalSpend')}</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>¥{dailySummary.total_spend.toLocaleString()}</div>
            </Col>
            <Col xs={12} sm={6}>
              <div style={{ fontSize: 13, color: '#666' }}>{t('totalImpressions')}</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{dailySummary.total_impressions.toLocaleString()}</div>
            </Col>
            <Col xs={12} sm={6}>
              <div style={{ fontSize: 13, color: '#666' }}>{t('totalClicks')}</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{dailySummary.total_clicks.toLocaleString()}</div>
            </Col>
            <Col xs={12} sm={6}>
              <div style={{ fontSize: 13, color: '#666' }}>CV</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{dailySummary.total_conversions.toLocaleString()}</div>
            </Col>
          </Row>
        )}
        {dailyLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : dailyRows.length === 0 ? (
          <Table<DailyAdInsightRow>
            dataSource={[]}
            columns={dailyColumns}
            rowKey="id"
            locale={{ emptyText: t('dailyAdInsightsEmpty') }}
            pagination={false}
            size="small"
          />
        ) : (
          <>
            <Collapse
              bordered
              activeKey={dailyCollapseActiveKeys}
              onChange={(k) =>
                setDailyCollapseActiveKeys(Array.isArray(k) ? k : k != null ? [String(k)] : [])
              }
              style={{ background: '#fafafa', marginBottom: 16 }}
              items={dailyInsightGroups.map((g) => ({
                key: g.key,
                label: (
                  <span>
                    <strong>{g.title}</strong>
                    {g.subtitle ? (
                      <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>
                        {g.subtitle}
                      </Text>
                    ) : null}
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>
                      ({g.accounts.length})
                    </Text>
                  </span>
                ),
                children: (
                  <Table<DailyAdInsightRow>
                    dataSource={g.accounts}
                    columns={dailyColumns}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: 1200 }}
                    size="small"
                  />
                ),
              }))}
            />
            <div style={{ textAlign: 'right' }}>
              <Pagination
                current={dailyPage}
                pageSize={dailyPageSize}
                total={dailyTotal}
                showSizeChanger
                showTotal={(total) => `全 ${total} 件`}
                onChange={(page, size) => {
                  setDailyPage(page);
                  setDailyPageSize(size || 20);
                }}
                pageSizeOptions={['10', '20', '50', '100']}
                disabled={dailyApiUnavailable}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default Reporting;

