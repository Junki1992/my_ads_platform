from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'campaigns', views.CampaignViewSet, basename='campaign')
router.register(r'adsets', views.AdSetViewSet, basename='adset')
router.register(r'ads', views.AdViewSet, basename='ad')

urlpatterns = [
    path('', include(router.urls)),
]