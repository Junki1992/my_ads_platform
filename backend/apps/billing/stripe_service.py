"""
Stripe統合サービス
"""
import stripe
from django.conf import settings
from django.utils import timezone
from datetime import datetime
from .models import Subscription, Payment
import logging

logger = logging.getLogger(__name__)

# Stripeキーを設定
stripe.api_key = settings.STRIPE_SECRET_KEY if hasattr(settings, 'STRIPE_SECRET_KEY') else None


class StripeService:
    """Stripe統合サービスクラス"""
    
    # 価格設定（実際はStripe Dashboardで設定したPrice IDを使用）
    PRICE_IDS = {
        'pro_monthly': 'price_pro_monthly_id',  # 実際のPrice IDに置き換え
        'pro_yearly': 'price_pro_yearly_id',
        'enterprise_monthly': 'price_enterprise_monthly_id',
        'enterprise_yearly': 'price_enterprise_yearly_id',
    }
    
    @staticmethod
    def create_customer(user):
        """
        Stripeカスタマーを作成
        
        Args:
            user: Userオブジェクト
            
        Returns:
            Stripe Customerオブジェクト
        """
        try:
            customer = stripe.Customer.create(
                email=user.email,
                name=f"{user.first_name} {user.last_name}",
                metadata={
                    'user_id': user.id,
                    'username': user.username
                }
            )
            logger.info(f"Created Stripe customer: {customer.id} for user: {user.email}")
            return customer
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create Stripe customer: {str(e)}")
            raise
    
    @staticmethod
    def create_checkout_session(user, plan, billing_period='monthly', success_url=None, cancel_url=None):
        """
        Stripe Checkout Sessionを作成
        
        Args:
            user: Userオブジェクト
            plan: 'pro' or 'enterprise'
            billing_period: 'monthly' or 'yearly'
            success_url: 成功時のリダイレクトURL
            cancel_url: キャンセル時のリダイレクトURL
            
        Returns:
            Checkout Sessionオブジェクト
        """
        try:
            # カスタマーIDを取得または作成
            subscription = getattr(user, 'subscription', None)
            if subscription and subscription.stripe_customer_id:
                customer_id = subscription.stripe_customer_id
            else:
                customer = StripeService.create_customer(user)
                customer_id = customer.id
                
                # サブスクリプションにカスタマーIDを保存
                if not subscription:
                    subscription = Subscription.objects.create(user=user)
                subscription.stripe_customer_id = customer_id
                subscription.save()
            
            # Price IDを取得
            price_key = f"{plan}_{billing_period}"
            price_id = StripeService.PRICE_IDS.get(price_key)
            
            if not price_id:
                raise ValueError(f"Invalid plan or billing period: {price_key}")
            
            # デフォルトURL
            if not success_url:
                success_url = f"{settings.FRONTEND_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
            if not cancel_url:
                cancel_url = f"{settings.FRONTEND_URL}/billing/cancel"
            
            # Checkout Sessionを作成
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=['card'],
                line_items=[{
                    'price': price_id,
                    'quantity': 1,
                }],
                mode='subscription',
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={
                    'user_id': user.id,
                    'plan': plan,
                    'billing_period': billing_period
                }
            )
            
            logger.info(f"Created checkout session: {session.id} for user: {user.email}")
            return session
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create checkout session: {str(e)}")
            raise
    
    @staticmethod
    def cancel_subscription(user, cancel_at_period_end=True):
        """
        サブスクリプションをキャンセル
        
        Args:
            user: Userオブジェクト
            cancel_at_period_end: 期間終了時にキャンセル（True）か即時キャンセル（False）
            
        Returns:
            Stripe Subscriptionオブジェクト
        """
        try:
            subscription = user.subscription
            
            if not subscription.stripe_subscription_id:
                raise ValueError("No Stripe subscription found")
            
            if cancel_at_period_end:
                # 期間終了時にキャンセル
                stripe_sub = stripe.Subscription.modify(
                    subscription.stripe_subscription_id,
                    cancel_at_period_end=True
                )
                subscription.cancel_at_period_end = True
            else:
                # 即時キャンセル
                stripe_sub = stripe.Subscription.delete(
                    subscription.stripe_subscription_id
                )
                subscription.status = 'canceled'
            
            subscription.save()
            logger.info(f"Canceled subscription: {subscription.stripe_subscription_id}")
            return stripe_sub
        except stripe.error.StripeError as e:
            logger.error(f"Failed to cancel subscription: {str(e)}")
            raise
    
    @staticmethod
    def change_plan(user, new_plan):
        """
        プランを変更
        
        Args:
            user: Userオブジェクト
            new_plan: 新しいプラン ('free', 'pro', 'enterprise')
            
        Returns:
            Subscriptionオブジェクト
        """
        try:
            subscription = user.subscription
            
            # Freeプランへのダウングレード
            if new_plan == 'free':
                if subscription.stripe_subscription_id:
                    StripeService.cancel_subscription(user, cancel_at_period_end=True)
                subscription.plan = 'free'
                subscription.save()
                logger.info(f"Downgraded to free plan: {user.email}")
                return subscription
            
            # 有料プランへの変更
            if not subscription.stripe_subscription_id:
                raise ValueError("No active Stripe subscription")
            
            # 新しいPrice IDを取得
            price_key = f"{new_plan}_monthly"  # デフォルトは月額
            price_id = StripeService.PRICE_IDS.get(price_key)
            
            # Stripeでサブスクリプションを更新
            stripe_sub = stripe.Subscription.retrieve(subscription.stripe_subscription_id)
            stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                items=[{
                    'id': stripe_sub['items']['data'][0]['id'],
                    'price': price_id,
                }],
                proration_behavior='create_prorations',  # 日割り計算
            )
            
            subscription.plan = new_plan
            subscription.save()
            logger.info(f"Changed plan to {new_plan}: {user.email}")
            return subscription
        except stripe.error.StripeError as e:
            logger.error(f"Failed to change plan: {str(e)}")
            raise
    
    @staticmethod
    def handle_webhook_event(payload, signature):
        """
        Stripe Webhookイベントを処理
        
        Args:
            payload: Webhookペイロード
            signature: Stripe署名
            
        Returns:
            処理結果
        """
        try:
            # Webhook署名を検証
            event = stripe.Webhook.construct_event(
                payload,
                signature,
                settings.STRIPE_WEBHOOK_SECRET
            )
            
            logger.info(f"Received webhook event: {event['type']}")
            
            # イベントタイプごとに処理
            if event['type'] == 'checkout.session.completed':
                return StripeService._handle_checkout_completed(event['data']['object'])
            
            elif event['type'] == 'customer.subscription.created':
                return StripeService._handle_subscription_created(event['data']['object'])
            
            elif event['type'] == 'customer.subscription.updated':
                return StripeService._handle_subscription_updated(event['data']['object'])
            
            elif event['type'] == 'customer.subscription.deleted':
                return StripeService._handle_subscription_deleted(event['data']['object'])
            
            elif event['type'] == 'invoice.payment_succeeded':
                return StripeService._handle_payment_succeeded(event['data']['object'])
            
            elif event['type'] == 'invoice.payment_failed':
                return StripeService._handle_payment_failed(event['data']['object'])
            
            else:
                logger.info(f"Unhandled event type: {event['type']}")
                return {'status': 'ignored'}
        
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Webhook signature verification failed: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Webhook processing failed: {str(e)}")
            raise
    
    @staticmethod
    def _handle_checkout_completed(session):
        """Checkout完了時の処理"""
        customer_id = session['customer']
        subscription_id = session['subscription']
        
        # Subscriptionを更新
        subscription = Subscription.objects.get(stripe_customer_id=customer_id)
        subscription.stripe_subscription_id = subscription_id
        subscription.status = 'active'
        subscription.save()
        
        logger.info(f"Checkout completed: {subscription_id}")
        return {'status': 'success'}
    
    @staticmethod
    def _handle_subscription_created(stripe_subscription):
        """サブスクリプション作成時の処理"""
        customer_id = stripe_subscription['customer']
        subscription_id = stripe_subscription['id']
        
        subscription = Subscription.objects.get(stripe_customer_id=customer_id)
        subscription.stripe_subscription_id = subscription_id
        subscription.status = stripe_subscription['status']
        subscription.current_period_start = datetime.fromtimestamp(
            stripe_subscription['current_period_start'],
            tz=timezone.utc
        )
        subscription.current_period_end = datetime.fromtimestamp(
            stripe_subscription['current_period_end'],
            tz=timezone.utc
        )
        subscription.save()
        
        logger.info(f"Subscription created: {subscription_id}")
        return {'status': 'success'}
    
    @staticmethod
    def _handle_subscription_updated(stripe_subscription):
        """サブスクリプション更新時の処理"""
        subscription_id = stripe_subscription['id']
        
        subscription = Subscription.objects.get(stripe_subscription_id=subscription_id)
        subscription.status = stripe_subscription['status']
        subscription.cancel_at_period_end = stripe_subscription.get('cancel_at_period_end', False)
        subscription.current_period_end = datetime.fromtimestamp(
            stripe_subscription['current_period_end'],
            tz=timezone.utc
        )
        subscription.save()
        
        logger.info(f"Subscription updated: {subscription_id}")
        return {'status': 'success'}
    
    @staticmethod
    def _handle_subscription_deleted(stripe_subscription):
        """サブスクリプション削除時の処理"""
        subscription_id = stripe_subscription['id']
        
        subscription = Subscription.objects.get(stripe_subscription_id=subscription_id)
        subscription.status = 'canceled'
        subscription.plan = 'free'
        subscription.save()
        
        logger.info(f"Subscription deleted: {subscription_id}")
        return {'status': 'success'}
    
    @staticmethod
    def _handle_payment_succeeded(invoice):
        """支払い成功時の処理"""
        customer_id = invoice['customer']
        amount = invoice['amount_paid'] / 100  # セントから円に変換
        
        subscription = Subscription.objects.get(stripe_customer_id=customer_id)
        
        # 支払い履歴を作成
        Payment.objects.create(
            user=subscription.user,
            subscription=subscription,
            stripe_payment_intent_id=invoice['payment_intent'],
            amount=amount,
            currency='jpy',
            status='succeeded',
            description=f"Subscription payment for {subscription.plan}"
        )
        
        logger.info(f"Payment succeeded: {invoice['id']}")
        return {'status': 'success'}
    
    @staticmethod
    def _handle_payment_failed(invoice):
        """支払い失敗時の処理"""
        customer_id = invoice['customer']
        
        subscription = Subscription.objects.get(stripe_customer_id=customer_id)
        subscription.status = 'past_due'
        subscription.save()
        
        logger.warning(f"Payment failed for subscription: {subscription.stripe_subscription_id}")
        return {'status': 'failed'}

