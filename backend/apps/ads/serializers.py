from rest_framework import serializers
from .models import AdSubmission, AdTemplate

class AdSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdSubmission
        fields = '__all__'

class AdTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdTemplate
        fields = '__all__'