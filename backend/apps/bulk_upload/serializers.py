from rest_framework import serializers
from .models import BulkUpload, BulkUploadRecord

class BulkUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = BulkUpload
        fields = '__all__'

class BulkUploadRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = BulkUploadRecord
        fields = '__all__'