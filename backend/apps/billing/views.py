from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse
from django.utils.decorators import method_decorator
import logging
import json

from .models import Subscription, Payment, UsageMetrics, PlanLimit
from .serializers import (
    SubscriptionSerializer,
    PaymentSerializer,
    UsageMetricsSerializer,
    PlanLimitSerializer,
    CheckoutSessionSerializer,
    CancelSubscriptionSerializer,
    ChangePlanSerializer
)
from .stripe_service import StripeService

logger = logging.getLogger(__name__)


class SubscriptionViewSet(viewsets.ReadOnlyModelViewSet):
    """サブスクリプション管理ViewSet"""
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """自分のサブスクリプションのみ取得"""
        return Subscription.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """現在のサブスクリプション情報を取得"""
        subscription, created = Subscription.objects.get_or_create(
            user=request.user,
            defaults={'plan': 'free', 'status': 'active'}
        )
        serializer = self.get_serializer(subscription)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def create_checkout_session(self, request):
        """Stripe Checkout Sessionを作成"""
        serializer = CheckoutSessionSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                session = StripeService.create_checkout_session(
                    user=request.user,
                    plan=serializer.validated_data['plan'],
                    billing_period=serializer.validated_data.get('billing_period', 'monthly'),
                    success_url=serializer.validated_data.get('success_url'),
                    cancel_url=serializer.validated_data.get('cancel_url')
                )
                
                return Response({
                    'session_id': session.id,
                    'session_url': session.url
                }, status=status.HTTP_200_OK)
            
            except Exception as e:
                logger.error(f"Failed to create checkout session: {str(e)}")
                return Response({
                    'error': 'Failed to create checkout session',
                    'detail': str(e)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def cancel(self, request):
        """サブスクリプションをキャンセル"""
        serializer = CancelSubscriptionSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                subscription = StripeService.cancel_subscription(
                    user=request.user,
                    cancel_at_period_end=serializer.validated_data.get('cancel_at_period_end', True)
                )
                
                logger.info(f"Subscription canceled by user: {request.user.email}")
                
                return Response({
                    'message': 'Subscription canceled successfully',
                    'cancel_at_period_end': serializer.validated_data.get('cancel_at_period_end', True)
                }, status=status.HTTP_200_OK)
            
            except Exception as e:
                logger.error(f"Failed to cancel subscription: {str(e)}")
                return Response({
                    'error': 'Failed to cancel subscription',
                    'detail': str(e)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def change_plan(self, request):
        """プランを変更"""
        serializer = ChangePlanSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                new_plan = serializer.validated_data['new_plan']
                subscription = StripeService.change_plan(request.user, new_plan)
                
                logger.info(f"Plan changed to {new_plan} for user: {request.user.email}")
                
                return Response({
                    'message': f'Plan changed to {new_plan} successfully',
                    'subscription': SubscriptionSerializer(subscription).data
                }, status=status.HTTP_200_OK)
            
            except Exception as e:
                logger.error(f"Failed to change plan: {str(e)}")
                return Response({
                    'error': 'Failed to change plan',
                    'detail': str(e)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def reactivate(self, request):
        """キャンセル予定のサブスクリプションを再開"""
        try:
            subscription = request.user.subscription
            
            if not subscription.cancel_at_period_end:
                return Response({
                    'error': 'Subscription is not scheduled for cancellation'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            import stripe
            stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                cancel_at_period_end=False
            )
            
            subscription.cancel_at_period_end = False
            subscription.save()
            
            logger.info(f"Subscription reactivated for user: {request.user.email}")
            
            return Response({
                'message': 'Subscription reactivated successfully'
            }, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Failed to reactivate subscription: {str(e)}")
            return Response({
                'error': 'Failed to reactivate subscription',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """支払い履歴ViewSet"""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """自分の支払い履歴のみ取得"""
        return Payment.objects.filter(user=self.request.user)


class UsageMetricsViewSet(viewsets.ReadOnlyModelViewSet):
    """使用量メトリクスViewSet"""
    serializer_class = UsageMetricsSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """自分の使用量メトリクスのみ取得"""
        return UsageMetrics.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def current_month(self, request):
        """今月の使用量を取得"""
        from datetime import date
        from django.db.models import Sum
        
        today = date.today()
        first_day = date(today.year, today.month, 1)
        
        metrics = UsageMetrics.objects.filter(
            user=request.user,
            date__gte=first_day
        ).aggregate(
            total_campaigns=Sum('campaign_count'),
            total_api_calls=Sum('api_calls'),
            total_ad_spend=Sum('ad_spend')
        )
        
        return Response(metrics)


class PlanLimitViewSet(viewsets.ReadOnlyModelViewSet):
    """プラン制限ViewSet"""
    serializer_class = PlanLimitSerializer
    permission_classes = [permissions.AllowAny]
    queryset = PlanLimit.objects.all()
    
    @action(detail=False, methods=['get'])
    def by_plan(self, request):
        """プラン別の制限を取得"""
        plan = request.query_params.get('plan', 'free')
        
        try:
            plan_limit = PlanLimit.objects.get(plan=plan)
            serializer = self.get_serializer(plan_limit)
            return Response(serializer.data)
        except PlanLimit.DoesNotExist:
            return Response({
                'error': f'Plan limit not found for plan: {plan}'
            }, status=status.HTTP_404_NOT_FOUND)


@csrf_exempt
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def stripe_webhook(request):
    """
    Stripe Webhookエンドポイント
    """
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    try:
        result = StripeService.handle_webhook_event(payload, sig_header)
        return HttpResponse(json.dumps(result), status=200)
    
    except ValueError as e:
        logger.error(f"Invalid webhook payload: {str(e)}")
        return HttpResponse(status=400)
    
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return HttpResponse(status=500)
