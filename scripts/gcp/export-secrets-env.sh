#!/usr/bin/env bash
# Secret Manager に保存した値を KEY=value 形式で標準出力する。
# チームでシークレット ID のプレフィックスを揃える（例: ads-prod-SECRET_KEY）。
#
# 使い方:
#   export GCP_PROJECT_ID=my-project
#   ./scripts/gcp/export-secrets-env.sh >> .env.append
#   # 内容を確認してから .env にマージ
#
# 前提: gcloud がログイン済みで、secrets へのアクセス権があること。

set -euo pipefail

PREFIX="${SECRET_PREFIX:-ads-prod}"
PROJECT="${GCP_PROJECT_ID:-}"

if [[ -z "$PROJECT" ]]; then
  echo "GCP_PROJECT_ID を設定してください。" >&2
  exit 1
fi

# 取得する論理名（Secret Manager 上の ID は ${PREFIX}_${NAME} を想定）
KEYS=(
  SECRET_KEY
  JWT_SECRET_KEY
  DB_PASSWORD
  META_APP_SECRET
  BOX_CLIENT_SECRET
)

for NAME in "${KEYS[@]}"; do
  SECRET_ID="${PREFIX}_${NAME}"
  if gcloud secrets describe "$SECRET_ID" --project="$PROJECT" &>/dev/null; then
    VAL="$(gcloud secrets versions access latest --secret="$SECRET_ID" --project="$PROJECT")"
    # 値に改行が含まれる場合は失敗させる（.env 1 行 1 変数のため）
    if [[ "$VAL" == *$'\n'* ]]; then
      echo "シークレット ${SECRET_ID} に改行が含まれています。手動で設定してください。" >&2
      exit 1
    fi
    printf '%s=%s\n' "$NAME" "$VAL"
  fi
done
