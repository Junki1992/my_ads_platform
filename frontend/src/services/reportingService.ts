import api from './api';

export interface DailyInsightSummary {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
}

export interface DailyAdInsightRow {
  id: number;
  stat_date: string;
  meta_account: number;
  meta_account_name: string;
  meta_account_id_str: string;
  meta_business_name?: string;
  meta_business_id?: string;
  meta_ad_id: string;
  campaign_name: string;
  adset_name: string;
  ad_name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: string;
  spend: string;
  conversions: number;
  cpa: string | null;
  fetched_at: string;
}

export interface DailyInsightsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: DailyAdInsightRow[];
  summary?: DailyInsightSummary;
}

async function getDailyInsights(params: {
  start_date?: string;
  end_date?: string;
  meta_account?: number;
  page?: number;
  page_size?: number;
}): Promise<DailyInsightsResponse> {
  const response = await api.get<DailyInsightsResponse>('/reporting/daily-insights/', { params });
  return response.data;
}

export default {
  getDailyInsights,
};
