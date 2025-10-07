from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'uploads', views.BulkUploadViewSet, basename='bulkupload')

urlpatterns = [
    path('', include(router.urls)),
    path('template/', views.BulkUploadTemplateView.as_view(), name='bulk-upload-template'),
]