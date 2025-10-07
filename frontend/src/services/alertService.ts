import api from './api';

export interface AlertRule {
  id?: number;
  name: string;
  description?: string;
  alert_type: 'BUDGET_THRESHOLD' | 'PERFORMANCE_DROP' | 'CAMPAIGN_PAUSED' | 'API_ERROR' | 'BULK_UPLOAD_COMPLETE' | 'BULK_UPLOAD_FAILED' | 'CUSTOM';
  condition: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS';
  threshold_value: string;
  target_campaigns?: number[];
  is_active: boolean;
  notification_frequency: 'IMMEDIATE' | 'HOURLY' | 'DAILY' | 'WEEKLY';
  chatwork_webhook_url?: string;
  slack_webhook_url?: string;
  email_notification: boolean;
  chatwork_message_template?: string;
  slack_message_template?: string;
  created_at?: string;
  updated_at?: string;
  last_triggered?: string;
}

export interface AlertNotification {
  id: number;
  alert_rule_name: string;
  campaign_name?: string;
  title: string;
  message: string;
  current_value: string;
  threshold_value: string;
  channel: 'CHATWORK' | 'SLACK' | 'EMAIL' | 'DASHBOARD';
  status: 'PENDING' | 'SENT' | 'FAILED';
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

export interface AlertSettings {
  global_notifications_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  default_chatwork_webhook?: string;
  default_slack_webhook?: string;
  default_email?: string;
  max_notifications_per_hour: number;
  max_notifications_per_day: number;
  created_at?: string;
  updated_at?: string;
}

export interface AlertStats {
  total_rules: number;
  active_rules: number;
  total_notifications: number;
  notifications_today: number;
  notifications_this_week: number;
  failed_notifications: number;
  success_rate: number;
  chatwork_notifications: number;
  slack_notifications: number;
  email_notifications: number;
  budget_alerts: number;
  performance_alerts: number;
  system_alerts: number;
}

class AlertService {
  // アラートルール管理
  async getAlertRules(): Promise<AlertRule[]> {
    try {
      const response = await api.get('/alerts/rules/');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Failed to fetch alert rules:', error);
      return [];
    }
  }

  async getAlertRule(id: number): Promise<AlertRule> {
    const response = await api.get(`/alerts/rules/${id}/`);
    return response.data;
  }

  async createAlertRule(rule: AlertRule): Promise<AlertRule> {
    const response = await api.post('/alerts/rules/', rule);
    return response.data;
  }

  async updateAlertRule(id: number, rule: AlertRule): Promise<AlertRule> {
    const response = await api.put(`/alerts/rules/${id}/`, rule);
    return response.data;
  }

  async deleteAlertRule(id: number): Promise<void> {
    await api.delete(`/alerts/rules/${id}/`);
  }

  async testAlertRule(id: number, testData: {
    test_message?: string;
    test_channels?: string[];
  }): Promise<{ status: string; message: string; notifications: AlertNotification[] }> {
    const response = await api.post(`/alerts/rules/${id}/test/`, testData);
    return response.data;
  }

  async toggleAlertRule(id: number): Promise<{ status: string; is_active: boolean; message: string }> {
    const response = await api.post(`/alerts/rules/${id}/toggle_active/`);
    return response.data;
  }

  // 通知履歴
  async getNotifications(): Promise<AlertNotification[]> {
    try {
      const response = await api.get('/alerts/notifications/');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      return [];
    }
  }

  async getRecentNotifications(): Promise<AlertNotification[]> {
    try {
      const response = await api.get('/alerts/notifications/recent/');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Failed to fetch recent notifications:', error);
      return [];
    }
  }

  async getFailedNotifications(): Promise<AlertNotification[]> {
    try {
      const response = await api.get('/alerts/notifications/failed/');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Failed to fetch failed notifications:', error);
      return [];
    }
  }

  // アラート設定
  async getAlertSettings(): Promise<AlertSettings> {
    const response = await api.get('/alerts/settings/');
    return response.data;
  }

  async updateAlertSettings(settings: AlertSettings): Promise<AlertSettings> {
    const response = await api.put('/alerts/settings/', settings);
    return response.data;
  }

  // 統計情報
  async getAlertStats(): Promise<AlertStats> {
    const response = await api.get('/alerts/stats/dashboard/');
    return response.data;
  }
}

const alertService = new AlertService();
export default alertService;
