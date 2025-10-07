from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.accounts.models import User

class AdSubmission(models.Model):
    """広告入稿モデル"""
    STATUS_CHOICES = [
        ('DRAFT', _('Draft')),
        ('SUBMITTED', _('Submitted')),
        ('APPROVED', _('Approved')),
        ('REJECTED', _('Rejected')),
        ('ACTIVE', _('Active')),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ad_submissions')
    campaign_name = models.CharField(max_length=200)
    adset_name = models.CharField(max_length=200)
    ad_name = models.CharField(max_length=200)
    budget_type = models.CharField(max_length=20, choices=[('DAILY', _('Daily')), ('LIFETIME', _('Lifetime'))])
    budget = models.DecimalField(max_digits=10, decimal_places=2)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)
    targeting = models.JSONField(default=dict)
    creative = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Ad Submission')
        verbose_name_plural = _('Ad Submissions')

class AdTemplate(models.Model):
    """広告テンプレートモデル"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ad_templates')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    template_data = models.JSONField(default=dict)
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Ad Template')
        verbose_name_plural = _('Ad Templates')