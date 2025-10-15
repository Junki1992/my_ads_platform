import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Input,
  Card,
  List,
  Typography,
  Space,
  Tag,
  Divider,
  Tooltip,
  message
} from 'antd';
import {
  QuestionCircleOutlined,
  BookOutlined,
  PlayCircleOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import helpService, { HelpArticle } from '../services/helpService';

const { Title, Text, Paragraph } = Typography;

// HelpItem interface is now replaced by HelpArticle from helpService

interface HelpSystemProps {
  page?: string;
  showQuickHelp?: boolean;
  context?: string;
}

const HelpSystem: React.FC<HelpSystemProps> = ({ 
  page, 
  showQuickHelp = true, 
  context 
}): React.ReactElement => {
  const { t, i18n } = useTranslation();
  const [helpVisible, setHelpVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState<HelpArticle | null>(null);
  const [helpContent, setHelpContent] = useState<HelpArticle[]>([]);

  // フォールバック用のサンプルデータ
  const getFallbackContent = (): HelpArticle[] => {
    const isJapanese = i18n.language === 'ja';
    
    return [
      {
        id: 1,
        category: 1,
        category_name: isJapanese ? 'ダッシュボード' : 'Dashboard',
        category_name_en: 'Dashboard',
        title: isJapanese ? 'ダッシュボードの使い方' : 'How to use Dashboard',
        title_en: 'How to use Dashboard',
        content: isJapanese ? 'ダッシュボードでは、広告のパフォーマンスを一目で確認できます。' : 'The dashboard allows you to view your ad performance at a glance.',
        content_en: 'The dashboard allows you to view your ad performance at a glance.',
        article_type: 'text',
        tags: ['overview', 'basics'],
        order: 1,
        is_featured: true,
        is_active: true,
        view_count: 0,
        feedback_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 2,
        category: 2,
        category_name: isJapanese ? '設定' : 'Settings',
        category_name_en: 'Settings',
        title: isJapanese ? 'アカウント設定の変更方法' : 'How to change account settings',
        title_en: 'How to change account settings',
        content: isJapanese ? 'アカウント設定では、会社情報や言語設定を変更できます。' : 'You can change company information and language settings in account settings.',
        content_en: 'You can change company information and language settings in account settings.',
        article_type: 'steps',
        tags: ['settings', 'account'],
        order: 2,
        is_featured: false,
        is_active: true,
        view_count: 0,
        feedback_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  };

  // 初期化時にフォールバックデータを設定
  useEffect(() => {
    if (helpContent.length === 0) {
      setHelpContent(getFallbackContent());
    }
  }, []);

  const categories = [
    { key: 'all', label: t('help.categories.all') },
    { key: 'dashboard', label: t('help.categories.dashboard') },
    { key: 'campaigns', label: t('help.categories.campaigns') },
    { key: 'upload', label: t('help.categories.upload') },
    { key: 'settings', label: t('help.categories.settings') }
  ];

  const loadHelpContent = useCallback(async () => {
    try {
      // 記事を取得
      const articles = await helpService.getArticles({
        page_context: selectedCategory !== 'all' ? selectedCategory : undefined
      });
      
      // 配列でない場合はフォールバックを使用
      if (Array.isArray(articles)) {
        setHelpContent(articles);
      } else {
        console.log('API response is not an array, using fallback content');
        setHelpContent(getFallbackContent());
      }
    } catch (error) {
      console.error('Failed to load help content:', error);
      console.log('Using fallback content instead');
      // フォールバック用のサンプルデータを設定
      setHelpContent(getFallbackContent());
    }
  }, [selectedCategory, page, i18n.language]);

  // ヘルプコンテンツを読み込む
  useEffect(() => {
    if (helpVisible) {
      loadHelpContent();
    }
  }, [selectedCategory, loadHelpContent, helpVisible]);

  const filteredContent = Array.isArray(helpContent) ? helpContent.filter(item => {
    const matchesCategory = selectedCategory === 'all' || 
                           item.page_context === selectedCategory ||
                           (selectedCategory === 'settings' && item.page_context === 'settings') ||
                           (selectedCategory === 'dashboard' && item.page_context === 'dashboard') ||
                           (selectedCategory === 'campaigns' && item.page_context === 'campaigns') ||
                           (selectedCategory === 'upload' && item.page_context === 'bulk-upload');
    
    return matchesCategory;
  }) : [];


  const getPageSpecificHelp = () => {
    return Array.isArray(helpContent) ? helpContent.filter(item => item.page_context === page) : [];
  };

  const handleItemClick = (item: HelpArticle) => {
    setSelectedItem(item);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  const renderHelpContent = (item: HelpArticle): React.ReactElement => {
    const title = i18n.language === 'ja' ? item.title : item.title_en;
    const content = i18n.language === 'ja' ? item.content : item.content_en;
    
    return (
      <Card
        key={item.id}
        title={title}
        extra={
          <Button 
            type="link" 
            icon={<ArrowRightOutlined />}
            onClick={() => handleItemClick(item)}
          >
            {t('help.viewDetails')}
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <div style={{ 
          maxHeight: '200px', 
          overflowY: 'auto',
          marginBottom: '12px',
          lineHeight: '1.6'
        }}>
          <ReactMarkdown
            components={{
              h1: ({children}) => <Title level={4}>{children}</Title>,
              h2: ({children}) => <Title level={5}>{children}</Title>,
              h3: ({children}) => <Title level={5}>{children}</Title>,
              p: ({children}) => <Paragraph style={{ marginBottom: '8px' }}>{children}</Paragraph>,
              ul: ({children}) => <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>{children}</ul>,
              ol: ({children}) => <ol style={{ marginLeft: '20px', marginBottom: '12px' }}>{children}</ol>,
              li: ({children}) => <li style={{ marginBottom: '4px' }}>{children}</li>,
              strong: ({children}) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
              code: ({children}) => <code style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '2px 4px', 
                borderRadius: '3px',
                fontFamily: 'monospace'
              }}>{children}</code>
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        <div>
          {item.tags.map(tag => (
            <Tag key={tag} color="blue">{tag}</Tag>
          ))}
        </div>
      </Card>
    );
  };

  const renderHelpModal = (): React.ReactElement => (
    <Modal
      title={
        <Space>
          <BookOutlined />
          {t('help.title')}
        </Space>
      }
      open={helpVisible}
      onCancel={() => setHelpVisible(false)}
      width={800}
      footer={null}
      style={{ top: 20 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* カテゴリフィルター */}
        <div>
          <Text strong style={{ marginBottom: 8, display: 'block' }}>
            カテゴリを選択してください
          </Text>
          {categories.map(cat => (
            <Button
              key={cat.key}
              type={selectedCategory === cat.key ? 'primary' : 'default'}
              size="small"
              onClick={() => setSelectedCategory(cat.key)}
              style={{ marginRight: 8, marginBottom: 8 }}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        <Divider />

        {/* ヘルプコンテンツ */}
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {filteredContent.length > 0 ? (
            filteredContent.map(renderHelpContent)
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">{t('help.noResults')}</Text>
            </div>
          )}
        </div>
      </Space>
    </Modal>
  );

  const renderItemDetail = (): React.ReactElement => (
    <Modal
      title={selectedItem ? (i18n.language === 'ja' ? selectedItem.title : selectedItem.title_en) : ''}
      open={!!selectedItem}
      onCancel={() => setSelectedItem(null)}
      width={800}
      footer={[
        <Button key="close" onClick={() => setSelectedItem(null)}>
          {t('help.close')}
        </Button>
      ]}
    >
      {selectedItem && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ 
            maxHeight: '500px', 
            overflowY: 'auto',
            lineHeight: '1.6',
            padding: '16px',
            backgroundColor: '#fafafa',
            borderRadius: '6px'
          }}>
            <ReactMarkdown
              components={{
                h1: ({children}) => <Title level={3}>{children}</Title>,
                h2: ({children}) => <Title level={4}>{children}</Title>,
                h3: ({children}) => <Title level={5}>{children}</Title>,
                p: ({children}) => <Paragraph style={{ marginBottom: '12px' }}>{children}</Paragraph>,
                ul: ({children}) => <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>{children}</ul>,
                ol: ({children}) => <ol style={{ marginLeft: '20px', marginBottom: '16px' }}>{children}</ol>,
                li: ({children}) => <li style={{ marginBottom: '6px' }}>{children}</li>,
                strong: ({children}) => <strong style={{ fontWeight: 'bold', color: '#1890ff' }}>{children}</strong>,
                code: ({children}) => <code style={{ 
                  backgroundColor: '#f0f0f0', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '13px'
                }}>{children}</code>,
                blockquote: ({children}) => <blockquote style={{ 
                  borderLeft: '4px solid #1890ff', 
                  paddingLeft: '16px', 
                  margin: '16px 0',
                  backgroundColor: '#f6f8fa',
                  padding: '12px 16px'
                }}>{children}</blockquote>
              }}
            >
              {i18n.language === 'ja' ? selectedItem.content : selectedItem.content_en}
            </ReactMarkdown>
          </div>
          
          {selectedItem.article_type === 'steps' && (
            <div>
              <Title level={5}>{t('help.steps')}</Title>
              <Paragraph>{t('help.stepByStepGuide')}</Paragraph>
            </div>
          )}

          {selectedItem.video_url && (
            <div>
              <Title level={5}>{t('help.videoGuide')}</Title>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                href={selectedItem.video_url}
                target="_blank"
              >
                {t('help.watchVideo')}
              </Button>
            </div>
          )}
        </Space>
      )}
    </Modal>
  );

  return (
    <>
      {/* ヘルプボタン */}
      {showQuickHelp && (
        <Tooltip title={t('help.quickHelp')}>
          <Button
            type="primary"
            shape="circle"
            icon={<QuestionCircleOutlined />}
            onClick={() => {
              setHelpVisible(true);
              if (helpContent.length === 0) {
                loadHelpContent();
              }
            }}
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          />
        </Tooltip>
      )}

      {/* ページ固有のクイックヘルプ */}
      {context && getPageSpecificHelp().length > 0 && (
        <Card 
          size="small" 
          style={{ marginBottom: 16 }}
          title={
            <Space>
              <QuestionCircleOutlined />
              {t('help.quickTips')}
            </Space>
          }
        >
          <List
            size="small"
            dataSource={getPageSpecificHelp()}
            renderItem={(item: HelpArticle) => (
              <List.Item>
                <Text strong>{i18n.language === 'ja' ? item.title : item.title_en}</Text>
                <Button 
                  type="link" 
                  size="small"
                  onClick={() => setSelectedItem(item)}
                >
                  {t('help.learnMore')}
                </Button>
              </List.Item>
            )}
          />
        </Card>
      )}

      {renderHelpModal()}
      {renderItemDetail()}
    </>
  );
};

export default HelpSystem;
