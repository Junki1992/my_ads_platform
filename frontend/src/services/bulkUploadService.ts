import api from './api';

export interface BulkUpload {
  id: number;
  file_name: string;
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  status: 'UPLOADING' | 'VALIDATING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error_log?: string;
  created_at: string;
  updated_at: string;
}

export interface BulkUploadRecord {
  id: number;
  row_number: number;
  data: any;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  error_message?: string;
  created_at: string;
}

export interface BulkUploadProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  status: string;
  progress_percentage: number;
  error_log?: string;
  created_at: string;
  updated_at: string;
  failed_records_detail: BulkUploadRecord[];
}

export interface ValidationResult {
  row_index: number;
  is_valid: boolean;
  errors: string[];
  data: any;
}

export interface UploadAndValidateResponse {
  bulk_upload_id: number;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  validation_results: ValidationResult[];
  status: string;
}

class BulkUploadService {
  // CSVファイルのアップロードとバリデーション
  async uploadAndValidate(file: File): Promise<UploadAndValidateResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post<UploadAndValidateResponse>(
      '/bulk-upload/uploads/upload_and_validate/',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    return response.data;
  }

  // CSVファイルのアップロードとバリデーション（アカウント選択付き）
  async uploadAndValidateWithAccount(formData: FormData): Promise<UploadAndValidateResponse> {
    const response = await api.post<UploadAndValidateResponse>(
      '/bulk-upload/uploads/upload_and_validate/',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    return response.data;
  }

  // 一括入稿処理の開始
  async processBulkUpload(bulkUploadId: number): Promise<{
    status: string;
    message: string;
    bulk_upload_id: number;
  }> {
    const response = await api.post(`/bulk-upload/uploads/${bulkUploadId}/process/`);
    return response.data;
  }

  // 進捗状況の取得
  async getProgress(bulkUploadId: number): Promise<BulkUploadProgress> {
    const response = await api.get<BulkUploadProgress>(
      `/bulk-upload/uploads/${bulkUploadId}/progress/`
    );
    return response.data;
  }

  // 一括入稿履歴の取得
  async getBulkUploads(): Promise<BulkUpload[]> {
    const response = await api.get<BulkUpload[]>('/bulk-upload/uploads/');
    return response.data;
  }

  // 特定の一括入稿の詳細取得
  async getBulkUpload(id: number): Promise<BulkUpload> {
    const response = await api.get<BulkUpload>(`/bulk-upload/uploads/${id}/`);
    return response.data;
  }

  // 一括入稿の削除
  async deleteBulkUpload(id: number): Promise<void> {
    await api.delete(`/bulk-upload/uploads/${id}/`);
  }

  // CSVテンプレートのダウンロード
  async downloadTemplate(): Promise<Blob> {
    const response = await api.get('/bulk-upload/template/', {
      responseType: 'blob',
    });
    return response.data;
  }
}

const bulkUploadService = new BulkUploadService();
export default bulkUploadService;
