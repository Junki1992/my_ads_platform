import React, { useState, useCallback, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Upload, 
  Table, 
  message, 
  Steps, 
  Alert, 
  Space, 
  Progress, 
  Modal, 
  Typography, 
  Tag, 
  Tooltip,
  Switch,
  Divider,
  Row, 
  Col,
  Statistic,
  Badge,
  Popconfirm,
  Select
} from 'antd';
import { useTranslation } from 'react-i18next';
import { 
  UploadOutlined, 
  DownloadOutlined, 
  FileOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  InboxOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import campaignService from '../services/campaignService';
import bulkUploadService, { type BulkUpload as BulkUploadType, type BulkUploadProgress, type ValidationResult } from '../services/bulkUploadService';
import metaAccountService, { type MetaAccount } from '../services/metaAccountService';

const { Step } = Steps;
const { Title, Text } = Typography;

interface CampaignData {
  // キャンペーン設定
  campaign_name: string;
  objective: string;
  budget_type: string;
  budget: number;
  bid_strategy: string;
  start_date: string;
  end_date?: string;
  budget_optimization: boolean;
  
  // セット設定
  adset_name: string;
  placement_type: string;
  conversion_location: string;
  optimization_event: string;
  age_min: number;
  age_max: number;
  gender: string;
  locations: string[];
  interests: string[];
  attribution_window: string;
  
  // 広告設定
  ad_name: string;
  headline: string;
  description: string;
  website_url: string;
  cta: string;
  image_url: string;
  
  // 拡張設定
  campaign_status?: string;
  targeting_preset?: string;
  creative_template?: string;
  notes?: string;
  
  // ステータス管理用
  rowIndex?: number;
  isValid?: boolean;
  errors?: string[];
  status?: 'pending' | 'processing' | 'success' | 'error';
}

interface ColumnMapping {
  csvColumn: string;
  fieldName: string;
  isRequired: boolean;
  dataType: string;
}

const BulkUpload: React.FC = () => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CampaignData[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [bulkUploadId, setBulkUploadId] = useState<number | null>(null);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<BulkUploadProgress | null>(null);
  const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null);
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  // 画面サイズの検出
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [progressInterval]);

  // Metaアカウント一覧を取得
  useEffect(() => {
    const fetchMetaAccounts = async () => {
      try {
        const accounts = await metaAccountService.fetchMetaAccounts();
        setMetaAccounts(accounts);
        // 最初のアクティブなアカウントを選択
        const activeAccount = accounts.find(acc => acc.is_active);
        if (activeAccount) {
          setSelectedAccountId(activeAccount.id);
        }
      } catch (error) {
        console.error('Metaアカウント取得エラー:', error);
        message.error('Metaアカウントの取得に失敗しました');
      }
    };

    fetchMetaAccounts();
  }, []);

  // CSV列定義（AdSubmission.tsxと完全一致）
  const csvColumns: ColumnMapping[] = [
    // キャンペーン設定
    { csvColumn: 'campaign_name', fieldName: 'キャンペーン名', isRequired: true, dataType: 'string' },
    { csvColumn: 'objective', fieldName: '目的', isRequired: true, dataType: 'select' },
    { csvColumn: 'budget_type', fieldName: '予算タイプ', isRequired: true, dataType: 'select' },
    { csvColumn: 'budget', fieldName: '予算金額', isRequired: true, dataType: 'number' },
    { csvColumn: 'bid_strategy', fieldName: '入札戦略', isRequired: true, dataType: 'select' },
    { csvColumn: 'start_date', fieldName: '開始日', isRequired: true, dataType: 'date' },
    { csvColumn: 'end_date', fieldName: '終了日', isRequired: false, dataType: 'date' },
    { csvColumn: 'budget_optimization', fieldName: '予算最適化', isRequired: false, dataType: 'boolean' },
    
    // セット設定
    { csvColumn: 'adset_name', fieldName: 'セット名', isRequired: true, dataType: 'string' },
    { csvColumn: 'placement_type', fieldName: '配信タイプ', isRequired: true, dataType: 'select' },
    { csvColumn: 'conversion_location', fieldName: 'コンバージョン場所', isRequired: true, dataType: 'select' },
    { csvColumn: 'optimization_event', fieldName: '最適化イベント', isRequired: true, dataType: 'select' },
    { csvColumn: 'age_min', fieldName: '最小年齢', isRequired: false, dataType: 'number' },
    { csvColumn: 'age_max', fieldName: '最大年齢', isRequired: false, dataType: 'number' },
    { csvColumn: 'gender', fieldName: '性別', isRequired: false, dataType: 'select' },
    { csvColumn: 'locations', fieldName: '地域', isRequired: false, dataType: 'array' },
    { csvColumn: 'interests', fieldName: '興味関心', isRequired: false, dataType: 'array' },
    { csvColumn: 'attribution_window', fieldName: 'アトリビューションウィンドウ', isRequired: false, dataType: 'select' },
    
    // 広告設定
    { csvColumn: 'ad_name', fieldName: '広告名', isRequired: true, dataType: 'string' },
    { csvColumn: 'headline', fieldName: '見出し', isRequired: true, dataType: 'string' },
    { csvColumn: 'description', fieldName: '説明文', isRequired: true, dataType: 'string' },
    { csvColumn: 'website_url', fieldName: 'ウェブサイトURL', isRequired: true, dataType: 'url' },
    { csvColumn: 'cta', fieldName: 'CTA', isRequired: true, dataType: 'select' },
    { csvColumn: 'image_url', fieldName: '画像URL', isRequired: true, dataType: 'url' },
    
    // 拡張設定
    { csvColumn: 'campaign_status', fieldName: 'キャンペーン状態', isRequired: false, dataType: 'select' },
    { csvColumn: 'targeting_preset', fieldName: 'ターゲティングプリセット', isRequired: false, dataType: 'string' },
    { csvColumn: 'creative_template', fieldName: 'クリエイティブテンプレート', isRequired: false, dataType: 'string' },
    { csvColumn: 'notes', fieldName: 'メモ', isRequired: false, dataType: 'string' },
  ];

  // 選択肢の定義
  const validValues = {
    objective: ['SALES', 'TRAFFIC', 'ENGAGEMENT', 'APP_INSTALLS', 'VIDEO_VIEWS', 'LEAD_GENERATION', 'AWARENESS', 'CONSIDERATION'],
    budget_type: ['DAILY', 'LIFETIME'],
    bid_strategy: ['LOWEST_COST', 'HIGHEST_VALUE', 'COST_CAP'],
    placement_type: ['auto', 'manual'],
    conversion_location: ['website', 'app', 'offline'],
    optimization_event: ['CONVERSION', 'PURCHASE', 'ADD_TO_CART', 'VIEW_CONTENT', 'LEAD'],
    gender: ['all', 'male', 'female'],
    attribution_window: ['click_1d', 'click_7d', 'click_14d', 'click_28d'],
    cta: ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'DOWNLOAD', 'GET_QUOTE', 'CALL_NOW'],
    campaign_status: ['ACTIVE', 'PAUSED']
  };

  // CSVファイルの処理（バックエンドAPIを使用）
  const handleFileUpload = useCallback(async (file: File) => {
    setUploadedFile(file);
    setIsUploading(true);

    try {
      // バックエンドAPIでファイルをアップロードしてバリデーション
      const formData = new FormData();
      formData.append('file', file);
      if (selectedAccountId) {
        formData.append('selected_account_id', selectedAccountId.toString());
      }
      
      const response = await bulkUploadService.uploadAndValidateWithAccount(formData);
      
      // バリデーション結果をCampaignData形式に変換
      const campaigns: CampaignData[] = response.validation_results.map((result: ValidationResult, index: number) => ({
        campaign_name: result.data.campaign_name || '',
        objective: result.data.objective || '',
        budget_type: result.data.budget_type || '',
        budget: Number(result.data.budget) || 0,
        bid_strategy: result.data.bid_strategy || '',
        start_date: result.data.start_date || '',
        end_date: result.data.end_date || '',
        budget_optimization: result.data.budget_optimization === 'true' || result.data.budget_optimization === true,
        adset_name: result.data.adset_name || '',
        placement_type: result.data.placement_type || '',
        conversion_location: result.data.conversion_location || '',
        optimization_event: result.data.optimization_event || '',
        age_min: Number(result.data.age_min) || 13,
        age_max: Number(result.data.age_max) || 65,
        gender: result.data.gender || 'all',
        locations: result.data.locations ? String(result.data.locations).split(',').map(l => l.trim()) : [],
        interests: result.data.interests ? String(result.data.interests).split(',').map(i => i.trim()) : [],
        attribution_window: result.data.attribution_window || 'click_7d',
        ad_name: result.data.ad_name || '',
        headline: result.data.headline || '',
        description: result.data.description || '',
        website_url: result.data.website_url || '',
        cta: result.data.cta || '',
        image_url: result.data.image_url || '',
        campaign_status: result.data.campaign_status || 'ACTIVE',
        targeting_preset: result.data.targeting_preset || '',
        creative_template: result.data.creative_template || '',
        notes: result.data.notes || '',
        
        // ステータス管理
        rowIndex: result.row_index,
        isValid: result.is_valid,
        errors: result.errors,
        status: result.is_valid ? 'success' : 'error'
      }));

      setCsvData(campaigns);
      setValidationResults(response.validation_results);
      setBulkUploadId(response.bulk_upload_id);
      setCurrentStep(1);
      setIsUploading(false);
      
      message.success(`${response.total_records}件のキャンペーンデータを読み込みました。有効: ${response.valid_records}件、無効: ${response.invalid_records}件`);
      
    } catch (error: any) {
      console.error('CSVアップロードエラー:', error);
      message.error(`CSVファイルの処理に失敗しました: ${error.response?.data?.error || error.message}`);
      setIsUploading(false);
    }
  }, []);

  // データバリデーション（バックエンドで処理するため削除）

  // バリデーション実行（バックエンドで処理するため、このuseEffectは不要）
  // useEffect(() => {
  //   if (csvData.length > 0) {
  //     validateCampaignData(csvData);
  //   }
  // }, [csvData, validateCampaignData]);

  // テンプレートファイルのダウンロード
  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/csv_template.csv';
    link.download = 'meta_ads_template.csv';
    link.click();
  };

  // 進捗監視の開始
  const startProgressMonitoring = useCallback((bulkUploadId: number) => {
    const interval = setInterval(async () => {
      try {
        const progress = await bulkUploadService.getProgress(bulkUploadId);
        setBulkUploadProgress(progress);
        setProcessedCount(progress.processed);
        
        if (progress.status === 'COMPLETED' || progress.status === 'FAILED') {
          clearInterval(interval);
          setIsProcessing(false);
          
          if (progress.status === 'COMPLETED') {
            message.success(`一括入稿が完了しました。成功: ${progress.successful}件、失敗: ${progress.failed}件`);
          } else {
            message.error(`一括入稿が失敗しました: ${progress.error_log}`);
          }
          
          setCurrentStep(0);
        }
      } catch (error) {
        console.error('進捗取得エラー:', error);
      }
    }, 2000); // 2秒ごとに進捗を確認
    
    setProgressInterval(interval);
  }, []);

  // 進捗監視の停止
  const stopProgressMonitoring = useCallback(() => {
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }
  }, [progressInterval]);

  // 一括投稿実行（バックエンドAPIを使用）
  const executeBulkUpload = async () => {
    if (!bulkUploadId) {
      message.error('一括入稿IDが設定されていません。');
      return;
    }

    const validCampaigns = validationResults.filter(r => r.is_valid);
    
    if (validCampaigns.length === 0) {
      message.error('有効なキャンペーンがありません。データを修正してください。');
      return;
    }

    setIsProcessing(true);
    setProcessedCount(0);

    try {
      // バックエンドで一括処理を開始
      await bulkUploadService.processBulkUpload(bulkUploadId);
      
      // 進捗監視を開始
      startProgressMonitoring(bulkUploadId);
      
      message.info('一括入稿処理を開始しました。進捗を監視しています...');
      
    } catch (error: any) {
      console.error('一括入稿開始エラー:', error);
      message.error(`一括入稿の開始に失敗しました: ${error.response?.data?.error || error.message}`);
      setIsProcessing(false);
    }
  };

  // テーブルカラム定義
  const tableColumns = [
    {
      title: '行番号',
      dataIndex: 'rowIndex',
      key: 'rowIndex',
      width: 80,
    },
    {
      title: 'ステータス',
      key: 'status',
      width: 120,
      render: (record: CampaignData) => {
        const result = validationResults.find(r => r.row_index === record.rowIndex);
        if (!result) return <Tag color="default">未チェック</Tag>;
        
        if (result.is_valid) {
          return <Tag color="green" icon={<CheckCircleOutlined />}>有効</Tag>;
        } else {
          return <Tag color="red" icon={<ExclamationCircleOutlined />}>エラー</Tag>;
        }
      },
    },
    {
      title: 'キャンペーン名',
      dataIndex: 'campaign_name',
      key: 'campaign_name',
      render: (text: string, record: CampaignData) => (
        <div>
          <Text strong={true}>{text}</Text>
          {validationResults.find(r => r.row_index === record.rowIndex)?.errors && (
            <div style={{ fontSize: '12px', color: '#ff4d4f' }}>
              {validationResults.find(r => r.row_index === record.rowIndex)?.errors.join('; ')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'セット名',
      dataIndex: 'adset_name',
      key: 'adset_name',
    },
    {
      title: '広告名',
      dataIndex: 'ad_name',
      key: 'ad_name',
    },
    {
      title: '予算',
      key: 'budget',
      render: (record: CampaignData) => (
        <Text>
          ¥{record.budget.toLocaleString()} 
          <span style={{ color: '#666', fontSize: '12px' }}>({record.budget_type})</span>
        </Text>
      ),
    },
    {
      title: '目的',
      dataIndex: 'objective',
      key: 'objective',
      render: (objective: string) => {
        const colorMap: { [key: string]: string } = {
          SALES: 'green',
          TRAFFIC: 'blue',
          ENGAGEMENT: 'purple',
          AWARENESS: 'orange'
        };
        return <Tag color={colorMap[objective] || 'default'}>{objective}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (record: CampaignData) => {
        const result = validationResults.find(r => r.row_index === record.rowIndex);
        const isDisabled = result && !result.is_valid;
        
        return (
          <Space>
            <Button 
              type="link" 
              icon={<EditOutlined />}
              size="small"
              disabled={isDisabled}
            >
              編集
            </Button>
            <Popconfirm 
              title="このキャンペーンを削除しますか？"
              onConfirm={() => {
                setCsvData(prev => prev.filter(item => item.rowIndex !== record.rowIndex));
                setValidationResults(prev => prev.filter(item => item.row_index !== record.rowIndex));
              }}
            >
              <Button 
                type="link" 
                icon={<DeleteOutlined />}
                size="small"
                danger
              >
                削除
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const steps = [
    {
      title: t('csvFileSelection'),
      content: (
    <div>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Title level={3} style={{ 
              fontSize: 'clamp(18px, 4vw, 24px)',
              marginBottom: 16 
            }}>
              {t('selectCsvFile')}
            </Title>
            <Text type="secondary" style={{
              fontSize: 'clamp(12px, 3vw, 14px)',
              display: 'block',
              marginBottom: 'clamp(24px, 6vw, 32px)'
            }}>
              {t('metaAdBulkUploadCsvDescription')}
            </Text>

            <div style={{ 
              margin: 'clamp(24px, 6vw, 32px) clamp(8px, 2vw, 32px)',
              maxWidth: '800px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              <Upload.Dragger
                name="file"
                multiple={false}
                accept=".csv,.xlsx,.xls"
                beforeUpload={(file) => {
                  handleFileUpload(file);
                  return false;
                }}
                showUploadList={false}
                disabled={isUploading}
                style={{
                  padding: 'clamp(20px, 8vw, 40px) 16px',
                  minHeight: 'clamp(200px, 40vw, 300px)',
                  border: '2px dashed #d9d9d9',
                  borderRadius: 8,
                  transition: 'all 0.3s ease',
                  width: '100%'
                }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined style={{ 
                    fontSize: 'clamp(32px, 8vw, 48px)', 
                    color: '#1890ff',
                    marginBottom: 'clamp(8px, 2vw, 16px)'
                  }} />
                </p>
                <p className="ant-upload-text" style={{
                  fontSize: 'clamp(14px, 3.5vw, 18px)',
                  marginBottom: 'clamp(4px, 1vw, 8px)'
                }}>
                  {isUploading ? t('fileProcessing') : t('dragDropCsvFile')}
                </p>
                <p className="ant-upload-hint" style={{
                  fontSize: 'clamp(11px, 2.5vw, 14px)',
                  color: '#999',
                  marginBottom: 'clamp(8px, 2vw, 16px)'
                }}>
                  {t('csvExcelSupported')}
                </p>
                {!isUploading && (
                <Button
                  type="primary"
                    size="large"
                    style={{ 
                      marginTop: 'clamp(8px, 2vw, 16px)',
                      fontSize: 'clamp(12px, 3vw, 16px)',
                      height: 'clamp(36px, 8vw, 48px)',
                      padding: '0 clamp(16px, 4vw, 24px)'
                    }}
                  >
                    {t('selectFile')}
                </Button>
                )}
              </Upload.Dragger>
              </div>

            <div style={{ 
              marginTop: 'clamp(16px, 4vw, 24px)',
              textAlign: 'center'
            }}>
              <Button
                type="dashed" 
                icon={<DownloadOutlined />}
                onClick={downloadTemplate}
                style={{ 
                  fontSize: 'clamp(12px, 3vw, 14px)',
                  height: 'clamp(32px, 7vw, 40px)',
                  padding: '0 clamp(12px, 3vw, 20px)',
                  maxWidth: '300px'
                }}
              >
                {t('downloadCsvTemplate')}
              </Button>
            </div>

            {/* Metaアカウント選択 */}
            {metaAccounts.length > 0 && (
              <div style={{ 
                marginTop: 'clamp(24px, 5vw, 32px)',
                padding: '0 clamp(8px, 2vw, 32px)',
                maxWidth: '800px',
                marginLeft: 'auto',
                marginRight: 'auto'
              }}>
                <Card size="small" style={{ textAlign: 'left' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <Text strong style={{ fontSize: 'clamp(14px, 3.5vw, 16px)' }}>
                      {t('metaAdAccountSelection')}
                    </Text>
                  </div>
                  <Select
                    value={selectedAccountId}
                    onChange={setSelectedAccountId}
                    placeholder={t('selectAccount')}
                    style={{ width: '100%' }}
                    size="large"
                  >
                    {metaAccounts.map(account => (
                      <Select.Option key={account.id} value={account.id}>
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{account.account_name}</div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            ID: {account.account_id}
                          </div>
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                  <div style={{ 
                    marginTop: '8px', 
                    fontSize: 'clamp(11px, 2.5vw, 12px)', 
                    color: '#666' 
                  }}>
                    {t('selectedAccountCampaigns')}
                  </div>
                </Card>
              </div>
            )}
          </div>

          <Alert
            message={t('csvFileSpecifications')}
            description={
              <div style={{ marginTop: 'clamp(16px, 4vw, 24px)' }}>
                {t('csvFileSpecificationsDesc').split('\n').map((line, index) => (
                  <div key={index} style={{ marginBottom: '8px' }}>{line}</div>
                ))}
              </div>
            }
            type="info"
            showIcon
            style={{
              marginTop: 'clamp(16px, 4vw, 24px)',
              marginLeft: 'clamp(8px, 2vw, 32px)',
              marginRight: 'clamp(8px, 2vw, 32px)'
            }}
          />
        </div>
      ),
    },
    {
      title: t('dataConfirmation'),
      content: (
        <div>
          <div style={{ marginBottom: 'clamp(24px, 5vw, 32px)' }}>
            <Title level={4} style={{ 
              fontSize: 'clamp(16px, 4vw, 20px)',
              marginBottom: 'clamp(16px, 4vw, 24px)'
            }}>
              {t('dataSummary')}
            </Title>
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={12} md={6} lg={3} style={{ padding: '8px' }}>
                <Card size="small" style={{ 
                  textAlign: 'center',
                  minHeight: 'clamp(80px, 15vw, 120px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: 'clamp(12px, 3vw, 16px)'
                }}>
                  <FileOutlined style={{ 
                    fontSize: 'clamp(20px, 5vw, 24px)', 
                    color: '#1890ff', 
                    marginBottom: 'clamp(4px, 1vw, 8px)' 
                  }} />
                  <div style={{ 
                    fontSize: 'clamp(14px, 4vw, 16px)', 
                    fontWeight: 'bold' 
                  }}>
                    {csvData.length}
                  </div>
                  <div style={{ 
                    fontSize: 'clamp(10px, 2.5vw, 12px)', 
                    color: '#666',
                    lineHeight: 1.2
                  }}>
                    {t('totalCampaigns')}
                  </div>
            </Card>
          </Col>
              <Col xs={12} sm={12} md={6} lg={3} style={{ padding: '8px' }}>
                <Card size="small" style={{ 
                  textAlign: 'center',
                  backgroundColor: '#f6ffed',
                  minHeight: 'clamp(80px, 15vw, 120px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: 'clamp(12px, 3vw, 16px)'
                }}>
                  <CheckCircleOutlined style={{ 
                    fontSize: 'clamp(20px, 5vw, 24px)', 
                    color: '#52c41a', 
                    marginBottom: 'clamp(4px, 1vw, 8px)' 
                  }} />
                  <div style={{ 
                    fontSize: 'clamp(14px, 4vw, 16px)', 
                    fontWeight: 'bold', 
                    color: '#52c41a' 
                  }}>
                    {validationResults.filter(r => r.is_valid).length}
                  </div>
                  <div style={{ 
                    fontSize: 'clamp(10px, 2.5vw, 12px)', 
                    color: '#666',
                    lineHeight: 1.2
                  }}>
                    {t('validData')}
                  </div>
      </Card>
            </Col>
              <Col xs={12} sm={12} md={6} lg={3} style={{ padding: '8px' }}>
                <Card size="small" style={{ 
                  textAlign: 'center',
                  backgroundColor: '#fff2f0',
                  minHeight: 'clamp(80px, 15vw, 120px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: 'clamp(12px, 3vw, 16px)'
                }}>
                  <ExclamationCircleOutlined style={{ 
                    fontSize: 'clamp(20px, 5vw, 24px)', 
                    color: '#ff4d4f', 
                    marginBottom: 'clamp(4px, 1vw, 8px)' 
                  }} />
                   <div style={{ 
                    fontSize: 'clamp(14px, 4vw, 16px)', 
                    fontWeight: 'bold', 
                    color: '#ff4d4f' 
                  }}>
                    {validationResults.filter(r => !r.is_valid).length}
                  </div>
                  <div style={{ 
                    fontSize: 'clamp(10px, 2.5vw, 12px)', 
                    color: '#666',
                    lineHeight: 1.2
                  }}>
                    {t('errorData')}
                  </div>
                </Card>
            </Col>
              <Col xs={12} sm={12} md={6} lg={3} style={{ padding: '8px' }}>
                <Card size="small" style={{ 
                  textAlign: 'center',
                  backgroundColor: '#e6f7ff',
                  minHeight: 'clamp(80px, 15vw, 120px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: 'clamp(12px, 3vw, 16px)'
                }}>
                  <PlayCircleOutlined style={{ 
                    fontSize: 'clamp(20px, 5vw, 24px)', 
                    color: '#1890ff', 
                    marginBottom: 'clamp(4px, 1vw, 8px)' 
                  }} />
                  <div style={{ 
                    fontSize: 'clamp(14px, 4vw, 16px)', 
                    fontWeight: 'bold' 
                  }}>
                    {validationResults.filter(r => r.is_valid).length}/{csvData.length}
                  </div>
                  <div style={{ 
                    fontSize: 'clamp(10px, 2.5vw, 12px)', 
                    color: '#666',
                    lineHeight: 1.2
                  }}>
                    {t('submissionPossible')}
                  </div>
                </Card>
            </Col>
          </Row>
          </div>

          {validationResults.filter(r => !r.is_valid).length > 0 && (
            <Alert
              message="データにエラーがあります"
              description="以下のテーブルでエラーの詳細を確認し、必要に応じてCSVファイルを修正してください。"
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          <Card style={{ margin: 'clamp(16px, 4vw, 24px) 0' }}>
            <div style={{ marginBottom: 'clamp(12px, 3vw, 16px)' }}>
              <Title level={5} style={{ 
                margin: 0,
                fontSize: 'clamp(14px, 3.5vw, 16px)'
              }}>
                キャンペーン一覧
              </Title>
              <Text type="secondary" style={{
                fontSize: 'clamp(11px, 2.5vw, 12px)',
                display: 'block',
                marginTop: '4px'
              }}>
                {csvData.length}件のキャンペーンデータを確認できます
              </Text>
            </div>
            
            <div style={{ overflowX: 'auto', margin: isMobile ? '-8px -4px' : '-8px' }}>
              <Table
                dataSource={csvData}
                columns={tableColumns}
                pagination={{ 
                  pageSize: isMobile ? 2 : 3,
                  showSizeChanger: !isMobile,
                  showQuickJumper: !isMobile,
                  simple: isMobile,
                  showTotal: isMobile ? undefined : (total, range) =>
                    `${range[0]}-${range[1]} / ${total} 件`,
                  size: isMobile ? 'small' : 'default'
                }}
                scroll={{ 
                  x: isMobile ? 700 : 1200,
                  y: (window.innerHeight < 600 || isMobile) ? 350 : undefined
                }}
                size={isMobile ? "small" : "middle"}
                rowKey={(record) => `row-${record.rowIndex}`}
                style={{
                  minWidth: isMobile ? '650px' : 'auto',
                  fontSize: isMobile ? '12px' : '14px'
                }}
              />
            </div>
          </Card>
        </div>
      ),
    },
    {
      title: '投稿実行',
      content: (
        <div style={{ 
          textAlign: 'center',
          padding: 'clamp(16px, 4vw, 32px)'
        }}>
          {isProcessing ? (
            <div>
              <Progress
                percent={bulkUploadProgress ? bulkUploadProgress.progress_percentage : Math.round((processedCount / validationResults.filter(r => r.is_valid).length) * 100)}
                status="active"
                strokeWidth={8}
                style={{
                  marginBottom: 'clamp(16px, 4vw, 24px)'
                }}
              />
              <div style={{ 
                fontSize: 'clamp(14px, 3.5vw, 16px)',
                fontWeight: 500
              }}>
                <PlayCircleOutlined style={{ marginRight: 8 }} /> 
                投稿中... {processedCount}/{validationResults.filter(r => r.is_valid).length}
              </div>
              {bulkUploadProgress && (
                <div style={{ 
                  fontSize: 'clamp(12px, 3vw, 14px)',
                  color: '#666',
                  marginTop: '8px'
                }}>
                  成功: {bulkUploadProgress.successful}件, 失敗: {bulkUploadProgress.failed}件
                </div>
              )}
            </div>
          ) : (
            <div>
              <EyeOutlined style={{ 
                fontSize: 'clamp(40px, 10vw, 48px)', 
                marginBottom: 'clamp(12px, 3vw, 16px)', 
                color: '#52c41a' 
              }} />
              <Title level={4} style={{ 
                fontSize: 'clamp(18px, 4.5vw, 24px)',
                marginBottom: 'clamp(8px, 2vw, 12px)'
              }}>
                投稿準備完了
              </Title>
              <Text type="secondary" style={{
                fontSize: 'clamp(12px, 3vw, 14px)',
                display: 'block',
                lineHeight: 1.4
              }}>
                有効な{validationResults.filter(r => r.is_valid).length}件のキャンペーンを投稿します
              </Text>
              
              <div style={{ 
                marginTop: 'clamp(24px, 6vw, 32px)'
              }}>
            <Button
              type="primary"
                  size="large"
              icon={<PlayCircleOutlined />}
                  onClick={executeBulkUpload}
                  disabled={validationResults.filter(r => r.is_valid).length === 0}
                  style={{
                    height: 'clamp(44px, 10vw, 56px)',
                    padding: '0 clamp(20px, 5vw, 32px)',
                    fontSize: 'clamp(14px, 3.5vw, 16px)',
                    minWidth: 'clamp(140px, 30vw, 200px)'
                  }}
                >
                  一括入稿実行
            </Button>
          </div>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ 
      maxWidth: '100%', 
      margin: '0', 
      padding: '0',
      width: '100%',
      boxSizing: 'border-box',
      overflowX: 'hidden'
    }}>
      <div style={{ marginBottom: 'clamp(24px, 5vw, 32px)' }}>
        <Title level={2} style={{ 
          fontSize: 'clamp(20px, 5vw, 32px)',
          lineHeight: 1.2,
          marginBottom: 12
        }}>
          {t('metaAdCsvBulkUpload')}
        </Title>
        <Text type="secondary" style={{
          fontSize: 'clamp(12px, 3vw, 16px)',
          lineHeight: 1.4,
          display: 'block'
        }}>
          {t('metaAdCsvBulkUploadDescription')}
        </Text>
      </div>

      <Card style={{ 
        marginBottom: 'clamp(16px, 4vw, 32px)',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden'
      }}>
        <Steps 
          current={currentStep} 
          style={{ 
            marginBottom: 'clamp(24px, 5vw, 32px)',
            padding: '0 clamp(8px, 2vw, 16px)',
            maxWidth: '100%'
          }}
          responsive={isMobile}
          direction={isMobile ? 'vertical' : 'horizontal'}
          size="default"
          items={[
            { 
              title: isMobile ? t('fileSelection') : t('csvFileSelection'), 
              status: currentStep === 0 ? 'process' : currentStep > 0 ? 'finish' : 'wait' 
            },
            { 
              title: t('dataConfirmation'), 
              status: currentStep === 1 ? 'process' : currentStep > 1 ? 'finish' : 'wait' 
            },
            { 
              title: t('submissionExecution'), 
              status: currentStep === 2 ? 'process' : 'wait' 
            }
          ]}
        />

        {steps[currentStep].content}
        
        {(currentStep > 0 || currentStep < steps.length - 1) && (
          <div style={{ 
            marginTop: 'clamp(20px, 5vw, 24px)',
            display: 'flex',
            justifyContent: currentStep === 0 ? 'center' : 'space-between',
            alignItems: 'center',
            gap: 'clamp(8px, 2vw, 12px)',
            flexWrap: 'wrap',
            padding: '0 clamp(8px, 2vw, 16px)' 
          }}>
            {currentStep > 0 && (
              <Button 
                onClick={() => setCurrentStep(currentStep - 1)}
                disabled={isProcessing}
                style={{ 
                  minWidth: isMobile ? '100px' : '120px',
                  height: isMobile ? '36px' : '40px',
                  fontSize: isMobile ? '13px' : '14px'
                }}
                size={isMobile ? 'small' : 'middle'}
              >
                {isMobile ? '戻る' : '前のステップへ'}
              </Button>
            )}
            
            {currentStep < steps.length - 1 && (
              <Button 
                type="primary"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={
                  (currentStep === 1 && validationResults.filter(r => !r.is_valid).length > 0) ||
                  (currentStep === 2 && validationResults.filter(r => r.is_valid).length === 0)
                }
                style={{ 
                  minWidth: isMobile ? '100px' : '120px',
                  height: isMobile ? '36px' : '40px',
                  fontSize: isMobile ? '13px' : '14px'
                }}
                size={isMobile ? 'small' : 'middle'}
              >
                {isMobile ? t('next') : t('nextStep')}
             </Button>
            )}
          </div>
        )}
        </Card>
    </div>
  );
};

export default BulkUpload;