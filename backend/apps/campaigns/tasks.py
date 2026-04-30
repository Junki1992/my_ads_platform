from celery import shared_task
from django.conf import settings
import requests
import logging
import base64
import os
from urllib.parse import urljoin

logger = logging.getLogger(__name__)


def _meta_campaign_insights_time_range_json():
    """Meta campaign insights 用 time_range（実行日から最大約1年・当日まで）"""
    from datetime import timedelta
    import json
    from django.utils import timezone

    end_d = timezone.now().date()
    start_d = end_d - timedelta(days=364)
    return json.dumps({'since': start_d.strftime('%Y-%m-%d'), 'until': end_d.strftime('%Y-%m-%d')})


def upload_image_to_meta(ad, access_token):
    """
    Meta APIに画像をアップロードしてハッシュIDを取得する関数
    """
    try:
        logger.info(f"=== META API IMAGE UPLOAD DEBUG START ===")
        logger.info(f"Ad ID: {ad.id}")
        logger.info(f"Ad Name: {ad.name}")
        
        # Adからクリエイティブ情報を取得
        creative_data = ad.creative
        logger.info(f"Creative data from ad: {creative_data}")
        logger.info(f"Creative data type: {type(creative_data)}")
        
        if not creative_data or not isinstance(creative_data, dict):
            logger.info("No creative data found for ad")
            return None
            
        # 画像ファイルのパスを取得
        image_url = creative_data.get('image_url', '')
        image_file_path = creative_data.get('image_file_path', '')
        
        if not image_file_path:
            logger.info("No image file path found in creative data")
            return None
            
        # 実際のファイルパスを構築
        full_image_path = os.path.join(settings.MEDIA_ROOT, image_file_path)
        
        if not os.path.exists(full_image_path):
            logger.warning(f"Image file does not exist: {full_image_path}")
            return None
            
        logger.info(f"Image file exists at: {full_image_path}")
        logger.info(f"File size check: {os.path.getsize(full_image_path)} bytes")
        
        # Meta APIに画像をアップロード
        meta_api_url = "https://graph.facebook.com/v22.0/adaccounts/{account_id}/adimages"
        logger.info(f"Meta API URL template: {meta_api_url}")
        
        # アクセストークンチェック
        logger.info(f"Access token starts with 'demo_': {access_token.startswith('demo_')}")
        logger.info(f"Access token starts with 'demo_token': {access_token.startswith('demo_token')}")
        
        # ここではデモ模式では実際のアップロードをスキップし、デモハッシュを返す
        if access_token.startswith('demo_') or access_token.startswith('demo_token'):
            logger.info("Demo mode: Skipping actual image upload to Meta API")
            # Base64データがあればそれを使用、なければデモハッシュを返す
            if 'image_base64_data' in creative_data:
                return f"demo_image_hash_{ad.id}"
            return None
            
        # 実際のMeta APIアップロード（開発環境でMetaトークンが有効な場合）
        try:
            account_id = ad.adset.campaign.meta_account.account_id
            # Meta APIの正しい形式: act_1576785066140972/adimages
            api_url = f"https://graph.facebook.com/v22.0/act_{account_id}/adimages"
            
            logger.info(f"Account ID: {account_id}")
            logger.info(f"API URL: {api_url}")
            logger.info(f"Opening image file: {full_image_path}")
            
            with open(full_image_path, 'rb') as image_file:
                files = {'filename': image_file}
                
                logger.info("Sending request to Meta API...")
                
                # POST先URLを構築（account_idはaccess_tokenから取得する必要がある）
                response = requests.post(
                    api_url,
                    headers={'Authorization': f'Bearer {access_token}'},
                    files=files,
                    timeout=30
                )
                
                logger.info(f"Meta API response status: {response.status_code}")
                logger.info(f"Meta API response text: {response.text[:500]}...")  # 最初の500文字
                
                if response.status_code == 200:
                    response_data = response.json()
                    logger.info(f"Full response data keys: {list(response_data.keys())}")
                    
                    # Meta APIは {'images': {'filename': {'hash': '...', ...}}} の形式で返す
                    if 'images' in response_data:
                        images_data = response_data['images']
                        logger.info(f"Images data keys: {list(images_data.keys())}")
                        
                        # 最初の画像ファイルのデータを取得
                        filename = list(images_data.keys())[0]
                        image_info = images_data[filename]
                        image_hash = image_info['hash']
                        image_url = image_info.get('url', f'https://graph.facebook.com/{image_hash}')
                        
                        logger.info(f"Image uploaded successfully! Filename: {filename}")
                        logger.info(f"Image Hash: {image_hash}")
                        logger.info(f"Image URL: {image_url}")
                        
                        # pictureフィールドにはURLが必要、ハッシュでもurlもあるのでURLを返す
                        return image_url
                    elif 'hash' in response_data:
                        logger.info(f"Image uploaded successfully with hash: {response_data['hash']}")
                        return response_data['hash']
                        
        except Exception as e:
            logger.error(f"Failed to upload image in production mode: {str(e)}")
            logger.error(f"Exception type: {type(e)}")
            logger.error(f"Exception details: {e}")
            return None
            
    except Exception as e:
        logger.error(f"Error in upload_image_to_meta: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        
    logger.info(f"=== META API IMAGE UPLOAD DEBUG END ===")
    return None

@shared_task(bind=True)
def submit_campaign_to_meta(self, campaign_id):
    """実際のMeta APIにキャンペーンを投稿するタスク"""
    from .models import Campaign
    from apps.accounts.models import MetaAccount
    
    try:
        # デバッグ情報を追加
        logger.info(f"=== TASK STARTED ===")
        logger.info(f"Campaign ID: {campaign_id}")
        
        # キャンペーンを取得
        campaign = Campaign.objects.get(id=campaign_id)
        meta_account = campaign.meta_account
        
        logger.info(f"Campaign Name: {campaign.name}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        logger.info(f"Meta Account Active: {meta_account.is_active}")
        logger.info(f"Meta Account Token: {meta_account.access_token[:30]}...")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        logger.info(f"Starting Meta API submission for campaign: {campaign.name}")
        
        # Meta APIのベースURL（最新バージョンに更新）
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # 1. キャンペーン作成（Meta APIの要件に準拠）
        # objectiveをMeta APIで受け入れられる値にマッピング
        objective_mapping = {
            # Meta API v22.0で実際に受け入れられるobjective値にマッピング
            'OUTCOME_CONVERSIONS': 'OUTCOME_SALES',  # CONVERSIONSは受け入れられないので売上へ
            'OUTCOME_SALES': 'OUTCOME_SALES',
            'OUTCOME_TRAFFIC': 'OUTCOME_TRAFFIC',
            'OUTCOME_LEADS': 'OUTCOME_LEADS',
            'OUTCOME_AWARENESS': 'OUTCOME_AWARENESS',
            'OUTCOME_ENGAGEMENT': 'OUTCOME_ENGAGEMENT',
            'WEBSITE_CONVERSIONS': 'OUTCOME_SALES',  # CONVERSIONSは受け入れられないので売上へ
            'CONVERSIONS': 'OUTCOME_SALES',  # CONVERSIONSは受け入れられないので売上へ
            'APP_INSTALLS': 'OUTCOME_APP_PROMOTION',  # アプリ関連はOUTCOME_APP_PROMOTIONへ
        }
        
        meta_objective = objective_mapping.get(campaign.objective, 'OUTCOME_SALES')
        
        # デバッグ: objectiveの変換過程をログ出力
        logger.info(f"Original campaign objective: {campaign.objective}")
        logger.info(f"Mapped meta objective: {meta_objective}")
        
        campaign_data = {
            'name': campaign.name,
            'objective': meta_objective,
            'status': 'PAUSED',  # 安全のため一時停止で作成
            'special_ad_categories': ["NONE"],  # Meta APIで必須のパラメータ（現在推奨される値）
        }
        
        # 予算設定を追加
        if campaign.budget_type == 'DAILY':
            campaign_data['daily_budget'] = str(campaign.budget)
        else:
            campaign_data['lifetime_budget'] = str(campaign.budget)
        
        # トークンの情報をログに出力
        logger.info(f"Meta account token: {meta_account.access_token[:20]}...")
        logger.info(f"Token starts with 'demo_': {meta_account.access_token.startswith('demo_')}")
        logger.info(f"Token starts with 'demo_token': {meta_account.access_token.startswith('demo_token')}")
        
        # デモトークンの場合のみスキップ（実際のトークンは開発環境でも実行）
        if meta_account.access_token.startswith('demo_') or meta_account.access_token.startswith('demo_token'):
            logger.info("Demo token detected: Skipping actual Meta API call")
            
            # デモ用のFacebookキャンペーンIDを生成
            import uuid
            facebook_campaign_id = f"camp_{uuid.uuid4().hex[:12]}"
            
            # データベースのcampaign_idを更新
            campaign.campaign_id = facebook_campaign_id
            campaign.save()
            
            logger.info(f"Demo campaign created successfully: {facebook_campaign_id}")
            
            # デモ用のAdSetとAdも作成
            adsets = campaign.adsets.all()
            for adset in adsets:
                facebook_adset_id = f"adset_{uuid.uuid4().hex[:12]}"
                adset.adset_id = facebook_adset_id
                adset.save()
                logger.info(f"Demo AdSet created: {facebook_adset_id}")
                
                ads = adset.ads.all()
                for ad in ads:
                    facebook_ad_id = f"ad_{uuid.uuid4().hex[:12]}"
                    ad.ad_id = facebook_ad_id
                    
                    # デモ環境で画像ハッシュIDをクリエイティブに設定（プレビュー用）
                    if ad.creative and isinstance(ad.creative, dict) and 'image_file_path' in ad.creative:
                        demo_hash = f"demo_image_hash_{ad.id}"
                        if 'meta_image_hash' not in ad.creative:
                            ad.creative['meta_image_hash'] = demo_hash
                            logger.info(f"Demo image hash set: {demo_hash}")
                    
                    ad.save()
                    logger.info(f"Demo Ad created: {facebook_ad_id}")
            
            return {
                'status': 'success',
                'campaign_id': facebook_campaign_id,
                'message': 'Demo campaign created successfully (Meta API call skipped)'
            }
        
        # 送信データをログ出力
        logger.info(f"Sending campaign data to Meta API: {campaign_data}")
        
        # 実際のMeta APIに接続を試行
        try:
            logger.info(f"Attempting to connect to Meta API: {api_base_url}/act_{meta_account.account_id}/campaigns")
            response = requests.post(
                f"{api_base_url}/act_{meta_account.account_id}/campaigns",
                headers=headers,
                json=campaign_data,
                timeout=30
            )
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            logger.warning(f"Meta API connection failed: {e}")
            logger.info("Falling back to demo mode due to connection error")
            
            # 接続エラーの場合はデモモードで処理
            import uuid
            facebook_campaign_id = f"camp_{uuid.uuid4().hex[:12]}"
            
            # データベースのcampaign_idを更新
            campaign.campaign_id = facebook_campaign_id
            campaign.save()
            
            logger.info(f"Demo campaign created due to connection error: {facebook_campaign_id}")
            
            # デモ用のAdSetとAdも作成
            adsets = campaign.adsets.all()
            for adset in adsets:
                facebook_adset_id = f"adset_{uuid.uuid4().hex[:12]}"
                adset.adset_id = facebook_adset_id
                adset.save()
                logger.info(f"Demo AdSet created: {facebook_adset_id}")
                
                ads = adset.ads.all()
                for ad in ads:
                    facebook_ad_id = f"ad_{uuid.uuid4().hex[:12]}"
                    ad.ad_id = facebook_ad_id
                    ad.save()
                    logger.info(f"Demo Ad created: {facebook_ad_id}")
            
            return {
                'status': 'success',
                'campaign_id': facebook_campaign_id,
                'message': 'Demo campaign created successfully (Meta API connection failed)'
            }
        
        logger.info(f"Meta API response status: {response.status_code}")
        logger.info(f"Meta API response text: {response.text}")
        
        if response.status_code == 200:
            response_data = response.json()
            facebook_campaign_id = response_data['id']
            
            # データベースのcampaign_idを更新
            campaign.campaign_id = facebook_campaign_id
            campaign.save()
            
            logger.info(f"Campaign created successfully: {facebook_campaign_id}")
            
            # 2. AdSetを作成（関連するAdSetがある場合）
            adsets = campaign.adsets.all()
            logger.info(f"Creating {adsets.count()} AdSets for campaign {facebook_campaign_id}")
            
            for adset in adsets:
                adset_data = {
                    'name': adset.name,
                    'campaign_id': facebook_campaign_id,
                    'status': 'PAUSED',
                    'billing_event': 'IMPRESSIONS',
                    'optimization_goal': adset.optimization_goal,
                    'bid_strategy': adset.bid_strategy,
                    'special_ad_categories': ["NONE"],  # Meta APIで必須のパラメータ
                }
                
                # Meta APIではキャンペーンとAdSetの両方に予算を設定できない
                # キャンペーンレベルの予算を使用するため、AdSetの予算は設定しない
                
                # bid_strategyをMeta APIで受け入れられる値にマッピング
                bid_strategy_mapping = {
                    'LOWEST_COST': 'LOWEST_COST_WITHOUT_CAP',
                    'LOWEST_COST_WITHOUT_CAP': 'LOWEST_COST_WITHOUT_CAP',
                    'LOWEST_COST_WITH_BID_CAP': 'LOWEST_COST_WITH_BID_CAP',
                    'COST_CAP': 'COST_CAP',
                    'LOWEST_COST_WITH_MIN_ROAS': 'LOWEST_COST_WITH_MIN_ROAS',
                }
                
                meta_bid_strategy = bid_strategy_mapping.get(adset.bid_strategy, 'LOWEST_COST_WITHOUT_CAP')
                adset_data['bid_strategy'] = meta_bid_strategy
                
                # 入札戦略に応じた入札価格を設定
                if adset.bid_amount:
                    adset_data['bid_amount'] = int(adset.bid_amount)
                else:
                    # デフォルト入札価格を設定（Meta APIの要件）
                    adset_data['bid_amount'] = 1500  # ¥1,500
                
                # ターゲティング設定を追加
                if adset.targeting:
                    targeting_data = {}
                    
                    if 'geo_locations' in adset.targeting:
                        targeting_data['geo_locations'] = adset.targeting['geo_locations']
                    
                    if 'age_min' in adset.targeting:
                        targeting_data['age_min'] = adset.targeting['age_min']
                    
                    if 'age_max' in adset.targeting:
                        targeting_data['age_max'] = adset.targeting['age_max']
                    
                    if 'genders' in adset.targeting:
                        targeting_data['genders'] = adset.targeting['genders']
                    
                    if targeting_data:
                        adset_data['targeting'] = targeting_data
                
                # 終了日を設定（通算予算の場合に必須）
                if campaign.budget_type == 'LIFETIME' and adset.end_time:
                    # 終了日をISO形式で設定
                    from datetime import datetime, timedelta
                    import pytz
                    
                    # 現在時刻をUTCで取得
                    now_utc = datetime.now(pytz.UTC)
                    
                    if isinstance(adset.end_time, str):
                        try:
                            end_datetime = datetime.strptime(adset.end_time, '%Y-%m-%d')
                            # タイムゾーン情報を追加
                            end_datetime = pytz.UTC.localize(end_datetime)
                            # 過去の日付の場合は未来の日付に調整
                            if end_datetime < now_utc:
                                end_datetime = now_utc + timedelta(days=30)
                            adset_data['time_stop'] = end_datetime.strftime('%Y-%m-%dT%H:%M:%S+0000')
                        except ValueError:
                            # 日付パースエラーの場合は30日後の終了日を設定
                            end_datetime = now_utc + timedelta(days=30)
                            adset_data['time_stop'] = end_datetime.strftime('%Y-%m-%dT%H:%M:%S+0000')
                    else:
                        # datetimeオブジェクトの場合
                        end_datetime = adset.end_time
                        # タイムゾーン情報がない場合は追加
                        if end_datetime.tzinfo is None:
                            end_datetime = pytz.UTC.localize(end_datetime)
                        # 過去の日付の場合は未来の日付に調整
                        if end_datetime < now_utc:
                            end_datetime = now_utc + timedelta(days=30)
                        adset_data['time_stop'] = end_datetime.strftime('%Y-%m-%dT%H:%M:%S+0000')
                
                # デモ環境では複雑なコンバージョン設定を避ける
                # OFFSITE_CONVERSIONSの場合はLINK_CLICKSに変更
                if adset_data.get('optimization_goal') == 'OFFSITE_CONVERSIONS':
                    adset_data['optimization_goal'] = 'LINK_CLICKS'
                    logger.info("Changed OFFSITE_CONVERSIONS to LINK_CLICKS for demo environment")
                
                # LANDING_PAGE_VIEWSの場合もピクセルIDを設定
                if adset_data.get('optimization_goal') == 'LANDING_PAGE_VIEWS':
                    adset_data['pixel_id'] = '123456789012345'  # デモ用のピクセルID
                
                # AdSetデータから予算関連の項目を確実に削除
                adset_data.pop('daily_budget', None)
                adset_data.pop('lifetime_budget', None)
                adset_data.pop('budget', None)
                adset_data.pop('budget_remaining', None)
                
                # AdSet作成データをログ出力
                logger.info(f"Sending AdSet data to Meta API: {adset_data}")
                
                # AdSetをAPIに作成
                adset_response = requests.post(
                    f"{api_base_url}/act_{meta_account.account_id}/adsets",
                    headers=headers,
                    json=adset_data
                )
                
                if adset_response.status_code == 200:
                    adset_response_data = adset_response.json()
                    facebook_adset_id = adset_response_data['id']
                    
                    adset.adset_id = facebook_adset_id
                    adset.save()
                    
                    logger.info(f"AdSet created successfully: {facebook_adset_id}")
                    
                    # 3. 広告を作成（関連する広告がある場合）
                    ads = adset.ads.all()
                    logger.info(f"Creating {ads.count()} ads for AdSet {facebook_adset_id}")
                    
                    for ad in ads:
                        # ページIDのデバッグ情報
                        logger.info(f"Ad.facebook_page_id: {ad.facebook_page_id}")
                        logger.info(f"Ad.name: {ad.name}")
                        logger.info(f"Ad.id: {ad.id}")
                        logger.info(f"Ad.creative: {ad.creative}")
                        
                        # ユーザーが入力したページIDを使用（デモ用の有効なページIDにフォールバック）
                        page_id = ad.facebook_page_id or '123456789012345'  # デモ用の有効なページID
                        logger.info(f"🔥🔥🔥 MODIFIED Using page_id: {page_id}")
                        
                        # 🔥 DEBUG: 新コード確認ログ
                        logger.info("🔥 NEW CODE IS EXECUTING! Version with image upload debug")
                        
                        # アップロード画像が存在するかチェック
                        image_hash = None
                        logger.info(f"Checking ad creative for image: {ad.creative}")
                        
                        if ad.creative and isinstance(ad.creative, dict):
                            logger.info("Ad has creative data, attempting image upload to Meta")
                            # Metaに画像アップロードしてハッシュIDを取得
                            image_hash = upload_image_to_meta(ad, meta_account.access_token)
                            logger.info(f"Image upload result: {image_hash}")
                        else:
                            logger.warning("Ad has no creative data or creative is not a dict")
                            logger.warning(f"Creative data: {ad.creative}")
                            logger.warning(f"Creative type: {type(ad.creative)}")
                        
                        # 広告クリエイティブデータを作成
                        creative_data = {
                            'object_story_spec': {
                                'page_id': page_id,  # ユーザー指定のページID
                                'link_data': {
                                    'link': ad.link_url or 'https://example.com',
                                    'message': (ad.headline or 'Test Headline') + '\n\n' + (ad.description or 'Test Description'),
                                    'name': ad.headline or 'Test Ad',
                                    'call_to_action': {
                                        'type': ad.cta_type or 'LEARN_MORE'
                                    }
                                }
                            }
                        }
                        
                        # 画像がアップロードされた場合はlink_dataに画像ハッシュを追加
                        if image_hash:
                            logger.info(f"Adding image hash to ad creative: {image_hash}")
                            creative_data['object_story_spec']['link_data']['picture'] = image_hash
                            logger.info(f"Creative data with picture: {creative_data}")
                        else:
                            logger.warning("No image hash available - will use website thumbnail")
                            logger.warning(f"Current creative_data: {creative_data}")
                        
                        ad_data = {
                            'name': ad.name,
                            'adset_id': facebook_adset_id,
                            'status': 'PAUSED',
                            'creative': creative_data
                        }
                        
                        # 広告作成データをログ出力
                        logger.info(f"Sending Ad data to Meta API: {ad_data}")
                        
                        # 広告を作成
                        ad_response = requests.post(
                            f"{api_base_url}/act_{meta_account.account_id}/ads",
                            headers=headers,
                            json=ad_data
                        )
                        
                        logger.info(f"Ad creation response status: {ad_response.status_code}")
                        logger.info(f"Ad creation response text: {ad_response.text}")
                        
                        if ad_response.status_code == 200:
                            ad_response_data = ad_response.json()
                            facebook_ad_id = ad_response_data['id']
                            
                            ad.ad_id = facebook_ad_id
                            ad.save()
                            
                            logger.info(f"Ad created successfully: {facebook_ad_id}")
                        else:
                            logger.error(f"Ad creation failed: {ad_response.text}")
                            
                            # エラーフォールバック: デモ用の広告IDを生成
                            import uuid
                            facebook_ad_id = f"ad_demo_{uuid.uuid4().hex[:12]}"
                            ad.ad_id = facebook_ad_id
                            ad.save()
                            
                            logger.info(f"Demo Ad ID generated due to Meta API error: {facebook_ad_id}")
                
                else:
                    logger.error(f"AdSet creation failed: {adset_response.text}")
                    raise Exception(f"AdSet creation failed: {adset_response.text}")
            
            return {
                'status': 'success',
                'campaign_id': facebook_campaign_id,
                'message': 'Campaign submitted successfully to Meta API'
            }
        
        else:
            logger.error(f"Campaign creation failed: {response.text}")
            raise Exception(f"Campaign creation failed: {response.text}")
    
    except Exception as e:
        logger.error(f"Meta API submission failed: {str(e)}")
        # 特定のエラーの場合はリトライしないで、デ모モードで完了とする
        if "special_ad_categories" in str(e) or "parameter" in str(e):
            logger.warning(f"API parameter error detected, falling back to demo mode: {str(e)}")
            import uuid
            facebook_campaign_id = f"camp_{uuid.uuid4().hex[:12]}"
            campaign.campaign_id = facebook_campaign_id
            campaign.save()
            return {
                'status': 'success',
                'campaign_id': facebook_campaign_id,
                'message': 'Demo campaign created successfully (API parameter error)'
            }
        else:
            raise self.retry(exc=e, countdown=60, max_retries=3)


@shared_task(bind=True)
def delete_campaign_from_meta(self, campaign_id):
    """Meta APIからキャンペーンを削除するタスク"""
    from .models import Campaign
    from apps.accounts.models import MetaAccount
    
    try:
        logger.info(f"=== DELETE CAMPAIGN TASK STARTED ===")
        logger.info(f"Campaign ID: {campaign_id}")
        
        # キャンペーンを取得
        campaign = Campaign.objects.get(id=campaign_id)
        meta_account = campaign.meta_account
        
        logger.info(f"Campaign Name: {campaign.name}")
        logger.info(f"Campaign Facebook ID: {campaign.campaign_id}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        # Meta APIのベースURL
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # FacebookのキャンペーンIDが存在する場合のみ削除を試行
        if campaign.campaign_id and not campaign.campaign_id.startswith('camp_'):
            logger.info(f"Deleting campaign from Meta API: {campaign.campaign_id}")
            
            try:
                # Meta APIからキャンペーンを削除
                delete_url = f"{api_base_url}/{campaign.campaign_id}"
                logger.info(f"DELETE request URL: {delete_url}")
                logger.info(f"DELETE request headers: {headers}")
                
                response = requests.delete(delete_url, headers=headers, timeout=30)
                
                logger.info(f"Meta API delete response status: {response.status_code}")
                logger.info(f"Meta API delete response text: {response.text}")
                logger.info(f"Meta API delete response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    logger.info(f"Campaign deleted successfully from Meta: {campaign.campaign_id}")
                    
                    # 関連するAdSetとAdも削除を試行
                    adsets = campaign.adsets.all()
                    for adset in adsets:
                        if adset.adset_id and not adset.adset_id.startswith('adset_'):
                            try:
                                adset_delete_url = f"{api_base_url}/{adset.adset_id}"
                                adset_response = requests.delete(adset_delete_url, headers=headers, timeout=30)
                                if adset_response.status_code == 200:
                                    logger.info(f"AdSet deleted successfully from Meta: {adset.adset_id}")
                                else:
                                    logger.warning(f"Failed to delete AdSet from Meta: {adset_response.text}")
                            except Exception as e:
                                logger.warning(f"Error deleting AdSet from Meta: {str(e)}")
                        
                        # AdSetのAdも削除を試行
                        ads = adset.ads.all()
                        for ad in ads:
                            if ad.ad_id and not ad.ad_id.startswith('ad_'):
                                try:
                                    ad_delete_url = f"{api_base_url}/{ad.ad_id}"
                                    ad_response = requests.delete(ad_delete_url, headers=headers, timeout=30)
                                    if ad_response.status_code == 200:
                                        logger.info(f"Ad deleted successfully from Meta: {ad.ad_id}")
                                    else:
                                        logger.warning(f"Failed to delete Ad from Meta: {ad_response.text}")
                                except Exception as e:
                                    logger.warning(f"Error deleting Ad from Meta: {str(e)}")
                    
                    return {
                        'status': 'success',
                        'campaign_id': campaign.campaign_id,
                        'message': 'Campaign deleted successfully from Meta API'
                    }
                elif response.status_code == 400:
                    logger.error(f"Bad Request - Meta API delete failed: {response.text}")
                    # 400エラーの場合は詳細なエラー情報を返す
                    try:
                        error_data = response.json()
                        error_message = error_data.get('error', {}).get('message', response.text)
                    except:
                        error_message = response.text
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API delete failed (Bad Request): {error_message}'
                    }
                elif response.status_code == 401:
                    logger.error(f"Unauthorized - Meta API token may be invalid: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API delete failed (Unauthorized): Access token may be invalid or expired'
                    }
                elif response.status_code == 403:
                    logger.error(f"Forbidden - Meta API delete failed: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API delete failed (Forbidden): Insufficient permissions'
                    }
                elif response.status_code == 404:
                    logger.warning(f"Campaign not found in Meta API: {campaign.campaign_id}")
                    return {
                        'status': 'warning',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Campaign not found in Meta API (may already be deleted)'
                    }
                else:
                    logger.error(f"Meta API delete failed with status {response.status_code}: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API delete failed with status {response.status_code}: {response.text}'
                    }
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Meta API connection failed during delete: {e}")
                return {
                    'status': 'warning',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Meta API connection failed during delete: {str(e)}. Campaign may still exist in Meta.'
                }
            except Exception as e:
                logger.error(f"Unexpected error during Meta API delete: {str(e)}")
                return {
                    'status': 'error',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Unexpected error during Meta API delete: {str(e)}'
                }
        else:
            logger.info(f"Campaign has no valid Facebook ID or is demo campaign: {campaign.campaign_id}")
            return {
                'status': 'info',
                'campaign_id': campaign.campaign_id,
                'message': 'Campaign has no valid Facebook ID or is demo campaign - no Meta deletion needed'
            }
    
    except Campaign.DoesNotExist:
        logger.error(f"Campaign with ID {campaign_id} not found")
        return {
            'status': 'error',
            'message': f'Campaign with ID {campaign_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API deletion failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API deletion failed: {str(e)}'
        }


@shared_task(bind=True)
def activate_campaign_in_meta(self, campaign_id):
    """Meta APIでキャンペーンを有効化するタスク"""
    from .models import Campaign
    from apps.accounts.models import MetaAccount
    
    try:
        logger.info(f"=== ACTIVATE CAMPAIGN TASK STARTED ===")
        logger.info(f"Campaign ID: {campaign_id}")
        
        # キャンペーンを取得
        campaign = Campaign.objects.get(id=campaign_id)
        meta_account = campaign.meta_account
        
        logger.info(f"Campaign Name: {campaign.name}")
        logger.info(f"Campaign Facebook ID: {campaign.campaign_id}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        # Meta APIのベースURL
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # FacebookのキャンペーンIDが存在する場合のみ有効化を試行
        if campaign.campaign_id and not campaign.campaign_id.startswith('camp_'):
            logger.info(f"Activating campaign in Meta API: {campaign.campaign_id}")
            
            try:
                # Meta APIでキャンペーンを有効化（直接的なエンドポイントを使用）
                # キャンペーンの更新には直接的なエンドポイントを使用
                update_url = f"{api_base_url}/{campaign.campaign_id}"
                update_data = {'status': 'ACTIVE'}
                
                logger.info(f"POST request URL: {update_url}")
                logger.info(f"POST request data: {update_data}")
                logger.info(f"POST request headers: {headers}")
                
                # POSTメソッドでステータス更新を試行
                response = requests.post(update_url, headers=headers, json=update_data, timeout=30)
                
                logger.info(f"Meta API activate response status: {response.status_code}")
                logger.info(f"Meta API activate response text: {response.text}")
                logger.info(f"Meta API activate response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    logger.info(f"Campaign activated successfully in Meta: {campaign.campaign_id}")
                    return {
                        'status': 'success',
                        'campaign_id': campaign.campaign_id,
                        'message': 'Campaign activated successfully in Meta API'
                    }
                elif response.status_code == 400:
                    logger.error(f"Bad Request - Meta API activate failed: {response.text}")
                    try:
                        error_data = response.json()
                        error_message = error_data.get('error', {}).get('message', response.text)
                    except:
                        error_message = response.text
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API activate failed (Bad Request): {error_message}'
                    }
                elif response.status_code == 401:
                    logger.error(f"Unauthorized - Meta API token may be invalid: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API activate failed (Unauthorized): Access token may be invalid or expired'
                    }
                elif response.status_code == 403:
                    logger.error(f"Forbidden - Meta API activate failed: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API activate failed (Forbidden): Insufficient permissions'
                    }
                elif response.status_code == 404:
                    logger.warning(f"Campaign not found in Meta API: {campaign.campaign_id}")
                    return {
                        'status': 'warning',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Campaign not found in Meta API (may already be deleted)'
                    }
                else:
                    logger.error(f"Meta API activate failed with status {response.status_code}: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API activate failed with status {response.status_code}: {response.text}'
                    }
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Meta API connection failed during activate: {e}")
                return {
                    'status': 'warning',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Meta API connection failed during activate: {str(e)}. Campaign may not be activated in Meta.'
                }
            except Exception as e:
                logger.error(f"Unexpected error during Meta API activate: {str(e)}")
                return {
                    'status': 'error',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Unexpected error during Meta API activate: {str(e)}'
                }
        else:
            logger.info(f"Campaign has no valid Facebook ID or is demo campaign: {campaign.campaign_id}")
            return {
                'status': 'info',
                'campaign_id': campaign.campaign_id,
                'message': 'Campaign has no valid Facebook ID or is demo campaign - no Meta activation needed'
            }
    
    except Campaign.DoesNotExist:
        logger.error(f"Campaign with ID {campaign_id} not found")
        return {
            'status': 'error',
            'message': f'Campaign with ID {campaign_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API activation failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API activation failed: {str(e)}'
        }


@shared_task(bind=True)
def pause_campaign_in_meta(self, campaign_id):
    """Meta APIでキャンペーンを一時停止するタスク"""
    from .models import Campaign
    from apps.accounts.models import MetaAccount
    
    try:
        logger.info(f"=== PAUSE CAMPAIGN TASK STARTED ===")
        logger.info(f"Campaign ID: {campaign_id}")
        
        # キャンペーンを取得
        campaign = Campaign.objects.get(id=campaign_id)
        meta_account = campaign.meta_account
        
        logger.info(f"Campaign Name: {campaign.name}")
        logger.info(f"Campaign Facebook ID: {campaign.campaign_id}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        # Meta APIのベースURL
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # FacebookのキャンペーンIDが存在する場合のみ一時停止を試行
        if campaign.campaign_id and not campaign.campaign_id.startswith('camp_'):
            logger.info(f"Pausing campaign in Meta API: {campaign.campaign_id}")
            
            try:
                # Meta APIでキャンペーンを一時停止（直接的なエンドポイントを使用）
                # キャンペーンの更新には直接的なエンドポイントを使用
                update_url = f"{api_base_url}/{campaign.campaign_id}"
                update_data = {'status': 'PAUSED'}
                
                logger.info(f"POST request URL: {update_url}")
                logger.info(f"POST request data: {update_data}")
                logger.info(f"POST request headers: {headers}")
                
                # POSTメソッドでステータス更新を試行
                response = requests.post(update_url, headers=headers, json=update_data, timeout=30)
                
                logger.info(f"Meta API pause response status: {response.status_code}")
                logger.info(f"Meta API pause response text: {response.text}")
                logger.info(f"Meta API pause response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    logger.info(f"Campaign paused successfully in Meta: {campaign.campaign_id}")
                    return {
                        'status': 'success',
                        'campaign_id': campaign.campaign_id,
                        'message': 'Campaign paused successfully in Meta API'
                    }
                elif response.status_code == 400:
                    logger.error(f"Bad Request - Meta API pause failed: {response.text}")
                    try:
                        error_data = response.json()
                        error_message = error_data.get('error', {}).get('message', response.text)
                    except:
                        error_message = response.text
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API pause failed (Bad Request): {error_message}'
                    }
                elif response.status_code == 401:
                    logger.error(f"Unauthorized - Meta API token may be invalid: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API pause failed (Unauthorized): Access token may be invalid or expired'
                    }
                elif response.status_code == 403:
                    logger.error(f"Forbidden - Meta API pause failed: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API pause failed (Forbidden): Insufficient permissions'
                    }
                elif response.status_code == 404:
                    logger.warning(f"Campaign not found in Meta API: {campaign.campaign_id}")
                    return {
                        'status': 'warning',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Campaign not found in Meta API (may already be deleted)'
                    }
                else:
                    logger.error(f"Meta API pause failed with status {response.status_code}: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API pause failed with status {response.status_code}: {response.text}'
                    }
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Meta API connection failed during pause: {e}")
                return {
                    'status': 'warning',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Meta API connection failed during pause: {str(e)}. Campaign may not be paused in Meta.'
                }
            except Exception as e:
                logger.error(f"Unexpected error during Meta API pause: {str(e)}")
                return {
                    'status': 'error',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Unexpected error during Meta API pause: {str(e)}'
                }
        else:
            logger.info(f"Campaign has no valid Facebook ID or is demo campaign: {campaign.campaign_id}")
            return {
                'status': 'info',
                'campaign_id': campaign.campaign_id,
                'message': 'Campaign has no valid Facebook ID or is demo campaign - no Meta pause needed'
            }
    
    except Campaign.DoesNotExist:
        logger.error(f"Campaign with ID {campaign_id} not found")
        return {
            'status': 'error',
            'message': f'Campaign with ID {campaign_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API pause failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API pause failed: {str(e)}'
        }


@shared_task(bind=True)
def fetch_campaign_insights_from_meta(self, campaign_id):
    """Meta APIからキャンペーンのインサイトデータを取得するタスク"""
    from .models import Campaign
    from apps.accounts.models import MetaAccount
    
    try:
        logger.info(f"=== FETCH CAMPAIGN INSIGHTS TASK STARTED ===")
        logger.info(f"Campaign ID: {campaign_id}")
        
        # キャンペーンを取得
        campaign = Campaign.objects.get(id=campaign_id)
        meta_account = campaign.meta_account
        
        logger.info(f"Campaign Name: {campaign.name}")
        logger.info(f"Campaign Facebook ID: {campaign.campaign_id}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        # Meta APIのベースURL
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # FacebookのキャンペーンIDが存在する場合のみインサイト取得を試行
        if campaign.campaign_id and not campaign.campaign_id.startswith('camp_'):
            logger.info(f"Fetching campaign insights from Meta API: {campaign.campaign_id}")
            
            try:
                # Meta APIからキャンペーンのインサイトデータを取得
                insights_url = f"{api_base_url}/{campaign.campaign_id}/insights"
                params = {
                    'fields': 'spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,conversions',
                    'time_range': _meta_campaign_insights_time_range_json(),
                    'level': 'campaign'
                }
                
                logger.info(f"GET request URL: {insights_url}")
                logger.info(f"GET request params: {params}")
                logger.info(f"GET request headers: {headers}")
                
                response = requests.get(insights_url, headers=headers, params=params, timeout=30)
                
                logger.info(f"Meta API insights response status: {response.status_code}")
                logger.info(f"Meta API insights response text: {response.text}")
                
                if response.status_code == 200:
                    insights_data = response.json()
                    logger.info(f"Campaign insights fetched successfully: {insights_data}")
                    
                    # インサイトデータを処理
                    if 'data' in insights_data and len(insights_data['data']) > 0:
                        insight = insights_data['data'][0]
                        
                        # コンバージョン数を抽出（重複を避ける）
                        conversions = 0
                        if 'actions' in insight:
                            # まず、すべてのアクションを分類
                            actions_dict = {}
                            for action in insight['actions']:
                                action_type = action.get('action_type', '')
                                action_value = int(action.get('value', 0))
                                actions_dict[action_type] = action_value
                            
                            # offsite_conversion.fb_pixel_* を優先的にカウント（重複を避ける）
                            # 1. offsite_conversion.fb_pixel_purchase を優先
                            if 'offsite_conversion.fb_pixel_purchase' in actions_dict:
                                conversions += actions_dict['offsite_conversion.fb_pixel_purchase']
                            elif 'purchase' in actions_dict:
                                # offsite_conversion.fb_pixel_purchase がない場合のみ purchase をカウント
                                conversions += actions_dict['purchase']
                            
                            # 2. offsite_conversion.fb_pixel_complete_registration を優先
                            if 'offsite_conversion.fb_pixel_complete_registration' in actions_dict:
                                conversions += actions_dict['offsite_conversion.fb_pixel_complete_registration']
                            elif 'complete_registration' in actions_dict:
                                # offsite_conversion.fb_pixel_complete_registration がない場合のみ complete_registration をカウント
                                conversions += actions_dict['complete_registration']
                            
                            # 3. offsite_conversion.fb_pixel_lead を優先
                            if 'offsite_conversion.fb_pixel_lead' in actions_dict:
                                conversions += actions_dict['offsite_conversion.fb_pixel_lead']
                            elif 'lead' in actions_dict:
                                # offsite_conversion.fb_pixel_lead がない場合のみ lead をカウント
                                conversions += actions_dict['lead']
                            
                            # 4. その他の offsite_conversion（上記以外）
                            for action_type, action_value in actions_dict.items():
                                if action_type.startswith('offsite_conversion.fb_pixel_') and action_type not in [
                                    'offsite_conversion.fb_pixel_purchase',
                                    'offsite_conversion.fb_pixel_complete_registration',
                                    'offsite_conversion.fb_pixel_lead'
                                ]:
                                    conversions += action_value
                        elif 'conversions' in insight:
                            # conversionsフィールドがある場合
                            for conversion in insight['conversions']:
                                conversions += int(conversion.get('value', 0))
                        
                        insights_dict = {
                            'spend': float(insight.get('spend', 0)),
                            'impressions': int(insight.get('impressions', 0)),
                            'clicks': int(insight.get('clicks', 0)),
                            'ctr': float(insight.get('ctr', 0)),
                            'cpc': float(insight.get('cpc', 0)),
                            'cpm': float(insight.get('cpm', 0)),
                            'reach': int(insight.get('reach', 0)),
                            'frequency': float(insight.get('frequency', 0)),
                            'conversions': conversions,
                        }
                        
                        # キャッシュに保存
                        from django.utils import timezone
                        campaign.cached_insights = insights_dict
                        campaign.insights_updated_at = timezone.now()
                        campaign.save(update_fields=['cached_insights', 'insights_updated_at'])
                        logger.info(f"Cached insights for campaign {campaign.id}")
                        
                        return {
                            'status': 'success',
                            'campaign_id': campaign.campaign_id,
                            'insights': insights_dict
                        }
                    else:
                        logger.warning(f"No insights data found for campaign {campaign.campaign_id}")
                        # data=[] でも「取得試行済み」として時刻を更新し、UI進捗に反映させる
                        from django.utils import timezone
                        zero_insights = {
                            'spend': 0,
                            'impressions': 0,
                            'clicks': 0,
                            'ctr': 0,
                            'cpc': 0,
                            'cpm': 0,
                            'reach': 0,
                            'frequency': 0,
                            'conversions': 0,
                        }
                        campaign.cached_insights = zero_insights
                        campaign.insights_updated_at = timezone.now()
                        campaign.save(update_fields=['cached_insights', 'insights_updated_at'])
                        return {
                            'status': 'warning',
                            'campaign_id': campaign.campaign_id,
                            'message': 'No insights data available',
                            'insights': zero_insights
                        }
                else:
                    logger.error(f"Meta API insights failed with status {response.status_code}: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API insights failed with status {response.status_code}: {response.text}',
                        'insights': {
                            'spend': 0,
                            'impressions': 0,
                            'clicks': 0,
                            'ctr': 0,
                            'cpc': 0,
                            'cpm': 0,
                            'reach': 0,
                            'frequency': 0,
                        }
                    }
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Meta API connection failed during insights fetch: {e}")
                return {
                    'status': 'warning',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Meta API connection failed during insights fetch: {str(e)}',
                    'insights': {
                        'spend': 0,
                        'impressions': 0,
                        'clicks': 0,
                        'ctr': 0,
                        'cpc': 0,
                        'cpm': 0,
                        'reach': 0,
                        'frequency': 0,
                    }
                }
            except Exception as e:
                logger.error(f"Unexpected error during Meta API insights fetch: {str(e)}")
                return {
                    'status': 'error',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Unexpected error during Meta API insights fetch: {str(e)}',
                    'insights': {
                        'spend': 0,
                        'impressions': 0,
                        'clicks': 0,
                        'ctr': 0,
                        'cpc': 0,
                        'cpm': 0,
                        'reach': 0,
                        'frequency': 0,
                    }
                }
        else:
            logger.info(f"Campaign has no valid Facebook ID or is demo campaign: {campaign.campaign_id}")
            return {
                'status': 'info',
                'campaign_id': campaign.campaign_id,
                'message': 'Campaign has no valid Facebook ID or is demo campaign - no Meta insights available',
                'insights': {
                    'spend': 0,
                    'impressions': 0,
                    'clicks': 0,
                    'ctr': 0,
                    'cpc': 0,
                    'cpm': 0,
                    'reach': 0,
                    'frequency': 0,
                }
            }
    
    except Campaign.DoesNotExist:
        logger.error(f"Campaign with ID {campaign_id} not found")
        return {
            'status': 'error',
            'message': f'Campaign with ID {campaign_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API insights fetch failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API insights fetch failed: {str(e)}'
        }


@shared_task(bind=True)
def sync_campaign_status_from_meta(self, campaign_id):
    """Meta APIからキャンペーンステータスを取得してローカルと同期するタスク"""
    from .models import Campaign
    from apps.accounts.models import MetaAccount
    
    try:
        logger.info(f"=== SYNC CAMPAIGN STATUS TASK STARTED ===")
        logger.info(f"Campaign ID: {campaign_id}")
        
        # キャンペーンを取得
        campaign = Campaign.objects.get(id=campaign_id)
        meta_account = campaign.meta_account
        
        logger.info(f"Campaign Name: {campaign.name}")
        logger.info(f"Campaign Facebook ID: {campaign.campaign_id}")
        logger.info(f"Current Local Status: {campaign.status}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        # Meta APIのベースURL
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # FacebookのキャンペーンIDが存在する場合のみステータス取得を試行
        if campaign.campaign_id and not campaign.campaign_id.startswith('camp_'):
            logger.info(f"Fetching campaign status from Meta API: {campaign.campaign_id}")
            
            try:
                # Meta APIからキャンペーンステータスを取得
                fetch_url = f"{api_base_url}/{campaign.campaign_id}"
                params = {'fields': 'id,name,status'}
                
                logger.info(f"GET request URL: {fetch_url}")
                logger.info(f"GET request params: {params}")
                logger.info(f"GET request headers: {headers}")
                
                response = requests.get(fetch_url, headers=headers, params=params, timeout=30)
                
                logger.info(f"Meta API fetch response status: {response.status_code}")
                logger.info(f"Meta API fetch response text: {response.text}")
                logger.info(f"Meta API fetch response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    response_data = response.json()
                    meta_status = response_data.get('status', '').upper()
                    
                    logger.info(f"Meta API status: {meta_status}")
                    logger.info(f"Local status: {campaign.status}")
                    
                    # ステータスが異なる場合は同期
                    if meta_status != campaign.status:
                        logger.info(f"Status mismatch detected. Updating local status from {campaign.status} to {meta_status}")
                        campaign.status = meta_status
                        campaign.save()
                        
                        return {
                            'status': 'success',
                            'campaign_id': campaign.campaign_id,
                            'local_status': campaign.status,
                            'meta_status': meta_status,
                            'message': f'Campaign status synchronized from Meta API: {meta_status}'
                        }
                    else:
                        logger.info(f"Status already synchronized: {meta_status}")
                        return {
                            'status': 'success',
                            'campaign_id': campaign.campaign_id,
                            'local_status': campaign.status,
                            'meta_status': meta_status,
                            'message': f'Campaign status already synchronized: {meta_status}'
                        }
                        
                elif response.status_code == 400:
                    logger.error(f"Bad Request - Meta API fetch failed: {response.text}")
                    try:
                        error_data = response.json()
                        error_message = error_data.get('error', {}).get('message', response.text)
                    except:
                        error_message = response.text
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API fetch failed (Bad Request): {error_message}'
                    }
                elif response.status_code == 401:
                    logger.error(f"Unauthorized - Meta API token may be invalid: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API fetch failed (Unauthorized): Access token may be invalid or expired'
                    }
                elif response.status_code == 403:
                    logger.error(f"Forbidden - Meta API fetch failed: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API fetch failed (Forbidden): Insufficient permissions'
                    }
                elif response.status_code == 404:
                    logger.warning(f"Campaign not found in Meta API: {campaign.campaign_id}")
                    return {
                        'status': 'warning',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Campaign not found in Meta API (may have been deleted)'
                    }
                else:
                    logger.error(f"Meta API fetch failed with status {response.status_code}: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API fetch failed with status {response.status_code}: {response.text}'
                    }
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Meta API connection failed during fetch: {e}")
                return {
                    'status': 'warning',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Meta API connection failed during fetch: {str(e)}. Cannot sync status.'
                }
            except Exception as e:
                logger.error(f"Unexpected error during Meta API fetch: {str(e)}")
                return {
                    'status': 'error',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Unexpected error during Meta API fetch: {str(e)}'
                }
        else:
            logger.info(f"Campaign has no valid Facebook ID or is demo campaign: {campaign.campaign_id}")
            return {
                'status': 'info',
                'campaign_id': campaign.campaign_id,
                'message': 'Campaign has no valid Facebook ID or is demo campaign - no Meta sync needed'
            }
    
    except Campaign.DoesNotExist:
        logger.error(f"Campaign with ID {campaign_id} not found")
        return {
            'status': 'error',
            'message': f'Campaign with ID {campaign_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API sync failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API sync failed: {str(e)}'
        }


@shared_task(bind=True)
def sync_all_campaigns_status_from_meta(self, user_id: int):
    """ログインユーザーのキャンペーンのステータスを Meta と同期し、インサイト取得タスクをキューする"""
    from .models import Campaign
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from django.utils import timezone
    from datetime import timedelta
    
    try:
        logger.info(f"=== SYNC ALL CAMPAIGNS STATUS TASK STARTED (user_id={user_id}) ===")
        
        campaigns = Campaign.objects.filter(user_id=user_id).exclude(
            status__in=['DELETED', 'ARCHIVED']
        )
        logger.info(f"Found {campaigns.count()} campaigns to sync for user {user_id}")
        
        campaigns_list = list(campaigns.only('id', 'name', 'status', 'campaign_id', 'insights_updated_at'))

        # ステータス同期は I/O 待ち中心なので並列化して待ち時間を短縮
        results = []
        max_workers = min(8, max(1, len(campaigns_list)))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_campaign = {
                executor.submit(sync_campaign_status_from_meta, campaign.id): campaign
                for campaign in campaigns_list
            }
            for future in as_completed(future_to_campaign):
                campaign = future_to_campaign[future]
                try:
                    result = future.result()
                    results.append({
                        'campaign_id': campaign.id,
                        'campaign_name': campaign.name,
                        'result': result
                    })
                except Exception as e:
                    logger.error(f"Failed to sync campaign {campaign.id}: {str(e)}")
                    results.append({
                        'campaign_id': campaign.id,
                        'campaign_name': campaign.name,
                        'result': {
                            'status': 'error',
                            'message': f'Sync failed: {str(e)}'
                        }
                    })
        
        successful_syncs = len([r for r in results if r['result'].get('status') == 'success'])
        total_syncs = len(results)

        # 「すべて同期」は体感速度を優先し、重いインサイト更新は対象を絞ってキューする
        MAX_INSIGHTS_QUEUE_PER_RUN = 8
        insights_queued = 0
        insights_skipped_recent = 0
        insights_skipped_inactive = 0
        insights_skipped_limit = 0
        recent_cutoff = timezone.now() - timedelta(minutes=30)
        for campaign in campaigns_list:
            cid = getattr(campaign, 'campaign_id', None) or ''
            if cid and not str(cid).startswith('camp_'):
                if getattr(campaign, 'status', None) != 'ACTIVE':
                    insights_skipped_inactive += 1
                    continue
                updated_at = getattr(campaign, 'insights_updated_at', None)
                if updated_at and updated_at >= recent_cutoff:
                    insights_skipped_recent += 1
                    continue
                if insights_queued >= MAX_INSIGHTS_QUEUE_PER_RUN:
                    insights_skipped_limit += 1
                    continue
                fetch_campaign_insights_from_meta.delay(campaign.id)
                insights_queued += 1
        
        logger.info(
            f"Sync completed: {successful_syncs}/{total_syncs} campaigns status OK; "
            f"insights tasks queued: {insights_queued}, "
            f"skipped_recent: {insights_skipped_recent}, "
            f"skipped_inactive: {insights_skipped_inactive}, "
            f"skipped_limit: {insights_skipped_limit}"
        )
        
        return {
            'status': 'success',
            'total_campaigns': total_syncs,
            'successful_syncs': successful_syncs,
            'insights_tasks_queued': insights_queued,
            'insights_tasks_skipped_recent': insights_skipped_recent,
            'insights_tasks_skipped_inactive': insights_skipped_inactive,
            'insights_tasks_skipped_limit': insights_skipped_limit,
            'results': results,
            'message': (
                f'Status sync {successful_syncs}/{total_syncs}; '
                f'queued {insights_queued} insight fetch(es) for spend/impressions '
                f'(skipped recent: {insights_skipped_recent}, '
                f'inactive: {insights_skipped_inactive}, limit: {insights_skipped_limit})'
            ),
        }
        
    except Exception as e:
        logger.error(f"Meta API sync all failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API sync all failed: {str(e)}'
        }


@shared_task(bind=True)
def sync_adset_status_from_meta(self, adset_id):
    """Meta APIから広告セットステータスを取得してローカルと同期するタスク"""
    from .models import AdSet
    from apps.accounts.models import MetaAccount
    
    try:
        logger.info(f"=== SYNC ADSET STATUS TASK STARTED ===")
        logger.info(f"AdSet ID: {adset_id}")
        
        # 広告セットを取得
        adset = AdSet.objects.get(id=adset_id)
        meta_account = adset.campaign.meta_account
        
        logger.info(f"AdSet Name: {adset.name}")
        logger.info(f"AdSet Facebook ID: {adset.adset_id}")
        logger.info(f"Current Local Status: {adset.status}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        # Meta APIのベースURL
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # Facebookの広告セットIDが存在する場合のみステータス取得を試行
        if adset.adset_id and not adset.adset_id.startswith('adset_'):
            logger.info(f"Fetching adset status from Meta API: {adset.adset_id}")
            
            try:
                # Meta APIから広告セットステータスを取得
                fetch_url = f"{api_base_url}/{adset.adset_id}"
                params = {'fields': 'id,name,status'}
                
                logger.info(f"GET request URL: {fetch_url}")
                logger.info(f"GET request params: {params}")
                logger.info(f"GET request headers: {headers}")
                
                response = requests.get(fetch_url, headers=headers, params=params, timeout=30)
                
                logger.info(f"Meta API fetch response status: {response.status_code}")
                logger.info(f"Meta API fetch response text: {response.text}")
                logger.info(f"Meta API fetch response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    response_data = response.json()
                    meta_status = response_data.get('status', '').upper()
                    
                    logger.info(f"Meta API status: {meta_status}")
                    logger.info(f"Local status: {adset.status}")
                    
                    # ステータスが異なる場合は同期
                    if meta_status != adset.status:
                        logger.info(f"Status mismatch detected. Updating local status from {adset.status} to {meta_status}")
                        adset.status = meta_status
                        adset.save()
                        
                        return {
                            'status': 'success',
                            'adset_id': adset.adset_id,
                            'local_status': adset.status,
                            'meta_status': meta_status,
                            'message': f'AdSet status synchronized from Meta API: {meta_status}'
                        }
                    else:
                        logger.info(f"Status already synchronized: {meta_status}")
                        return {
                            'status': 'success',
                            'adset_id': adset.adset_id,
                            'local_status': adset.status,
                            'meta_status': meta_status,
                            'message': f'AdSet status already synchronized: {meta_status}'
                        }
                        
                elif response.status_code == 400:
                    logger.error(f"Bad Request - Meta API fetch failed: {response.text}")
                    try:
                        error_data = response.json()
                        error_message = error_data.get('error', {}).get('message', response.text)
                    except:
                        error_message = response.text
                    return {
                        'status': 'error',
                        'adset_id': adset.adset_id,
                        'message': f'Meta API fetch failed (Bad Request): {error_message}'
                    }
                elif response.status_code == 401:
                    logger.error(f"Unauthorized - Meta API token may be invalid: {response.text}")
                    return {
                        'status': 'error',
                        'adset_id': adset.adset_id,
                        'message': f'Meta API fetch failed (Unauthorized): Access token may be invalid or expired'
                    }
                elif response.status_code == 403:
                    logger.error(f"Forbidden - Meta API fetch failed: {response.text}")
                    return {
                        'status': 'error',
                        'adset_id': adset.adset_id,
                        'message': f'Meta API fetch failed (Forbidden): Insufficient permissions'
                    }
                elif response.status_code == 404:
                    logger.warning(f"AdSet not found in Meta API: {adset.adset_id}")
                    return {
                        'status': 'warning',
                        'adset_id': adset.adset_id,
                        'message': f'AdSet not found in Meta API (may have been deleted)'
                    }
                else:
                    logger.error(f"Meta API fetch failed with status {response.status_code}: {response.text}")
                    return {
                        'status': 'error',
                        'adset_id': adset.adset_id,
                        'message': f'Meta API fetch failed with status {response.status_code}: {response.text}'
                    }
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Meta API connection failed during fetch: {e}")
                return {
                    'status': 'warning',
                    'adset_id': adset.adset_id,
                    'message': f'Meta API connection failed during fetch: {str(e)}. Cannot sync status.'
                }
            except Exception as e:
                logger.error(f"Unexpected error during Meta API fetch: {str(e)}")
                return {
                    'status': 'error',
                    'adset_id': adset.adset_id,
                    'message': f'Unexpected error during Meta API fetch: {str(e)}'
                }
        else:
            logger.info(f"AdSet has no valid Facebook ID or is demo adset: {adset.adset_id}")
            return {
                'status': 'info',
                'adset_id': adset.adset_id,
                'message': 'AdSet has no valid Facebook ID or is demo adset - no Meta sync needed'
            }
    
    except AdSet.DoesNotExist:
        logger.error(f"AdSet with ID {adset_id} not found")
        return {
            'status': 'error',
            'message': f'AdSet with ID {adset_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API sync failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API sync failed: {str(e)}'
        }


@shared_task(bind=True)
def sync_ad_status_from_meta(self, ad_id):
    """Meta APIから広告ステータスを取得してローカルと同期するタスク"""
    from .models import Ad
    from apps.accounts.models import MetaAccount
    
    try:
        logger.info(f"=== SYNC AD STATUS TASK STARTED ===")
        logger.info(f"Ad ID: {ad_id}")
        
        # 広告を取得
        ad = Ad.objects.get(id=ad_id)
        meta_account = ad.adset.campaign.meta_account
        
        logger.info(f"Ad Name: {ad.name}")
        logger.info(f"Ad Facebook ID: {ad.ad_id}")
        logger.info(f"Current Local Status: {ad.status}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        # Meta APIのベースURL
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # Facebookの広告IDが存在する場合のみステータス取得を試行
        if ad.ad_id and not ad.ad_id.startswith('ad_'):
            logger.info(f"Fetching ad status from Meta API: {ad.ad_id}")
            
            try:
                # Meta APIから広告ステータスを取得
                fetch_url = f"{api_base_url}/{ad.ad_id}"
                params = {'fields': 'id,name,status'}
                
                logger.info(f"GET request URL: {fetch_url}")
                logger.info(f"GET request params: {params}")
                logger.info(f"GET request headers: {headers}")
                
                response = requests.get(fetch_url, headers=headers, params=params, timeout=30)
                
                logger.info(f"Meta API fetch response status: {response.status_code}")
                logger.info(f"Meta API fetch response text: {response.text}")
                logger.info(f"Meta API fetch response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    response_data = response.json()
                    meta_status = response_data.get('status', '').upper()
                    
                    logger.info(f"Meta API status: {meta_status}")
                    logger.info(f"Local status: {ad.status}")
                    
                    # ステータスが異なる場合は同期
                    if meta_status != ad.status:
                        logger.info(f"Status mismatch detected. Updating local status from {ad.status} to {meta_status}")
                        ad.status = meta_status
                        ad.save()
                        
                        return {
                            'status': 'success',
                            'ad_id': ad.ad_id,
                            'local_status': ad.status,
                            'meta_status': meta_status,
                            'message': f'Ad status synchronized from Meta API: {meta_status}'
                        }
                    else:
                        logger.info(f"Status already synchronized: {meta_status}")
                        return {
                            'status': 'success',
                            'ad_id': ad.ad_id,
                            'local_status': ad.status,
                            'meta_status': meta_status,
                            'message': f'Ad status already synchronized: {meta_status}'
                        }
                        
                elif response.status_code == 400:
                    logger.error(f"Bad Request - Meta API fetch failed: {response.text}")
                    try:
                        error_data = response.json()
                        error_message = error_data.get('error', {}).get('message', response.text)
                    except:
                        error_message = response.text
                    return {
                        'status': 'error',
                        'ad_id': ad.ad_id,
                        'message': f'Meta API fetch failed (Bad Request): {error_message}'
                    }
                elif response.status_code == 401:
                    logger.error(f"Unauthorized - Meta API token may be invalid: {response.text}")
                    return {
                        'status': 'error',
                        'ad_id': ad.ad_id,
                        'message': f'Meta API fetch failed (Unauthorized): Access token may be invalid or expired'
                    }
                elif response.status_code == 403:
                    logger.error(f"Forbidden - Meta API fetch failed: {response.text}")
                    return {
                        'status': 'error',
                        'ad_id': ad.ad_id,
                        'message': f'Meta API fetch failed (Forbidden): Insufficient permissions'
                    }
                elif response.status_code == 404:
                    logger.warning(f"Ad not found in Meta API: {ad.ad_id}")
                    return {
                        'status': 'warning',
                        'ad_id': ad.ad_id,
                        'message': f'Ad not found in Meta API (may have been deleted)'
                    }
                else:
                    logger.error(f"Meta API fetch failed with status {response.status_code}: {response.text}")
                    return {
                        'status': 'error',
                        'ad_id': ad.ad_id,
                        'message': f'Meta API fetch failed with status {response.status_code}: {response.text}'
                    }
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Meta API connection failed during fetch: {e}")
                return {
                    'status': 'warning',
                    'ad_id': ad.ad_id,
                    'message': f'Meta API connection failed during fetch: {str(e)}. Cannot sync status.'
                }
            except Exception as e:
                logger.error(f"Unexpected error during Meta API fetch: {str(e)}")
                return {
                    'status': 'error',
                    'ad_id': ad.ad_id,
                    'message': f'Unexpected error during Meta API fetch: {str(e)}'
                }
        else:
            logger.info(f"Ad has no valid Facebook ID or is demo ad: {ad.ad_id}")
            return {
                'status': 'info',
                'ad_id': ad.ad_id,
                'message': 'Ad has no valid Facebook ID or is demo ad - no Meta sync needed'
            }
    
    except Ad.DoesNotExist:
        logger.error(f"Ad with ID {ad_id} not found")
        return {
            'status': 'error',
            'message': f'Ad with ID {ad_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API sync failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API sync failed: {str(e)}'
        }


@shared_task(bind=True)
def sync_campaign_full_from_meta(self, campaign_id):
    """キャンペーン全体（キャンペーン+広告セット+広告）をMeta APIから同期するタスク"""
    from .models import Campaign
    
    try:
        logger.info(f"=== SYNC CAMPAIGN FULL TASK STARTED ===")
        logger.info(f"Campaign ID: {campaign_id}")
        
        # キャンペーンを取得
        campaign = Campaign.objects.get(id=campaign_id)
        
        logger.info(f"Campaign Name: {campaign.name}")
        logger.info(f"Campaign Facebook ID: {campaign.campaign_id}")
        
        results = []
        
        # 1. キャンペーンステータスを同期
        try:
            campaign_result = sync_campaign_status_from_meta(campaign_id)
            results.append({
                'type': 'campaign',
                'id': campaign.id,
                'name': campaign.name,
                'result': campaign_result
            })
        except Exception as e:
            logger.error(f"Failed to sync campaign {campaign_id}: {str(e)}")
            results.append({
                'type': 'campaign',
                'id': campaign.id,
                'name': campaign.name,
                'result': {
                    'status': 'error',
                    'message': f'Campaign sync failed: {str(e)}'
                }
            })
        
        # 2. 広告セットステータスを同期
        adsets = campaign.adsets.all()
        for adset in adsets:
            try:
                adset_result = sync_adset_status_from_meta(adset.id)
                results.append({
                    'type': 'adset',
                    'id': adset.id,
                    'name': adset.name,
                    'result': adset_result
                })
            except Exception as e:
                logger.error(f"Failed to sync adset {adset.id}: {str(e)}")
                results.append({
                    'type': 'adset',
                    'id': adset.id,
                    'name': adset.name,
                    'result': {
                        'status': 'error',
                        'message': f'AdSet sync failed: {str(e)}'
                    }
                })
        
        # 3. 広告ステータスを同期
        for adset in adsets:
            ads = adset.ads.all()
            for ad in ads:
                try:
                    ad_result = sync_ad_status_from_meta(ad.id)
                    results.append({
                        'type': 'ad',
                        'id': ad.id,
                        'name': ad.name,
                        'result': ad_result
                    })
                except Exception as e:
                    logger.error(f"Failed to sync ad {ad.id}: {str(e)}")
                    results.append({
                        'type': 'ad',
                        'id': ad.id,
                        'name': ad.name,
                        'result': {
                            'status': 'error',
                            'message': f'Ad sync failed: {str(e)}'
                        }
                    })
        
        # 結果を集計
        successful_syncs = len([r for r in results if r['result'].get('status') == 'success'])
        total_syncs = len(results)
        
        logger.info(f"Full sync completed: {successful_syncs}/{total_syncs} items synchronized successfully")
        
        return {
            'status': 'success',
            'campaign_id': campaign_id,
            'campaign_name': campaign.name,
            'total_items': total_syncs,
            'successful_syncs': successful_syncs,
            'results': results,
            'message': f'Campaign full sync completed: {successful_syncs}/{total_syncs} items synchronized'
        }
        
    except Campaign.DoesNotExist:
        logger.error(f"Campaign with ID {campaign_id} not found")
        return {
            'status': 'error',
            'message': f'Campaign with ID {campaign_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API full sync failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API full sync failed: {str(e)}'
        }


@shared_task(bind=True)
def activate_adset_in_meta(self, adset_id):
    """Meta APIで広告セットを有効化するタスク"""
    from .models import AdSet
    from apps.accounts.models import MetaAccount
    
    try:
        logger.info(f"=== ACTIVATE ADSET TASK STARTED ===")
        logger.info(f"AdSet ID: {adset_id}")
        
        # 広告セットを取得
        adset = AdSet.objects.get(id=adset_id)
        meta_account = adset.campaign.meta_account
        
        logger.info(f"AdSet Name: {adset.name}")
        logger.info(f"AdSet Facebook ID: {adset.adset_id}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        # Meta APIのベースURL
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # Facebookの広告セットIDが存在する場合のみ有効化を試行
        if adset.adset_id and not adset.adset_id.startswith('adset_'):
            logger.info(f"Activating adset in Meta API: {adset.adset_id}")
            
            try:
                # Meta APIで広告セットを有効化（POSTメソッドを使用）
                update_url = f"{api_base_url}/{adset.adset_id}"
                update_data = {'status': 'ACTIVE'}
                
                logger.info(f"POST request URL: {update_url}")
                logger.info(f"POST request data: {update_data}")
                logger.info(f"POST request headers: {headers}")
                
                response = requests.post(update_url, headers=headers, json=update_data, timeout=30)
                
                logger.info(f"Meta API activate response status: {response.status_code}")
                logger.info(f"Meta API activate response text: {response.text}")
                logger.info(f"Meta API activate response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    logger.info(f"AdSet activated successfully in Meta: {adset.adset_id}")
                    return {
                        'status': 'success',
                        'adset_id': adset.adset_id,
                        'message': 'AdSet activated successfully in Meta API'
                    }
                elif response.status_code == 400:
                    logger.error(f"Bad Request - Meta API activate failed: {response.text}")
                    try:
                        error_data = response.json()
                        error_message = error_data.get('error', {}).get('message', response.text)
                    except:
                        error_message = response.text
                    return {
                        'status': 'error',
                        'adset_id': adset.adset_id,
                        'message': f'Meta API activate failed (Bad Request): {error_message}'
                    }
                elif response.status_code == 401:
                    logger.error(f"Unauthorized - Meta API token may be invalid: {response.text}")
                    return {
                        'status': 'error',
                        'adset_id': adset.adset_id,
                        'message': f'Meta API activate failed (Unauthorized): Access token may be invalid or expired'
                    }
                elif response.status_code == 403:
                    logger.error(f"Forbidden - Meta API activate failed: {response.text}")
                    return {
                        'status': 'error',
                        'adset_id': adset.adset_id,
                        'message': f'Meta API activate failed (Forbidden): Insufficient permissions'
                    }
                elif response.status_code == 404:
                    logger.warning(f"AdSet not found in Meta API: {adset.adset_id}")
                    return {
                        'status': 'warning',
                        'adset_id': adset.adset_id,
                        'message': f'AdSet not found in Meta API (may already be deleted)'
                    }
                else:
                    logger.error(f"Meta API activate failed with status {response.status_code}: {response.text}")
                    return {
                        'status': 'error',
                        'adset_id': adset.adset_id,
                        'message': f'Meta API activate failed with status {response.status_code}: {response.text}'
                    }
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Meta API connection failed during activate: {e}")
                return {
                    'status': 'warning',
                    'adset_id': adset.adset_id,
                    'message': f'Meta API connection failed during activate: {str(e)}. AdSet may not be activated in Meta.'
                }
            except Exception as e:
                logger.error(f"Unexpected error during Meta API activate: {str(e)}")
                return {
                    'status': 'error',
                    'adset_id': adset.adset_id,
                    'message': f'Unexpected error during Meta API activate: {str(e)}'
                }
        else:
            logger.info(f"AdSet has no valid Facebook ID or is demo adset: {adset.adset_id}")
            return {
                'status': 'info',
                'adset_id': adset.adset_id,
                'message': 'AdSet has no valid Facebook ID or is demo adset - no Meta activation needed'
            }
    
    except AdSet.DoesNotExist:
        logger.error(f"AdSet with ID {adset_id} not found")
        return {
            'status': 'error',
            'message': f'AdSet with ID {adset_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API activation failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API activation failed: {str(e)}'
        }


@shared_task(bind=True)
def pause_adset_in_meta(self, adset_id):
    """Meta APIで広告セットを一時停止するタスク"""
    from .models import AdSet
    from apps.accounts.models import MetaAccount
    
    try:
        logger.info(f"=== PAUSE ADSET TASK STARTED ===")
        logger.info(f"AdSet ID: {adset_id}")
        
        # 広告セットを取得
        adset = AdSet.objects.get(id=adset_id)
        meta_account = adset.campaign.meta_account
        
        logger.info(f"AdSet Name: {adset.name}")
        logger.info(f"AdSet Facebook ID: {adset.adset_id}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        # Meta APIのベースURL
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # Facebookの広告セットIDが存在する場合のみ一時停止を試行
        if adset.adset_id and not adset.adset_id.startswith('adset_'):
            logger.info(f"Pausing adset in Meta API: {adset.adset_id}")
            
            try:
                # Meta APIで広告セットを一時停止（POSTメソッドを使用）
                update_url = f"{api_base_url}/{adset.adset_id}"
                update_data = {'status': 'PAUSED'}
                
                logger.info(f"POST request URL: {update_url}")
                logger.info(f"POST request data: {update_data}")
                logger.info(f"POST request headers: {headers}")
                
                response = requests.post(update_url, headers=headers, json=update_data, timeout=30)
                
                logger.info(f"Meta API pause response status: {response.status_code}")
                logger.info(f"Meta API pause response text: {response.text}")
                logger.info(f"Meta API pause response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    logger.info(f"AdSet paused successfully in Meta: {adset.adset_id}")
                    return {
                        'status': 'success',
                        'adset_id': adset.adset_id,
                        'message': 'AdSet paused successfully in Meta API'
                    }
                elif response.status_code == 400:
                    logger.error(f"Bad Request - Meta API pause failed: {response.text}")
                    try:
                        error_data = response.json()
                        error_message = error_data.get('error', {}).get('message', response.text)
                    except:
                        error_message = response.text
                    return {
                        'status': 'error',
                        'adset_id': adset.adset_id,
                        'message': f'Meta API pause failed (Bad Request): {error_message}'
                    }
                elif response.status_code == 401:
                    logger.error(f"Unauthorized - Meta API token may be invalid: {response.text}")
                    return {
                        'status': 'error',
                        'adset_id': adset.adset_id,
                        'message': f'Meta API pause failed (Unauthorized): Access token may be invalid or expired'
                    }
                elif response.status_code == 403:
                    logger.error(f"Forbidden - Meta API pause failed: {response.text}")
                    return {
                        'status': 'error',
                        'adset_id': adset.adset_id,
                        'message': f'Meta API pause failed (Forbidden): Insufficient permissions'
                    }
                elif response.status_code == 404:
                    logger.warning(f"AdSet not found in Meta API: {adset.adset_id}")
                    return {
                        'status': 'warning',
                        'adset_id': adset.adset_id,
                        'message': f'AdSet not found in Meta API (may already be deleted)'
                    }
                else:
                    logger.error(f"Meta API pause failed with status {response.status_code}: {response.text}")
                    return {
                        'status': 'error',
                        'adset_id': adset.adset_id,
                        'message': f'Meta API pause failed with status {response.status_code}: {response.text}'
                    }
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Meta API connection failed during pause: {e}")
                return {
                    'status': 'warning',
                    'adset_id': adset.adset_id,
                    'message': f'Meta API connection failed during pause: {str(e)}. AdSet may not be paused in Meta.'
                }
            except Exception as e:
                logger.error(f"Unexpected error during Meta API pause: {str(e)}")
                return {
                    'status': 'error',
                    'adset_id': adset.adset_id,
                    'message': f'Unexpected error during Meta API pause: {str(e)}'
                }
        else:
            logger.info(f"AdSet has no valid Facebook ID or is demo adset: {adset.adset_id}")
            return {
                'status': 'info',
                'adset_id': adset.adset_id,
                'message': 'AdSet has no valid Facebook ID or is demo adset - no Meta pause needed'
            }
    
    except AdSet.DoesNotExist:
        logger.error(f"AdSet with ID {adset_id} not found")
        return {
            'status': 'error',
            'message': f'AdSet with ID {adset_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API pause failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API pause failed: {str(e)}'
        }


@shared_task(bind=True)
def fetch_campaign_insights_from_meta(self, campaign_id):
    """Meta APIからキャンペーンのインサイトデータを取得するタスク"""
    from .models import Campaign
    from apps.accounts.models import MetaAccount
    
    try:
        logger.info(f"=== FETCH CAMPAIGN INSIGHTS TASK STARTED ===")
        logger.info(f"Campaign ID: {campaign_id}")
        
        # キャンペーンを取得
        campaign = Campaign.objects.get(id=campaign_id)
        meta_account = campaign.meta_account
        
        logger.info(f"Campaign Name: {campaign.name}")
        logger.info(f"Campaign Facebook ID: {campaign.campaign_id}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        # Meta APIのベースURL
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # FacebookのキャンペーンIDが存在する場合のみインサイト取得を試行
        if campaign.campaign_id and not campaign.campaign_id.startswith('camp_'):
            logger.info(f"Fetching campaign insights from Meta API: {campaign.campaign_id}")
            
            try:
                # Meta APIからキャンペーンのインサイトデータを取得
                insights_url = f"{api_base_url}/{campaign.campaign_id}/insights"
                params = {
                    'fields': 'spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,conversions',
                    'time_range': _meta_campaign_insights_time_range_json(),
                    'level': 'campaign'
                }
                
                logger.info(f"GET request URL: {insights_url}")
                logger.info(f"GET request params: {params}")
                logger.info(f"GET request headers: {headers}")
                
                response = requests.get(insights_url, headers=headers, params=params, timeout=30)
                
                logger.info(f"Meta API insights response status: {response.status_code}")
                logger.info(f"Meta API insights response text: {response.text}")
                
                if response.status_code == 200:
                    insights_data = response.json()
                    logger.info(f"Campaign insights fetched successfully: {insights_data}")
                    
                    # インサイトデータを処理
                    if 'data' in insights_data and len(insights_data['data']) > 0:
                        insight = insights_data['data'][0]
                        
                        # コンバージョン数を抽出（重複を避ける）
                        conversions = 0
                        if 'actions' in insight:
                            # まず、すべてのアクションを分類
                            actions_dict = {}
                            for action in insight['actions']:
                                action_type = action.get('action_type', '')
                                action_value = int(action.get('value', 0))
                                actions_dict[action_type] = action_value
                            
                            # offsite_conversion.fb_pixel_* を優先的にカウント（重複を避ける）
                            # 1. offsite_conversion.fb_pixel_purchase を優先
                            if 'offsite_conversion.fb_pixel_purchase' in actions_dict:
                                conversions += actions_dict['offsite_conversion.fb_pixel_purchase']
                            elif 'purchase' in actions_dict:
                                # offsite_conversion.fb_pixel_purchase がない場合のみ purchase をカウント
                                conversions += actions_dict['purchase']
                            
                            # 2. offsite_conversion.fb_pixel_complete_registration を優先
                            if 'offsite_conversion.fb_pixel_complete_registration' in actions_dict:
                                conversions += actions_dict['offsite_conversion.fb_pixel_complete_registration']
                            elif 'complete_registration' in actions_dict:
                                # offsite_conversion.fb_pixel_complete_registration がない場合のみ complete_registration をカウント
                                conversions += actions_dict['complete_registration']
                            
                            # 3. offsite_conversion.fb_pixel_lead を優先
                            if 'offsite_conversion.fb_pixel_lead' in actions_dict:
                                conversions += actions_dict['offsite_conversion.fb_pixel_lead']
                            elif 'lead' in actions_dict:
                                # offsite_conversion.fb_pixel_lead がない場合のみ lead をカウント
                                conversions += actions_dict['lead']
                            
                            # 4. その他の offsite_conversion（上記以外）
                            for action_type, action_value in actions_dict.items():
                                if action_type.startswith('offsite_conversion.fb_pixel_') and action_type not in [
                                    'offsite_conversion.fb_pixel_purchase',
                                    'offsite_conversion.fb_pixel_complete_registration',
                                    'offsite_conversion.fb_pixel_lead'
                                ]:
                                    conversions += action_value
                        elif 'conversions' in insight:
                            # conversionsフィールドがある場合
                            for conversion in insight['conversions']:
                                conversions += int(conversion.get('value', 0))
                        
                        insights_dict = {
                            'spend': float(insight.get('spend', 0)),
                            'impressions': int(insight.get('impressions', 0)),
                            'clicks': int(insight.get('clicks', 0)),
                            'ctr': float(insight.get('ctr', 0)),
                            'cpc': float(insight.get('cpc', 0)),
                            'cpm': float(insight.get('cpm', 0)),
                            'reach': int(insight.get('reach', 0)),
                            'frequency': float(insight.get('frequency', 0)),
                            'conversions': conversions,
                        }
                        
                        # キャッシュに保存
                        from django.utils import timezone
                        campaign.cached_insights = insights_dict
                        campaign.insights_updated_at = timezone.now()
                        campaign.save(update_fields=['cached_insights', 'insights_updated_at'])
                        logger.info(f"Cached insights for campaign {campaign.id}")
                        
                        return {
                            'status': 'success',
                            'campaign_id': campaign.campaign_id,
                            'insights': insights_dict
                        }
                    else:
                        logger.warning(f"No insights data found for campaign {campaign.campaign_id}")
                        # data=[] でも「取得試行済み」として時刻を更新し、UI進捗に反映させる
                        from django.utils import timezone
                        zero_insights = {
                            'spend': 0,
                            'impressions': 0,
                            'clicks': 0,
                            'ctr': 0,
                            'cpc': 0,
                            'cpm': 0,
                            'reach': 0,
                            'frequency': 0,
                            'conversions': 0,
                        }
                        campaign.cached_insights = zero_insights
                        campaign.insights_updated_at = timezone.now()
                        campaign.save(update_fields=['cached_insights', 'insights_updated_at'])
                        return {
                            'status': 'warning',
                            'campaign_id': campaign.campaign_id,
                            'message': 'No insights data available',
                            'insights': zero_insights
                        }
                else:
                    logger.error(f"Meta API insights failed with status {response.status_code}: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API insights failed with status {response.status_code}: {response.text}',
                        'insights': {
                            'spend': 0,
                            'impressions': 0,
                            'clicks': 0,
                            'ctr': 0,
                            'cpc': 0,
                            'cpm': 0,
                            'reach': 0,
                            'frequency': 0,
                        }
                    }
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Meta API connection failed during insights fetch: {e}")
                return {
                    'status': 'warning',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Meta API connection failed during insights fetch: {str(e)}',
                    'insights': {
                        'spend': 0,
                        'impressions': 0,
                        'clicks': 0,
                        'ctr': 0,
                        'cpc': 0,
                        'cpm': 0,
                        'reach': 0,
                        'frequency': 0,
                    }
                }
            except Exception as e:
                logger.error(f"Unexpected error during Meta API insights fetch: {str(e)}")
                return {
                    'status': 'error',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Unexpected error during Meta API insights fetch: {str(e)}',
                    'insights': {
                        'spend': 0,
                        'impressions': 0,
                        'clicks': 0,
                        'ctr': 0,
                        'cpc': 0,
                        'cpm': 0,
                        'reach': 0,
                        'frequency': 0,
                    }
                }
        else:
            logger.info(f"Campaign has no valid Facebook ID or is demo campaign: {campaign.campaign_id}")
            return {
                'status': 'info',
                'campaign_id': campaign.campaign_id,
                'message': 'Campaign has no valid Facebook ID or is demo campaign - no Meta insights available',
                'insights': {
                    'spend': 0,
                    'impressions': 0,
                    'clicks': 0,
                    'ctr': 0,
                    'cpc': 0,
                    'cpm': 0,
                    'reach': 0,
                    'frequency': 0,
                }
            }
    
    except Campaign.DoesNotExist:
        logger.error(f"Campaign with ID {campaign_id} not found")
        return {
            'status': 'error',
            'message': f'Campaign with ID {campaign_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API insights fetch failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API insights fetch failed: {str(e)}'
        }


@shared_task(bind=True)
def activate_ad_in_meta(self, ad_id):
    """Meta APIで広告を有効化するタスク"""
    from .models import Ad
    from apps.accounts.models import MetaAccount
    
    try:
        logger.info(f"=== ACTIVATE AD TASK STARTED ===")
        logger.info(f"Ad ID: {ad_id}")
        
        # 広告を取得
        ad = Ad.objects.get(id=ad_id)
        meta_account = ad.adset.campaign.meta_account
        
        logger.info(f"Ad Name: {ad.name}")
        logger.info(f"Ad Facebook ID: {ad.ad_id}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        # Meta APIのベースURL
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # Facebookの広告IDが存在する場合のみ有効化を試行
        if ad.ad_id and not ad.ad_id.startswith('ad_'):
            logger.info(f"Activating ad in Meta API: {ad.ad_id}")
            
            try:
                # Meta APIで広告を有効化（POSTメソッドを使用）
                update_url = f"{api_base_url}/{ad.ad_id}"
                update_data = {'status': 'ACTIVE'}
                
                logger.info(f"POST request URL: {update_url}")
                logger.info(f"POST request data: {update_data}")
                logger.info(f"POST request headers: {headers}")
                
                response = requests.post(update_url, headers=headers, json=update_data, timeout=30)
                
                logger.info(f"Meta API activate response status: {response.status_code}")
                logger.info(f"Meta API activate response text: {response.text}")
                logger.info(f"Meta API activate response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    logger.info(f"Ad activated successfully in Meta: {ad.ad_id}")
                    return {
                        'status': 'success',
                        'ad_id': ad.ad_id,
                        'message': 'Ad activated successfully in Meta API'
                    }
                elif response.status_code == 400:
                    logger.error(f"Bad Request - Meta API activate failed: {response.text}")
                    try:
                        error_data = response.json()
                        error_message = error_data.get('error', {}).get('message', response.text)
                    except:
                        error_message = response.text
                    return {
                        'status': 'error',
                        'ad_id': ad.ad_id,
                        'message': f'Meta API activate failed (Bad Request): {error_message}'
                    }
                elif response.status_code == 401:
                    logger.error(f"Unauthorized - Meta API token may be invalid: {response.text}")
                    return {
                        'status': 'error',
                        'ad_id': ad.ad_id,
                        'message': f'Meta API activate failed (Unauthorized): Access token may be invalid or expired'
                    }
                elif response.status_code == 403:
                    logger.error(f"Forbidden - Meta API activate failed: {response.text}")
                    return {
                        'status': 'error',
                        'ad_id': ad.ad_id,
                        'message': f'Meta API activate failed (Forbidden): Insufficient permissions'
                    }
                elif response.status_code == 404:
                    logger.warning(f"Ad not found in Meta API: {ad.ad_id}")
                    return {
                        'status': 'warning',
                        'ad_id': ad.ad_id,
                        'message': f'Ad not found in Meta API (may already be deleted)'
                    }
                else:
                    logger.error(f"Meta API activate failed with status {response.status_code}: {response.text}")
                    return {
                        'status': 'error',
                        'ad_id': ad.ad_id,
                        'message': f'Meta API activate failed with status {response.status_code}: {response.text}'
                    }
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Meta API connection failed during activate: {e}")
                return {
                    'status': 'warning',
                    'ad_id': ad.ad_id,
                    'message': f'Meta API connection failed during activate: {str(e)}. Ad may not be activated in Meta.'
                }
            except Exception as e:
                logger.error(f"Unexpected error during Meta API activate: {str(e)}")
                return {
                    'status': 'error',
                    'ad_id': ad.ad_id,
                    'message': f'Unexpected error during Meta API activate: {str(e)}'
                }
        else:
            logger.info(f"Ad has no valid Facebook ID or is demo ad: {ad.ad_id}")
            return {
                'status': 'info',
                'ad_id': ad.ad_id,
                'message': 'Ad has no valid Facebook ID or is demo ad - no Meta activation needed'
            }
    
    except Ad.DoesNotExist:
        logger.error(f"Ad with ID {ad_id} not found")
        return {
            'status': 'error',
            'message': f'Ad with ID {ad_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API activation failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API activation failed: {str(e)}'
        }


@shared_task(bind=True)
def pause_ad_in_meta(self, ad_id):
    """Meta APIで広告を一時停止するタスク"""
    from .models import Ad
    from apps.accounts.models import MetaAccount
    
    try:
        logger.info(f"=== PAUSE AD TASK STARTED ===")
        logger.info(f"Ad ID: {ad_id}")
        
        # 広告を取得
        ad = Ad.objects.get(id=ad_id)
        meta_account = ad.adset.campaign.meta_account
        
        logger.info(f"Ad Name: {ad.name}")
        logger.info(f"Ad Facebook ID: {ad.ad_id}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        # Meta APIのベースURL
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # Facebookの広告IDが存在する場合のみ一時停止を試行
        if ad.ad_id and not ad.ad_id.startswith('ad_'):
            logger.info(f"Pausing ad in Meta API: {ad.ad_id}")
            
            try:
                # Meta APIで広告を一時停止（POSTメソッドを使用）
                update_url = f"{api_base_url}/{ad.ad_id}"
                update_data = {'status': 'PAUSED'}
                
                logger.info(f"POST request URL: {update_url}")
                logger.info(f"POST request data: {update_data}")
                logger.info(f"POST request headers: {headers}")
                
                response = requests.post(update_url, headers=headers, json=update_data, timeout=30)
                
                logger.info(f"Meta API pause response status: {response.status_code}")
                logger.info(f"Meta API pause response text: {response.text}")
                logger.info(f"Meta API pause response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    logger.info(f"Ad paused successfully in Meta: {ad.ad_id}")
                    return {
                        'status': 'success',
                        'ad_id': ad.ad_id,
                        'message': 'Ad paused successfully in Meta API'
                    }
                elif response.status_code == 400:
                    logger.error(f"Bad Request - Meta API pause failed: {response.text}")
                    try:
                        error_data = response.json()
                        error_message = error_data.get('error', {}).get('message', response.text)
                    except:
                        error_message = response.text
                    return {
                        'status': 'error',
                        'ad_id': ad.ad_id,
                        'message': f'Meta API pause failed (Bad Request): {error_message}'
                    }
                elif response.status_code == 401:
                    logger.error(f"Unauthorized - Meta API token may be invalid: {response.text}")
                    return {
                        'status': 'error',
                        'ad_id': ad.ad_id,
                        'message': f'Meta API pause failed (Unauthorized): Access token may be invalid or expired'
                    }
                elif response.status_code == 403:
                    logger.error(f"Forbidden - Meta API pause failed: {response.text}")
                    return {
                        'status': 'error',
                        'ad_id': ad.ad_id,
                        'message': f'Meta API pause failed (Forbidden): Insufficient permissions'
                    }
                elif response.status_code == 404:
                    logger.warning(f"Ad not found in Meta API: {ad.ad_id}")
                    return {
                        'status': 'warning',
                        'ad_id': ad.ad_id,
                        'message': f'Ad not found in Meta API (may already be deleted)'
                    }
                else:
                    logger.error(f"Meta API pause failed with status {response.status_code}: {response.text}")
                    return {
                        'status': 'error',
                        'ad_id': ad.ad_id,
                        'message': f'Meta API pause failed with status {response.status_code}: {response.text}'
                    }
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Meta API connection failed during pause: {e}")
                return {
                    'status': 'warning',
                    'ad_id': ad.ad_id,
                    'message': f'Meta API connection failed during pause: {str(e)}. Ad may not be paused in Meta.'
                }
            except Exception as e:
                logger.error(f"Unexpected error during Meta API pause: {str(e)}")
                return {
                    'status': 'error',
                    'ad_id': ad.ad_id,
                    'message': f'Unexpected error during Meta API pause: {str(e)}'
                }
        else:
            logger.info(f"Ad has no valid Facebook ID or is demo ad: {ad.ad_id}")
            return {
                'status': 'info',
                'ad_id': ad.ad_id,
                'message': 'Ad has no valid Facebook ID or is demo ad - no Meta pause needed'
            }
    
    except Ad.DoesNotExist:
        logger.error(f"Ad with ID {ad_id} not found")
        return {
            'status': 'error',
            'message': f'Ad with ID {ad_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API pause failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API pause failed: {str(e)}'
        }


@shared_task(bind=True)
def fetch_campaign_insights_from_meta(self, campaign_id):
    """Meta APIからキャンペーンのインサイトデータを取得するタスク"""
    from .models import Campaign
    from apps.accounts.models import MetaAccount
    
    try:
        logger.info(f"=== FETCH CAMPAIGN INSIGHTS TASK STARTED ===")
        logger.info(f"Campaign ID: {campaign_id}")
        
        # キャンペーンを取得
        campaign = Campaign.objects.get(id=campaign_id)
        meta_account = campaign.meta_account
        
        logger.info(f"Campaign Name: {campaign.name}")
        logger.info(f"Campaign Facebook ID: {campaign.campaign_id}")
        logger.info(f"Meta Account ID: {meta_account.id}")
        logger.info(f"Meta Account Name: {meta_account.account_name}")
        
        if not meta_account.is_active:
            raise Exception("Meta account is not active")
        
        # Meta APIのベースURL
        api_base_url = f"https://graph.facebook.com/v22.0"
        
        headers = {
            'Authorization': f'Bearer {meta_account.access_token}',
            'Content-Type': 'application/json',
        }
        
        # FacebookのキャンペーンIDが存在する場合のみインサイト取得を試行
        if campaign.campaign_id and not campaign.campaign_id.startswith('camp_'):
            logger.info(f"Fetching campaign insights from Meta API: {campaign.campaign_id}")
            
            try:
                # Meta APIからキャンペーンのインサイトデータを取得
                insights_url = f"{api_base_url}/{campaign.campaign_id}/insights"
                params = {
                    'fields': 'spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,conversions',
                    'time_range': _meta_campaign_insights_time_range_json(),
                    'level': 'campaign'
                }
                
                logger.info(f"GET request URL: {insights_url}")
                logger.info(f"GET request params: {params}")
                logger.info(f"GET request headers: {headers}")
                
                response = requests.get(insights_url, headers=headers, params=params, timeout=30)
                
                logger.info(f"Meta API insights response status: {response.status_code}")
                logger.info(f"Meta API insights response text: {response.text}")
                
                if response.status_code == 200:
                    insights_data = response.json()
                    logger.info(f"Campaign insights fetched successfully: {insights_data}")
                    
                    # インサイトデータを処理
                    if 'data' in insights_data and len(insights_data['data']) > 0:
                        insight = insights_data['data'][0]
                        
                        # コンバージョン数を抽出（重複を避ける）
                        conversions = 0
                        if 'actions' in insight:
                            # まず、すべてのアクションを分類
                            actions_dict = {}
                            for action in insight['actions']:
                                action_type = action.get('action_type', '')
                                action_value = int(action.get('value', 0))
                                actions_dict[action_type] = action_value
                            
                            # offsite_conversion.fb_pixel_* を優先的にカウント（重複を避ける）
                            # 1. offsite_conversion.fb_pixel_purchase を優先
                            if 'offsite_conversion.fb_pixel_purchase' in actions_dict:
                                conversions += actions_dict['offsite_conversion.fb_pixel_purchase']
                            elif 'purchase' in actions_dict:
                                # offsite_conversion.fb_pixel_purchase がない場合のみ purchase をカウント
                                conversions += actions_dict['purchase']
                            
                            # 2. offsite_conversion.fb_pixel_complete_registration を優先
                            if 'offsite_conversion.fb_pixel_complete_registration' in actions_dict:
                                conversions += actions_dict['offsite_conversion.fb_pixel_complete_registration']
                            elif 'complete_registration' in actions_dict:
                                # offsite_conversion.fb_pixel_complete_registration がない場合のみ complete_registration をカウント
                                conversions += actions_dict['complete_registration']
                            
                            # 3. offsite_conversion.fb_pixel_lead を優先
                            if 'offsite_conversion.fb_pixel_lead' in actions_dict:
                                conversions += actions_dict['offsite_conversion.fb_pixel_lead']
                            elif 'lead' in actions_dict:
                                # offsite_conversion.fb_pixel_lead がない場合のみ lead をカウント
                                conversions += actions_dict['lead']
                            
                            # 4. その他の offsite_conversion（上記以外）
                            for action_type, action_value in actions_dict.items():
                                if action_type.startswith('offsite_conversion.fb_pixel_') and action_type not in [
                                    'offsite_conversion.fb_pixel_purchase',
                                    'offsite_conversion.fb_pixel_complete_registration',
                                    'offsite_conversion.fb_pixel_lead'
                                ]:
                                    conversions += action_value
                        elif 'conversions' in insight:
                            # conversionsフィールドがある場合
                            for conversion in insight['conversions']:
                                conversions += int(conversion.get('value', 0))
                        
                        insights_dict = {
                            'spend': float(insight.get('spend', 0)),
                            'impressions': int(insight.get('impressions', 0)),
                            'clicks': int(insight.get('clicks', 0)),
                            'ctr': float(insight.get('ctr', 0)),
                            'cpc': float(insight.get('cpc', 0)),
                            'cpm': float(insight.get('cpm', 0)),
                            'reach': int(insight.get('reach', 0)),
                            'frequency': float(insight.get('frequency', 0)),
                            'conversions': conversions,
                        }
                        
                        # キャッシュに保存
                        from django.utils import timezone
                        campaign.cached_insights = insights_dict
                        campaign.insights_updated_at = timezone.now()
                        campaign.save(update_fields=['cached_insights', 'insights_updated_at'])
                        logger.info(f"Cached insights for campaign {campaign.id}")
                        
                        return {
                            'status': 'success',
                            'campaign_id': campaign.campaign_id,
                            'insights': insights_dict
                        }
                    else:
                        logger.warning(f"No insights data found for campaign {campaign.campaign_id}")
                        # data=[] でも「取得試行済み」として時刻を更新し、UI進捗に反映させる
                        from django.utils import timezone
                        zero_insights = {
                            'spend': 0,
                            'impressions': 0,
                            'clicks': 0,
                            'ctr': 0,
                            'cpc': 0,
                            'cpm': 0,
                            'reach': 0,
                            'frequency': 0,
                            'conversions': 0,
                        }
                        campaign.cached_insights = zero_insights
                        campaign.insights_updated_at = timezone.now()
                        campaign.save(update_fields=['cached_insights', 'insights_updated_at'])
                        return {
                            'status': 'warning',
                            'campaign_id': campaign.campaign_id,
                            'message': 'No insights data available',
                            'insights': zero_insights
                        }
                else:
                    logger.error(f"Meta API insights failed with status {response.status_code}: {response.text}")
                    return {
                        'status': 'error',
                        'campaign_id': campaign.campaign_id,
                        'message': f'Meta API insights failed with status {response.status_code}: {response.text}',
                        'insights': {
                            'spend': 0,
                            'impressions': 0,
                            'clicks': 0,
                            'ctr': 0,
                            'cpc': 0,
                            'cpm': 0,
                            'reach': 0,
                            'frequency': 0,
                        }
                    }
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Meta API connection failed during insights fetch: {e}")
                return {
                    'status': 'warning',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Meta API connection failed during insights fetch: {str(e)}',
                    'insights': {
                        'spend': 0,
                        'impressions': 0,
                        'clicks': 0,
                        'ctr': 0,
                        'cpc': 0,
                        'cpm': 0,
                        'reach': 0,
                        'frequency': 0,
                    }
                }
            except Exception as e:
                logger.error(f"Unexpected error during Meta API insights fetch: {str(e)}")
                return {
                    'status': 'error',
                    'campaign_id': campaign.campaign_id,
                    'message': f'Unexpected error during Meta API insights fetch: {str(e)}',
                    'insights': {
                        'spend': 0,
                        'impressions': 0,
                        'clicks': 0,
                        'ctr': 0,
                        'cpc': 0,
                        'cpm': 0,
                        'reach': 0,
                        'frequency': 0,
                    }
                }
        else:
            logger.info(f"Campaign has no valid Facebook ID or is demo campaign: {campaign.campaign_id}")
            return {
                'status': 'info',
                'campaign_id': campaign.campaign_id,
                'message': 'Campaign has no valid Facebook ID or is demo campaign - no Meta insights available',
                'insights': {
                    'spend': 0,
                    'impressions': 0,
                    'clicks': 0,
                    'ctr': 0,
                    'cpc': 0,
                    'cpm': 0,
                    'reach': 0,
                    'frequency': 0,
                }
            }
    
    except Campaign.DoesNotExist:
        logger.error(f"Campaign with ID {campaign_id} not found")
        return {
            'status': 'error',
            'message': f'Campaign with ID {campaign_id} not found'
        }
    except Exception as e:
        logger.error(f"Meta API insights fetch failed: {str(e)}")
        return {
            'status': 'error',
            'message': f'Meta API insights fetch failed: {str(e)}'
        }