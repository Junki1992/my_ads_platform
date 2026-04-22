#!/bin/bash

# ==============================================================================
# バックエンド本番デプロイ（VM で git pull → docker build / up / migrate / nginx）
# 本番のソースは GitHub の main と一致させるのが最短・確実（差分転送は git が行う）。
# ローカルだけの未 push 変更を載せたい場合のみ: DEPLOY_LOCAL_TAR=1（HEAD との差分を tar で上書き）
# VM に手編集・未追跡があると pull が止まる。既定は強制同期: DEPLOY_SYNC_HARD=1（fetch + clean + reset）。
# 追跡外を残したいときは DEPLOY_SYNC_HARD=0（従来の pull のみ）。
# ==============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

DEPLOY_HOST="${DEPLOY_HOST:-meta_ads_platform1008@ads-web-prod}"
DEPLOY_ZONE="${DEPLOY_ZONE:-asia-northeast1-a}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/my_ads_platform}"
: "${DEPLOY_SYNC_HARD:=1}"
GCLOUD_SSH_FLAGS=(--ssh-flag=-oServerAliveInterval=30 --ssh-flag=-oServerAliveCountMax=120)

should_skip_backend_path() {
  local p="$1"
  [[ "$p" != backend/* ]] && return 0
  [[ "$p" == backend/venv/* ]] && return 0
  [[ "$p" == backend/.venv/* ]] && return 0
  [[ "$p" == *"__pycache__"* ]] && return 0
  [[ "$p" == backend/logs/* ]] && return 0
  [[ "$p" == backend/db.sqlite3 ]] && return 0
  [[ "$p" == backend/.pytest_cache/* ]] && return 0
  [[ "$p" == backend/htmlcov/* ]] && return 0
  [[ "$p" == backend/.mypy_cache/* ]] && return 0
  [[ "$p" == backend/media/* ]] && return 0
  [[ "$p" == backend/staticfiles/* ]] && return 0
  [[ "$p" == backend/.env ]] && return 0
  [[ "$p" == backend/.env.* ]] && return 0
  [[ "$p" == backend/.coverage ]] && return 0
  [[ "$p" == backend/coverage.xml ]] && return 0
  [[ "$p" == backend/.tox/* ]] && return 0
  [[ "$p" == backend/.nox/* ]] && return 0
  [[ "$p" == *egg-info* ]] && return 0
  [[ "$p" == backend/dist/* ]] && return 0
  [[ "$p" == backend/build/* ]] && return 0
  return 1
}

FULL_BACKEND_TAR_EXCLUDES=(
  --exclude='backend/venv'
  --exclude='backend/.venv'
  --exclude='backend/**/__pycache__'
  --exclude='backend/logs'
  --exclude='backend/db.sqlite3'
  --exclude='backend/.pytest_cache'
  --exclude='backend/htmlcov'
  --exclude='backend/.mypy_cache'
  --exclude='backend/media'
  --exclude='backend/staticfiles'
  --exclude='backend/.env'
  --exclude='backend/.env.*'
  --exclude='backend/.coverage'
  --exclude='backend/coverage.xml'
  --exclude='backend/.tox'
  --exclude='backend/.nox'
  --exclude='backend/*.egg-info'
  --exclude='backend/dist'
  --exclude='backend/build'
  --exclude='backend/tests'
)

echo "=========================================="
echo "バックエンド本番デプロイ"
echo "=========================================="
echo -e "${YELLOW}ホスト:${NC} $DEPLOY_HOST  ${YELLOW}ゾーン:${NC} $DEPLOY_ZONE  ${YELLOW}先:${NC} $DEPLOY_DIR/"
echo ""

if [ -n "${DEPLOY_LOCAL_TAR:-}" ]; then
  echo -e "${YELLOW}[1/7]${NC} ローカル HEAD 差分を tar で上書き（DEPLOY_LOCAL_TAR=1）..."
  tar_paths=()
  while IFS= read -r p || [ -n "$p" ]; do
    [ -z "$p" ] && continue
    should_skip_backend_path "$p" && continue
    if [ -f "$ROOT/$p" ] || [ -d "$ROOT/$p" ]; then
      tar_paths+=("$p")
    fi
  done < <({ git diff --name-only HEAD -- backend/; git ls-files --others --exclude-standard -- backend/; } | sort -u)
  if [ "${#tar_paths[@]}" -gt 0 ]; then
    echo -e "${GREEN}  → ${#tar_paths[@]} ファイル${NC}"
    (
      cd "$ROOT"
      COPYFILE_DISABLE=1 tar czf - "${tar_paths[@]}"
    ) | gcloud compute ssh "$DEPLOY_HOST" \
      --zone="$DEPLOY_ZONE" \
      "${GCLOUD_SSH_FLAGS[@]}" \
      --command="set -e; mkdir -p $DEPLOY_DIR; cd $DEPLOY_DIR && tar xzf -"
  else
    echo -e "${YELLOW}  → 差分なし（スキップ）${NC}"
  fi
elif [ -n "${FULL_BACKEND_TAR:-}" ]; then
  echo -e "${GREEN}[1/7]${NC} backend/ 全ツリー tar（FULL_BACKEND_TAR=1）..."
  (
    cd "$ROOT"
    COPYFILE_DISABLE=1 tar czf - "${FULL_BACKEND_TAR_EXCLUDES[@]}" backend
  ) | gcloud compute ssh "$DEPLOY_HOST" \
    --zone="$DEPLOY_ZONE" \
    "${GCLOUD_SSH_FLAGS[@]}" \
    --command="set -e; mkdir -p $DEPLOY_DIR; cd $DEPLOY_DIR && tar xzf -"
else
  # リポジトリが root 所有だと FETCH_HEAD が書けない。デプロイユーザーに揃えてから Git 同期。
  if [ "$DEPLOY_SYNC_HARD" = "1" ]; then
    echo -e "${YELLOW}[1/7]${NC} VM: 所有権調整 → origin/main 強制一致（未追跡の非 ignore ファイルは削除）..."
    gcloud compute ssh "$DEPLOY_HOST" \
      --zone="$DEPLOY_ZONE" \
      "${GCLOUD_SSH_FLAGS[@]}" \
      --command='set -e; sudo chown -R "$(id -un):$(id -gn)" '"$DEPLOY_DIR"' && cd '"$DEPLOY_DIR"' && GIT_TERMINAL_PROMPT=0 git -c safe.directory='"$DEPLOY_DIR"' fetch origin main && git clean -fd && git reset --hard origin/main && git log -1 --oneline'
  else
    echo -e "${YELLOW}[1/7]${NC} VM: 所有権調整 → git pull origin main（DEPLOY_SYNC_HARD=0）..."
    gcloud compute ssh "$DEPLOY_HOST" \
      --zone="$DEPLOY_ZONE" \
      "${GCLOUD_SSH_FLAGS[@]}" \
      --command='set -e; sudo chown -R "$(id -un):$(id -gn)" '"$DEPLOY_DIR"' && cd '"$DEPLOY_DIR"' && GIT_TERMINAL_PROMPT=0 git -c safe.directory='"$DEPLOY_DIR"' pull origin main && git log -1 --oneline'
  fi
fi

if git diff --name-only HEAD -- docker-compose.prod.yml 2>/dev/null | grep -q .; then
  echo -e "${GREEN}[2/7]${NC} 手元の docker-compose.prod.yml を転送（未コミット差分あり）"
  gcloud compute scp \
    "$ROOT/docker-compose.prod.yml" \
    "${DEPLOY_HOST}:${DEPLOY_DIR}/" \
    --zone="$DEPLOY_ZONE"
else
  echo -e "${YELLOW}[2/7]${NC} compose はリポジトリのまま（手元に未コミット差分なし）"
fi

echo -e "${YELLOW}[3/7]${NC} VM: Docker build（数分かかることがあります）..."
gcloud compute ssh "$DEPLOY_HOST" \
  --zone="$DEPLOY_ZONE" \
  "${GCLOUD_SSH_FLAGS[@]}" \
  --command="set -e; cd $DEPLOY_DIR && \
    export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 && \
    docker compose -f docker-compose.prod.yml build --progress=plain backend celery celery-beat"

echo -e "${GREEN}[4/7]${NC} VM: docker compose up..."
gcloud compute ssh "$DEPLOY_HOST" \
  --zone="$DEPLOY_ZONE" \
  "${GCLOUD_SSH_FLAGS[@]}" \
  --command="set -e; cd $DEPLOY_DIR && \
    docker compose -f docker-compose.prod.yml up -d --no-deps backend celery celery-beat"

echo -e "${GREEN}[5/7]${NC} VM: migrate..."
gcloud compute ssh "$DEPLOY_HOST" \
  --zone="$DEPLOY_ZONE" \
  "${GCLOUD_SSH_FLAGS[@]}" \
  --command="set -e; cd $DEPLOY_DIR && \
    docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --noinput"

echo -e "${GREEN}[6/7]${NC} VM: collectstatic..."
gcloud compute ssh "$DEPLOY_HOST" \
  --zone="$DEPLOY_ZONE" \
  "${GCLOUD_SSH_FLAGS[@]}" \
  --command="set -e; cd $DEPLOY_DIR && \
    docker compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput"

echo -e "${GREEN}[7/7]${NC} VM: nginx restart..."
gcloud compute ssh "$DEPLOY_HOST" \
  --zone="$DEPLOY_ZONE" \
  "${GCLOUD_SSH_FLAGS[@]}" \
  --command="set -e; cd $DEPLOY_DIR && \
    docker compose -f docker-compose.prod.yml restart nginx"

echo ""
echo "=========================================="
echo -e "${GREEN}✅ バックエンド反映完了（本番で確認可能）${NC}"
echo "=========================================="
echo -e "${YELLOW}フロントも更新する場合:${NC} ./deploy-frontend-only.sh"
echo ""
