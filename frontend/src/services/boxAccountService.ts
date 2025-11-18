import api from './api';

export interface BoxAccount {
  id: number;
  account_id: string;
  account_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoxFile {
  id: string;
  name: string;
  size: number;
  modified_at: string | null;
  download_url: string;
}

class BoxAccountService {
  // Boxアカウント一覧取得
  async fetchBoxAccounts(): Promise<BoxAccount[]> {
    const response = await api.get<any>('/accounts/box-accounts/');
    // DRFのページネーションレスポンスに対応
    if (response.data && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  // Box OAuth認証URL取得
  async getOAuthUrl(): Promise<{ auth_url: string; state: string }> {
    const response = await api.get<{ auth_url: string; state: string }>('/accounts/box-accounts/oauth_authorize/');
    return response.data;
  }

  // Boxアカウント削除
  async deleteBoxAccount(id: number): Promise<{ message: string }> {
    const response = await api.delete(`/accounts/box-accounts/${id}/`);
    return response.data;
  }

  // Boxファイル一覧取得
  async listFiles(boxAccountId: number): Promise<{ files: BoxFile[] }> {
    const response = await api.get<{ files: BoxFile[] }>(`/accounts/box-accounts/${boxAccountId}/list_files/`);
    return response.data;
  }

  // Boxファイルダウンロード（Blobとして取得）
  async downloadFile(boxAccountId: number, fileId: string): Promise<Blob> {
    const response = await api.get(
      `/accounts/box-accounts/${boxAccountId}/download-file/${fileId}/`,
      { responseType: 'blob' }
    );
    return response.data;
  }
}

export default new BoxAccountService();

