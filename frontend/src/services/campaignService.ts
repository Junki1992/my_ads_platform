import api from './api';

export interface Campaign {
  id: number;
  campaign_id: string;
  name: string;
  objective: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED';
  budget: number;
  budget_type: 'DAILY' | 'LIFETIME';
  budget_optimization?: string;
  budget_remaining?: number;
  start_date: string;
  end_date?: string;
  schedule_start_time?: string;
  schedule_end_time?: string;
  schedule_days?: string[];
  timezone?: string;
  user: number;
  user_email: string;
  meta_account: number;
  meta_account_name: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignCreate {
  name: string;
  objective: string;
  budget: number;
  budget_type: 'DAILY' | 'LIFETIME';
  budget_optimization?: string;
  start_date: string;
  end_date?: string;
  schedule_start_time?: string;
  schedule_end_time?: string;
  schedule_days?: string[];
  timezone?: string;
}

export interface CampaignStats {
  total: number;
  active: number;
  paused: number;
  total_budget: number;
}

export interface DashboardStats {
  summary: {
    total_campaigns: number;
    active_campaigns: number;
    paused_campaigns: number;
    total_budget: number;
    total_spend: number;
    total_impressions: number;
    total_clicks: number;
  };
  recent_campaigns: Array<{
    id: number;
    name: string;
    objective: string;
    status: string;
    budget: number;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    start_date: string;
    end_date?: string;
  }>;
}

class CampaignService {
  // キャンペーン一覧取得
  async getCampaigns(params?: { status?: string; search?: string }): Promise<Campaign[]> {
    const response = await api.get<any>('/campaigns/campaigns/', { params });
    // DRFのページネーションレスポンスに対応
    if (response.data && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  // キャンペーン詳細取得
  async getCampaign(id: number): Promise<Campaign> {
    const response = await api.get<Campaign>(`/campaigns/campaigns/${id}/`);
    return response.data;
  }

  // キャンペーン作成
  async createCampaign(data: CampaignCreate & { meta_account_id?: number; image_file?: File }): Promise<Campaign> {
    console.log('CampaignService: 送信データ:', data);
    console.log('CampaignService: APIエンドポイント:', '/campaigns/campaigns/');
    console.log('CampaignService: Image file:', data.image_file);
    
    try {
      // 画像ファイルがある場合はFormDataを使用
      if (data.image_file) {
        const formData = new FormData();
        
        // 通常のフィールドを追加
        Object.keys(data).forEach(key => {
          if (key !== 'image_file' && data[key as keyof typeof data] !== undefined) {
            formData.append(key, String(data[key as keyof typeof data]));
          }
        });
        
        // 画像ファイルを追加
        formData.append('image_file', data.image_file);
        
        console.log('CampaignService: FormData作成完了');
        console.log('CampaignService: FormData contents check:', {
          hasImageFile: formData.has('image_file'),
          keys: Array.from((formData as any).keys())
        });
        
        const response = await api.post<Campaign>('/campaigns/campaigns/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        });
        
        console.log('CampaignService: FormData送信成功:', response.data);
        return response.data;
      } else {
        // 画像ファイルがない場合は通常のJSON送信
        const { image_file, ...jsonData } = data;
        const response = await api.post<Campaign>('/campaigns/campaigns/', jsonData);
        console.log('CampaignService: JSON送信成功:', response.data);
        return response.data;
      }
    } catch (error: any) {
        console.error('CampaignService: エラー発生:', error);
        console.error('CampaignService: エラーレスポンス:', error.response?.data);
        throw error;
    }
  }

  // キャンペーン更新
  async updateCampaign(id: number, data: Partial<CampaignCreate>): Promise<Campaign> {
    const response = await api.patch<Campaign>(`/campaigns/campaigns/${id}/`, data);
    return response.data;
  }

  // キャンペーン削除（従来の論理削除のみ）
  async deleteCampaign(id: number): Promise<void> {
    await api.delete(`/campaigns/campaigns/${id}/soft_delete/`);
  }

  // キャンペーン削除（オプション付き）
  async deleteCampaignWithOptions(id: number, options: {
    deleteFromMeta: boolean;
    password?: string;
  }): Promise<{
    status: string;
    task_id?: string;
    message: string;
  }> {
    const response = await api.post(`/campaigns/campaigns/${id}/delete_with_options/`, {
      delete_from_meta: options.deleteFromMeta,
      password: options.password
    });
    return response.data;
  }

  // キャンペーン有効化
  async activateCampaign(id: number): Promise<{
    status: string;
    message: string;
  }> {
    const response = await api.post(`/campaigns/campaigns/${id}/activate/`);
    return response.data;
  }

  // キャンペーン一時停止
  async pauseCampaign(id: number): Promise<{
    status: string;
    message: string;
  }> {
    const response = await api.post(`/campaigns/campaigns/${id}/pause/`);
    return response.data;
  }

  // キャンペーン統計取得
  async getStats(): Promise<CampaignStats> {
    const response = await api.get<CampaignStats>('/campaigns/campaigns/stats/');
    return response.data;
  }

  // 単一キャンペーンのMeta API同期
  async syncCampaignFromMeta(id: number): Promise<{
    status: string;
    message: string;
    local_status?: string;
    meta_status?: string;
  }> {
    const response = await api.post(`/campaigns/campaigns/${id}/sync_from_meta/`);
    return response.data;
  }

  // すべてのキャンペーンのMeta API同期
  async syncAllCampaignsFromMeta(): Promise<{
    status: string;
    task_id?: string;
    message: string;
  }> {
    const response = await api.post('/campaigns/campaigns/sync_all_from_meta/');
    return response.data;
  }

  // キャンペーン全体（キャンペーン+広告セット+広告）のMeta API同期
  async syncCampaignFullFromMeta(id: number): Promise<{
    status: string;
    task_id?: string;
    message: string;
  }> {
    const response = await api.post(`/campaigns/campaigns/${id}/sync_full_from_meta/`);
    return response.data;
  }

  // レポート用データ取得
  async getReportingData(params?: {
    campaign_id?: string;
    start_date?: string;
    end_date?: string;
    metrics?: string;
  }): Promise<{
    campaigns: any[];
    summary: {
      total_campaigns: number;
      total_spend: number;
      total_impressions: number;
      total_clicks: number;
    };
  }> {
    const response = await api.get('/campaigns/campaigns/reporting_data/', { params });
    return response.data;
  }

  // ダッシュボード統計取得
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/campaigns/campaigns/stats/');
    return response.data;
  }

  // Meta APIにキャンペーンを投稿
  async submitToMeta(campaignId: number): Promise<{ task_id: string; status: string; message: string }> {
    const response = await api.post(`/campaigns/campaigns/${campaignId}/submit_to_meta/`);
    return response.data;
  }
}

const campaignService = new CampaignService();
export default campaignService;