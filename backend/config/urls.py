from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/accounts/', include('apps.accounts.urls')),
    path('api/campaigns/', include('apps.campaigns.urls')),
    path('api/ads/', include('apps.ads.urls')),
    path('api/bulk-upload/', include('apps.bulk_upload.urls')),
    path('api/alerts/', include('apps.alerts.urls')),
    path('api/automation/', include('apps.automation.urls')),
    path('api/reporting/', include('apps.reporting.urls')),
    path('api/integrations/', include('apps.integrations.urls')),
    path('api/i18n/', include('apps.i18n.urls')),
    path('api/help/', include('apps.help.urls')),
    path('api/demo/', include('apps.demo.urls')),
    path('', include('apps.demo.urls')),  # ルートURLを追加
]

# 課金機能（環境変数で制御）
if settings.ENABLE_BILLING:
    urlpatterns.append(
        path('api/billing/', include('apps.billing.urls'))
    )

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)