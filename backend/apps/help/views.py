from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count, Avg
from django.utils import timezone
from .models import HelpCategory, HelpArticle, HelpFeedback, UserGuideProgress
from .serializers import (
    HelpCategorySerializer, HelpArticleSerializer, HelpArticleListSerializer,
    HelpFeedbackSerializer, UserGuideProgressSerializer, HelpSearchSerializer,
    HelpStatsSerializer
)


class HelpCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ヘルプカテゴリビューセット"""
    queryset = HelpCategory.objects.filter(is_active=True)
    serializer_class = HelpCategorySerializer
    permission_classes = [AllowAny]
    ordering = ['order', 'name']


class HelpArticleViewSet(viewsets.ReadOnlyModelViewSet):
    """ヘルプ記事ビューセット"""
    queryset = HelpArticle.objects.filter(is_active=True).select_related('category')
    serializer_class = HelpArticleSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'article_type', 'page_context', 'is_featured']
    search_fields = ['title', 'title_en', 'content', 'content_en', 'tags']
    ordering_fields = ['order', 'title', 'view_count', 'created_at']
    ordering = ['order', 'title']

    def get_serializer_class(self):
        # フロントエンドでコンテンツ表示に必要なので、常に完全なシリアライザーを使用
        return HelpArticleSerializer

    def retrieve(self, request, *args, **kwargs):
        """記事詳細取得時に閲覧数を増加"""
        instance = self.get_object()
        instance.increment_view_count()
        return super().retrieve(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def search(self, request):
        """高度な検索機能"""
        serializer = HelpSearchSerializer(data=request.data)
        if serializer.is_valid():
            query = serializer.validated_data['query']
            category = serializer.validated_data.get('category')
            page_context = serializer.validated_data.get('page_context')
            article_type = serializer.validated_data.get('article_type')

            queryset = self.get_queryset()

            # テキスト検索
            if query:
                queryset = queryset.filter(
                    Q(title__icontains=query) |
                    Q(title_en__icontains=query) |
                    Q(content__icontains=query) |
                    Q(content_en__icontains=query) |
                    Q(tags__icontains=query)
                )

            # フィルタリング
            if category:
                queryset = queryset.filter(category__name=category)
            if page_context:
                queryset = queryset.filter(page_context=page_context)
            if article_type:
                queryset = queryset.filter(article_type=article_type)

            # ページネーション
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def feedback(self, request, pk=None):
        """記事へのフィードバック投稿"""
        article = self.get_object()
        serializer = HelpFeedbackSerializer(
            data=request.data,
            context={'request': request}
        )
        if serializer.is_valid():
            # 既存のフィードバックがある場合は更新
            feedback, created = HelpFeedback.objects.get_or_create(
                article=article,
                user=request.user,
                defaults=serializer.validated_data
            )
            if not created:
                for key, value in serializer.validated_data.items():
                    setattr(feedback, key, value)
                feedback.save()

            return Response(
                {'message': 'フィードバックを保存しました'},
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """おすすめ記事一覧"""
        queryset = self.get_queryset().filter(is_featured=True)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_context(self, request):
        """ページコンテキスト別記事一覧"""
        page_context = request.query_params.get('context')
        if not page_context:
            return Response(
                {'error': 'page_contextパラメータが必要です'},
                status=status.HTTP_400_BAD_REQUEST
            )

        queryset = self.get_queryset().filter(page_context=page_context)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class UserGuideProgressViewSet(viewsets.ModelViewSet):
    """ユーザーガイド進捗ビューセット"""
    queryset = UserGuideProgress.objects.all()
    serializer_class = UserGuideProgressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            # 既存の進捗がある場合は更新
            progress, created = UserGuideProgress.objects.get_or_create(
                user=request.user,
                guide_type=serializer.validated_data['guide_type'],
                defaults=serializer.validated_data
            )
            if not created:
                for key, value in serializer.validated_data.items():
                    setattr(progress, key, value)
                progress.save()

            return Response(
                UserGuideProgressSerializer(progress).data,
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def complete_step(self, request):
        """ステップ完了のマーク"""
        guide_type = request.data.get('guide_type')
        step_id = request.data.get('step_id')

        if not guide_type or not step_id:
            return Response(
                {'error': 'guide_typeとstep_idが必要です'},
                status=status.HTTP_400_BAD_REQUEST
            )

        progress, created = UserGuideProgress.objects.get_or_create(
            user=request.user,
            guide_type=guide_type,
            defaults={'completed_steps': []}
        )

        progress.mark_step_completed(step_id)
        return Response(UserGuideProgressSerializer(progress).data)

    @action(detail=False, methods=['post'])
    def complete_guide(self, request):
        """ガイド完了のマーク"""
        guide_type = request.data.get('guide_type')

        if not guide_type:
            return Response(
                {'error': 'guide_typeが必要です'},
                status=status.HTTP_400_BAD_REQUEST
            )

        progress, created = UserGuideProgress.objects.get_or_create(
            user=request.user,
            guide_type=guide_type
        )

        progress.mark_completed()
        return Response(UserGuideProgressSerializer(progress).data)


class HelpStatsViewSet(viewsets.ViewSet):
    """ヘルプ統計ビューセット"""
    permission_classes = [AllowAny]

    @action(detail=False, methods=['get'])
    def overview(self, request):
        """ヘルプ統計の概要"""
        # 基本統計
        total_articles = HelpArticle.objects.filter(is_active=True).count()
        total_categories = HelpCategory.objects.filter(is_active=True).count()
        total_feedbacks = HelpFeedback.objects.count()

        # 人気記事（閲覧数順）
        most_viewed_articles = HelpArticle.objects.filter(
            is_active=True
        ).order_by('-view_count')[:5]

        # 評価の高い記事
        most_helpful_articles = HelpArticle.objects.filter(
            is_active=True
        ).annotate(
            avg_rating=Avg('feedbacks__rating')
        ).filter(
            avg_rating__isnull=False
        ).order_by('-avg_rating')[:5]

        # カテゴリ別統計
        category_stats = {}
        for category in HelpCategory.objects.filter(is_active=True):
            article_count = category.articles.filter(is_active=True).count()
            if article_count > 0:
                category_stats[category.name] = {
                    'article_count': article_count,
                    'total_views': sum(
                        article.view_count 
                        for article in category.articles.filter(is_active=True)
                    )
                }

        data = {
            'total_articles': total_articles,
            'total_categories': total_categories,
            'total_feedbacks': total_feedbacks,
            'most_viewed_articles': HelpArticleListSerializer(
                most_viewed_articles, many=True
            ).data,
            'most_helpful_articles': HelpArticleListSerializer(
                most_helpful_articles, many=True
            ).data,
            'category_stats': category_stats
        }

        serializer = HelpStatsSerializer(data)
        return Response(serializer.data)
