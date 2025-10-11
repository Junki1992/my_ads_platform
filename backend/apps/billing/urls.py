from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'subscriptions', views.SubscriptionViewSet, basename='subscription')
router.register(r'payments', views.PaymentViewSet, basename='payment')
router.register(r'usage', views.UsageMetricsViewSet, basename='usage')
router.register(r'plan-limits', views.PlanLimitViewSet, basename='plan-limit')

urlpatterns = [
    path('', include(router.urls)),
    path('webhook/', views.stripe_webhook, name='stripe-webhook'),
]

