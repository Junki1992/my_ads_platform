import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { 
  Card, 
  Form, 
  Input, 
  Select, 
  DatePicker, 
  InputNumber, 
  Button, 
  Row, 
  Col, 
  Upload, 
  message,
  Switch,
  Slider,
  Radio,
  Checkbox,
  Alert,
  Tooltip,
  Typography,
  Progress,
  Avatar,
  Steps,
  Divider,
  Modal,
  Tag,
  Descriptions
} from 'antd';
import { useTranslation } from 'react-i18next';
import { 
  PlusOutlined, 
  SaveOutlined, 
  LeftOutlined, 
  RightOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  CameraOutlined,
  GlobalOutlined,
  TagOutlined,
  SettingOutlined,
  EyeOutlined,
  FacebookOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import campaignService from '../services/campaignService';
import metaAccountService from '../services/metaAccountService';
import boxAccountService, { BoxAccount, BoxFile } from '../services/boxAccountService';

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;
const { Step } = Steps;

interface AdSubmissionProps {}

const AdSubmission: React.FC<AdSubmissionProps> = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const imageUploadValue = Form.useWatch('image_upload', form);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [metaAccounts, setMetaAccounts] = useState<any[]>([]);
  const [selectedMetaAccount, setSelectedMetaAccount] = useState<number | null>(null);
  const [boxAccounts, setBoxAccounts] = useState<BoxAccount[]>([]);
  const [boxFilesModalVisible, setBoxFilesModalVisible] = useState(false);
  const [selectedBoxAccount, setSelectedBoxAccount] = useState<number | null>(null);
  const [boxFiles, setBoxFiles] = useState<BoxFile[]>([]);
  const [loadingBoxFiles, setLoadingBoxFiles] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [thumbnailLoadingStates, setThumbnailLoadingStates] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({});

  // 画面サイズの検出
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Metaアカウント取得
  useEffect(() => {
    const fetchMetaAccounts = async () => {
      try {
        const accounts = await metaAccountService.fetchMetaAccounts();
        console.log('Fetched meta accounts:', accounts);
        setMetaAccounts(accounts);
        
        if (accounts.length > 0) {
          // デモアカウント以外のアカウントを優先選択
          const realAccount = accounts.find(account => 
            !account.access_token?.startsWith('demo_') && 
            !account.access_token?.startsWith('demo_token')
          );
          
          const selectedAccount = realAccount || accounts[0];
          setSelectedMetaAccount(selectedAccount.id);
          form.setFieldsValue({ meta_account_id: selectedAccount.id });
          console.log('Set meta_account_id to:', selectedAccount.id, 'Account name:', selectedAccount.account_name);
        } else {
          console.warn('No meta accounts found');
        }
      } catch (error) {
        console.error('Failed to fetch meta accounts:', error);
      }
    };
    fetchMetaAccounts();
  }, [form]);
  const [campaignOff] = useState(true);
  const [autoPlacement, setAutoPlacement] = useState(true);
  const [budgetOptimization, setBudgetOptimization] = useState(true);
  const [previewImages, setPreviewImages] = useState<string[]>([]);

  // Meta APIで実際に使用可能なキャンペーン目的（バックエンドのOBJECTIVE_CHOICESに合わせて修正）
  const campaignObjectives = [
    // Meta APIで実際に使用可能なobjective値
    { value: 'APP_INSTALLS', label: t('appInstalls') },
    { value: 'BRAND_AWARENESS', label: t('brandAwareness') },
    { value: 'EVENT_RESPONSES', label: t('eventResponses') },
    { value: 'LEAD_GENERATION', label: t('leadGeneration') },
    { value: 'LINK_CLICKS', label: t('linkClicks') },
    { value: 'LOCAL_AWARENESS', label: t('localAwareness') },
    { value: 'MESSAGES', label: t('messages') },
    { value: 'OFFER_CLAIMS', label: t('offerClaims') },
    { value: 'PAGE_LIKES', label: t('pageLikes') },
    { value: 'POST_ENGAGEMENT', label: t('postEngagement') },
    { value: 'PRODUCT_CATALOG_SALES', label: t('productCatalogSales') },
    { value: 'REACH', label: t('reach') },
    { value: 'STORE_VISITS', label: t('storeVisits') },
    { value: 'VIDEO_VIEWS', label: t('videoViews') },
    
    // Outcome系（Meta APIで推奨される新しいobjective）
    { value: 'OUTCOME_AWARENESS', label: t('outcomeAwareness') },
    { value: 'OUTCOME_ENGAGEMENT', label: t('outcomeEngagement') },
    { value: 'OUTCOME_LEADS', label: t('outcomeLeads') },
    { value: 'OUTCOME_SALES', label: t('outcomeSales') },
    { value: 'OUTCOME_TRAFFIC', label: t('outcomeTraffic') },
    { value: 'OUTCOME_APP_PROMOTION', label: t('outcomeAppPromotion') },
    
    // 最も一般的なコンバージョン系objective
    { value: 'CONVERSIONS', label: t('conversions') }
  ];

  // 実際の配信先プラットフォーム
  const placements = [
    { value: 'facebook_feed', label: t('facebookFeed') },
    { value: 'facebook_story', label: t('facebookStory') },
    { value: 'instagram_feed', label: t('instagramFeed') },
    { value: 'instagram_story', label: t('instagramStory') },
    { value: 'messenger', label: t('messenger') },
    { value: 'audience_network', label: t('audienceNetwork') }
  ];

  // 実際のCTAオプション
  const ctaOptions = [
    { value: 'LEARN_MORE', label: t('learnMore') },
    { value: 'SHOP_NOW', label: t('shopNow') },
    { value: 'SIGN_UP', label: t('signUp') },
    { value: 'DOWNLOAD', label: t('download') },
    { value: 'GET_QUOTE', label: t('getQuote') },
    { value: 'CALL_NOW', label: t('callNow') }
  ];

  const [forceRender, setForceRender] = useState(0);

  const steps = [
    {
      title: t('campaignSettings'),
      icon: <SettingOutlined />,
      content: (
        <div>
          <Alert
            message={t('importantNotice')}
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Row gutter={isMobile ? 16 : 24}>
            <Col span={24}>
              <Form.Item
                name="campaign_name"
                label={<span>{t('campaignName')} <Text type="secondary">*</Text></span>}
                rules={[{ required: true, message: t('campaignNameRequired') }]}
              >
                <Input 
                  placeholder={t('campaignNamePlaceholder')}
                  size={isMobile ? 'middle' : 'large'}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Metaアカウント選択 */}
          <Form.Item
            name="meta_account_id"
            label={<span>{t('metaAccount')} <Text type="secondary">*</Text></span>}
            rules={[{ required: true, message: t('metaAccountRequired') }]}
          >
            <Select 
              placeholder={t('metaAccountPlaceholder')}
              size={isMobile ? 'middle' : 'large'}
              value={selectedMetaAccount}
              onChange={(value) => setSelectedMetaAccount(value)}
            >
              {metaAccounts.map(account => (
                <Option key={account.id} value={account.id}>
                  {account.account_name} ({account.account_id})
                </Option>
              ))}
            </Select>
          </Form.Item>

          {metaAccounts.length === 0 && (
            <Alert
              message={t('metaAccountNotRegistered')}
              description={t('metaAccountNotRegisteredDesc')}
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          <Form.Item
            name="objective"
            label={<span>{t('objective')} <Text type="secondary">*</Text></span>}
            rules={[{ required: true, message: t('campaignObjectiveRequired') }]}
          >
            <Select 
              placeholder={t('campaignObjectivePlaceholder')}
              size={isMobile ? 'middle' : 'large'}
            >
              {campaignObjectives.map(obj => (
                <Option key={obj.value} value={obj.value}>
                  {obj.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider />
          
          <Title level={5}>{t('budgetSettings')}</Title>
          
          <Row gutter={isMobile ? 16 : 24}>
            <Col span={12}>
              <Form.Item
                name="budget_type"
                label={<span>{t('budgetType')} <Text type="secondary">*</Text></span>}
                rules={[{ required: true, message: t('budgetTypeRequired') }]}
              >
                <Radio.Group size="large" style={{ width: '100%', display: 'flex' }}>
                  <Radio.Button value="DAILY" style={{ flex: 1 }}>
                    <div>
                      <div>{t('dailyBudget')}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{t('dailyBudgetDesc')}</div>
                    </div>
                  </Radio.Button>
                  <Radio.Button value="LIFETIME" style={{ flex: 1 }}>
                    <div>
                      <div>{t('lifetimeBudget')}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{t('lifetimeBudgetDesc')}</div>
                    </div>
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="budget"
                label={<span>{t('budget')} <Text type="secondary">*</Text></span>}
                rules={[{ required: true, message: t('budgetAmountRequired') }]}
              >
                <InputNumber 
                  placeholder={t('budgetAmountPlaceholder')} 
                  min={100} 
                  max={1000000}
                  style={{ width: '100%' }}
                  size={isMobile ? 'middle' : 'large'}
                  addonAfter={t('yen')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="budget_optimization"
            label={
              <span>
                {t('budgetOptimization')} 
                <Tooltip title={t('budgetOptimizationTooltip')}>
                  <InfoCircleOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
          >
            <Switch 
              checked={budgetOptimization}
              onChange={setBudgetOptimization}
              checkedChildren={t('enabled')} 
              unCheckedChildren={t('disabled')}
            />
            {budgetOptimization && (
              <Text type="secondary" style={{ marginLeft: 16 }}>
                {t('budgetOptimizationDesc')}
              </Text>
            )}
          </Form.Item>

          <Divider />
          
          <Title level={5}>{t('biddingStrategy')}</Title>
          
          <Form.Item
            name="bid_strategy"
            rules={[{ required: true, message: t('biddingStrategyRequired') }]}
          >
            <Radio.Group size="large">
              <Radio.Button value="LOWEST_COST_WITHOUT_CAP">
                <div>
                  <div style={{ fontWeight: 'bold' }}>{t('lowestCostNoCap')}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{t('lowestCostNoCapDesc')}</div>
                </div>
              </Radio.Button>
              <Radio.Button value="COST_CAP">
                <div>
                  <div style={{ fontWeight: 'bold' }}>{t('costCap')}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{t('costCapDesc')}</div>
                </div>
              </Radio.Button>
              <Radio.Button value="LOWEST_COST_WITH_BID_CAP">
                <div>
                  <div style={{ fontWeight: 'bold' }}>{t('lowestCostWithBidCap')}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{t('lowestCostWithBidCapDesc')}</div>
                </div>
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Row gutter={isMobile ? 16 : 24}>
            <Col span={12}>
              <Form.Item
                name="start_date"
                label={<span>{t('startDate')} <Text type="secondary">*</Text></span>}
                rules={[
                  { required: true, message: t('campaignStartDateRequired') },
                  {
                    validator: (_, value) => {
                      if (!value) {
                        return Promise.reject(new Error(t('campaignStartDateRequired')));
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  size={isMobile ? 'middle' : 'large'}
                  placeholder={t('campaignStartDatePlaceholder')}
                  format="YYYY-MM-DD"
                  showToday={false}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                name="end_date"
                label={t('campaignEndDate')}
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  size={isMobile ? 'middle' : 'large'}
                  placeholder={t('campaignEndDatePlaceholder')}
                  format="YYYY-MM-DD"
                  showToday={false}
                />
              </Form.Item>
            </Col>
          </Row>

          <Alert
            message={
              <div>
                <Text type="secondary">
                  <InfoCircleOutlined style={{ marginRight: 8 }} />
                  {t('budgetInfo')}
                </Text>
              </div>
            }
            type="info"
            showIcon={false}
            style={{ marginTop: 16 }}
          />
        </div>
      ),
    },
    {
      title: t('setSettings'),
      icon: <TagOutlined />,
      content: (
        <div>
          <Form.Item
            name="adset_name"
            label={<span>セット名 <Text type="secondary">*</Text></span>}
            rules={[{ required: true, message: 'セット名を入力してください' }]}
          >
            <Input 
              placeholder="例：ターゲットA_男女20-30代"
              size={isMobile ? 'middle' : 'large'}
            />
          </Form.Item>

          <Divider />
          
          <Title level={5}>
            <GlobalOutlined style={{ marginRight: 8 }} />
            配信設定
          </Title>

          <Form.Item
            name="placement_type"
            label={
              <span>
                配信先選択 
                <Tooltip title="Advantage+配信（自動配信）はMetaの最適化AIが自動で最適な配信先を選択します">
                  <InfoCircleOutlined style={{ marginLeft: 8 }} />
                </Tooltip>
              </span>
            }
            rules={[{ required: true }]}
          >
            <Radio.Group size="large">
              <Radio.Button value="auto">
                <div>
                  <div style={{ fontWeight: 'bold' }}>Advantage+配信（推奨）</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>AI自動最適化</div>
                </div>
              </Radio.Button>
              <Radio.Button value="manual" onClick={() => setAutoPlacement(false)}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>手動配信</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>配信先を詳細指定</div>
                </div>
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          {!autoPlacement && (
            <Form.Item label="配信プラットフォーム・場所">
              <Checkbox.Group style={{ width: '100%' }}>
                <Row gutter={[16, 16]}>
                  {placements.map(placement => (
                    <Col span={8} key={placement.value}>
                      <Checkbox value={placement.value}>
                        {placement.label}
                      </Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
            </Form.Item>
          )}

          <Divider />
          
          <Title level={5}>コンバージョン設定</Title>

          <Row gutter={isMobile ? 16 : 24}>
            <Col span={12}>
              <Form.Item
                name="conversion_location"
                label={<span>コンバージョン場所 <Text type="secondary">*</Text></span>}
                rules={[{ required: true }]}
              >
                <Select placeholder="ウェブサイト" size="large">
                  <Option value="website">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>ウェブサイト</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>ウェブサイトやランディングページ</div>
                    </div>
                  </Option>
                  <Option value="app">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>アプリ</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>モバイルアプリ內</div>
                    </div>
                  </Option>
                  <Option value="offline">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>オフライン</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>店舗や電話等のオフライン行動</div>
                    </div>
                  </Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="optimization_event"
                label={<span>最適化イベント <Text type="secondary">*</Text></span>}
                rules={[{ required: true }]}
              >
                <Select placeholder="コンバージョン" size="large">
                  <Option value="CONVERSION">コンバージョン</Option>
                  <Option value="PURCHASE">購入完了</Option>
                  <Option value="ADD_TO_CART">カート追加</Option>
                  <Option value="VIEW_CONTENT">ページ表示</Option>
                  <Option value="LEAD">リード獲得</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          
          <Title level={5}>ターゲティング設定</Title>

          <Row gutter={isMobile ? 16 : 24}>
            <Col span={12}>
              <Form.Item label="年齢範囲">
                <Slider
                  range
                  min={13}
                  max={65}
                  defaultValue={[25, 45]}
                  marks={{
                    13: '13',
                    25: '25',
                    45: '45',
                    65: '65+'
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="性別">
                <Radio.Group size="large">
                  <Radio.Button value="all">すべて</Radio.Button>
                  <Radio.Button value="male">男性</Radio.Button>
                  <Radio.Button value="female">女性</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="地域">
            <Select mode="multiple" placeholder="配信地域を選択" size="large">
              <Option value="JP">日本</Option>
              <Option value="US">アメリカ合衆国</Option>
              <Option value="CN">中国</Option>
              <Option value="KR">韓国</Option>
              <Option value="AU">オーストラリア</Option>
              <Option value="UK">イギリス</Option>
            </Select>
          </Form.Item>

          <Form.Item label="細かいターゲティング">
            <Select 
              mode="tags" 
              placeholder="興味関心を追加（例：プログラミング、料理、旅行）"
              size={isMobile ? 'middle' : 'large'}
              tokenSeparators={[',']}
            >
              <Option value="テクノロジー">テクノロジー</Option>
              <Option value="料理">料理</Option>
              <Option value="旅行">旅行</Option>
              <Option value="音楽">音楽</Option>
              <Option value="映画">映画</Option>
              <Option value="スポーツ">スポーツ</Option>
            </Select>
          </Form.Item>

          <Divider />
          
          <Title level={5}>アトリビューション設定</Title>

          <Form.Item label="アトリビューションウィンドウ">
            <Select placeholder="クリックから7日間" size="large">
              <Option value="click_1d">クリックから1日間</Option>
              <Option value="click_7d">クリックから7日間（推奨）</Option>
              <Option value="click_14d">クリックから14日間</Option>
              <Option value="click_28d">クリックから28日間</Option>
            </Select>
          </Form.Item>
        </div>
      ),
    },
    {
      title: t('adCreation'),
      icon: <PlayCircleOutlined />,
      content: (
        <div>
          <Form.Item
            name="ad_name"
            label={<span>広告名 <Text type="secondary">*</Text></span>}
            rules={[{ required: true, message: '広告名を入力してください' }]}
          >
            <Input 
              placeholder="例：女性向け新商品_メインバナー"
              size={isMobile ? 'middle' : 'large'}
            />
          </Form.Item>

          <Divider />
          
          <Title level={5}>
            <CameraOutlined style={{ marginRight: 8 }} />
            広告素材
          </Title>

          <Row gutter={isMobile ? 16 : 24}>
            <Col span={12}>
              <Form.Item
                name="image_upload"
                label={<span>メイン画像 <Text type="secondary">*</Text></span>}
                rules={[
                  { 
                    required: true, 
                    message: '画像をアップロードしてください' 
                  },
                  {
                    validator: (_, value) => {
                      console.log('Image validation - value:', value);
                      if (!value || !Array.isArray(value) || value.length === 0) {
                        return Promise.reject(new Error('画像ファイルを選択してください'));
                      }
                      const firstFile = value[0];
                      if (!firstFile || !firstFile.originFileObj) {
                        return Promise.reject(new Error('画像ファイルが正しく選択されていません'));
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <Upload
                  accept="image/*"
                  multiple
                  listType="picture-card"
                  className="ad-image-uploader"
                    fileList={imageUploadValue || []}
                  beforeUpload={(file: any) => {
                    console.log('BeforeUpload called with file:', file);
                    // ファイルのvalidation（例：サイズチェック）
                    const isLt2M = file.size / 1024 / 1024 < 2; // 2MB以下
                    if (!isLt2M) {
                      message.error('画像は2MB以下でアップロードしてください！');
                      return false;
                    }
                    return false; // 自動アップロードは無効
                  }}
                  onRemove={(file: any) => {
                    // ファイル削除時の処理
                    console.log('File removed:', file);
                    
                    // プレビューURLをクリーンアップ（メモリリーク防止）
                    if (file.url && file.url.startsWith('blob:')) {
                      URL.revokeObjectURL(file.url);
                    }
                    
                    // フォームフィールドから削除
                    const currentFiles = form.getFieldValue('image_upload') || [];
                    const remainingFiles = currentFiles.filter((f: any) => f.uid !== file.uid);
                    form.setFieldValue('image_upload', remainingFiles);
                    
                    // プレビュー画像を更新
                    const remainingUrls = remainingFiles.map((f: any) => {
                      if (f.url) return f.url;
                      if (f.thumbUrl) return f.thumbUrl;
                      if (f.originFileObj) return URL.createObjectURL(f.originFileObj);
                      return null;
                    }).filter(Boolean);
                    setPreviewImages(remainingUrls);
                    
                    // Boxファイル情報もクリア（削除されたファイルがBoxファイルの場合）
                    if (file.box_file_id) {
                      form.setFieldValue('box_file_id', undefined);
                      form.setFieldValue('box_account_id', undefined);
                    }
                    
                    return true; // 削除を許可
                  }}
                  onChange={(info: any) => {
                    console.log('=== Upload onChange Debug ===');
                    console.log('info:', info);
                    console.log('fileList:', info.fileList);
                    console.log('file:', info.file);
                    
                    // 個別ファイルの情報をログ出力
                    info.fileList.forEach((file: any, index: number) => {
                      console.log(`File ${index}:`, {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        originFileObj: file.originFileObj,
                        status: file.status,
                        percent: file.percent
                      });
                    });
                    
                    // プレビュー用URLの作成
                    const files = info.fileList.map((file: any) => {
                      if (file.url) return file.url;
                      if (file.thumbUrl) return file.thumbUrl;
                      if (file.originFileObj) return URL.createObjectURL(file.originFileObj);
                      return null;
                    }).filter(Boolean);
                    setPreviewImages(files);
                    console.log('Preview URLs created:', files);
                    
                    // フォームフィールドにファイルオブジェクトを設定
                    const validFiles = info.fileList
                      .filter((file: any) => !file.error && file.status !== 'error')
                      .map((file: any) => ({
                        ...file,
                        // originFileObjが存在することを確認
                        originFileObj: file.originFileObj || file
                      }));
                    
                    console.log('Setting files to form field "image_upload"');
                    form.setFieldValue('image_upload', validFiles);
                    
                    // 設定後すぐに確認
                    const confirmationValue = form.getFieldValue('image_upload');
                    console.log('Form field confirmation:', confirmationValue);
                    console.log('Valid files set to form:', validFiles);
                    console.log('=== Upload onChange Debug End ===');
                  }}
                >
                  {(!imageUploadValue || imageUploadValue.length === 0) && (
                    <div>
                      <PlusOutlined />
                      <div style={{ marginTop: 8 }}>画像をアップロード</div>
                    </div>
                  )}
                </Upload>
                <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                  推奨サイズ：1080×1080px以上
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button 
                    type="dashed" 
                    onClick={async () => {
                      try {
                        const accounts = await boxAccountService.fetchBoxAccounts();
                        setBoxAccounts(accounts);
                        if (accounts.length === 0) {
                          message.warning('Boxアカウントが登録されていません。設定ページでBoxアカウントを連携してください。');
                          return;
                        }
                        setBoxFilesModalVisible(true);
                        if (accounts.length === 1) {
                          setSelectedBoxAccount(accounts[0].id);
                          await loadBoxFiles(accounts[0].id);
                        }
                      } catch (error) {
                        console.error('Failed to fetch Box accounts:', error);
                        message.error('Boxアカウントの取得に失敗しました');
                      }
                    }}
                  >
                    Boxから選択
                  </Button>
                  <Button 
                    type="default" 
                    danger
                    onClick={() => {
                      // 画像をクリア
                      const currentFiles = form.getFieldValue('image_upload') || [];
                      if (currentFiles.length > 0) {
                        // プレビューURLをクリーンアップ
                        currentFiles.forEach((file: any) => {
                          if (file.url && file.url.startsWith('blob:')) {
                            URL.revokeObjectURL(file.url);
                          }
                        });
                        setPreviewImages([]);
                        form.setFieldValue('image_upload', []);
                        form.setFieldValue('box_file_id', undefined);
                        form.setFieldValue('box_account_id', undefined);
                        message.success('画像をクリアしました');
                      } else {
                        message.info('クリアする画像がありません');
                      }
                    }}
                    disabled={!imageUploadValue || imageUploadValue.length === 0}
                  >
                    選択画像をクリア
                  </Button>
                </div>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="画像サイズ別最適化">
                <div style={{ width: '100%' }}>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>ストーリーズ用（縦長）:</Text>
                    <Switch size="small" style={{ marginLeft: 8 }} />
                    <Text type="secondary" style={{ marginLeft: 8 }}>1080×1920px</Text>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>インストリーム動画:</Text>
                    <Switch size="small" /> 
                    <Text type="secondary" style={{ marginLeft: 8 }}>1280×720px</Text>
                  </div>
                  <div>
                    <Text strong>Audience Network:</Text>
                    <Switch size="small" />
                    <Text type="secondary" style={{ marginLeft: 8 }}>1080×1350px</Text>
                  </div>
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Divider />
           
          <Title level={5}>テキスト要素</Title>

          <Form.Item
            name="headline"
            label={<span>見出し <Text type="secondary">*</Text></span>}
            rules={[{ required: true, message: '見出しを入力してください' }]}
          >
            <Input 
              placeholder="魅力的な見出しを入力してください（最大40文字）"
              size={isMobile ? 'middle' : 'large'}
              maxLength={40}
              showCount
            />
          </Form.Item>

           
          <Form.Item
            name="description"
            label={<span>説明文 <Text type="secondary">*</Text></span>}
            rules={[{ required: true, message: '説明文を入力してください' }]}
          >
            <TextArea 
              placeholder="商品やサービスの詳細を説明してください（最大125文字）"
              rows={3}
              maxLength={125}
              showCount
              size={isMobile ? 'middle' : 'large'}
            />
          </Form.Item>

          <Row gutter={isMobile ? 16 : 24}>
            <Col span={12}>
              <Form.Item
                name="website_url"
                label={<span>ウェブサイトURL <Text type="secondary">*</Text></span>}
                rules={[{ required: true, message: 'URLを入力してください' }]}
              >
                <Input 
                  placeholder="https://your-website.com"
                  size={isMobile ? 'middle' : 'large'}
                  addonBefore={<GlobalOutlined />}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cta"
                label={<span>コールトゥーアクション</span>}
                rules={[{ required: true }]}
              >
                <Select placeholder="アクションを選択" size="large">
                  {ctaOptions.map(cta => (
                    <Option key={cta.value} value={cta.value}>
                      {cta.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="facebook_page_id"
            label={<span>FacebookページID <Text type="secondary">*</Text></span>}
            rules={[
              { 
                validator: (_, value) => {
                  if (!value || value.trim().length === 0) {
                    return Promise.reject(new Error('FacebookページIDを入力してください'));
                  }
                  if (value.trim().length < 10) {
                    return Promise.reject(new Error('ページIDは10文字以上で入力してください'));
                  }
                  if (!/^\d+$/.test(value.trim())) {
                    return Promise.reject(new Error('ページIDは数字のみで入力してください'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input 
              placeholder="FacebookページIDを入力してください"
              size={isMobile ? 'middle' : 'large'}
              addonBefore={<FacebookOutlined />}
              suffix={
                <Tooltip title="Graph APIでページIDを確認できます: GET /me/accounts">
                  <QuestionCircleOutlined />
                </Tooltip>
              }
            />
          </Form.Item>

          <Alert
            message="FacebookページIDについて"
            description={
              <div>
                <p>広告を作成するためにFacebookページIDが必要です。</p>
                <p>✓ Graph APIで確認: <code>GET /me/accounts</code></p>
                <p>✓ Meta Business Managerでページを選択</p>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Divider />
          
          <Title level={5}>プレビュー</Title>

          <Row gutter={isMobile ? 16 : 24}>
            <Col span={12}>
              <Alert
                message="広告プレビュー - Facebook Feed"
                description="選択された画像とテキストでFacebookのフィードにどのように表示されるかを表示しています"
                type="info"
                showIcon
              />
              <div style={{ 
                border: '1px solid #d9d9d9', 
                borderRadius: 8, 
                padding: '16px', 
                backgroundColor: '#fff',
                marginTop: 16,
                textAlign: 'center'
              }}>
                {previewImages.length > 0 ? (
                  <div>
                    <img 
                      src={previewImages[0]} 
                      style={{ width: '100%', maxWidth: 400, borderRadius: 4 }}
                      alt="手動アップロード画像（プレビュー）"
                    />
                    <Alert 
                      message="✅ 手動アップロード画像" 
                      description="この画像が広告で使用されます"
                      type="success" 
                      style={{ marginTop: 8, textAlign: 'left' }}
                    />
                  </div>
                ) : (
                  <div style={{ padding: '40px', color: '#999' }}>
                    <CameraOutlined style={{ fontSize: '32px', marginBottom: 8 }} />
                    <div>画像をアップロードしてプレビューを確認</div>
                    <Alert 
                      message="⚠️ Webサイトサムネイルが表示される可能性" 
                      description="画像をアップロードしない場合、webサイトURLから自動取得されたサムネイルが使用されます"
                      type="warning" 
                      style={{ marginTop: 16, textAlign: 'left' }}
                    />
                  </div>
                )}
                <div style={{ marginTop: 12, textAlign: 'left' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                    {form.getFieldValue('headline') || '広告の見出しがここに表示されます'}
                  </div>
                  <div style={{ fontSize: '14px', marginBottom: 8 }}>
                    {form.getFieldValue('description') || '商品やサービスの詳細説明がここに表示されます。特徴やメリットを簡潔に伝えましょう。'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: 8 }}>
                    {form.getFieldValue('website_url') ? new URL(form.getFieldValue('website_url')).hostname : 'your-website.com'}
                  </div>
                  <Button type="primary" size="small">
                    {form.getFieldValue('cta') === 'SHOP_NOW' ? 'ショッピング' : 
                     form.getFieldValue('cta') === 'LEARN_MORE' ? '詳細を見る' :
                     form.getFieldValue('cta') === 'SIGN_UP' ? '登録する' :
                     form.getFieldValue('cta') === 'DOWNLOAD' ? 'ダウンロード' :
                     '詳細を見る'}
                  </Button>
                </div>
              </div>
            </Col>
            <Col span={12}>
              <Alert
                message="広告プレビュー - Instagram Story"
                description="Instagram Storiesの縦型フォーマットでの表示を想定したプレビューです"
                type="info"
                showIcon
              />
              <div style={{ 
                border: '1px solid #d9d9d9', 
                borderRadius: 8, 
                padding: '16px', 
                backgroundColor: '#fff',
                marginTop: 16,
                textAlign: 'center'
              }}>
                {previewImages.length > 0 ? (
                  <div style={{ display: 'inline-block', width: '50%', maxWidth: 200 }}>
                    <img 
                      src={previewImages[0]} 
                      style={{ 
                        width: '100%', 
                        aspectRatio: '9/16',
                        borderRadius: 4,
                        objectFit: 'cover'
                      }}
                      alt="Instagram Story プレビュー"
                    />
                  </div>
                ) : (
                  <div style={{ padding: '40px', color: '#999' }}>
                    <div style={{ fontSize: '48px', marginBottom: 8 }}>📱</div>
                    <div>ストーリーズ用画像をアップロード</div>
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      title: t('confirmationSubmission'),
      icon: <EyeOutlined />,
      content: (
        <div>
          <Progress percent={100} status="success" />
          
          <Title level={4}>広告設定の確認</Title>
          
          <Alert
            message="投稿準備完了"
            description="すべての設定が完了しました。以下の内容で広告を投稿するには「投稿する」ボタンをクリックしてください。"
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Row gutter={isMobile ? 16 : 24}>
            <Col span={12}>
              <Card size="small" title="キャンペーン設定">
                <div style={{ lineHeight: '1.8' }}>
                  <div><Text type="secondary">キャンペーン名:</Text> 新商品プロモーション_2024年1月</div>
                  <div><Text type="secondary">目的:</Text> 売上</div>
                  <div><Text type="secondary">予算:</Text> ¥10,000 (日予算)</div>
                  <div><Text type="secondary">期間:</Text> 2024/01/01 〜 継続</div>
                  <div><Text type="secondary">入札戦略:</Text> 最大数量</div>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="ターゲティング設定">
                <div style={{ lineHeight: '1.8' }}>
                  <div><Text type="secondary">年齢:</Text> 25-45歳</div>
                  <div><Text type="secondary">性別:</Text> すべて</div>
                  <div><Text type="secondary">地域:</Text> 日本</div>
                  <div><Text type="secondary">配信:</Text> Advantage+配信</div>
                  <div><Text type="secondary">ウィンドウ:</Text> クリックから7日間</div>
                </div>
              </Card>
            </Col>
          </Row>

          <Card size="small" title="広告素材" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={6}>
                {(() => {
                  const imageUpload = imageUploadValue || form.getFieldValue('image_upload');
                  const imageUrl = imageUpload && imageUpload.length > 0 
                    ? (imageUpload[0].url || (imageUpload[0].originFileObj ? URL.createObjectURL(imageUpload[0].originFileObj) : null))
                    : null;
                  
                  return imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt="広告画像" 
                      style={{ 
                        width: '100%', 
                        maxWidth: 120, 
                        height: 120, 
                        objectFit: 'cover', 
                        borderRadius: 4,
                        border: '1px solid #d9d9d9'
                      }} 
                    />
                  ) : (
                    <Avatar 
                      shape="square" 
                      size={80} 
                      style={{ backgroundColor: '#f0f0f0' }}
                      icon={<CameraOutlined />}
                    />
                  );
                })()}
              </Col>
              <Col span={18}>
                <div style={{ lineHeight: '1.8' }}>
                  <div><Text type="secondary">広告名:</Text> <Text strong>{form.getFieldValue('ad_name') || '未設定'}</Text></div>
                  <div><Text type="secondary">見出し:</Text> <Text strong>{form.getFieldValue('headline') || '未設定'}</Text></div>
                  <div><Text type="secondary">説明文:</Text> <Text strong>{form.getFieldValue('description') || '未設定'}</Text></div>
                  <div><Text type="secondary">CTA:</Text> <Text strong>{form.getFieldValue('cta') || '未設定'}</Text></div>
                  <div><Text type="secondary">URL:</Text> <Text strong>{form.getFieldValue('website_url') || '未設定'}</Text></div>
                </div>
              </Col>
            </Row>
          </Card>

          <Divider />
          
          <Alert
            message={campaignOff ? "キャンペーンは「オフ」状態で作成されます" : "キャンペーンは「オン」状態で作成されます"}
            description={campaignOff ? 
              "誤配信を防ぐため、キャンペーンは一時停止状態で作成されます。後で管理画面から手動で開始できます。" : 
              "設定した広告は即座に配信を開始します。配信開始前に内容を再確認してください。"
            }
            type={campaignOff ? "warning" : "success"}
            showIcon
            style={{ marginTop: 24 }}
          />
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 2) {
      // 現在のステップのフィールドのみバリデーション
      const currentStepFields = getCurrentStepFields(currentStep);
      form.validateFields(currentStepFields)
        .then(() => setCurrentStep(currentStep + 1))
        .catch((errorInfo) => {
          console.log('Validation failed:', errorInfo);
          message.warning('必要な情報を入力してください');
        });
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  // ステップごとのフィールドを取得
  const getCurrentStepFields = (step: number) => {
    switch (step) {
      case 0: // キャンペーン設定
        return ['campaign_name', 'meta_account_id', 'objective', 'budget_type', 'budget', 'start_date'];
      case 1: // セット設定
        return ['adset_name'];
      case 2: // 広告作成
        return ['ad_name', 'headline', 'description', 'website_url', 'facebook_page_id'];
      default:
        return [];
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  // デバッグ用：フォームの値を手動で設定
  const setDebugValues = () => {
    form.setFieldsValue({
      campaign_name: 'テストキャンペーン',
      objective: 'OUTCOME_SALES',
      budget: 10000,
      budget_type: 'DAILY',
      start_date: dayjs('2024-01-01'),
      end_date: dayjs('2024-12-31'),
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      adset_name: 'テスト広告セット',
      ad_name: 'テスト広告',
      headline: 'テスト見出し',
      description: 'テスト説明文',
      website_url: 'https://example.com',
      facebook_page_id: '', // 空にする
    });
    console.log('Debug values set');
    console.log('Form values after setting:', form.getFieldsValue());
  };

  // フォームの値をリアルタイムで監視
  const logFormValues = () => {
    const values = form.getFieldsValue();
    console.log('Current form values:', values);
    console.log('Selected meta account:', selectedMetaAccount);
    console.log('Meta accounts:', metaAccounts);
  };

  // 投稿成功後の状態管理を追加
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);

  // Box Content Pickerを開く関数
  const openBoxContentPicker = async (boxAccountId: number) => {
    try {
      // Boxアカウントのアクセストークンを取得
      const tokenData = await boxAccountService.getAccessToken(boxAccountId);
      
      // Box Content Pickerが利用可能か確認（スクリプトの読み込みを待つ）
      const checkBoxAvailable = (): Promise<any> => {
        return new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 50; // 5秒間待機
          
          const checkInterval = setInterval(() => {
            attempts++;
            const Box = (window as any).Box;
            
            if (Box && Box.ContentPicker) {
              clearInterval(checkInterval);
              resolve(Box);
            } else if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              reject(new Error('Box Content Pickerがタイムアウトしました。スクリプトが読み込まれていない可能性があります。'));
            }
          }, 100);
        });
      };
      
      let Box;
      try {
        Box = await checkBoxAvailable();
        console.log('Box object loaded:', Box);
        console.log('Box.ContentPicker:', Box.ContentPicker);
      } catch (error: any) {
        console.error('Box Content Picker not available:', error);
        message.error(`Box Content Pickerが読み込まれていません: ${error.message}`);
        return;
      }
      
      // コンテナ要素を作成（モーダルとして表示）
      let container = document.getElementById('box-content-picker-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'box-content-picker-container';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.zIndex = '10000';
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        document.body.appendChild(container);
      }
      
      // Box Content Pickerを初期化
      let contentPicker;
      try {
        // Box.ContentPickerが関数かコンストラクタかを確認
        console.log('Box.ContentPicker type:', typeof Box.ContentPicker);
        console.log('Box.ContentPicker:', Box.ContentPicker);
        
        // 両方の方法を試す
        if (typeof Box.ContentPicker === 'function') {
          // 関数として呼び出す場合
          try {
            contentPicker = Box.ContentPicker();
            console.log('Content Picker initialized as function');
          } catch (e1: any) {
            // コンストラクタとして呼び出す場合
            try {
              contentPicker = new Box.ContentPicker();
              console.log('Content Picker initialized as constructor');
            } catch (e2: any) {
              throw new Error(`Both methods failed: function=${e1?.message || 'unknown'}, constructor=${e2?.message || 'unknown'}`);
            }
          }
        } else {
          throw new Error('Box.ContentPicker is not a function');
        }
      } catch (initError: any) {
        console.error('Box Content Picker init error:', initError);
        console.error('Error stack:', initError.stack);
        message.error(`Box Content Pickerの初期化に失敗しました: ${initError.message}`);
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
        // フォールバック: 一覧表示モーダル
        setBoxFilesModalVisible(true);
        setSelectedBoxAccount(boxAccountId);
        await loadBoxFiles(boxAccountId);
        return;
      }
      
      // ファイル選択時のコールバック
      contentPicker.addListener('choose', async (items: any[]) => {
        if (items.length === 0) {
          return;
        }
        
        const selectedFile = items[0];
        const fileId = selectedFile.id;
        const fileName = selectedFile.name;
        
        try {
          message.info('Boxファイルをダウンロードしています...');
          
          // BoxファイルをダウンロードしてBlobに変換
          const blob = await boxAccountService.downloadFile(boxAccountId, fileId);
          
          // BlobをFileオブジェクトに変換
          const fileObj = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
          
          // プレビュー用URLを作成
          const previewUrl = URL.createObjectURL(fileObj);
          setPreviewImages([previewUrl]);
          
          // フォームフィールドに設定
          form.setFieldValue('image_upload', [{
            uid: fileId,
            name: fileName,
            status: 'done',
            url: previewUrl,
            originFileObj: fileObj,
            box_file_id: fileId,
            box_account_id: boxAccountId
          }]);
          
          // フォームにBox情報を保存（送信時に使用）
          form.setFieldValue('box_file_id', fileId);
          form.setFieldValue('box_account_id', boxAccountId);
          
          // 既存のプレビューURLをクリーンアップ（メモリリーク防止）
          if (previewImages.length > 0) {
            previewImages.forEach(url => {
              if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
              }
            });
          }
          
          // コンテナを削除
          if (container && container.parentNode) {
            container.parentNode.removeChild(container);
          }
          
          message.success('Boxファイルを選択しました');
        } catch (error) {
          console.error('Failed to download Box file:', error);
          message.error('Boxファイルのダウンロードに失敗しました');
        }
      });
      
      // キャンセル時のコールバック
      contentPicker.addListener('cancel', () => {
        console.log('Box Content Picker cancelled');
        // コンテナを削除
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
      });
      
      // エラー時のコールバック
      contentPicker.addListener('error', async (pickerError: any) => {
        console.error('Box Content Picker error:', pickerError);
        message.error(`Box Content Pickerエラー: ${pickerError?.message || '不明なエラー'}`);
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
        // フォールバック: 一覧表示モーダル
        setBoxFilesModalVisible(true);
        setSelectedBoxAccount(boxAccountId);
        await loadBoxFiles(boxAccountId);
      });

      // Content Pickerを表示
      console.log('Attempting to show Content Picker...');
      console.log('Access token length:', tokenData.access_token?.length);
      console.log('Container element:', document.getElementById('box-content-picker-container'));
      
      try {
        // 複数のAPI形式を試す
        let showSuccess = false;
        
        // 方法1: 標準的なAPI (accessToken, folderId, options)
        try {
          console.log('Trying method 1: show(accessToken, folderId, options)');
          contentPicker.show(tokenData.access_token, '0', {
            container: '#box-content-picker-container',
            modal: true,
            modalTitle: 'Boxから画像を選択',
            modalButtonLabel: '選択',
            selectableType: 'file',
            fileExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            size: 'large'
          });
          showSuccess = true;
          console.log('Content Picker shown successfully (method 1)');
        } catch (e1: any) {
          console.warn('Method 1 failed:', e1.message);
          
          // 方法2: オプションのみ (accessToken, options)
          try {
            console.log('Trying method 2: show(accessToken, options)');
            contentPicker.show(tokenData.access_token, {
              container: '#box-content-picker-container',
              modal: true,
              modalTitle: 'Boxから画像を選択',
              modalButtonLabel: '選択',
              selectableType: 'file',
              fileExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
              size: 'large'
            });
            showSuccess = true;
            console.log('Content Picker shown successfully (method 2)');
          } catch (e2: any) {
            console.warn('Method 2 failed:', e2.message);
            
            // 方法3: 最小限のオプション
            try {
              console.log('Trying method 3: minimal options');
              contentPicker.show(tokenData.access_token, null, {
                container: '#box-content-picker-container',
                modal: true,
                modalTitle: 'Boxから画像を選択',
                modalButtonLabel: '選択'
              });
              showSuccess = true;
              console.log('Content Picker shown successfully (method 3)');
            } catch (e3: any) {
              console.error('All methods failed:', { e1: e1.message, e2: e2.message, e3: e3.message });
              throw new Error(`All show methods failed. Last error: ${e3.message}`);
            }
          }
        }
        
        if (!showSuccess) {
          throw new Error('Content Picker show() did not succeed');
        }
      } catch (showError: any) {
        console.error('Box Content Picker show error:', showError);
        console.error('Error details:', {
          message: showError.message,
          stack: showError.stack,
          name: showError.name
        });
        message.error(`Box Content Pickerの表示に失敗しました: ${showError.message || '不明なエラー'}`);
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
        // フォールバック: 一覧表示モーダル
        setBoxFilesModalVisible(true);
        setSelectedBoxAccount(boxAccountId);
        await loadBoxFiles(boxAccountId);
      }
      
    } catch (error) {
      console.error('Failed to open Box Content Picker:', error);
      message.error('Box Content Pickerの起動に失敗しました');
    }
  };

  // Boxファイルを読み込む関数
  const loadBoxFiles = async (boxAccountId: number) => {
    setLoadingBoxFiles(true);
    setLoadingProgress(0);
    
    // 進捗をシミュレート（0%から90%まで徐々に増やす）
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        // 徐々に進捗を増やす（最初は速く、後半は遅く）
        const increment = prev < 50 ? 5 : prev < 80 ? 2 : 1;
        return Math.min(prev + increment, 90);
      });
    }, 500);
    
    try {
      message.info('Boxファイルの取得を開始しました。ファイル数が多い場合、処理に時間がかかる場合があります。', 5);
      const response = await boxAccountService.listFiles(boxAccountId);
      
      // 進捗を100%に
      clearInterval(progressInterval);
      setLoadingProgress(100);
      
      const files = response.files || [];
      setBoxFiles(files);
      
      // サムネイルの読み込み状態を初期化（すべて読み込み中として設定）
      const initialLoadingStates: Record<string, 'loading' | 'loaded' | 'error'> = {};
      files.forEach(file => {
        if (file.thumbnail_url) {
          initialLoadingStates[file.id] = 'loading'; // 'loading' = 読み込み中
        }
      });
      setThumbnailLoadingStates(initialLoadingStates);
      if (!response.files || response.files.length === 0) {
        message.warning('画像・動画ファイルが見つかりませんでした。Boxアカウントに画像ファイル（jpg, jpeg, png, gif, webp）または動画ファイル（mp4, mov, avi等）が存在するか確認してください。');
      } else {
        message.success(`${response.files.length}件のメディアファイルを取得しました。`, 3);
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      console.error('Failed to load Box files:', error);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      const errorData = error.response?.data || {};
      const errorMessage = errorData.error || errorData.details || error.message || 'Boxファイルの取得に失敗しました';
      const requiresReauth = errorData.requires_reauth || false;
      const statusCode = error.response?.status;
      
      // 認証エラー（401）または再認証が必要な場合
      if (statusCode === 401 || requiresReauth) {
        message.error({
          content: 'Boxアカウントの認証が期限切れです。設定画面でBoxアカウントを再連携してください。',
          duration: 10,
        });
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        // タイムアウトエラーの場合は特別なメッセージを表示
        message.error('Boxファイルの取得がタイムアウトしました。ファイル数が非常に多い可能性があります。しばらく時間をおいて再度お試しください。', 10);
      } else {
        message.error(`Boxファイルの取得に失敗しました: ${errorMessage}`, 5);
      }
    } finally {
      setLoadingBoxFiles(false);
      setLoadingProgress(0);
    }
  };

  // Boxファイル選択時の処理
  const handleBoxFileSelect = async (file: BoxFile) => {
    if (!selectedBoxAccount) {
      message.error('Boxアカウントが選択されていません');
      return;
    }

    try {
      // BoxファイルをダウンロードしてBlobに変換
      const blob = await boxAccountService.downloadFile(selectedBoxAccount, file.id);
      
      // BlobをFileオブジェクトに変換
      const fileObj = new File([blob], file.name, { type: blob.type || 'image/jpeg' });
      
      // 既存のプレビューURLをクリーンアップ（メモリリーク防止）
      if (previewImages.length > 0) {
        previewImages.forEach(url => {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
      }
      
      // プレビュー用URLを作成
      const previewUrl = URL.createObjectURL(fileObj);
      setPreviewImages([previewUrl]);
      
      // フォームフィールドに設定
      form.setFieldValue('image_upload', [{
        uid: file.id,
        name: file.name,
        status: 'done',
        url: previewUrl,
        originFileObj: fileObj,
        box_file_id: file.id,
        box_account_id: selectedBoxAccount
      }]);
      
      // フォームにBox情報を保存（送信時に使用）
      form.setFieldValue('box_file_id', file.id);
      form.setFieldValue('box_account_id', selectedBoxAccount);
      
      setBoxFilesModalVisible(false);
      message.success('Boxファイルを選択しました');
    } catch (error) {
      console.error('Failed to select Box file:', error);
      message.error('Boxファイルの選択に失敗しました');
    }
  };

  // 画像をBase64に変換する関数（同期的バージョン）
  const convertImageToBase64Sync = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader result is not a string'));
        }
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      console.log('=== フォーム送信開始 ===');

      // 送信前にすべてのステップのフィールドを検証
      try {
        await form.validateFields();
      } catch (validationError: any) {
        console.error('フォーム検証エラー:', validationError);
        message.error('すべての必須項目を入力してください');
        setSubmitting(false);
        return;
      }

      // フォームの値を直接取得（強制取得で確実に値を取得）
      const formValues = form.getFieldsValue(true);
      console.log('フォームから直接取得した値:', formValues);
      
      // 画像フィールドの特別確認
      const imageUploadFromGetFieldsValue = formValues.image_upload;
      const imageUploadFromGetFieldValue = form.getFieldValue('image_upload');
      console.log('=== Image Field Debug ===');
      console.log('getFieldsValue().image_upload:', imageUploadFromGetFieldsValue);
      console.log('getFieldValue("image_upload"):', imageUploadFromGetFieldValue);
      console.log('=== Image Field Debug End ===');

      // FacebookページIDのチェック
      if (!formValues.facebook_page_id || formValues.facebook_page_id.trim().length === 0) {
        console.error('Facebook Page IDが入力されていません');
        message.error('FacebookページIDを入力してください');
        setSubmitting(false);
        return;
      }

      console.log('ユーザーが入力したFacebook Page ID:', formValues.facebook_page_id);

      // 必須フィールドのデフォルト値を設定
      const defaultMetaAccountId = selectedMetaAccount || (metaAccounts.length > 0 ? metaAccounts[0].id : 1);
      
      // ユーザー入力値をそのまま使用（デフォルト値で上書きしない）
      const finalValues = {
        campaign_name: formValues.campaign_name,
        objective: formValues.objective,
        budget: formValues.budget,
        budget_type: formValues.budget_type,
        start_date: formValues.start_date,
        end_date: formValues.end_date,
        bid_strategy: formValues.bid_strategy,
        meta_account_id: formValues.meta_account_id || defaultMetaAccountId,
        adset_name: formValues.adset_name,
        ad_name: formValues.ad_name,
        headline: formValues.headline,
        description: formValues.description,
        website_url: formValues.website_url,
        facebook_page_id: formValues.facebook_page_id.trim(),
        // 🔍 画像フィールドを明示的に追加
        image_upload: formValues.image_upload
      };
      
      console.log('=== Final Values Debug ===');
      console.log('finalValues.image_upload:', finalValues.image_upload);
      console.log('finalValues keys:', Object.keys(finalValues));
      console.log('=== Final Values Debug End ===');
      
      console.log('最終的なfinalValues:', finalValues);
      console.log('Facebook Page ID最終値:', finalValues.facebook_page_id);
      
      // 日付を適切な形式に変換
      const formatDate = (date: any) => {
        if (!date) return null;
        
        if (typeof date === 'string') return date;
        
        if (dayjs.isDayjs(date)) {
          return date.format('YYYY-MM-DD');
        }
        
        if (date && date.format) {
          return date.format('YYYY-MM-DD');
        }
        
        if (date instanceof Date) {
          return dayjs(date).format('YYYY-MM-DD');
        }
        
        // dayjsでパースを試行
        try {
          const parsed = dayjs(date);
          if (parsed.isValid()) {
            return parsed.format('YYYY-MM-DD');
          }
        } catch (error) {
          console.error('Date parsing failed:', error);
        }
        
        return null;
      };
      
      // 日付をフォーマット
      const formattedStartDate = formatDate(finalValues.start_date) || '2024-01-01';
      const formattedEndDate = formatDate(finalValues.end_date) || '2024-12-31';
      
      // 画像ファイルを取得 - Base64ではなくファイルオブジェクトを直接送信
      let imageFile = null;
      const imageUpload = (finalValues as any).image_upload;
      
      console.log('=== 画像処理デバッグ開始 ===');
      console.log('finalValues.image_upload:', imageUpload);
      console.log('typeof imageUpload:', typeof imageUpload);
      console.log('Array.isArray(imageUpload):', Array.isArray(imageUpload));
      
      if (imageUpload && Array.isArray(imageUpload) && imageUpload.length > 0) {
        const firstImage = imageUpload[0];
        console.log('firstImage:', firstImage);
        console.log('firstImage.originFileObj:', firstImage.originFileObj);
        
        const file = firstImage.originFileObj || firstImage;
        console.log('file object:', file);
        console.log('file instanceof File:', file instanceof File);
        
        if (file && file instanceof File) {
          console.log('ファイルオブジェクト確認 - 直接ファイルを送信:', {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          });
          
          // Base64エンコードではなく、ファイルオブジェクトを直接保存
          imageFile = file;
          console.log('✅ ファイルオブジェクトを直接保存:', !!imageFile);
          
          // フロントエンドでプレビュー用にBase64を生成（オプション）
          try {
            console.log('プレビュー用Base64生成を試行...');
            const previewBase64 = await convertImageToBase64Sync(file);
            console.log('プレビュー用Base64成功:', !!previewBase64);
          } catch (error) {
            console.log('プレビュー用Base64失敗（問題なし）:', error);
          }
          
        } else {
          console.error('Invalid file object:', file);
          console.error('File type:', typeof file);
          console.error('File instanceof File:', file instanceof File);
          message.error('無効なファイル形式です');
          imageFile = null;
        }
      } else {
        console.log('No image file found in upload data');
        imageFile = null;
      }
      
      console.log('=== 画像処理デバッグ終了 ===');

      // 画像ファイルが存在するかチェック
      if (!imageFile) {
        console.warn('⚠️ Image file is null - will fallback to website thumbnail');
        message.warning('画像ファイルが読み込まれませんでした。ウェブサイトのサムネイルが使用される可能性があります。');
      }

      // Boxファイル情報を取得
      const boxFileId = formValues.box_file_id;
      const boxAccountId = formValues.box_account_id;
      
      const campaignData = {
        name: finalValues.campaign_name,
        objective: finalValues.objective,
        budget: finalValues.budget,
        budget_type: finalValues.budget_type,
        start_date: formattedStartDate,
        end_date: formattedEndDate,
        bid_strategy: finalValues.bid_strategy,
        meta_account_id: finalValues.meta_account_id,
        adset_name: finalValues.adset_name,
        ad_name: finalValues.ad_name,
        headline: finalValues.headline,
        description: finalValues.description,
        website_url: finalValues.website_url,
        facebook_page_id: finalValues.facebook_page_id,
        // ファイルデータをクリエイティブフィールドに追加（FormData形式）
        image_file: imageFile || undefined,
        // Boxファイル情報（Boxから選択した場合）
        box_file_id: boxFileId || undefined,
        box_account_id: boxAccountId || undefined
      };
      
      console.log('=== Campaign Data Debug ===');
      console.log('Image file included:', !!campaignData.image_file);
      console.log('Image file details:', campaignData.image_file ? {
        name: campaignData.image_file.name,
        size: campaignData.image_file.size,
        type: campaignData.image_file.type
      } : null);
      console.log('=== Campaign Data Debug End ===');
      
      console.log('送信するキャンペーンデータ:', campaignData);
      
      // 必須フィールドのチェック
      const missingFields = [];
      if (!campaignData.name) missingFields.push('name');
      if (!campaignData.objective) missingFields.push('objective');
      if (!campaignData.budget) missingFields.push('budget');
      if (!campaignData.budget_type) missingFields.push('budget_type');
      if (!campaignData.start_date) missingFields.push('start_date');
      if (!campaignData.meta_account_id) missingFields.push('meta_account_id');
      if (!campaignData.facebook_page_id) missingFields.push('facebook_page_id');
      
      if (missingFields.length > 0) {
        throw new Error(`送信データが不完全です。不足フィールド: ${missingFields.join(', ')}`);
      }
      
      // キャンペーンを作成
      const campaign = await campaignService.createCampaign(campaignData);
      console.log('Campaign created:', campaign);
      
      // Meta APIに投稿
      const submissionResult = await campaignService.submitToMeta(campaign.id);
      console.log('Meta submission started:', submissionResult);
      
      // 投稿結果を保存
      setSubmissionResult({
        campaign: campaign,
        submission: submissionResult,
        timestamp: new Date().toISOString()
      });
      setShowSubmissionDetails(true);
      
      message.success(`キャンペーン作成完了！Meta APIへの投稿を開始しました。`);
      
      // 開発環境でも実際のMeta APIに接続されることを表示
      if (process.env.NODE_ENV === 'development') {
        console.log('開発環境でも実際のMeta APIに接続されます。デモトークンまたは接続エラーの場合はデモモードで動作します。');
      }
      
    } catch (error: any) {
      console.error('=== エラー発生 ===');
      console.error('Submission failed:', error);
      console.error('Error type:', typeof error);
      console.error('Error keys:', Object.keys(error || {}));
      
      // エラーレスポンスの詳細を確認
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', error.response.data);
        console.error('Error response headers:', error.response.headers);
      }
      
      // より詳細なエラーメッセージを表示
      let errorMessage = 'Unknown error';
      
      try {
        if (error.response?.data) {
          const errorData = error.response.data;
          console.log('Processing error response data:', errorData);
          
          if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else if (errorData.detail) {
            errorMessage = typeof errorData.detail === 'string' 
              ? errorData.detail 
              : JSON.stringify(errorData.detail);
          } else if (errorData.error) {
            errorMessage = typeof errorData.error === 'string'
              ? errorData.error
              : JSON.stringify(errorData.error);
          } else if (errorData.message) {
            errorMessage = typeof errorData.message === 'string'
              ? errorData.message
              : JSON.stringify(errorData.message);
          } else if (errorData.non_field_errors) {
            errorMessage = Array.isArray(errorData.non_field_errors) 
              ? errorData.non_field_errors.join(', ') 
              : JSON.stringify(errorData.non_field_errors);
          } else {
            // フィールドごとのエラーをまとめる
            const fieldErrors = Object.entries(errorData)
              .map(([field, errors]: [string, any]) => {
                if (Array.isArray(errors)) {
                  return `${field}: ${errors.join(', ')}`;
                }
                return `${field}: ${JSON.stringify(errors)}`;
              })
              .join('; ');
            errorMessage = fieldErrors || 'Validation error';
          }
        } else if (error.message) {
          errorMessage = error.message;
        } else if (error.error) {
          errorMessage = JSON.stringify(error.error);
        } else {
          errorMessage = JSON.stringify(error);
        }
      } catch (parseError) {
        console.error('Error parsing error message:', parseError);
        errorMessage = `Error: ${error.status || error.statusCode || JSON.stringify(error)}`;
      }
      
      console.log('Final error message:', errorMessage);
      message.error(`投稿に失敗しました: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 投稿結果詳細コンポーネント
  const SubmissionDetailsModal = () => {
    if (!showSubmissionDetails || !submissionResult) return null;
    
    return (
      <Modal
        title="キャンペーン投稿完了"
        open={showSubmissionDetails}
        onCancel={() => setShowSubmissionDetails(false)}
        footer={[
          <Button key="close" onClick={() => setShowSubmissionDetails(false)}>
            閉じる
          </Button>,
          <Button key="view" type="primary" onClick={() => {
            // キャンペーン一覧ページに遷移
            window.location.href = '/campaigns';
          }}>
            キャンペーン一覧を見る
          </Button>
        ]}
        width={800}
      >
        <div style={{ marginBottom: 20 }}>
          <Alert
            message="キャンペーンが正常に作成されました"
            description="Meta APIへの投稿も完了しています。"
            type="success"
            showIcon
          />
        </div>
        
        <Row gutter={16}>
          <Col span={12}>
            <Card title="キャンペーン情報" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="キャンペーン名">
                  {submissionResult.campaign.name}
                </Descriptions.Item>
                <Descriptions.Item label="目的">
                  {submissionResult.campaign.objective}
                </Descriptions.Item>
                <Descriptions.Item label="予算">
                  {submissionResult.campaign.budget}円
                </Descriptions.Item>
                <Descriptions.Item label="開始日">
                  {dayjs(submissionResult.campaign.start_date).format('YYYY-MM-DD')}
                </Descriptions.Item>
                <Descriptions.Item label="終了日">
                  {dayjs(submissionResult.campaign.end_date).format('YYYY-MM-DD')}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          
          <Col span={12}>
            <Card title="Meta API投稿結果" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="タスクID">
                  <code>{submissionResult.submission.task_id}</code>
                </Descriptions.Item>
                <Descriptions.Item label="ステータス">
                  <Tag color="processing">投稿完了</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="投稿時刻">
                  {dayjs(submissionResult.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="実行環境">
                  <Tag color="blue">開発環境</Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>
        
        <div style={{ marginTop: 20 }}>
          <Alert
            message="開発環境での動作について"
            description={
              <div>
                <p>• デモトークンが使用されているため、実際のMeta APIには接続されていません</p>
                <p>• デモ用のキャンペーンID、AdSet ID、Ad IDが生成されています</p>
                <p>• 実際のMeta APIに投稿するには、設定画面で有効なアクセストークンを設定してください</p>
              </div>
            }
            type="info"
            showIcon
          />
        </div>
      </Modal>
    );
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            {t('metaAdSubmissionSystem')}
          </Title>
          <Text type="secondary">
            {t('metaAdSubmissionDescription')}
          </Text>
        </div>

        <Steps 
          current={currentStep} 
          style={{ marginBottom: 32 }}
          type="navigation"
          direction={isMobile ? 'vertical' : 'horizontal'}
          size={isMobile ? 'default' : 'default'}
        >
          {steps.map((item, index) => (
            <Step 
              key={index} 
              title={item.title} 
              icon={item.icon}
              status={index === currentStep ? 'process' : 
                     index < currentStep ? 'finish' : 'wait'}
            />
          ))}
        </Steps>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            // ユーザー入力値を正しく取得するため、必須初期値のみ設定
            budget_type: 'DAILY',
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
            meta_account_id: 1 // MetaアカウントIDはデフォルト値
            // facebook_page_idは初期値を設定せず、ユーザー入力のみ受け取る
          }}
        >
          <Card 
            title={steps[currentStep].title}
            style={{ marginBottom: 24 }}
          >
            {steps[currentStep].content}
          </Card>
        </Form>

        <div style={{ textAlign: 'center' }}>
          {/* デバッグ用ボタン */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{ marginBottom: 16 }}>
              <Button 
                onClick={setDebugValues}
                type="dashed"
                size="small"
                style={{ marginRight: 8 }}
              >
                {t('testValuesSet')}
              </Button>
              <Button 
                onClick={logFormValues}
                type="dashed"
                size="small"
              >
                {t('checkFormValues')}
              </Button>
              <Button 
                onClick={() => {
                  console.log('Form values:', form.getFieldsValue());
                }}
                type="dashed"
                size="small"
                style={{ marginLeft: 8 }}
              >
                {t('formValuesCheck')}
              </Button>
              <Button 
                onClick={() => {
                  console.log('=== IMAGE DEBUG DEBUG ===');
                  console.log('Preview Images State:', previewImages);
                  const imageUpload = form.getFieldValue('image_upload');
                  console.log('Image Upload Field:', imageUpload);
                  if (imageUpload && Array.isArray(imageUpload)) {
                    imageUpload.forEach((file: any, index: number) => {
                      console.log(`File ${index}:`, {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        originFileObj: file.originFileObj,
                        url: file.url,
                        thumbUrl: file.thumbUrl
                      });
                    });
                  }
                  console.log('=== IMAGE DEBUG END ===');
                }}
                type="dashed"
                size="small"
                style={{ marginLeft: 8 }}
              >
                {t('imageDebug')}
              </Button>
            </div>
          )}
          
          <Button 
            onClick={handlePrevious}
            disabled={currentStep === 0}
            icon={<LeftOutlined />}
            size={isMobile ? 'middle' : 'large'}
            style={{ marginRight: 16 }}
          >
            {t('previous')}
          </Button>
          
          {currentStep === steps.length - 1 ? (
            <Button 
              type="primary" 
              loading={submitting}
              icon={<SaveOutlined />}
              size={isMobile ? 'middle' : 'large'}
              onClick={async () => {
                try {
                  // フォームの値を取得して送信（フォームの状態を確認）
                  const formValues = form.getFieldsValue();
                  console.log('ボタンクリック時のフォーム値:', formValues);
                  
                  if (Object.keys(formValues).length === 0) {
                    console.error('フォームの値が空です。getFieldsValue()を使用して再取得');
                    // getFieldsValue()で全フィールドを強制取得
                    const allValues = form.getFieldsValue(true);
                    console.log('強制取得したフォーム値:', allValues);
                    
                    if (Object.keys(allValues).length === 0) {
                      console.error('フォームに値が保存されていません');
                      // 最後の手段：フォームのフィールドを個別にチェック
                      const fieldNames = [
                        'campaign_name', 'meta_account_id', 'objective', 'budget_type', 'budget', 
                        'start_date', 'end_date', 'bid_strategy', 'adset_name', 'ad_name', 
                        'headline', 'description', 'website_url', 'facebook_page_id'
                      ];
                      
                      const individualValues: any = {};
                      fieldNames.forEach(fieldName => {
                        const fieldValue = form.getFieldValue(fieldName);
                        if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                          individualValues[fieldName] = fieldValue;
                        }
                      });
                      
                      console.log('個別フィールド取得の結果:', individualValues);
                      
                      if (Object.keys(individualValues).length === 0) {
                        message.error(t('formValuesEmpty'));
                        return;
                      }
                      
                      await handleSubmit(individualValues);
                      return;
                    }
                    
                    await handleSubmit(allValues);
                  } else {
                    await handleSubmit(formValues);
                  }
                } catch (error) {
                  console.error('送信エラー:', error);
                  message.error(t('requiredFieldsIncomplete'));
                }
              }}
            >
              {t('submitAd')}
            </Button>
          ) : (
            <Button 
              type="primary" 
              onClick={handleNext}
              icon={<RightOutlined />}
              size={isMobile ? 'middle' : 'large'}
            >
              {t('nextStep')}
            </Button>
          )}
        </div>
      </Card>

      {/* 投稿結果詳細モーダル */}
      <SubmissionDetailsModal />

      {/* Boxファイル選択モーダル */}
      <Modal
        title="Boxから画像を選択"
        open={boxFilesModalVisible}
        onCancel={() => {
          setBoxFilesModalVisible(false);
          setBoxFiles([]);
          setSelectedBoxAccount(null);
        }}
        footer={null}
        width={800}
      >
        {boxAccounts.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>Boxアカウント:</Text>
            <Select
              style={{ width: 300, marginLeft: 8 }}
              placeholder="Boxアカウントを選択"
              value={selectedBoxAccount}
              onChange={async (value) => {
                setSelectedBoxAccount(value);
                await loadBoxFiles(value);
              }}
            >
              {boxAccounts.map(account => (
                <Option key={account.id} value={account.id}>
                  {account.account_name}
                </Option>
              ))}
            </Select>
          </div>
        )}

        {loadingBoxFiles ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Progress 
              type="circle" 
              percent={loadingProgress}
              format={(percent) => `${percent}%`}
            />
            <div style={{ marginTop: 16, fontSize: 16, fontWeight: 500 }}>
              Boxファイルを読み込んでいます...
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              ファイル数が多い場合、最大5分程度かかる場合があります
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
              しばらくお待ちください...
            </div>
          </div>
        ) : boxFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">画像ファイルが見つかりませんでした</Text>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
            {boxFiles.map((file, index) => {
              // thumbnail_urlが既にフルパスの場合はそのまま使用、相対パスの場合はAPI URLを追加
              let thumbnailUrl = null;
              if (file.thumbnail_url) {
                if (file.thumbnail_url.startsWith('http://') || file.thumbnail_url.startsWith('https://')) {
                  thumbnailUrl = file.thumbnail_url;
                } else {
                  // 相対パスの場合、/api/で始まっている場合は/api/を削除してから結合（重複を防ぐ）
                  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
                  let path = file.thumbnail_url;
                  // /api/で始まる場合は削除（baseUrlに既に/api/が含まれているため）
                  if (path.startsWith('/api/')) {
                    path = path.substring(4); // '/api/'を削除
                  } else if (path.startsWith('api/')) {
                    path = path.substring(4); // 'api/'を削除
                  }
                  // baseUrlが/api/で終わっているか確認
                  const cleanBaseUrl = baseUrl.endsWith('/api') ? baseUrl : (baseUrl.endsWith('/api/') ? baseUrl.slice(0, -1) : baseUrl);
                  thumbnailUrl = `${cleanBaseUrl}${path.startsWith('/') ? path : '/' + path}`;
                }
              }
              
              // 最初の12枚（最初の画面に表示される分）は優先読み込み、それ以降は遅延読み込み
              const shouldLazyLoad = index >= 12;
              
              return (
              <div
                key={file.id}
                style={{
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  padding: 8,
                  cursor: 'pointer',
                  textAlign: 'center',
                    transition: 'all 0.3s',
                    backgroundColor: '#fff'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#1890ff';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#d9d9d9';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onClick={() => handleBoxFileSelect(file)}
              >
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={file.name}
                      loading={shouldLazyLoad ? "lazy" : "eager"}
                      style={{
                        width: '100%',
                        height: '120px',
                        objectFit: 'cover',
                        borderRadius: 4,
                        marginBottom: 8,
                        backgroundColor: '#f5f5f5',
                        display: thumbnailLoadingStates[file.id] === 'error' ? 'none' : 'block'
                      }}
                      onLoad={() => {
                        // 画像の読み込みが完了したら、読み込み状態を'loaded'に設定
                        setThumbnailLoadingStates(prev => ({ ...prev, [file.id]: 'loaded' }));
                      }}
                      onError={(e) => {
                        // サムネイル読み込み失敗時はプレースホルダーを表示
                        setThumbnailLoadingStates(prev => ({ ...prev, [file.id]: 'error' }));
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const placeholder = target.nextElementSibling as HTMLElement;
                        if (placeholder && placeholder.classList.contains('thumbnail-placeholder')) {
                          placeholder.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div 
                    className="thumbnail-placeholder"
                    style={{
                      width: '100%',
                      height: '120px',
                      backgroundColor: '#f5f5f5',
                      borderRadius: 4,
                      marginBottom: 8,
                      display: (thumbnailUrl && thumbnailLoadingStates[file.id] === 'error') ? 'flex' : (thumbnailUrl ? 'none' : 'flex'),
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#999',
                      fontSize: 12,
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <span style={{ fontSize: 32 }}>🖼️</span>
                    <span>{thumbnailUrl ? (thumbnailLoadingStates[file.id] === 'error' ? '読み込み失敗' : '読み込み中...') : '画像なし'}</span>
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  {file.name}
                </div>
                <div style={{ fontSize: 10, color: '#999' }}>
                    {file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB` : 'サイズ不明'}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdSubmission;
