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
  title: string;
  content: string;
  steps?: string[];
  videoUrl?: string;
  linkUrl?: string;
  tags?: string[];
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
              <Text strong>{helpContent.title}</Text>
              <Paragraph style={{ margin: 0, fontSize: 13 }}>
                {helpContent.content}
              </Paragraph>
              {helpContent.tags && (
                <div>
                  {helpContent.tags.map(tag => (
                    <Tag key={tag} color="blue">{tag}</Tag>
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
              <Text strong>{helpContent.title}</Text>
              <div>
                {helpContent.steps?.map((step, index) => (
                  <div key={index} style={{ marginBottom: 8 }}>
                    <Text strong style={{ color: '#1890ff' }}>{index + 1}. </Text>
                    <Text style={{ fontSize: 13 }}>{step}</Text>
                  </div>
                ))}
              </div>
              {helpContent.tags && (
                <div>
                  {helpContent.tags.map(tag => (
                    <Tag key={tag} color="green">{tag}</Tag>
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
                <Text strong>{helpContent.title}</Text>
              </Space>
              <Paragraph style={{ margin: 0, fontSize: 13 }}>
                {helpContent.content}
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
                <Text strong>{helpContent.title}</Text>
              </Space>
              <Paragraph style={{ margin: 0, fontSize: 13 }}>
                {helpContent.content}
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
        return <Text>{helpContent.content}</Text>;
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
      overlayStyle={{ maxWidth: 450 }}
      overlayClassName={`quick-help-tooltip ${className}`}
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
      title: 'パフォーマンス指標の見方',
      content: 'ここでは各キャンペーンの支出、インプレッション、クリック数などの重要な指標を確認できます。CTR（クリック率）が低い場合は、広告のクリエイティブやターゲティングを見直してみましょう。',
      tags: ['指標', 'パフォーマンス', '分析']
    },
    sync: {
      id: 'dashboard-sync',
      type: 'steps' as const,
      title: 'Meta APIからの同期',
      content: '最新のデータを取得する方法',
      steps: [
        '「Meta APIから同期」ボタンをクリック',
        '処理完了まで数秒待機',
        '最新のパフォーマンスデータが表示されます'
      ],
      tags: ['同期', 'データ更新', 'Meta API']
    }
  },

  // キャンペーン作成関連
  campaign: {
    name: {
      id: 'campaign-name',
      type: 'text' as const,
      title: 'キャンペーン名の付け方',
      content: '分かりやすいキャンペーン名を付けることで、後から管理しやすくなります。例：「新商品プロモーション_2024年1月」のように、目的と時期を含めることをお勧めします。',
      tags: ['命名規則', '管理', 'ベストプラクティス']
    },
    budget: {
      id: 'campaign-budget',
      type: 'text' as const,
      title: '予算設定のコツ',
      content: '初回は少額から始めて、パフォーマンスを確認しながら予算を調整していくことをお勧めします。日予算は最低100円から設定可能です。',
      tags: ['予算', '最適化', '初心者向け']
    },
    targeting: {
      id: 'campaign-targeting',
      type: 'steps' as const,
      title: 'ターゲティング設定',
      content: '効果的なターゲティングの設定方法',
      steps: [
        '年齢と性別を設定（例：25-45歳、男女）',
        '地域を選択（日本全国または特定地域）',
        '興味関心を追加（関連するキーワード）',
        'アトリビューションウィンドウを設定'
      ],
      tags: ['ターゲティング', 'オーディエンス', '設定']
    }
  },

  // 一括入稿関連
  bulkUpload: {
    template: {
      id: 'bulk-template',
      type: 'link' as const,
      title: 'CSVテンプレートの使い方',
      content: 'テンプレートをダウンロードして、必要な情報を入力してください。必須項目をすべて記入することで、エラーなく一括入稿できます。',
      linkUrl: '/help/bulk-upload-template',
      tags: ['テンプレート', 'CSV', '一括入稿']
    },
    validation: {
      id: 'bulk-validation',
      type: 'text' as const,
      title: 'データ検証について',
      content: 'アップロードしたCSVファイルは自動的に検証されます。エラーがある場合は詳細を確認して修正してください。全てのエラーを解決してから実行ボタンを押してください。',
      tags: ['検証', 'エラー', 'データ確認']
    }
  },

  // 設定関連
  settings: {
    metaAccount: {
      id: 'meta-account',
      type: 'steps' as const,
      title: 'Metaアカウントの設定',
      content: 'Meta API連携の設定手順',
      steps: [
        'Facebook Developer Consoleでアプリを作成',
        '広告管理システムのアクセストークンを取得',
        'App ID、App Secret、アクセストークンを入力',
        '「このアカウントを追加」ボタンで保存'
      ],
      tags: ['Meta API', '設定', '連携']
    }
  }
};

export default QuickHelpTooltip;
