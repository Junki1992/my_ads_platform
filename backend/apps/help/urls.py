from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    HelpCategoryViewSet, HelpArticleViewSet, UserGuideProgressViewSet,
    HelpStatsViewSet
)

router = DefaultRouter()
router.register(r'categories', HelpCategoryViewSet)
router.register(r'articles', HelpArticleViewSet)
router.register(r'guide-progress', UserGuideProgressViewSet)
router.register(r'stats', HelpStatsViewSet, basename='help-stats')

urlpatterns = [
    path('', include(router.urls)),
]
