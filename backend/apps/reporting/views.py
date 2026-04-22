from datetime import datetime

from django.db.models import Sum
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import DailyAdInsight
from .serializers import DailyAdInsightSerializer


class DailyAdInsightListView(generics.ListAPIView):
    """
    日次保存済みの広告単位インサイト一覧（ログインユーザーが紐づける Meta アカウントのみ）。
    クエリ: start_date, end_date (YYYY-MM-DD), meta_account (内部 ID)
    """

    permission_classes = [IsAuthenticated]
    serializer_class = DailyAdInsightSerializer

    def get_queryset(self):
        qs = DailyAdInsight.objects.filter(
            meta_account__user=self.request.user,
            meta_account__is_active=True,
        ).select_related('meta_account')

        start_s = self.request.query_params.get('start_date')
        end_s = self.request.query_params.get('end_date')
        if start_s:
            try:
                start_d = datetime.strptime(start_s, '%Y-%m-%d').date()
                qs = qs.filter(stat_date__gte=start_d)
            except ValueError:
                pass
        if end_s:
            try:
                end_d = datetime.strptime(end_s, '%Y-%m-%d').date()
                qs = qs.filter(stat_date__lte=end_d)
            except ValueError:
                pass

        ma = self.request.query_params.get('meta_account')
        if ma:
            qs = qs.filter(meta_account_id=ma)

        return qs.order_by('-stat_date', 'campaign_name', 'meta_ad_id')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        summary = queryset.aggregate(
            total_spend=Sum('spend'),
            total_impressions=Sum('impressions'),
            total_clicks=Sum('clicks'),
            total_conversions=Sum('conversions'),
        )
        summary_payload = {
            'total_spend': float(summary['total_spend'] or 0),
            'total_impressions': int(summary['total_impressions'] or 0),
            'total_clicks': int(summary['total_clicks'] or 0),
            'total_conversions': float(summary['total_conversions'] or 0),
        }
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            resp = self.get_paginated_response(serializer.data)
            resp.data['summary'] = summary_payload
            return resp
        serializer = self.get_serializer(queryset, many=True)
        return Response({'summary': summary_payload, 'results': serializer.data})
