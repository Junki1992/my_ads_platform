import api from './api';

export interface MetaAccount {
  id: number;
  account_id: string;
  account_name: string;
  /** Meta ビジネス（広告アカウントの1つ上） */
  business_id?: string;
  business_name?: string;
  access_token: string;  // 追加
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetaAccountCreate {
  account_id: string;
  account_name: string;
  access_token: string;
  business_id?: string;
  business_name?: string;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  account_id: string;
  currency: string;
  timezone: string;
  status: number;
  business_id?: string;
  business_name?: string;
}

class MetaAccountService {
  // Metaアカウント一覧取得
  async fetchMetaAccounts(): Promise<MetaAccount[]> {
    const response = await api.get<any>('/accounts/meta-accounts/');
    // DRFのページネーションレスポンスに対応
    if (response.data && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  // 互換性のため
  async getMetaAccounts(): Promise<MetaAccount[]> {
    return this.fetchMetaAccounts();
  }

  // Metaアカウント作成
  async createMetaAccount(data: MetaAccountCreate): Promise<MetaAccount> {
    const response = await api.post<MetaAccount>('/accounts/meta-accounts/', data);
    return response.data;
  }

  // Metaアカウント更新
  async updateMetaAccount(id: number, data: MetaAccountCreate): Promise<MetaAccount> {
    const response = await api.put<MetaAccount>(`/accounts/meta-accounts/${id}/`, data);
    return response.data;
  }

  // Metaアカウント削除（パスワード確認必須）
  async deleteMetaAccount(id: number, password: string): Promise<{ message: string }> {
    const response = await api.delete(`/accounts/meta-accounts/${id}/`, {
      data: { password }
    });
    return response.data;
  }

  /** 複数 Meta 広告アカウントを一括削除 */
  async bulkDeleteMetaAccounts(ids: number[], password: string): Promise<{ message: string; deleted: number }> {
    const response = await api.post('/accounts/meta-accounts/bulk_delete/', {
      ids,
      password,
    });
    return response.data;
  }

  // トークン変換（短期→長期）
  async exchangeToken(data: {
    short_token: string;
    app_id: string;
    app_secret: string;
  }): Promise<{ access_token: string; expires_in: number }> {
    const response = await api.post('/accounts/meta-accounts/exchange_token/', data);
    return response.data;
  }

  /** 長期トークン等の検証（バックエンドは access_token 必須） */
  async validateToken(accessToken: string): Promise<{
    valid: boolean;
    user_id?: string;
    user_name?: string;
    error?: string;
  }> {
    const response = await api.post('/accounts/meta-accounts/validate_token/', {
      access_token: accessToken,
    });
    return response.data;
  }

  // アカウント取得（Meta API）
  async fetchAccounts(accessToken: string): Promise<{ accounts: MetaAdAccount[]; token_info: any }> {
    // Meta Graph API経由でアカウント情報を取得
    const response = await api.post('/accounts/meta-accounts/fetch_accounts/', {
      access_token: accessToken
    });
    return response.data;
  }

  // OAuth認証URL取得
  async getOAuthUrl(): Promise<{ auth_url: string }> {
    const response = await api.get('/accounts/meta-accounts/oauth_authorize/');
    return response.data;
  }

  // 特定アカウント用OAuth認証URL取得
  async getOAuthUrlForAccount(accountId: number): Promise<{ auth_url: string; account_id: string; account_name: string }> {
    const response = await api.get(`/accounts/meta-accounts/${accountId}/oauth_authorize_account/`);
    return response.data;
  }

  // 開発用：ダミーアカウント作成
  async createDemoAccounts(): Promise<{ message: string; accounts: number }> {
    const response = await api.post('/accounts/meta-accounts/create_demo_accounts/');
    return response.data;
  }
}

const metaAccountService = new MetaAccountService();
export default metaAccountService;