from django.contrib import admin
from .models import HelpCategory, HelpArticle, HelpFeedback, UserGuideProgress


@admin.register(HelpCategory)
class HelpCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'name_en', 'icon', 'order', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'name_en', 'description']
    ordering = ['order', 'name']
    list_editable = ['order', 'is_active']


@admin.register(HelpArticle)
class HelpArticleAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'category', 'article_type', 'page_context',
        'order', 'is_featured', 'view_count', 'is_active', 'created_at'
    ]
    list_filter = [
        'category', 'article_type', 'page_context', 'is_featured',
        'is_active', 'created_at'
    ]
    search_fields = ['title', 'title_en', 'content', 'tags']
    ordering = ['order', 'title']
    list_editable = ['order', 'is_featured', 'is_active']
    filter_horizontal = []
    raw_id_fields = ['created_by']
    
    fieldsets = (
        ('基本情報', {
            'fields': ('category', 'title', 'title_en', 'summary', 'summary_en', 'content', 'content_en')
        }),
        ('設定', {
            'fields': (
                'article_type', 'tags', 'video_url', 'external_url',
                'page_context', 'element_selector', 'order'
            )
        }),
        ('表示設定', {
            'fields': ('is_featured', 'is_active')
        }),
        ('統計', {
            'fields': ('view_count',),
            'classes': ('collapse',)
        }),
        ('管理情報', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['view_count', 'created_at', 'updated_at']

    def save_model(self, request, obj, form, change):
        if not change:  # 新規作成時
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(HelpFeedback)
class HelpFeedbackAdmin(admin.ModelAdmin):
    list_display = ['article', 'user', 'rating', 'is_helpful', 'created_at']
    list_filter = ['rating', 'is_helpful', 'created_at']
    search_fields = ['article__title', 'user__username', 'comment']
    ordering = ['-created_at']
    raw_id_fields = ['article', 'user']


@admin.register(UserGuideProgress)
class UserGuideProgressAdmin(admin.ModelAdmin):
    list_display = [
        'user', 'guide_type', 'is_completed', 
        'completed_steps_count', 'completed_at', 'created_at'
    ]
    list_filter = ['guide_type', 'is_completed', 'created_at']
    search_fields = ['user__username', 'guide_type']
    ordering = ['-created_at']
    raw_id_fields = ['user']

    def completed_steps_count(self, obj):
        return len(obj.completed_steps)
    completed_steps_count.short_description = '完了ステップ数'
