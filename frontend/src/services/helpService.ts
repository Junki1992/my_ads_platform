import api from './api';

export interface HelpCategory {
  id: number;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  icon: string;
  order: number;
  is_active: boolean;
  article_count: number;
  created_at: string;
}

export interface HelpArticle {
  id: number;
  category: number;
  category_name: string;
  category_name_en: string;
  title: string;
  title_en: string;
  content: string;
  content_en: string;
  article_type: 'text' | 'steps' | 'video' | 'link';
  tags: string[];
  video_url?: string;
  external_url?: string;
  page_context?: string;
  element_selector?: string;
  order: number;
  is_featured: boolean;
  is_active: boolean;
  view_count: number;
  average_rating?: number;
  feedback_count: number;
  created_at: string;
  updated_at: string;
}

export interface HelpSearchParams {
  query?: string;
  category?: string;
  page_context?: string;
  article_type?: string;
}

export interface HelpFeedback {
  rating: number;
  comment?: string;
  is_helpful: boolean;
}

class HelpService {
  // ヘルプカテゴリ一覧を取得
  async getCategories(): Promise<HelpCategory[]> {
    const response = await api.get('/help/categories/');
    return response.data;
  }

  // ヘルプ記事一覧を取得
  async getArticles(params?: HelpSearchParams): Promise<HelpArticle[]> {
    const response = await api.get('/help/articles/', { params });
    // APIレスポンスは {results: [...]} の形式
    return response.data.results || response.data || [];
  }

  // 特定のヘルプ記事を取得
  async getArticle(id: number): Promise<HelpArticle> {
    const response = await api.get(`/help/articles/${id}/`);
    return response.data;
  }

  // ヘルプ記事を検索
  async searchArticles(searchParams: HelpSearchParams): Promise<HelpArticle[]> {
    const response = await api.post('/help/articles/search/', searchParams);
    return response.data.results || response.data || [];
  }

  // おすすめ記事を取得
  async getFeaturedArticles(): Promise<HelpArticle[]> {
    const response = await api.get('/help/articles/featured/');
    return response.data;
  }

  // ページコンテキスト別記事を取得
  async getArticlesByContext(context: string): Promise<HelpArticle[]> {
    const response = await api.get('/help/articles/by_context/', { 
      params: { context } 
    });
    return response.data;
  }

  // ヘルプフィードバックを送信
  async submitFeedback(articleId: number, feedback: HelpFeedback): Promise<void> {
    await api.post(`/help/articles/${articleId}/feedback/`, feedback);
  }

  // ユーザーガイド進捗を更新
  async updateGuideProgress(guideType: string, completedSteps: string[]): Promise<void> {
    await api.post('/help/guide-progress/', {
      guide_type: guideType,
      completed_steps: completedSteps
    });
  }

  // ステップ完了をマーク
  async completeStep(guideType: string, stepId: string): Promise<void> {
    await api.post('/help/guide-progress/complete_step/', {
      guide_type: guideType,
      step_id: stepId
    });
  }

  // ガイド完了をマーク
  async completeGuide(guideType: string): Promise<void> {
    await api.post('/help/guide-progress/complete_guide/', {
      guide_type: guideType
    });
  }

  // ヘルプ統計を取得
  async getStats(): Promise<any> {
    const response = await api.get('/help/stats/overview/');
    return response.data;
  }
}

const helpService = new HelpService();
export default helpService;
