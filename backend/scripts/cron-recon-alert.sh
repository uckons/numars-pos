#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SQL_FILE="$ROOT_DIR/docs/execution-pack/sprint-2/sql-reconciliation-harian.sql"
PARSER="$ROOT_DIR/backend/scripts/recon-output-parser.js"
LOG_DIR="${ROOT_DIR}/backend/logs/reconciliation"
mkdir -p "$LOG_DIR"

RECON_DATE="${RECON_DATE:-$(date +%F)}"
BRANCH_ID="${BRANCH_ID:-}"
DATABASE_URL="${DATABASE_URL:-}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "[recon-cron] ERROR: DATABASE_URL is required"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
RAW_OUT="$LOG_DIR/recon-${RECON_DATE}-branch-${BRANCH_ID:-ALL}-${STAMP}.log"
JSON_OUT="$LOG_DIR/recon-${RECON_DATE}-branch-${BRANCH_ID:-ALL}-${STAMP}.json"

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
  if [[ -n "$ALERT_WEBHOOK_URL" ]]; then
    curl -sS -X POST "$ALERT_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"[ALERT] Recon SQL gagal. date=$RECON_DATE branch=${BRANCH_ID:-ALL}. cek log: $RAW_OUT\"}" >/dev/null || true
  fi
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
  if [[ -n "$ALERT_WEBHOOK_URL" ]]; then
    curl -sS -X POST "$ALERT_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"[ALERT] Recon mismatch date=$RECON_DATE branch=${BRANCH_ID:-ALL} summary=$SUMMARY_JSON log=$RAW_OUT\"}" >/dev/null || true
  fi
  exit 2
fi

if [[ $PARSER_EXIT -ne 0 ]]; then
  echo "[recon-cron] ERROR: parser failed. See $RAW_OUT / $JSON_OUT"
  exit $PARSER_EXIT
fi

echo "[recon-cron] OK: no mismatch"
exit 0
