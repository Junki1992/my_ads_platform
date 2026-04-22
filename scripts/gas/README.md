# Google Apps Script: 日次 Meta レポート

`daily_meta_report.gs` をスプレッドシートに紐づく Apps Script プロジェクトにコピーして使います。

## スクリプトのプロパティ（本番向け）

エディタ左の **歯車 → プロジェクトの設定 → スクリプトのプロパティ** で追加します。**トークンはコードに書かないでください。**

| プロパティ | 必須 | 例 |
|-----------|------|-----|
| `META_AD_ACCOUNT_ID` | はい | `act_1234567890` |
| `META_ACCESS_TOKEN` | はい | Meta のアクセストークン |
| `META_BASE_URL` | いいえ | 省略時 `https://graph.facebook.com/` |
| `META_API_VERSION` | いいえ | 省略時 `v22.0` |

## 実行

1. 書き込み先の **スプレッドシート** を開く  
2. **拡張機能 → Apps Script** で `daily_meta_report.gs` の内容を貼る  
3. 上記プロパティを保存  
4. `fetchDailyReport` を選択して実行（初回は外部アクセスの承認）

## シート

- シート名 **`日次レポート`** が無ければ自動作成します。  
- 1 行目が空のときだけ **ヘッダー行** を書きます。  
- データは **最終行の次から追記** します（上書きではありません）。

## 高度な Google サービス

このスクリプトは **SpreadsheetApp / UrlFetchApp のみ**です。**Sheets API（`Sheets.`）は不要**です。  
あとから「テーブル」機能で `addTable` する場合だけ、Sheets サービスを追加してください。

## clasp を使う場合

この `scripts/gas/` をローカル編集し、`clasp push` で反映できます。  
**`.clasp.json` を Git に含め、トークンをコミットしない**ようにしてください。
