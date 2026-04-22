/**
 * Meta Marketing API → スプレッドシート「日次レポート」
 *
 * 【スクリプトのプロパティ】プロジェクトの設定 → スクリプトのプロパティ で登録
 *   META_BASE_URL        （省略可）既定: https://graph.facebook.com/
 *   META_API_VERSION     （省略可）既定: v22.0
 *   META_AD_ACCOUNT_ID   必須 例: act_1234567890
 *   META_ACCESS_TOKEN    必須（コードに直書きしない）
 *
 * clasp でプッシュする場合も、トークンはプロパティ側のみに置くこと。
 */

function getMetaConfig_() {
  var p = PropertiesService.getScriptProperties();
  var base = p.getProperty('META_BASE_URL') || 'https://graph.facebook.com/';
  if (base.slice(-1) !== '/') base += '/';
  var ver = p.getProperty('META_API_VERSION') || 'v22.0';
  if (ver.slice(-1) !== '/') ver += '/';
  var accountId = p.getProperty('META_AD_ACCOUNT_ID');
  var token = p.getProperty('META_ACCESS_TOKEN');
  if (!accountId || !token) {
    throw new Error('スクリプトプロパティに META_AD_ACCOUNT_ID と META_ACCESS_TOKEN を設定してください。');
  }
  return {
    BASE_URL: base,
    API_VERSION: ver,
    AD_ACCOUNT_ID: accountId,
    ACCESS_TOKEN: token
  };
}

function getOrCreateDailySheet_(ss) {
  var name = '日次レポート';
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function buildRow_(dateStr, row) {
  var conversions = 0;
  var cpa = 0;
  if (row.actions) {
    for (var j = 0; j < row.actions.length; j++) {
      if (row.actions[j].action_type === 'offsite_conversion.fb_pixel_purchase') {
        conversions = Number(row.actions[j].value) || 0;
        break;
      }
    }
  }
  if (row.cost_per_action_type) {
    for (var j = 0; j < row.cost_per_action_type.length; j++) {
      if (row.cost_per_action_type[j].action_type === 'offsite_conversion.fb_pixel_purchase') {
        cpa = Number(row.cost_per_action_type[j].value) || 0;
        break;
      }
    }
  }
  return [
    dateStr,
    row.campaign_name || '',
    row.adset_name || '',
    row.ad_name || '',
    Number(row.impressions) || 0,
    Number(row.clicks) || 0,
    Number(row.ctr) || 0,
    Number(row.cpc) || 0,
    Number(row.spend) || 0,
    conversions,
    cpa
  ];
}

// ====================
// 日次レポート自動取得
// ====================
function fetchDailyReport() {
  var CONFIG = getMetaConfig_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateDailySheet_(ss);

  var yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  var dateStr = Utilities.formatDate(yesterday, 'Asia/Tokyo', 'yyyy-MM-dd');

  var timeRange = encodeURIComponent(JSON.stringify({ since: dateStr, until: dateStr }));
  var fields =
    'campaign_name,adset_name,ad_name,impressions,clicks,ctr,cpc,spend,actions,cost_per_action_type';
  var base =
    CONFIG.BASE_URL + CONFIG.API_VERSION + CONFIG.AD_ACCOUNT_ID + '/insights';
  var url =
    base +
    '?fields=' +
    encodeURIComponent(fields) +
    '&level=ad' +
    '&time_range=' +
    timeRange +
    '&limit=500' +
    '&access_token=' +
    encodeURIComponent(CONFIG.ACCESS_TOKEN);

  var allRows = [];
  while (url) {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = response.getResponseCode();
    var text = response.getContentText();
    if (code !== 200) {
      throw new Error('Meta API error ' + code + ': ' + text.substring(0, 500));
    }
    var json = JSON.parse(text);
    var data = json.data || [];
    for (var i = 0; i < data.length; i++) {
      allRows.push(buildRow_(dateStr, data[i]));
    }
    url = json.paging && json.paging.next ? json.paging.next : null;
  }

  var header = [
    '日付',
    'キャンペーン',
    '広告セット',
    '広告名',
    'インプレッション',
    'クリック',
    'CTR',
    'CPC',
    '費用',
    'CV',
    'CPA'
  ];

  var startRow = sheet.getLastRow() + 1;
  if (startRow === 1) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    startRow = 2;
  }
  if (allRows.length > 0) {
    sheet
      .getRange(startRow, 1, startRow + allRows.length - 1, header.length)
      .setValues(allRows);
  }

  Logger.log('✅ ' + dateStr + ' 完了（' + allRows.length + ' 行）');
}
