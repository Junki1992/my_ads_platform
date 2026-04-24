# GCP 本番デプロイ（Cloud SQL + Compute Engine）

チーム運用を想定し、データベースは **Cloud SQL for PostgreSQL**、アプリは **Compute Engine 上の Docker Compose**（`docker-compose.gcp.yml`）を前提にした手順です。

## 手引き：最初からこの順で（思い出し用）

一度全体の流れを見てから、下の各節で細部を埋めていくと迷いにくいです。

### 0. ローカルで思い出す（任意）

コードの動きを手元で確認したいだけなら、リポジトリ直下で `cp env.example .env` → `README.md` の「セットアップ」に従い、Backend / Frontend を起動します。本番 GCP はこの次から。

### 1. Google Cloud 側で「土台」を作る

1. [Google Cloud Console](https://console.cloud.google.com/) にログインする。
2. **プロジェクト**を選ぶか新規作成する。
3. **請求**がプロジェクトに紐づいていることを確認する。
4. **API を有効化**する（例: Compute Engine API、Cloud SQL Admin API、Secret Manager API など、使うサービスに応じて）。

### 2. データベース（Cloud SQL）

1. **Cloud SQL** で **PostgreSQL** インスタンスを作成する（バージョンはアプリに合わせる。例: 15）。
2. **データベース名・ユーザー・パスワード**を決め、メモしておく（後で `.env` に書く）。
3. **自動バックアップ**を有効にする。
4. 接続方法を決める。
   - **プライベート IP**（推奨）: VM と同じ **VPC** でプライベート接続できるようにする。**VPC は、組織ポリシーなど特段の理由がなければプロジェクトの `default` VPC でよい。** Cloud SQL のネットワーク設定でも VM の作成時でも、同じく **`default` VPC** を選ぶ。
   - **パブリック IP**: 承認済みネットワークや SSL など、Cloud SQL の画面の指示に従う。その場合 Django 側では `DB_SSLMODE=require` を検討（`env.gcp.example` 参照）。

### 3. アプリ用 VM（Compute Engine）

1. **Compute Engine** で **VM インスタンス**を作成する（リージョンは Cloud SQL と揃えるのが無難）。**ネットワークは Cloud SQL と同じ VPC（通常は `default` VPC）を選ぶ。**
2. OS はチームで決めたもの（例: Ubuntu LTS）。**Docker** と **Docker Compose プラグイン**をインストールする。
3. **ファイアウォール**で、ユーザー向けは **TCP 80 と 443** を開ける（SSH は IAP や限定 IP などチーム方針で）。

### 4. VM の中でリポジトリと `.env`

1. VM に SSH して、リポジトリを置く（`git clone` など）。
2. プロジェクトルートで `cp env.gcp.example .env`。
3. `.env` を編集する。**ドメイン**（`ALLOWED_HOSTS` / `CORS_ALLOWED_ORIGINS` / `FRONTEND_URL`）、**Cloud SQL**（`DB_HOST` など）、**秘密鍵類**（`SECRET_KEY` / `JWT_SECRET_KEY` など）を本番用に埋める。
4. 秘密情報は **Secret Manager** に置き、`scripts/gcp/export-secrets-env.sh` で断片を出してマージしてもよい（スクリプト内の命名規則をチームで合わせる）。

### 5. フロントのビルドとコンテナ起動

1. `frontend` で `npm ci` → `npm run build`（`frontend/build` ができる）。
2. リポジトリルートで `docker compose -f docker-compose.gcp.yml --env-file .env build` → `up -d`。
3. **マイグレーション**と **collectstatic** を実行する（下の「初回・更新デプロイ」のコマンド）。

### 6. HTTPS とドメイン

- ドメインの **DNS** を VM の外部 IP かロードバランサに向ける。
- **Let’s Encrypt**（既存の Nginx 設定）や **HTTPS ロードバランサ** など、チームの方式で TLS を有効にする。

### 7. 更新するとき

- コードを `git pull`（またはデプロイパイプライン）したあと、同じ `docker compose -f docker-compose.gcp.yml` で **build → up**、必要なら **migrate**。問題があれば **前のコミットに戻して** 同様に build / up（ロールバックの詳細は下記）。

迷ったら **README の「本番を GCP」リンク**（このファイル）と **`env.gcp.example`** を開いたまま、上から順にチェックしていくと抜け漏れが減ります。

## Cloud SQL のコストを抑える（任意）

請求の SKU に **「Regional - vCPU / RAM」** と出ている場合は **高可用性（ゾーン跨ぎのスタンバイ）** が有効で、**クエリ量より「起動している時間とマシンサイズ」**が主因になりやすいです。

### 開発・検証だけの段階の目安（まずここ）

本番の可用性はまだ要らない前提で、**いまの請求を大きく下げる**なら次の組み合わせが多いです。

| 項目 | 推奨 |
|------|------|
| 高可用性 | **オフ**（**シングルゾーン / Zonal**。Regional のままだと vCPU・RAM が重い） |
| マシンタイプ | **負荷に耐える範囲で最小**（接続エラーや遅さが出たら一段上げる） |
| ストレージ | **必要な容量＋少し余裕**だけ（空き 50GB など取りすぎない） |
| バックアップ | **保持日数は短め**（失ってよい検証データならなおさら） |
| 夜間・休日 | 触らないなら **インスタンス停止**も検討（ストレージ課金は残る場合あり） |

**本番に切り替えるタイミング**で、高可用性やマシンサイズを見直せばよいです。

1. **高可用性が不要なら**（単一ゾーン障害で切れる開発・検証、または可用性を別手段で担保する本番）  
   - インスタンスの **「高可用性（リージョナル）」をオフ**にし、**シングルゾーン（Zonal）** にする。請求では SKU が **Zonal** 寄りに変わり、**vCPU/RAM が大きく下がる**ことが多いです。  
   - **本番でゾーン障害に備える必要がある**場合は Regional のままにし、代わりにマシンタイプやディスクで調整する判断になります。
2. **マシンタイプ**を、接続数・ピーク負荷を見ながら **一段小さく**する（vCPU・RAM の両方が下がる）。
3. **ストレージ**は必要容量に合わせる（標準ディスクの割り当てが大きいと常時課金が増える）。
4. **使わない期間が長い**なら、運用が許す範囲で **インスタンスの停止**を検討する（ストレージ課金は残ることがある。エディション・条件は [Cloud SQL のドキュメント](https://cloud.google.com/sql/docs/postgres/start-stop-restart-instance) を確認）。
5. **自動バックアップの保持日数**を必要最小限にする。

コンソールでは **Cloud SQL → 対象インスタンス → 編集** から上記の多くを変更できます。変更後は **請求レポートでサービス＝Cloud SQL、グループ化＝SKU** を再度確認すると効果が見えます。

### インスタンスを作り直すときの「リーズナブル」な初期例

**避ける**: `db-custom-8-32768`（8 vCPU / 32GB RAM）のように **大きいカスタム**から始める（課金が一気に跳ねる。操作時間と無関係に 24h 課金）。

| 項目 | 目安 |
|------|------|
| エディション | **Cloud SQL Enterprise**（**Enterprise Plus**は高スペック・高 SLA 向きで、まず安く始めるなら Enterprise）。 |
| エンジン | **PostgreSQL**（アプリに合わせる。例: 15） |
| リージョン | **Compute Engine（VM）と同じ**（例: `asia-northeast1`） |
| 高可用性 | **オフ**（Zonal。まず安く始める） |
| マシンタイプ | **共有コアの最小寄り**（例: `db-f1-micro` または `db-g1-small`）から。遅延・接続落ちが出たら **一段ずつ**上げる。必要になってから `db-custom-1-3840`（1 vCPU / 約 3.75GB）程度へ。 |
| ストレージ | **20〜50GB 前後**から。自動増量を使うなら上限に注意。 |
| バックアップ | 保持日数は**必要最小限**（検証は短く） |
| 接続 | **プライベート IP**（同一 VPC）推奨。パブリック IP なら **承認済みネットワークに VM のみ**＋Django は `DB_SSLMODE=require` を検討。 |

**作成後（VM 側）**

1. ルートの **`.env`**（本番）で `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_SSLMODE` を新インスタンスに合わせる。  
2. `docker compose -f docker-compose.gcp.yml`（または本番用 compose）で **backend / celery を再起動**。  
3. コンテナ内で **`python manage.py migrate --noinput`**。  
4. 空の DB なら **スーパーユーザ再作成**・Meta 連携のやり直しが必要。

## 構成の要点

| コンポーネント | 推奨 |
|----------------|------|
| PostgreSQL | Cloud SQL（プライベート IP 推奨） |
| Redis / Celery | 同一 VM 上のコンテナ（`docker-compose.gcp.yml`） |
| Django / Gunicorn / Nginx | 同一 VM 上のコンテナ |
| 秘密情報 | Secret Manager + デプロイ時に `.env` へ反映（または実行時注入） |

## 事前準備（GCP）

1. **プロジェクト**・請求の有効化。
2. **VPC とサブネット** — **特段の要件がなければ `default` VPC のままでよい。** Cloud SQL（プライベート IP）と VM は **どちらもこの `default` VPC** に載せ、リージョンは揃える（例: 両方とも `asia-northeast1`）。プライベート接続用に **Service Networking API** を有効にし、**プライベートサービス接続**（割り当て IP レンジ）を `default` VPC 上で設定する。
3. **Cloud SQL（PostgreSQL）**
   - バージョンは開発と揃える（例: 15）。
   - **自動バックアップ**とメンテナンスウィンドウを有効化。
   - GCE から接続する VM と **同じ VPC** にプライベート IP で配置するか、**Cloud SQL Auth Proxy** を利用。
4. **Compute Engine VM**
   - Docker と Docker Compose プラグインをインストール。
   - ファイアウォール: 外向きは **80/443 のみ**（管理用 SSH は IAP トンネルや限定 IP 推奨）。
5. **Secret Manager**
   - `SECRET_KEY`、`JWT_SECRET_KEY`、`DB_PASSWORD`、各種 API キーなどを格納。チームで **シークレット ID の命名規則**を決める（例: `ads-prod-SECRET_KEY`）。

## VM 上のリポジトリと環境変数

```bash
# リポジトリを配置（方法はチーム方針に合わせる）
cd /opt/my_ads_platform   # 例

cp env.gcp.example .env
# .env を編集するか、scripts/gcp/export-secrets-env.sh で Secret Manager から生成
```

必須の対応:

- `DEBUG=False`
- `ALLOWED_HOSTS` / `CORS_ALLOWED_ORIGINS` / `FRONTEND_URL` を本番ドメインに合わせる。
- `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` を Cloud SQL に合わせる。
- Cloud SQL を **パブリック IP** で接続する場合は `DB_SSLMODE=require` を検討。**プライベート IP のみ**の場合は空のままでよいことが多い。

## フロントエンドのビルド

Nginx はホストの `frontend/build` をマウントします。デプロイ前にビルドしてください。

```bash
cd frontend
npm ci
npm run build
```

## 初回・更新デプロイ

プロジェクトルートで:

```bash
# イメージ再ビルドと起動
docker compose -f docker-compose.gcp.yml --env-file .env build --no-cache
docker compose -f docker-compose.gcp.yml --env-file .env up -d

# マイグレーション（バックエンドコンテナ）
docker compose -f docker-compose.gcp.yml --env-file .env run --rm backend python manage.py migrate

# 静的ファイル
docker compose -f docker-compose.gcp.yml --env-file .env run --rm backend python manage.py collectstatic --noinput
```

SSL は既存の `nginx` 設定と Let’s Encrypt（`/etc/letsencrypt` のマウント）に依存します。ロードバランサで TLS を終端する場合は、Nginx の listen と `SECURE_PROXY_SSL_HEADER`（`config/settings.py` の本番ブロック）を合わせて調整してください。

## ロールバック

1. 前のリリースの **Git タグ / コミット** にチェックアウト。
2. `docker compose -f docker-compose.gcp.yml build` のあと `up -d`。
3. **DB マイグレーションを戻す場合**は `migrate` の逆操作が必要なときだけ `showmigrations` とドキュメントを確認して実行（データ破壊に注意）。

## チーム運用のチェックリスト

- [ ] 本番とステージングで **GCP プロジェクトまたは DB を分離**している。
- [ ] Secret Manager の **IAM** が最小権限になっている。
- [ ] **runbook**（障害時の連絡先、ロールバック手順、誰が VM に SSH できるか）が共有されている。
- [ ] **Cloud Logging**（および任意で Sentry）でエラーと 5xx を監視している。

## 関連ファイル

- `docker-compose.gcp.yml` — Cloud SQL 利用時の Compose（コンテナ内 Postgres なし）。
- `env.gcp.example` — 本番用環境変数のテンプレート。
- `scripts/gcp/export-secrets-env.sh` — Secret Manager から `.env` 断片を生成する補助スクリプト。
