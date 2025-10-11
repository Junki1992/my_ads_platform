import api from './api';

export interface TwoFactorStatus {
  enabled: boolean;
  has_backup_codes: boolean;
}

export interface TwoFactorSetupResponse {
  message: string;
  qr_code: string;
  backup_codes: string[];
}

export interface TwoFactorVerifyResponse {
  message: string;
  valid: boolean;
}

class TwoFactorService {
  /**
   * 2FAの状態を取得
   */
  async getStatus(): Promise<TwoFactorStatus> {
    const response = await api.get<TwoFactorStatus>('/accounts/users/get_2fa_status/');
    return response.data;
  }

  /**
   * 2FAを有効化
   * @param password - 現在のパスワード
   */
  async enable(password: string): Promise<TwoFactorSetupResponse> {
    const response = await api.post<TwoFactorSetupResponse>(
      '/accounts/users/enable_2fa/',
      { password }
    );
    return response.data;
  }

  /**
   * 2FAトークンを検証
   * @param token - 6桁の認証コード
   */
  async verify(token: string): Promise<TwoFactorVerifyResponse> {
    const response = await api.post<TwoFactorVerifyResponse>(
      '/accounts/users/verify_2fa/',
      { token }
    );
    return response.data;
  }

  /**
   * バックアップコードを検証
   * @param backupCode - バックアップコード
   */
  async verifyBackupCode(backupCode: string): Promise<TwoFactorVerifyResponse> {
    const response = await api.post<TwoFactorVerifyResponse>(
      '/accounts/users/verify_backup_code/',
      { backup_code: backupCode }
    );
    return response.data;
  }

  /**
   * 2FAを無効化
   * @param password - 現在のパスワード
   * @param token - 6桁の認証コード
   */
  async disable(password: string, token: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      '/accounts/users/disable_2fa/',
      { password, token }
    );
    return response.data;
  }
}

export default new TwoFactorService();

