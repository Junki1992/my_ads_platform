from rest_framework import serializers
from .models import HelpCategory, HelpArticle, HelpFeedback, UserGuideProgress


class HelpCategorySerializer(serializers.ModelSerializer):
    """ヘルプカテゴリシリアライザー"""
    article_count = serializers.SerializerMethodField()

    class Meta:
        model = HelpCategory
        fields = [
            'id', 'name', 'name_en', 'description', 'description_en',
            'icon', 'order', 'is_active', 'article_count', 'created_at'
        ]

    def get_article_count(self, obj):
        return obj.articles.filter(is_active=True).count()


class HelpArticleSerializer(serializers.ModelSerializer):
    """ヘルプ記事シリアライザー"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_name_en = serializers.CharField(source='category.name_en', read_only=True)
    average_rating = serializers.SerializerMethodField()
    feedback_count = serializers.SerializerMethodField()

    class Meta:
        model = HelpArticle
        fields = [
            'id', 'category', 'category_name', 'category_name_en',
            'title', 'title_en', 'title_ko', 'title_zh',
            'summary', 'summary_en', 'summary_ko', 'summary_zh',
            'content', 'content_en', 'content_ko', 'content_zh',
            'article_type', 'tags', 'video_url', 'external_url',
            'page_context', 'element_selector', 'order',
            'is_featured', 'is_active', 'view_count',
            'average_rating', 'feedback_count', 'created_at', 'updated_at'
        ]

    def get_average_rating(self, obj):
        feedbacks = obj.feedbacks.all()
        if feedbacks.exists():
            return sum(f.rating for f in feedbacks) / feedbacks.count()
        return None

    def get_feedback_count(self, obj):
        return obj.feedbacks.count()


class HelpArticleListSerializer(serializers.ModelSerializer):
    """ヘルプ記事一覧用シリアライザー（軽量版）"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_name_en = serializers.CharField(source='category.name_en', read_only=True)

    class Meta:
        model = HelpArticle
        fields = [
            'id', 'category', 'category_name', 'category_name_en',
            'title', 'title_en', 'title_ko', 'title_zh',
            'summary', 'summary_en', 'summary_ko', 'summary_zh',
            'article_type', 'tags',
            'page_context', 'element_selector', 'is_featured',
            'view_count', 'created_at'
        ]


class HelpFeedbackSerializer(serializers.ModelSerializer):
    """ヘルプフィードバックシリアライザー"""
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = HelpFeedback
        fields = [
            'id', 'article', 'user', 'user_name', 'rating',
            'comment', 'is_helpful', 'created_at'
        ]
        read_only_fields = ['user']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class UserGuideProgressSerializer(serializers.ModelSerializer):
    """ユーザーガイド進捗シリアライザー"""
    
    class Meta:
        model = UserGuideProgress
        fields = [
            'id', 'user', 'guide_type', 'completed_steps',
            'is_completed', 'completed_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['user']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class HelpSearchSerializer(serializers.Serializer):
    """ヘルプ検索シリアライザー"""
    query = serializers.CharField(max_length=200)
    category = serializers.CharField(max_length=50, required=False)
    page_context = serializers.CharField(max_length=100, required=False)
    article_type = serializers.CharField(max_length=20, required=False)


class HelpStatsSerializer(serializers.Serializer):
    """ヘルプ統計シリアライザー"""
    total_articles = serializers.IntegerField()
    total_categories = serializers.IntegerField()
    total_feedbacks = serializers.IntegerField()
    most_viewed_articles = HelpArticleListSerializer(many=True)
    most_helpful_articles = HelpArticleListSerializer(many=True)
    category_stats = serializers.DictField()
