import React, { useState, useEffect } from 'react';
import { Modal, Button, Steps, Card, Typography, Space, Badge } from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined,
  RedoOutlined,
  CloseOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

interface GuideStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  highlightElement?: boolean;
  action?: 'click' | 'input' | 'scroll' | 'wait';
  actionText?: string;
  completed?: boolean;
}

interface InteractiveGuideProps {
  visible: boolean;
  onClose: () => void;
  guideType: 'onboarding' | 'campaign-creation' | 'bulk-upload' | 'dashboard';
  onStepComplete?: (stepId: string) => void;
}

const InteractiveGuide: React.FC<InteractiveGuideProps> = ({
  visible,
  onClose,
  guideType,
  onStepComplete
}): React.ReactElement => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // ガイドのデータ定義
  const getGuideData = (type: string): GuideStep[] => {
    switch (type) {
      case 'onboarding':
        return [
          {
            id: 'welcome',
            title: t('guide.onboarding.welcome.title'),
            description: t('guide.onboarding.welcome.description'),
            action: 'wait',
            actionText: t('guide.onboarding.welcome.action')
          },
          {
            id: 'dashboard-overview',
            title: t('guide.onboarding.dashboard.title'),
            description: t('guide.onboarding.dashboard.description'),
            targetSelector: '.dashboard-stats',
            highlightElement: true,
            action: 'scroll',
            actionText: t('guide.onboarding.dashboard.action')
          },
          {
            id: 'navigation',
            title: t('guide.onboarding.navigation.title'),
            description: t('guide.onboarding.navigation.description'),
            targetSelector: '.sidebar-menu',
            highlightElement: true,
            action: 'click',
            actionText: t('guide.onboarding.navigation.action')
          }
        ];
      
      case 'campaign-creation':
        return [
          {
            id: 'campaign-basics',
            title: t('guide.campaign.basics.title'),
            description: t('guide.campaign.basics.description'),
            targetSelector: '#campaign-name',
            highlightElement: true,
            action: 'input',
            actionText: t('guide.campaign.basics.action')
          },
          {
            id: 'budget-settings',
            title: t('guide.campaign.budget.title'),
            description: t('guide.campaign.budget.description'),
            targetSelector: '#budget-amount',
            highlightElement: true,
            action: 'input',
            actionText: t('guide.campaign.budget.action')
          },
          {
            id: 'targeting',
            title: t('guide.campaign.targeting.title'),
            description: t('guide.campaign.targeting.description'),
            targetSelector: '#targeting-section',
            highlightElement: true,
            action: 'click',
            actionText: t('guide.campaign.targeting.action')
          },
          {
            id: 'creative',
            title: t('guide.campaign.creative.title'),
            description: t('guide.campaign.creative.description'),
            targetSelector: '#creative-upload',
            highlightElement: true,
            action: 'click',
            actionText: t('guide.campaign.creative.action')
          }
        ];

      case 'bulk-upload':
        return [
          {
            id: 'file-selection',
            title: t('guide.bulkUpload.fileSelection.title'),
            description: t('guide.bulkUpload.fileSelection.description'),
            targetSelector: '#file-upload',
            highlightElement: true,
            action: 'click',
            actionText: t('guide.bulkUpload.fileSelection.action')
          },
          {
            id: 'data-validation',
            title: t('guide.bulkUpload.validation.title'),
            description: t('guide.bulkUpload.validation.description'),
            targetSelector: '#validation-results',
            highlightElement: true,
            action: 'wait',
            actionText: t('guide.bulkUpload.validation.action')
          },
          {
            id: 'execution',
            title: t('guide.bulkUpload.execution.title'),
            description: t('guide.bulkUpload.execution.description'),
            targetSelector: '#execute-button',
            highlightElement: true,
            action: 'click',
            actionText: t('guide.bulkUpload.execution.action')
          }
        ];

      default:
        return [];
    }
  };

  const guideSteps = getGuideData(guideType);
  const currentStepData = guideSteps[currentStep];

  // 自動再生の制御
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentStep < guideSteps.length) {
      interval = setInterval(() => {
        handleNext();
      }, 3000); // 3秒間隔で自動進行
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentStep, guideSteps.length]);

  // 要素のハイライト
  useEffect(() => {
    if (currentStepData?.highlightElement && currentStepData.targetSelector) {
      const element = document.querySelector(currentStepData.targetSelector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('guide-highlight');
        
        return () => {
          element.classList.remove('guide-highlight');
        };
      }
    }
  }, [currentStep, currentStepData]);

  const handleNext = () => {
    if (currentStep < guideSteps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      
      // ステップ完了を記録
      if (onStepComplete) {
        onStepComplete(guideSteps[currentStep].id);
      }
      
      setCompletedSteps(prev => new Set([...Array.from(prev), guideSteps[currentStep].id]));
    } else {
      // ガイド完了
      setIsPlaying(false);
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setCompletedSteps(new Set(guideSteps.map(step => step.id)));
    onClose();
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const progress = ((currentStep + 1) / guideSteps.length) * 100;

  return (
    <>
      <Modal
        title={
          <Space>
            <PlayCircleOutlined />
            {t('guide.title', { type: t(`guide.types.${guideType}`) })}
            <Badge count={guideSteps.length} showZero />
          </Space>
        }
        open={visible}
        onCancel={onClose}
        width={600}
        footer={null}
        style={{ top: 20 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* プログレスバー */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ 
              width: '100%', 
              height: 6, 
              backgroundColor: '#f0f0f0', 
              borderRadius: 3,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: '#1890ff',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('guide.progress', { current: currentStep + 1, total: guideSteps.length })}
            </Text>
          </div>

          {/* 現在のステップ */}
          {currentStepData && (
            <Card>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Title level={4}>{currentStepData.title}</Title>
                  <Paragraph>{currentStepData.description}</Paragraph>
                </div>

                {currentStepData.action && (
                  <div style={{ 
                    padding: 12, 
                    backgroundColor: '#f6ffed', 
                    border: '1px solid #b7eb8f',
                    borderRadius: 6
                  }}>
                    <Space>
                      <InfoCircleOutlined style={{ color: '#52c41a' }} />
                      <Text strong style={{ color: '#389e0d' }}>
                        {currentStepData.actionText}
                      </Text>
                    </Space>
                  </div>
                )}
              </Space>
            </Card>
          )}

          {/* コントロールボタン */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Button
                icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={handlePlayPause}
                type={isPlaying ? 'default' : 'primary'}
              >
                {isPlaying ? t('guide.pause') : t('guide.play')}
              </Button>
              <Button icon={<RedoOutlined />} onClick={handleRestart}>
                {t('guide.restart')}
              </Button>
            </Space>

            <Space>
              <Button 
                disabled={currentStep === 0}
                onClick={handlePrevious}
              >
                {t('guide.previous')}
              </Button>
              <Button 
                type="primary"
                onClick={currentStep === guideSteps.length - 1 ? handleComplete : handleNext}
                icon={currentStep === guideSteps.length - 1 ? <CheckCircleOutlined /> : undefined}
              >
                {currentStep === guideSteps.length - 1 ? t('guide.complete') : t('guide.next')}
              </Button>
            </Space>
          </div>

          {/* ステップ一覧 */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            <Steps
              direction="vertical"
              size="small"
              current={currentStep}
              items={guideSteps.map((step, index) => ({
                title: step.title,
                description: step.description,
                status: completedSteps.has(step.id) ? 'finish' : 
                       index === currentStep ? 'process' : 'wait'
              }))}
            />
          </div>
        </Space>
      </Modal>

      {/* ハイライト用のCSS */}
      <style>
        {`
          .guide-highlight {
            position: relative;
            z-index: 1000;
            box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.3);
            border-radius: 4px;
            animation: guide-pulse 2s infinite;
          }
          
          @keyframes guide-pulse {
            0% { box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.3); }
            50% { box-shadow: 0 0 0 8px rgba(24, 144, 255, 0.1); }
            100% { box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.3); }
          }
        `}
      </style>
    </>
  );
};

export default InteractiveGuide;
