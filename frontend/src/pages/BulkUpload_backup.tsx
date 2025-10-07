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
  Popconfirm
} from 'antd';
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
import bulkUploadService, { type BulkUpload, type BulkUploadProgress, type ValidationResult } from '../services/bulkUploadService';

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

  return (
    <div>
      <Title level={2}>Meta広告 CSV一括入稿</Title>
      <Card>
        <p>一括入稿機能は現在開発中です。</p>
      </Card>
    </div>
  );
};

export default BulkUpload;
