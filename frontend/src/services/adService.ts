import api from './api';

export interface Ad {
  id: number;
  ad_id: string;
  name: string;
  status: string;
  creative: any;
  adset: number;
  created_at: string;
  updated_at: string;
}

export interface AdCreate {
  name: string;
  creative: any;
  adset: number;
}

class AdService {
  // 広告一覧取得
  async getAds(adsetId?: number): Promise<Ad[]> {
    const url = adsetId 
      ? `/campaigns/ads/?adset=${adsetId}`
      : '/campaigns/ads/';
    console.log('AdService: Fetching URL:', url);
    const response = await api.get<any>(url);
    console.log('AdService: Response data:', response.data);
    console.log('AdService: Response data type:', typeof response.data);
    console.log('AdService: Is response data array:', Array.isArray(response.data));
    
    // Django REST Frameworkのページネーション対応
    const data = response.data.results || response.data;
    console.log('AdService: Final data:', data);
    console.log('AdService: Final data type:', typeof data);
    console.log('AdService: Is final data array:', Array.isArray(data));
    
    return Array.isArray(data) ? data : [];
  }

  // 広告詳細取得
  async getAd(id: number): Promise<Ad> {
    const response = await api.get<Ad>(`/campaigns/ads/${id}/`);
    return response.data;
  }

  // 広告作成
  async createAd(data: AdCreate): Promise<Ad> {
    const response = await api.post<Ad>('/campaigns/ads/', data);
    return response.data;
  }

  // 広告更新
  async updateAd(id: number, data: Partial<AdCreate>): Promise<Ad> {
    const response = await api.patch<Ad>(`/campaigns/ads/${id}/`, data);
    return response.data;
  }

  // 広告削除
  async deleteAd(id: number): Promise<void> {
    await api.delete(`/campaigns/ads/${id}/`);
  }

  // 広告有効化
  async activateAd(id: number): Promise<{
    status: string;
    message: string;
  }> {
    const response = await api.post(`/campaigns/ads/${id}/activate/`);
    return response.data;
  }

  // 広告一時停止
  async pauseAd(id: number): Promise<{
    status: string;
    message: string;
  }> {
    const response = await api.post(`/campaigns/ads/${id}/pause/`);
    return response.data;
  }

  // 広告のMeta API同期
  async syncAdFromMeta(id: number): Promise<{
    status: string;
    message: string;
    local_status?: string;
    meta_status?: string;
  }> {
    const response = await api.post(`/campaigns/ads/${id}/sync_from_meta/`);
    return response.data;
  }
}

export default new AdService();