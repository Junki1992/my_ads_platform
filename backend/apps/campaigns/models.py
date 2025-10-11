from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.accounts.models import User, MetaAccount

class Campaign(models.Model):
    """キャンペーンモデル"""
    STATUS_CHOICES = [
        ('ACTIVE', _('Active')),
        ('PAUSED', _('Paused')),
        ('DELETED', _('Deleted')),
    ]
    
    # Meta API公式のキャンペーン目的（Meta APIで実際に使用可能な値に統一）
    OBJECTIVE_CHOICES = [
        # Meta APIで実際に使用可能なobjective値を直接使用
        ('APP_INSTALLS', _('App Installs')),
        ('BRAND_AWARENESS', _('Brand Awareness')),
        ('EVENT_RESPONSES', _('Event Responses')),
        ('LEAD_GENERATION', _('Lead Generation')),
        ('LINK_CLICKS', _('Link Clicks')),
        ('LOCAL_AWARENESS', _('Local Awareness')),
        ('MESSAGES', _('Messages')),
        ('OFFER_CLAIMS', _('Offer Claims')),
        ('PAGE_LIKES', _('Page Likes')),
        ('POST_ENGAGEMENT', _('Post Engagement')),
        ('PRODUCT_CATALOG_SALES', _('Product Catalog Sales')),
        ('REACH', _('Reach')),
        ('STORE_VISITS', _('Store Visits')),
        ('VIDEO_VIEWS', _('Video Views')),
        
        # Outcome系（Meta APIで推奨される新しいobjective）
        ('OUTCOME_AWARENESS', _('Awareness')),
        ('OUTCOME_ENGAGEMENT', _('Engagement')),
        ('OUTCOME_LEADS', _('Leads')),
        ('OUTCOME_SALES', _('Sales')),
        ('OUTCOME_TRAFFIC', _('Traffic')),
        ('OUTCOME_APP_PROMOTION', _('App Promotion')),
        
        # 最も一般的なコンバージョン系objective
        ('CONVERSIONS', _('Conversions')),
    ]
    
    # 予算タイプ
    BUDGET_TYPE_CHOICES = [
        ('DAILY', _('Daily Budget')),
        ('LIFETIME', _('Lifetime Budget')),
    ]
    
    # 予算最適化
    BUDGET_OPTIMIZATION_CHOICES = [
        ('STANDARD', _('Standard')),
        ('ACCELERATED', _('Accelerated')),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='campaigns')
    meta_account = models.ForeignKey(MetaAccount, on_delete=models.CASCADE, related_name='campaigns')
    campaign_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    objective = models.CharField(max_length=50, choices=OBJECTIVE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PAUSED')
    
    # 予算設定
    budget_type = models.CharField(max_length=20, choices=BUDGET_TYPE_CHOICES)
    budget_optimization = models.CharField(max_length=20, choices=BUDGET_OPTIMIZATION_CHOICES, default='STANDARD')
    budget = models.DecimalField(max_digits=10, decimal_places=2)
    budget_remaining = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # スケジュール設定
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)
    schedule_start_time = models.TimeField(null=True, blank=True)
    schedule_end_time = models.TimeField(null=True, blank=True)
    schedule_days = models.JSONField(default=list)  # ['monday', 'tuesday', ...]
    timezone = models.CharField(max_length=50, default='Asia/Tokyo')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Campaign')
        verbose_name_plural = _('Campaigns')

class AdSet(models.Model):
    """広告セットモデル"""
    # Meta API公式の入札戦略
    BID_STRATEGY_CHOICES = [
        ('LOWEST_COST_WITHOUT_CAP', _('Lowest Cost Without Cap')),
        ('LOWEST_COST_WITH_BID_CAP', _('Lowest Cost With Bid Cap')),
        ('COST_CAP', _('Cost Cap')),
        ('LOWEST_COST_WITH_MIN_ROAS', _('Lowest Cost With Min ROAS')),
    ]
    
    # 最適化目標
    OPTIMIZATION_GOAL_CHOICES = [
        ('NONE', _('None')),
        ('APP_INSTALLS', _('App Installs')),
        ('AD_RECALL_LIFT', _('Ad Recall Lift')),
        ('ENGAGED_USERS', _('Engaged Users')),
        ('EVENT_RESPONSES', _('Event Responses')),
        ('IMPRESSIONS', _('Impressions')),
        ('LEAD_GENERATION', _('Lead Generation')),
        ('QUALITY_LEAD', _('Quality Lead')),
        ('LINK_CLICKS', _('Link Clicks')),
        ('OFFSITE_CONVERSIONS', _('Offsite Conversions')),
        ('PAGE_LIKES', _('Page Likes')),
        ('POST_ENGAGEMENT', _('Post Engagement')),
        ('QUALITY_CALL', _('Quality Call')),
        ('REACH', _('Reach')),
        ('LANDING_PAGE_VIEWS', _('Landing Page Views')),
        ('VISIT_INSTAGRAM_PROFILE', _('Visit Instagram Profile')),
        ('VALUE', _('Value')),
        ('THRUPLAY', _('ThruPlay')),
        ('DERIVED_EVENTS', _('Derived Events')),
    ]
    
    # 配信タイプ
    DELIVERY_TYPE_CHOICES = [
        ('STANDARD', _('Standard')),
        ('ACCELERATED', _('Accelerated')),
    ]
    
    # プレースメント
    PLACEMENT_CHOICES = [
        ('AUTOMATIC', _('Automatic Placements')),
        ('MANUAL', _('Manual Placements')),
    ]
    
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='adsets')
    adset_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=Campaign.STATUS_CHOICES, default='PAUSED')
    
    # 予算設定
    budget = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    budget_type = models.CharField(max_length=20, choices=Campaign.BUDGET_TYPE_CHOICES, null=True, blank=True)
    
    # 入札・最適化設定
    bid_strategy = models.CharField(max_length=50, choices=BID_STRATEGY_CHOICES, default='LOWEST_COST_WITHOUT_CAP')
    bid_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    optimization_goal = models.CharField(max_length=50, choices=OPTIMIZATION_GOAL_CHOICES, default='LINK_CLICKS')
    
    # ターゲティング設定
    targeting = models.JSONField(default=dict)  # 詳細なターゲティング設定を格納
    # targeting構造例:
    # {
    #   "geo_locations": {"countries": ["JP"], "regions": [], "cities": []},
    #   "age_min": 18,
    #   "age_max": 65,
    #   "genders": [1, 2],  # 1: male, 2: female
    #   "interests": [],
    #   "behaviors": [],
    #   "custom_audiences": [],
    #   "excluded_custom_audiences": [],
    #   "lookalike_audiences": []
    # }
    
    # プレースメント設定
    placement_type = models.CharField(max_length=20, choices=PLACEMENT_CHOICES, default='AUTOMATIC')
    placements = models.JSONField(default=dict)  # プレースメント詳細設定
    # placements構造例:
    # {
    #   "facebook_positions": ["feed", "right_hand_column", "instant_article", "marketplace"],
    #   "instagram_positions": ["stream", "story", "explore"],
    #   "audience_network_positions": ["classic", "rewarded_video"],
    #   "messenger_positions": ["messenger_home", "sponsored_messages"],
    #   "device_platforms": ["mobile", "desktop"]
    # }
    
    # スケジュール設定
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    delivery_type = models.CharField(max_length=20, choices=DELIVERY_TYPE_CHOICES, default='STANDARD')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Ad Set')
        verbose_name_plural = _('Ad Sets')

class Ad(models.Model):
    """広告モデル"""
    # クリエイティブタイプ
    CREATIVE_TYPE_CHOICES = [
        ('SINGLE_IMAGE', _('Single Image')),
        ('SINGLE_VIDEO', _('Single Video')),
        ('CAROUSEL', _('Carousel')),
        ('COLLECTION', _('Collection')),
        ('SLIDESHOW', _('Slideshow')),
        ('INSTANT_EXPERIENCE', _('Instant Experience')),
    ]
    
    # CTA（Call To Action）タイプ
    CTA_TYPE_CHOICES = [
        ('NO_BUTTON', _('No Button')),
        ('LEARN_MORE', _('Learn More')),
        ('SHOP_NOW', _('Shop Now')),
        ('SIGN_UP', _('Sign Up')),
        ('DOWNLOAD', _('Download')),
        ('BOOK_TRAVEL', _('Book Travel')),
        ('CONTACT_US', _('Contact Us')),
        ('GET_QUOTE', _('Get Quote')),
        ('SUBSCRIBE', _('Subscribe')),
        ('APPLY_NOW', _('Apply Now')),
        ('DONATE', _('Donate')),
        ('GET_OFFER', _('Get Offer')),
        ('INSTALL_APP', _('Install App')),
        ('LISTEN_NOW', _('Listen Now')),
        ('ORDER_NOW', _('Order Now')),
        ('PLAY_GAME', _('Play Game')),
        ('REGISTER', _('Register')),
        ('SEE_MENU', _('See Menu')),
        ('WATCH_MORE', _('Watch More')),
        ('SEND_MESSAGE', _('Send Message')),
    ]
    
    adset = models.ForeignKey(AdSet, on_delete=models.CASCADE, related_name='ads')
    ad_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=Campaign.STATUS_CHOICES, default='PAUSED')
    
    # クリエイティブ設定
    creative_type = models.CharField(max_length=50, choices=CREATIVE_TYPE_CHOICES, default='SINGLE_IMAGE')
    
    # テキスト要素
    headline = models.CharField(max_length=100, blank=True)
    description = models.TextField(max_length=500, blank=True)
    link_url = models.URLField(blank=True)
    display_link = models.CharField(max_length=100, blank=True)
    
    # CTA設定
    cta_type = models.CharField(max_length=50, choices=CTA_TYPE_CHOICES, default='LEARN_MORE')
    
    # FacebookページID（広告作成に必要）
    facebook_page_id = models.CharField(max_length=50, blank=True, null=True)
    
    # 審査状況
    review_feedback = models.JSONField(default=dict, blank=True)
    # review_feedback構造例:
    # {
    #   "overall_status": "APPROVED", // APPROVED, PENDING, REJECTED
    #   "details": [
    #     {
    #       "field": "creative",
    #       "status": "APPROVED",
    #       "message": "Creative approved"
    #     }
    #   ]
    # }
    
    # メディア設定
    creative = models.JSONField(default=dict)
    # creative構造例:
    # {
    #   "image_url": "https://...",
    #   "video_url": "https://...",
    #   "thumbnail_url": "https://...",
    #   "carousel_cards": [
    #     {
    #       "image_url": "https://...",
    #       "headline": "Card 1",
    #       "description": "...",
    #       "link_url": "https://..."
    #     }
    #   ]
    # }
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Ad')
        verbose_name_plural = _('Ads')
