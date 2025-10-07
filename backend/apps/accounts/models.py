from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _

class User(AbstractUser):
    """カスタムユーザーモデル"""
    email = models.EmailField(_('email address'), unique=True)
    company = models.CharField(_('company'), max_length=100, blank=True)
    phone = models.CharField(_('phone'), max_length=20, blank=True)
    language = models.CharField(_('language'), max_length=5, default='ja')
    timezone = models.CharField(_('timezone'), max_length=50, default='Asia/Tokyo')
    is_demo_user = models.BooleanField(_('demo user'), default=False)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    class Meta:
        db_table = 'accounts_user'

class MetaAccount(models.Model):
    """Meta広告アカウント"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='meta_accounts')
    account_id = models.CharField(max_length=50, unique=True)
    account_name = models.CharField(max_length=200)
    access_token = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Meta Account')
        verbose_name_plural = _('Meta Accounts')