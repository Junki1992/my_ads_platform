from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import HttpResponse
from django.db import transaction
from django.utils import timezone
import pandas as pd
import json
import logging
import uuid
from celery import shared_task

def map_optimization_event_to_meta_api(optimization_event):
    """
    CSVのoptimization_eventをMeta APIのoptimization_goalにマッピング
    デモ環境では複雑なコンバージョン設定を避けて、シンプルな目標を使用
    """
    mapping = {
        'CONVERSION': 'LINK_CLICKS',  # デモ環境ではLINK_CLICKSを使用
        'PURCHASE': 'LINK_CLICKS',    # デモ環境ではLINK_CLICKSを使用
        'VIEW_CONTENT': 'LANDING_PAGE_VIEWS',
        'LINK_CLICKS': 'LINK_CLICKS',
        'IMPRESSIONS': 'IMPRESSIONS',
        'REACH': 'REACH',
        'ENGAGEMENT': 'POST_ENGAGEMENT',
        'LEAD_GENERATION': 'LEAD_GENERATION',
        'APP_INSTALLS': 'APP_INSTALLS',
        'VIDEO_VIEWS': 'THRUPLAY',
        'BRAND_AWARENESS': 'AD_RECALL_LIFT',
        'TRAFFIC': 'LINK_CLICKS',
        'SALES': 'LINK_CLICKS',       # デモ環境ではLINK_CLICKSを使用
        'AWARENESS': 'REACH'
    }
    return mapping.get(optimization_event, 'LINK_CLICKS')  # デフォルトはLINK_CLICKS

def map_bid_strategy_to_meta_api(bid_strategy):
    """
    CSVのbid_strategyをMeta APIのbid_strategyにマッピング
    """
    mapping = {
        'LOWEST_COST': 'LOWEST_COST_WITHOUT_CAP',
        'LOWEST_COST_WITHOUT_CAP': 'LOWEST_COST_WITHOUT_CAP',
        'LOWEST_COST_WITH_BID_CAP': 'LOWEST_COST_WITH_BID_CAP',
        'COST_CAP': 'COST_CAP',
        'HIGHEST_VALUE': 'LOWEST_COST_WITH_MIN_ROAS',
        'TARGET_COST': 'COST_CAP',
        'TARGET_ROAS': 'LOWEST_COST_WITH_MIN_ROAS'
    }
    return mapping.get(bid_strategy, 'LOWEST_COST_WITHOUT_CAP')  # デフォルト
from .models import BulkUpload, BulkUploadRecord
from .serializers import BulkUploadSerializer, BulkUploadRecordSerializer
from apps.campaigns.models import Campaign, AdSet, Ad
from apps.accounts.models import MetaAccount

logger = logging.getLogger(__name__)

class BulkUploadViewSet(viewsets.ModelViewSet):
    """大量入稿ViewSet"""
    serializer_class = BulkUploadSerializer
    
    def get_queryset(self):
        return BulkUpload.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """入稿処理実行"""
        bulk_upload = self.get_object()
        
        # 既に処理中の場合はエラー
        if bulk_upload.status == 'PROCESSING':
            return Response({
                'error': '既に処理中のため、新しい処理を開始できません'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 処理開始
        bulk_upload.status = 'PROCESSING'
        bulk_upload.save()
        
        # 非同期で処理を開始
        try:
            process_bulk_upload.delay(bulk_upload.id)
            logger.info(f"Bulk upload {bulk_upload.id} processing started")
            return Response({
                'status': 'processing',
                'message': '一括入稿処理を開始しました',
                'bulk_upload_id': bulk_upload.id
            })
        except Exception as e:
            bulk_upload.status = 'FAILED'
            bulk_upload.error_log = f"処理開始エラー: {str(e)}"
            bulk_upload.save()
            logger.error(f"Failed to start bulk upload processing: {e}")
            return Response({
                'error': '処理の開始に失敗しました',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        """進捗取得"""
        bulk_upload = self.get_object()
        
        # 詳細な進捗情報を取得
        records = bulk_upload.records.all()
        successful_records = records.filter(status='SUCCESS')
        failed_records = records.filter(status='FAILED')
        
        return Response({
            'total': bulk_upload.total_records,
            'processed': bulk_upload.processed_records,
            'successful': bulk_upload.successful_records,
            'failed': bulk_upload.failed_records,
            'status': bulk_upload.status,
            'progress_percentage': round((bulk_upload.processed_records / bulk_upload.total_records * 100) if bulk_upload.total_records > 0 else 0, 2),
            'error_log': bulk_upload.error_log,
            'created_at': bulk_upload.created_at,
            'updated_at': bulk_upload.updated_at,
            'failed_records_detail': BulkUploadRecordSerializer(failed_records, many=True).data
        })
    
    @action(detail=False, methods=['post'])
    def upload_and_validate(self, request):
        """CSVファイルのアップロードとバリデーション"""
        file = request.FILES.get('file')
        if not file:
            return Response({
                'error': 'ファイルが選択されていません'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 選択されたMetaアカウントIDを取得
        selected_account_id = request.data.get('selected_account_id')
        
        try:
            # CSVファイルを読み込み
            if file.name.endswith('.csv'):
                try:
                    df = pd.read_csv(file, encoding='utf-8-sig')
                except UnicodeDecodeError:
                    try:
                        df = pd.read_csv(file, encoding='shift_jis')
                    except UnicodeDecodeError:
                        df = pd.read_csv(file, encoding='cp932')
            else:
                df = pd.read_excel(file)
            
            # 空のDataFrameの場合はエラー
            if df.empty:
                return Response({
                    'error': 'ファイルが空です'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # データをクリーンアップしてからバリデーション
            cleaned_records = []
            for record in df.to_dict('records'):
                cleaned_record = {}
                for key, value in record.items():
                    if pd.isna(value):
                        cleaned_record[key] = None
                    elif isinstance(value, (int, float)) and pd.isna(value):
                        cleaned_record[key] = None
                    else:
                        cleaned_record[key] = value
                cleaned_records.append(cleaned_record)
            
            # データをバリデーション
            validation_results = validate_campaign_data(cleaned_records)
            
            # BulkUploadレコードを作成
            bulk_upload = BulkUpload.objects.create(
                user=request.user,
                file_name=file.name,
                file_path=f"temp/{file.name}",
                total_records=len(df),
                status='VALIDATING',
                selected_account_id=selected_account_id
            )
            
            # バリデーション結果をBulkUploadRecordに保存
            for i, (row_data, validation) in enumerate(zip(cleaned_records, validation_results)):
                BulkUploadRecord.objects.create(
                    bulk_upload=bulk_upload,
                    row_number=i + 2,  # Excel行番号（ヘッダー行を含む）
                    data=row_data,
                    status='SUCCESS' if validation['is_valid'] else 'FAILED',
                    error_message='; '.join(validation['errors']) if validation['errors'] else ''
                )
            
            # 統計情報を更新
            bulk_upload.successful_records = len([r for r in validation_results if r['is_valid']])
            bulk_upload.failed_records = len([r for r in validation_results if not r['is_valid']])
            bulk_upload.status = 'COMPLETED' if bulk_upload.failed_records == 0 else 'VALIDATED'
            bulk_upload.save()
            
            return Response({
                'bulk_upload_id': bulk_upload.id,
                'total_records': bulk_upload.total_records,
                'valid_records': bulk_upload.successful_records,
                'invalid_records': bulk_upload.failed_records,
                'validation_results': validation_results,
                'status': 'success'
            })
            
        except Exception as e:
            logger.error(f"CSV validation error: {e}")
            return Response({
                'error': 'ファイルの処理に失敗しました',
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

class BulkUploadTemplateView(APIView):
    """CSVテンプレートダウンロード"""
    def get(self, request):
        template_data = {
            # キャンペーン設定
            'campaign_name': ['サンプルキャンペーン'],
            'objective': ['SALES'],
            'budget_type': ['DAILY'],
            'budget': [1000],
            'bid_strategy': ['LOWEST_COST'],
            'start_date': ['2024-01-01'],
            'end_date': ['2024-01-31'],
            'budget_optimization': [True],
            
            # セット設定
            'adset_name': ['サンプル広告セット'],
            'placement_type': ['auto'],
            'conversion_location': ['website'],
            'optimization_event': ['CONVERSION'],
            'age_min': [25],
            'age_max': [45],
            'gender': ['all'],
            'locations': ['JP'],
            'interests': ['テクノロジー'],
            'attribution_window': ['click_7d'],
            
            # 広告設定
            'ad_name': ['サンプル広告'],
            'headline': ['サンプルヘッドライン'],
            'description': ['サンプル説明文'],
            'website_url': ['https://example.com'],
            'cta': ['LEARN_MORE'],
            'image_url': ['https://example.com/image.jpg'],
            
            # 拡張設定
            'campaign_status': ['ACTIVE'],
            'targeting_preset': [''],
            'creative_template': [''],
            'notes': ['サンプルメモ'],
        }
        
        df = pd.DataFrame(template_data)
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="meta_ads_template.csv"'
        df.to_csv(response, index=False, encoding='utf-8-sig')
        return response

# バリデーション関数
def validate_campaign_data(campaign_data_list):
    """キャンペーンデータのバリデーション"""
    validation_results = []
    
    # 有効な値の定義
    valid_values = {
        'objective': ['SALES', 'TRAFFIC', 'ENGAGEMENT', 'APP_INSTALLS', 'VIDEO_VIEWS', 'LEAD_GENERATION', 'AWARENESS', 'CONSIDERATION'],
        'budget_type': ['DAILY', 'LIFETIME'],
        'bid_strategy': ['LOWEST_COST', 'HIGHEST_VALUE', 'COST_CAP'],
        'placement_type': ['auto', 'manual'],
        'conversion_location': ['website', 'app', 'offline'],
        'optimization_event': ['CONVERSION', 'PURCHASE', 'ADD_TO_CART', 'VIEW_CONTENT', 'LEAD'],
        'gender': ['all', 'male', 'female'],
        'attribution_window': ['click_1d', 'click_7d', 'click_14d', 'click_28d'],
        'cta': ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'DOWNLOAD', 'GET_QUOTE', 'CALL_NOW'],
        'campaign_status': ['ACTIVE', 'PAUSED']
    }
    
    for i, data in enumerate(campaign_data_list):
        errors = []
        
        # 必須項目チェック
        required_fields = [
            'campaign_name', 'objective', 'budget_type', 'budget', 
            'bid_strategy', 'start_date', 'adset_name', 'ad_name',
            'headline', 'description', 'website_url', 'image_url'
        ]
        
        for field in required_fields:
            value = data.get(field)
            if value is None or value == '' or (isinstance(value, str) and value.strip() == ''):
                errors.append(f'{field}は必須です')
        
        # 数値フィールドのチェック
        budget = data.get('budget')
        if budget is not None and budget != '':
            try:
                budget = float(budget)
                if budget <= 0:
                    errors.append('予算金額は0より大きい数値である必要があります')
            except (ValueError, TypeError):
                errors.append('予算金額は数値である必要があります')
        
        age_min = data.get('age_min')
        if age_min is not None and age_min != '':
            try:
                age_min = int(age_min)
                if age_min < 13:
                    errors.append('最小年齢は13以上である必要があります')
            except (ValueError, TypeError):
                errors.append('最小年齢は数値である必要があります')
        
        age_max = data.get('age_max')
        if age_max is not None and age_max != '':
            try:
                age_max = int(age_max)
                if age_max > 65:
                    errors.append('最大年齢は65以下である必要があります')
            except (ValueError, TypeError):
                errors.append('最大年齢は数値である必要があります')
        
        # 値の妥当性チェック
        for field, valid_list in valid_values.items():
            value = data.get(field)
            if value is not None and value != '' and str(value) not in valid_list:
                errors.append(f'{field}の値が無効です。有効な値: {", ".join(valid_list)}')
        
        # URL形式チェック
        url_pattern = r'^https?://.+'
        import re
        website_url = data.get('website_url')
        if website_url is not None and website_url != '' and not re.match(url_pattern, str(website_url)):
            errors.append('ウェブサイトURLは正しいURL形式である必要があります')
        
        image_url = data.get('image_url')
        if image_url is not None and image_url != '' and not re.match(url_pattern, str(image_url)):
            errors.append('画像URLは正しいURL形式である必要があります')
        
        validation_results.append({
            'row_index': i + 2,  # Excel行番号
            'is_valid': len(errors) == 0,
            'errors': errors,
            'data': data
        })
    
    return validation_results


@shared_task(bind=True)
def process_bulk_upload(self, bulk_upload_id):
    """一括入稿の非同期処理"""
    try:
        bulk_upload = BulkUpload.objects.get(id=bulk_upload_id)
        logger.info(f"Starting bulk upload processing for {bulk_upload_id}")
        
        # 有効なレコードのみを取得
        valid_records = bulk_upload.records.filter(status='SUCCESS')
        total_records = len(valid_records)
        
        if total_records == 0:
            bulk_upload.status = 'COMPLETED'
            bulk_upload.error_log = '有効なレコードがありません'
            bulk_upload.save()
            return {'status': 'completed', 'message': '有効なレコードがありません'}
        
        # Metaアカウントを取得
        if bulk_upload.selected_account_id:
            # 選択されたアカウントを使用
            meta_account = MetaAccount.objects.filter(
                id=bulk_upload.selected_account_id,
                user=bulk_upload.user,
                is_active=True
            ).first()
        else:
            # デフォルトで最初のアクティブなアカウントを使用
            meta_account = MetaAccount.objects.filter(
                user=bulk_upload.user, 
                is_active=True
            ).first()
        
        if not meta_account:
            # デモ用のMetaAccountを作成
            meta_account = MetaAccount.objects.create(
                user=bulk_upload.user,
                account_id=f"demo_{bulk_upload.user.id}",
                account_name="Demo Account",
                access_token="demo_token",
                is_active=True
            )
        
        successful_count = 0
        failed_count = 0
        
        # 各レコードを処理
        for i, record in enumerate(valid_records):
            try:
                # キャンペーンを作成
                campaign_data = record.data
                
                with transaction.atomic():
                    # キャンペーン作成
                    # 終了日の処理（通算予算の場合は必須）
                    from datetime import datetime, timedelta
                    end_date = campaign_data.get('end_date', '')
                    
                    # 不正な終了日値をチェック（TRUE, FALSE, 空文字など）
                    if end_date in ['TRUE', 'FALSE', 'true', 'false', '', None]:
                        end_date = ''
                    
                    # 通算予算で終了日が未設定の場合、開始日から30日後に設定
                    if not end_date and campaign_data.get('budget_type') == 'LIFETIME':
                        start_date_str = campaign_data.get('start_date', '')
                        if start_date_str:
                            try:
                                start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
                                end_date = (start_date + timedelta(days=30)).strftime('%Y-%m-%d')
                            except ValueError:
                                end_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
                        else:
                            end_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
                    
                    # 日次予算でも終了日が不正な場合は空にする
                    if campaign_data.get('budget_type') == 'DAILY' and end_date in ['TRUE', 'FALSE', 'true', 'false']:
                        end_date = ''
                    
                    # 日付フィールドの処理（空文字列の場合はNoneにする）
                    start_date = campaign_data.get('start_date', '')
                    if not start_date or start_date == '':
                        start_date = None
                    
                    if not end_date or end_date == '':
                        end_date = None
                    
                    campaign = Campaign.objects.create(
                        user=bulk_upload.user,
                        meta_account=meta_account,
                        campaign_id=str(uuid.uuid4()),
                        name=campaign_data.get('campaign_name', ''),
                        objective=campaign_data.get('objective', ''),
                        budget_type=campaign_data.get('budget_type', 'DAILY'),
                        budget=float(campaign_data.get('budget', 0)),
                        start_date=start_date,
                        end_date=end_date,
                        status=campaign_data.get('campaign_status', 'PAUSED')
                    )
                    
                    # AdSet作成
                    # ターゲティング設定を構築
                    # locationsを配列に変換（CSVからは文字列で取得される）
                    locations_str = campaign_data.get('locations', 'JP')
                    if isinstance(locations_str, str):
                        locations_list = [loc.strip() for loc in locations_str.split(',')]
                    else:
                        locations_list = locations_str if isinstance(locations_str, list) else ['JP']
                    
                    # interestsを配列に変換（CSVからは文字列で取得される）
                    interests_str = campaign_data.get('interests', '')
                    if isinstance(interests_str, str) and interests_str:
                        interests_list = [interest.strip() for interest in interests_str.split(',')]
                    else:
                        interests_list = interests_str if isinstance(interests_str, list) else []
                    
                    targeting = {
                        'geo_locations': {'countries': locations_list},
                        'age_min': int(campaign_data.get('age_min', 13)),
                        'age_max': int(campaign_data.get('age_max', 65)),
                        'genders': [1, 2] if campaign_data.get('gender', 'all') == 'all' else ([1] if campaign_data.get('gender') == 'male' else [2]),
                        'interests': interests_list,
                        'behaviors': [],
                        'custom_audiences': [],
                        'excluded_custom_audiences': [],
                        'lookalike_audiences': []
                    }
                    
                    # optimization_eventをMeta API対応の値にマッピング
                    mapped_optimization_goal = map_optimization_event_to_meta_api(
                        campaign_data.get('optimization_event', 'LINK_CLICKS')
                    )
                    
                    # bid_strategyをMeta API対応の値にマッピング
                    mapped_bid_strategy = map_bid_strategy_to_meta_api(
                        campaign_data.get('bid_strategy', 'LOWEST_COST_WITHOUT_CAP')
                    )
                    
                    adset = AdSet.objects.create(
                        campaign=campaign,
                        adset_id=str(uuid.uuid4()),
                        name=campaign_data.get('adset_name', ''),
                        bid_strategy=mapped_bid_strategy,
                        optimization_goal=mapped_optimization_goal,
                        placement_type=campaign_data.get('placement_type', 'AUTOMATIC'),
                        targeting=targeting,
                        start_time=start_date,
                        end_time=end_date
                    )
                    
                    # Ad作成
                    # クリエイティブ設定を構築
                    creative = {}
                    if campaign_data.get('image_url'):
                        creative['image_url'] = campaign_data.get('image_url')
                    
                    ad = Ad.objects.create(
                        adset=adset,
                        ad_id=str(uuid.uuid4()),
                        name=campaign_data.get('ad_name', ''),
                        headline=campaign_data.get('headline', ''),
                        description=campaign_data.get('description', ''),
                        link_url=campaign_data.get('website_url', ''),
                        cta_type=campaign_data.get('cta', 'LEARN_MORE'),
                        creative=creative,
                        facebook_page_id=campaign_data.get('facebook_page_id', '123456789012345'),  # CSVから読み取り、デフォルト値
                        status='PAUSED'
                    )
                    
                    # Meta APIに送信（非同期）
                    from apps.campaigns.tasks import submit_campaign_to_meta
                    submit_campaign_to_meta.delay(campaign.id)
                
                successful_count += 1
                logger.info(f"Campaign created successfully: {campaign.name}")
                
            except Exception as e:
                failed_count += 1
                error_msg = f"行{record.row_number}: {str(e)}"
                record.status = 'FAILED'
                record.error_message = error_msg
                record.save()
                logger.error(f"Failed to create campaign for row {record.row_number}: {e}")
            
            # 進捗を更新
            bulk_upload.processed_records = i + 1
            bulk_upload.successful_records = successful_count
            bulk_upload.failed_records = failed_count
            bulk_upload.save()
        
        # 処理完了
        bulk_upload.status = 'COMPLETED'
        bulk_upload.save()
        
        logger.info(f"Bulk upload {bulk_upload_id} completed: {successful_count} successful, {failed_count} failed")
        
        return {
            'status': 'completed',
            'successful': successful_count,
            'failed': failed_count,
            'total': total_records
        }
        
    except Exception as e:
        logger.error(f"Bulk upload processing failed: {e}")
        bulk_upload.status = 'FAILED'
        bulk_upload.error_log = f"処理エラー: {str(e)}"
        bulk_upload.save()
        
        return {
            'status': 'failed',
            'error': str(e)
        }