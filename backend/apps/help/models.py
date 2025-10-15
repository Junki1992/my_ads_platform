from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class HelpCategory(models.Model):
    """ヘルプカテゴリ"""
    name = models.CharField(max_length=100, verbose_name="カテゴリ名")
    name_en = models.CharField(max_length=100, verbose_name="カテゴリ名（英語）")
    description = models.TextField(blank=True, verbose_name="説明")
    description_en = models.TextField(blank=True, verbose_name="説明（英語）")
    icon = models.CharField(max_length=50, default="question-circle", verbose_name="アイコン")
    order = models.IntegerField(default=0, verbose_name="表示順序")
    is_active = models.BooleanField(default=True, verbose_name="有効")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ヘルプカテゴリ"
        verbose_name_plural = "ヘルプカテゴリ"
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class HelpArticle(models.Model):
    """ヘルプ記事"""
    TYPE_CHOICES = [
        ('text', 'テキスト'),
        ('steps', 'ステップガイド'),
        ('video', '動画ガイド'),
        ('link', '外部リンク'),
    ]

    category = models.ForeignKey(
        HelpCategory, 
        on_delete=models.CASCADE, 
        related_name='articles',
        verbose_name="カテゴリ"
    )
    title = models.CharField(max_length=200, verbose_name="タイトル")
    title_en = models.CharField(max_length=200, verbose_name="タイトル（英語）")
    title_ko = models.CharField(max_length=200, verbose_name="タイトル（韓国語）", blank=True, default="")
    title_zh = models.CharField(max_length=200, verbose_name="タイトル（中国語）", blank=True, default="")
    summary = models.TextField(verbose_name="要約", help_text="一覧表示用の短い説明文", default="")
    summary_en = models.TextField(verbose_name="要約（英語）", help_text="一覧表示用の短い説明文（英語）", default="")
    summary_ko = models.TextField(verbose_name="要約（韓国語）", help_text="一覧表示用の短い説明文（韓国語）", default="")
    summary_zh = models.TextField(verbose_name="要約（中国語）", help_text="一覧表示用の短い説明文（中国語）", default="")
    content = models.TextField(verbose_name="内容")
    content_en = models.TextField(verbose_name="内容（英語）")
    content_ko = models.TextField(verbose_name="内容（韓国語）", default="")
    content_zh = models.TextField(verbose_name="内容（中国語）", default="")
    article_type = models.CharField(
        max_length=20, 
        choices=TYPE_CHOICES, 
        default='text',
        verbose_name="記事タイプ"
    )
    tags = models.JSONField(default=list, blank=True, verbose_name="タグ")
    video_url = models.URLField(blank=True, verbose_name="動画URL")
    external_url = models.URLField(blank=True, verbose_name="外部URL")
    page_context = models.CharField(max_length=100, blank=True, verbose_name="ページコンテキスト")
    element_selector = models.CharField(max_length=200, blank=True, verbose_name="要素セレクタ")
    order = models.IntegerField(default=0, verbose_name="表示順序")
    is_featured = models.BooleanField(default=False, verbose_name="おすすめ")
    is_active = models.BooleanField(default=True, verbose_name="有効")
    view_count = models.PositiveIntegerField(default=0, verbose_name="閲覧数")
    created_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        verbose_name="作成者"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ヘルプ記事"
        verbose_name_plural = "ヘルプ記事"
        ordering = ['order', 'title']

    def __str__(self):
        return self.title

    def increment_view_count(self):
        """閲覧数を増加"""
        self.view_count += 1
        self.save(update_fields=['view_count'])


class HelpFeedback(models.Model):
    """ヘルプフィードバック"""
    RATING_CHOICES = [
        (1, 'とても役に立たなかった'),
        (2, '役に立たなかった'),
        (3, '普通'),
        (4, '役に立った'),
        (5, 'とても役に立った'),
    ]

    article = models.ForeignKey(
        HelpArticle, 
        on_delete=models.CASCADE, 
        related_name='feedbacks',
        verbose_name="記事"
    )
    user = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        verbose_name="ユーザー"
    )
    rating = models.IntegerField(choices=RATING_CHOICES, verbose_name="評価")
    comment = models.TextField(blank=True, verbose_name="コメント")
    is_helpful = models.BooleanField(default=True, verbose_name="役に立った")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "ヘルプフィードバック"
        verbose_name_plural = "ヘルプフィードバック"
        unique_together = ['article', 'user']

    def __str__(self):
        return f"{self.article.title} - {self.get_rating_display()}"


class UserGuideProgress(models.Model):
    """ユーザーガイド進捗"""
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='guide_progress',
        verbose_name="ユーザー"
    )
    guide_type = models.CharField(max_length=50, verbose_name="ガイドタイプ")
    completed_steps = models.JSONField(default=list, verbose_name="完了したステップ")
    is_completed = models.BooleanField(default=False, verbose_name="完了済み")
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name="完了日時")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ユーザーガイド進捗"
        verbose_name_plural = "ユーザーガイド進捗"
        unique_together = ['user', 'guide_type']

    def __str__(self):
        return f"{self.user.username} - {self.guide_type}"

    def mark_step_completed(self, step_id: str):
        """ステップを完了としてマーク"""
        if step_id not in self.completed_steps:
            self.completed_steps.append(step_id)
            self.save()

    def mark_completed(self):
        """ガイドを完了としてマーク"""
        self.is_completed = True
        from django.utils import timezone
        self.completed_at = timezone.now()
        self.save()
