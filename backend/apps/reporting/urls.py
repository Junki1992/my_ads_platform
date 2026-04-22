from django.urls import path

from .views import DailyAdInsightListView

urlpatterns = [
    path('daily-insights/', DailyAdInsightListView.as_view(), name='daily-insights-list'),
]

