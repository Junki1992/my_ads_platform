from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.accounts.models import User

class BulkUpload(models.Model):
    """大量入稿モデル"""
    STATUS_CHOICES = [
        ('UPLOADING', _('Uploading')),
        ('VALIDATING', _('Validating')),
        ('PROCESSING', _('Processing')),
        ('COMPLETED', _('Completed')),
        ('FAILED', _('Failed')),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bulk_uploads')
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    total_records = models.IntegerField(default=0)
    processed_records = models.IntegerField(default=0)
    successful_records = models.IntegerField(default=0)
    failed_records = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='UPLOADING')
    error_log = models.TextField(blank=True)
    selected_account_id = models.IntegerField(null=True, blank=True, help_text='選択されたMetaアカウントID')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Bulk Upload')
        verbose_name_plural = _('Bulk Uploads')

class BulkUploadRecord(models.Model):
    """大量入稿レコードモデル"""
    bulk_upload = models.ForeignKey(BulkUpload, on_delete=models.CASCADE, related_name='records')
    row_number = models.IntegerField()
    data = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=[
        ('PENDING', _('Pending')),
        ('SUCCESS', _('Success')),
        ('FAILED', _('Failed')),
    ], default='PENDING')
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('Bulk Upload Record')
        verbose_name_plural = _('Bulk Upload Records')