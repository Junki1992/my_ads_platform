from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'rules', views.AlertRuleViewSet, basename='alertrule')
router.register(r'notifications', views.AlertNotificationViewSet, basename='alertnotification')
router.register(r'settings', views.AlertSettingsViewSet, basename='alertsettings')
router.register(r'stats', views.AlertStatsView, basename='alertstats')

urlpatterns = [
    path('', include(router.urls)),
]

