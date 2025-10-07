import api from './api';

export interface AdSet {
  id: number;
  adset_id: string;
  name: string;
  status: string;
  budget: number;
  budget_type: string;
  bid_strategy: string;
  targeting: any;
  campaign: number;
  created_at: string;
  updated_at: string;
}

export interface AdSetCreate {
  name: string;
  budget: number;
  budget_type: string;
  bid_strategy: string;
  targeting: any;
  campaign: number;
}

class AdSetService {
  // 広告セット一覧取得
  async getAdSets(campaignId?: number): Promise<AdSet[]> {
    const url = campaignId 
      ? `/campaigns/adsets/?campaign=${campaignId}`
      : '/campaigns/adsets/';
    console.log('AdSetService: Fetching URL:', url);
    const response = await api.get<any>(url);
    console.log('AdSetService: Response data:', response.data);
    console.log('AdSetService: Response data type:', typeof response.data);
    console.log('AdSetService: Is response data array:', Array.isArray(response.data));
    
    // Django REST Frameworkのページネーション対応
    const data = response.data.results || response.data;
    console.log('AdSetService: Final data:', data);
    console.log('AdSetService: Final data type:', typeof data);
    console.log('AdSetService: Is final data array:', Array.isArray(data));
    
    return Array.isArray(data) ? data : [];
  }

  // 広告セット詳細取得
  async getAdSet(id: number): Promise<AdSet> {
    const response = await api.get<AdSet>(`/campaigns/adsets/${id}/`);
    return response.data;
  }

  // 広告セット作成
  async createAdSet(data: AdSetCreate): Promise<AdSet> {
    const response = await api.post<AdSet>('/campaigns/adsets/', data);
    return response.data;
  }

  // 広告セット更新
  async updateAdSet(id: number, data: Partial<AdSetCreate>): Promise<AdSet> {
    const response = await api.patch<AdSet>(`/campaigns/adsets/${id}/`, data);
    return response.data;
  }

  // 広告セット削除
  async deleteAdSet(id: number): Promise<void> {
    await api.delete(`/campaigns/adsets/${id}/`);
  }

  // 広告セット有効化
  async activateAdSet(id: number): Promise<{
    status: string;
    message: string;
  }> {
    const response = await api.post(`/campaigns/adsets/${id}/activate/`);
    return response.data;
  }

  // 広告セット一時停止
  async pauseAdSet(id: number): Promise<{
    status: string;
    message: string;
  }> {
    const response = await api.post(`/campaigns/adsets/${id}/pause/`);
    return response.data;
  }

  // 広告セットのMeta API同期
  async syncAdSetFromMeta(id: number): Promise<{
    status: string;
    message: string;
    local_status?: string;
    meta_status?: string;
  }> {
    const response = await api.post(`/campaigns/adsets/${id}/sync_from_meta/`);
    return response.data;
  }
}

export default new AdSetService();
