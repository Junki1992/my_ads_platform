import React, { useState, useEffect } from 'react';
import { Tooltip, Button, Card, Typography, Space, Tag, Divider } from 'antd';
import { 
  QuestionCircleOutlined, 
  InfoCircleOutlined,
  BookOutlined,
  VideoCameraOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text, Paragraph } = Typography;

interface HelpContent {
  id: string;
  type: 'text' | 'steps' | 'video' | 'link';
  titleKey: string;
  contentKey: string;
  stepsKeys?: string[];
  videoUrl?: string;
  linkUrl?: string;
  tagsKeys?: string[];
}

interface QuickHelpTooltipProps {
  children: React.ReactElement;
  helpContent: HelpContent;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'leftTop' | 'leftBottom' | 'rightTop' | 'rightBottom';
  trigger?: 'hover' | 'click';
  showHelpIcon?: boolean;
  className?: string;
}

const QuickHelpTooltip: React.FC<QuickHelpTooltipProps> = ({
  children,
  helpContent,
  placement = 'top',
  trigger = 'hover',
  showHelpIcon = true,
  className = ''
}): React.ReactElement => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const renderHelpContent = () => {
    const contentStyle = {
      maxWidth: 400,
      maxHeight: 300,
      overflowY: 'auto' as const
    };

    switch (helpContent.type) {
      case 'text':
        return (
          <div style={contentStyle}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong style={{ color: '#000000' }}>{t(helpContent.titleKey)}</Text>
              <Paragraph style={{ margin: 0, fontSize: 13, color: '#000000' }}>
                {t(helpContent.contentKey)}
              </Paragraph>
              {helpContent.tagsKeys && (
                <div>
                  {helpContent.tagsKeys.map(tagKey => (
                    <Tag key={tagKey} color="blue">{t(tagKey)}</Tag>
                  ))}
                </div>
              )}
            </Space>
          </div>
        );

      case 'steps':
        return (
          <div style={contentStyle}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong style={{ color: '#000000' }}>{t(helpContent.titleKey)}</Text>
              <div>
                {helpContent.stepsKeys?.map((stepKey, index) => (
                  <div key={index} style={{ marginBottom: 8 }}>
                    <Text strong style={{ color: '#1890ff' }}>{index + 1}. </Text>
                    <Text style={{ fontSize: 13, color: '#000000' }}>{t(stepKey)}</Text>
                  </div>
                ))}
              </div>
              {helpContent.tagsKeys && (
                <div>
                  {helpContent.tagsKeys.map(tagKey => (
                    <Tag key={tagKey} color="green">{t(tagKey)}</Tag>
                  ))}
                </div>
              )}
            </Space>
          </div>
        );

      case 'video':
        return (
          <div style={contentStyle}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Space>
                <VideoCameraOutlined style={{ color: '#1890ff' }} />
                <Text strong style={{ color: '#000000' }}>{t(helpContent.titleKey)}</Text>
              </Space>
              <Paragraph style={{ margin: 0, fontSize: 13, color: '#000000' }}>
                {t(helpContent.contentKey)}
              </Paragraph>
              {helpContent.videoUrl && (
                <Button
                  type="link"
                  size="small"
                  icon={<VideoCameraOutlined />}
                  href={helpContent.videoUrl}
                  target="_blank"
                  style={{ padding: 0 }}
                >
                  {t('help.watchVideo')}
                </Button>
              )}
            </Space>
          </div>
        );

      case 'link':
        return (
          <div style={contentStyle}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Space>
                <FileTextOutlined style={{ color: '#1890ff' }} />
                <Text strong style={{ color: '#000000' }}>{t(helpContent.titleKey)}</Text>
              </Space>
              <Paragraph style={{ margin: 0, fontSize: 13, color: '#000000' }}>
                {t(helpContent.contentKey)}
              </Paragraph>
              {helpContent.linkUrl && (
                <Button
                  type="link"
                  size="small"
                  icon={<BookOutlined />}
                  href={helpContent.linkUrl}
                  target="_blank"
                  style={{ padding: 0 }}
                >
                  {t('help.learnMore')}
                </Button>
              )}
            </Space>
          </div>
        );

      default:
        return <Text>{t(helpContent.contentKey)}</Text>;
    }
  };

  const handleVisibleChange = (visible: boolean) => {
    setVisible(visible);
  };

  // クリックトリガーの場合、アイコンを表示
  const renderChildren = () => {
    if (trigger === 'click' && showHelpIcon) {
      return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {children}
          <Button
            type="text"
            size="small"
            icon={<QuestionCircleOutlined />}
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              zIndex: 10,
              padding: '2px 4px',
              minWidth: 'auto',
              height: 'auto',
              fontSize: '12px',
              color: '#1890ff',
              backgroundColor: 'white',
              border: '1px solid #d9d9d9',
              borderRadius: '50%'
            }}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setVisible(!visible);
            }}
          />
        </div>
      );
    }
    return children;
  };

  return (
    <Tooltip
      title={renderHelpContent()}
      placement={placement}
      trigger={trigger}
      visible={visible}
      onVisibleChange={handleVisibleChange}
      overlayStyle={{ 
        maxWidth: 450,
        backgroundColor: '#ffffff',
        border: '1px solid #d9d9d9',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        color: '#000000'
      }}
      overlayClassName={`quick-help-tooltip ${className}`}
      color="#ffffff"
    >
      {renderChildren()}
    </Tooltip>
  );
};

// ヘルプコンテンツの定義
export const HelpContents = {
  // ダッシュボード関連
  dashboard: {
    stats: {
      id: 'dashboard-stats',
      type: 'text' as const,
      titleKey: 'help.tooltips.dashboard.stats.title',
      contentKey: 'help.tooltips.dashboard.stats.content',
      tagsKeys: ['help.tooltips.dashboard.stats.tag1', 'help.tooltips.dashboard.stats.tag2', 'help.tooltips.dashboard.stats.tag3']
    },
    sync: {
      id: 'dashboard-sync',
      type: 'steps' as const,
      titleKey: 'help.tooltips.dashboard.sync.title',
      contentKey: 'help.tooltips.dashboard.sync.content',
      stepsKeys: [
        'help.tooltips.dashboard.sync.step1',
        'help.tooltips.dashboard.sync.step2',
        'help.tooltips.dashboard.sync.step3'
      ],
      tagsKeys: ['help.tooltips.dashboard.sync.tag1', 'help.tooltips.dashboard.sync.tag2', 'help.tooltips.dashboard.sync.tag3']
    }
  },

  // キャンペーン作成関連
  campaign: {
    name: {
      id: 'campaign-name',
      type: 'text' as const,
      titleKey: 'help.tooltips.campaign.name.title',
      contentKey: 'help.tooltips.campaign.name.content',
      tagsKeys: ['help.tooltips.campaign.name.tag1', 'help.tooltips.campaign.name.tag2', 'help.tooltips.campaign.name.tag3']
    },
    budget: {
      id: 'campaign-budget',
      type: 'text' as const,
      titleKey: 'help.tooltips.campaign.budget.title',
      contentKey: 'help.tooltips.campaign.budget.content',
      tagsKeys: ['help.tooltips.campaign.budget.tag1', 'help.tooltips.campaign.budget.tag2', 'help.tooltips.campaign.budget.tag3']
    },
    targeting: {
      id: 'campaign-targeting',
      type: 'steps' as const,
      titleKey: 'help.tooltips.campaign.targeting.title',
      contentKey: 'help.tooltips.campaign.targeting.content',
      stepsKeys: [
        'help.tooltips.campaign.targeting.step1',
        'help.tooltips.campaign.targeting.step2',
        'help.tooltips.campaign.targeting.step3',
        'help.tooltips.campaign.targeting.step4'
      ],
      tagsKeys: ['help.tooltips.campaign.targeting.tag1', 'help.tooltips.campaign.targeting.tag2', 'help.tooltips.campaign.targeting.tag3']
    }
  },

  // 一括入稿関連
  bulkUpload: {
    template: {
      id: 'bulk-template',
      type: 'link' as const,
      titleKey: 'help.tooltips.bulkUpload.template.title',
      contentKey: 'help.tooltips.bulkUpload.template.content',
      linkUrl: '/help/bulk-upload-template',
      tagsKeys: ['help.tooltips.bulkUpload.template.tag1', 'help.tooltips.bulkUpload.template.tag2', 'help.tooltips.bulkUpload.template.tag3']
    },
    validation: {
      id: 'bulk-validation',
      type: 'text' as const,
      titleKey: 'help.tooltips.bulkUpload.validation.title',
      contentKey: 'help.tooltips.bulkUpload.validation.content',
      tagsKeys: ['help.tooltips.bulkUpload.validation.tag1', 'help.tooltips.bulkUpload.validation.tag2', 'help.tooltips.bulkUpload.validation.tag3']
    }
  },

  // 設定関連
  settings: {
    metaAccount: {
      id: 'meta-account',
      type: 'steps' as const,
      titleKey: 'help.tooltips.settings.metaAccount.title',
      contentKey: 'help.tooltips.settings.metaAccount.content',
      stepsKeys: [
        'help.tooltips.settings.metaAccount.step1',
        'help.tooltips.settings.metaAccount.step2',
        'help.tooltips.settings.metaAccount.step3',
        'help.tooltips.settings.metaAccount.step4'
      ],
      tagsKeys: ['help.tooltips.settings.metaAccount.tag1', 'help.tooltips.settings.metaAccount.tag2', 'help.tooltips.settings.metaAccount.tag3']
    }
  }
};

export default QuickHelpTooltip;
