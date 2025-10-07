from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'submissions', views.AdSubmissionViewSet, basename='adsubmission')
router.register(r'templates', views.AdTemplateViewSet, basename='adtemplate')

urlpatterns = [
    path('', include(router.urls)),
    path('preview/', views.AdPreviewView.as_view(), name='ad-preview'),
]