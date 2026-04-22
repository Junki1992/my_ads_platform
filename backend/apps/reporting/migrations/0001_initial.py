# Generated manually for DailyAdInsight

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0007_boxaccount'),
    ]

    operations = [
        migrations.CreateModel(
            name='DailyAdInsight',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('stat_date', models.DateField(db_index=True, verbose_name='stat date')),
                ('meta_ad_id', models.CharField(db_index=True, max_length=64, verbose_name='Meta ad id')),
                ('campaign_name', models.CharField(blank=True, max_length=512, verbose_name='campaign name')),
                ('adset_name', models.CharField(blank=True, max_length=512, verbose_name='adset name')),
                ('ad_name', models.CharField(blank=True, max_length=512, verbose_name='ad name')),
                ('impressions', models.BigIntegerField(default=0)),
                ('clicks', models.BigIntegerField(default=0)),
                ('ctr', models.FloatField(default=0.0)),
                ('cpc', models.DecimalField(decimal_places=4, default=0, max_digits=14)),
                ('spend', models.DecimalField(decimal_places=2, default=0, max_digits=16)),
                ('conversions', models.FloatField(default=0, help_text='offsite_conversion.fb_pixel_purchase', verbose_name='conversions (purchase)')),
                ('cpa', models.DecimalField(blank=True, decimal_places=4, max_digits=16, null=True, verbose_name='CPA (purchase)')),
                ('fetched_at', models.DateTimeField(auto_now_add=True)),
                ('meta_account', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='daily_ad_insights', to='accounts.metaaccount')),
            ],
            options={
                'verbose_name': 'Daily ad insight',
                'verbose_name_plural': 'Daily ad insights',
            },
        ),
        migrations.AddIndex(
            model_name='dailyadinsight',
            index=models.Index(fields=['meta_account', 'stat_date'], name='reporting_d_meta_acct_date'),
        ),
        migrations.AddConstraint(
            model_name='dailyadinsight',
            constraint=models.UniqueConstraint(fields=('meta_account', 'stat_date', 'meta_ad_id'), name='uniq_daily_ad_insight_account_date_ad'),
        ),
    ]
