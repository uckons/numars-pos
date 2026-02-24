#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SQL_FILE="$ROOT_DIR/docs/execution-pack/sprint-2/sql-reconciliation-harian.sql"
PARSER="$ROOT_DIR/backend/scripts/recon-output-parser.js"
LOG_DIR="${ROOT_DIR}/backend/logs/reconciliation"
mkdir -p "$LOG_DIR"

load_env_file_if_unset() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0

  while IFS='=' read -r raw_key raw_val; do
    local key="$(printf '%s' "${raw_key:-}" | sed 's/^\s*//; s/\s*$//')"
    [[ -z "$key" ]] && continue
    [[ "$key" =~ ^# ]] && continue
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    if [[ -n "${!key+x}" ]]; then
      continue
    fi

    local val="${raw_val-}"
    val="${val%$'\r'}"
    val="$(printf '%s' "$val" | sed 's/^\s*//; s/\s*$//')"
    val="${val#\"}"
    val="${val%\"}"
    val="${val#\'}"
    val="${val%\'}"

    export "$key=$val"
  done < "$env_file"
}

# Load env defaults from file without overriding already-exported variables.
load_env_file_if_unset "$ROOT_DIR/backend/.env"
load_env_file_if_unset "$ROOT_DIR/.env"

RECON_DATE="${RECON_DATE:-$(date +%F)}"
BRANCH_ID="${BRANCH_ID:-${RECON_BRANCH_ID:-}}"
DATABASE_URL="${DATABASE_URL:-}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
RETENTION_DAYS="${RETENTION_DAYS:-${RECON_RETENTION_DAYS:-14}}"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

send_alert() {
  local msg="$1"
  if [[ -z "$ALERT_WEBHOOK_URL" ]]; then
    return 0
  fi

  local key="text"
  if [[ "$ALERT_WEBHOOK_URL" == *"discord.com/api/webhooks"* ]] || [[ "$ALERT_WEBHOOK_URL" == *"discordapp.com/api/webhooks"* ]]; then
    key="content"
  fi

  local escaped
  escaped="$(json_escape "$msg")"
  curl -sS -X POST "$ALERT_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"${key}\":\"${escaped}\"}" >/dev/null || true
}

if [[ -z "$DATABASE_URL" ]]; then
  echo "[recon-cron] ERROR: DATABASE_URL is required"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
RAW_OUT="$LOG_DIR/recon-${RECON_DATE}-branch-${BRANCH_ID:-ALL}-${STAMP}.log"
JSON_OUT="$LOG_DIR/recon-${RECON_DATE}-branch-${BRANCH_ID:-ALL}-${STAMP}.json"

# simple log rotation
find "$LOG_DIR" -type f -name "recon-*" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
find "$LOG_DIR" -type f -name "cron.log*" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

set +e
psql "$DATABASE_URL" \
  -v recon_date="$RECON_DATE" \
  -v branch_id="$BRANCH_ID" \
  -f "$SQL_FILE" \
  > "$RAW_OUT" 2>&1
PSQL_EXIT=$?
set -e

if [[ $PSQL_EXIT -ne 0 ]]; then
  echo "[recon-cron] ERROR: psql failed. See $RAW_OUT"
  send_alert "[ALERT] Recon SQL gagal. date=$RECON_DATE branch=${BRANCH_ID:-ALL}. cek log: $RAW_OUT"
  exit $PSQL_EXIT
fi

set +e
RECON_DATE="$RECON_DATE" BRANCH_ID="$BRANCH_ID" node "$PARSER" "$RAW_OUT" > "$JSON_OUT"
PARSER_EXIT=$?
set -e

SUMMARY_JSON="$(cat "$JSON_OUT")"
echo "[recon-cron] summary: $SUMMARY_JSON"

if [[ $PARSER_EXIT -eq 2 ]]; then
  echo "[recon-cron] ALERT: mismatch detected"
  send_alert "[ALERT] Recon mismatch date=$RECON_DATE branch=${BRANCH_ID:-ALL} summary=$SUMMARY_JSON log=$RAW_OUT"
  exit 2
fi

if [[ $PARSER_EXIT -ne 0 ]]; then
  echo "[recon-cron] ERROR: parser failed. See $RAW_OUT / $JSON_OUT"
  exit $PARSER_EXIT
fi

echo "[recon-cron] OK: no mismatch"
exit 0
