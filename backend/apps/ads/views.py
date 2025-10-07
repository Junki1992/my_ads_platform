from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db import models
from .models import AdSubmission, AdTemplate
from .serializers import AdSubmissionSerializer, AdTemplateSerializer

class AdSubmissionViewSet(viewsets.ModelViewSet):
    """広告入稿ViewSet"""
    serializer_class = AdSubmissionSerializer
    
    def get_queryset(self):
        return AdSubmission.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """入稿実行"""
        submission = self.get_object()
        return Response({'status': 'success'})
    
    @action(detail=True, methods=['post'])
    def preview(self, request, pk=None):
        """プレビュー生成"""
        submission = self.get_object()
        return Response({'preview': 'preview_data'})

class AdTemplateViewSet(viewsets.ModelViewSet):
    """広告テンプレートViewSet"""
    serializer_class = AdTemplateSerializer
    
    def get_queryset(self):
        return AdTemplate.objects.filter(
            models.Q(user=self.request.user) | models.Q(is_public=True)
        )
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class AdPreviewView(APIView):
    """広告プレビューView"""
    def post(self, request):
        data = request.data
        return Response({'preview': 'preview_data'})
