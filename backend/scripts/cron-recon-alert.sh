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
    [[ -n "${!key+x}" ]] && continue

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

json_escape() {
  # robust JSON escaping (quotes, backslashes, newlines, tabs, etc)
  node -e 'const s=process.argv[1] ?? ""; process.stdout.write(JSON.stringify(s).slice(1,-1))' "$1"
}

parse_bool() {
  local raw="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  case "$raw" in
    1|true|yes|y|on) return 0 ;;
    *) return 1 ;;
  esac
}

send_alert() {
  local msg="$1"
  [[ -z "$ALERT_WEBHOOK_URL" ]] && return 0

  local key="text"
  if [[ "$ALERT_WEBHOOK_URL" == *"discord.com/api/webhooks"* ]] || [[ "$ALERT_WEBHOOK_URL" == *"discordapp.com/api/webhooks"* ]]; then
    key="content"
  fi

  local escaped
  escaped="$(json_escape "$msg")"

  local http_code
  http_code="$(curl -sS -o /tmp/recon_webhook_resp.$$ -w "%{http_code}" -X POST "$ALERT_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"${key}\":\"${escaped}\"}" || true)"

  if [[ "$http_code" != "200" && "$http_code" != "204" ]]; then
    echo "[recon-cron] WARN: webhook send failed (http=${http_code:-NA})"
    [[ -f /tmp/recon_webhook_resp.$$ ]] && sed -n '1,3p' /tmp/recon_webhook_resp.$$ || true
    rm -f /tmp/recon_webhook_resp.$$ || true
    return 1
  fi

  rm -f /tmp/recon_webhook_resp.$$ || true
  echo "[recon-cron] webhook delivered (http=$http_code)"
  return 0
}

resolve_branch_label() {
  if [[ -z "$BRANCH_ID" ]]; then
    echo "ALL"
    return
  fi

  if ! [[ "$BRANCH_ID" =~ ^[0-9]+$ ]]; then
    echo "$BRANCH_ID"
    return
  fi

  local branch_name
  branch_name="$(psql "$DATABASE_URL" -Atqc "SELECT name FROM branches WHERE id=${BRANCH_ID} LIMIT 1" 2>/dev/null || true)"
  branch_name="$(printf '%s' "$branch_name" | head -n1 | sed 's/^\s*//; s/\s*$//')"

  if [[ -n "$branch_name" ]]; then
    echo "${branch_name} (#${BRANCH_ID})"
  else
    echo "#${BRANCH_ID}"
  fi
}

format_summary_text() {
  local summary_json="$1"
  BRANCH_LABEL="$BRANCH_LABEL" RECON_DATE="$RECON_DATE" SUMMARY_JSON="$summary_json" node - <<'NODE'
const s = JSON.parse(process.env.SUMMARY_JSON || '{}')
const counts = s.counts || {}
const lines = [
  '📒 Recon POS vs Journal',
  `Tanggal: ${process.env.RECON_DATE || '-'}`,
  `Branch: ${process.env.BRANCH_LABEL || '-'}`,
  `Status: ${s.status || 'UNKNOWN'} (mismatch=${s.mismatch_total ?? '-'})`,
  `- OK: ${counts.OK ?? 0}`,
  `- MISSING_JOURNAL: ${counts.MISSING_JOURNAL ?? 0}`,
  `- UNBALANCED_JOURNAL: ${counts.UNBALANCED_JOURNAL ?? 0}`,
  `- AMOUNT_MISMATCH: ${counts.AMOUNT_MISMATCH ?? 0}`,
  `- ZERO_TOTAL_WITH_ITEMS: ${counts.ZERO_TOTAL_WITH_ITEMS ?? 0}`,
  `- NO_JOURNAL_EXPECTED_ZERO_TOTAL: ${counts.NO_JOURNAL_EXPECTED_ZERO_TOTAL ?? 0}`
]
process.stdout.write(lines.join('\n'))
NODE
}

# Load env defaults from file without overriding already-exported variables.
load_env_file_if_unset "$ROOT_DIR/backend/.env"
load_env_file_if_unset "$ROOT_DIR/.env"

RECON_DATE="${RECON_DATE:-$(date +%F)}"
BRANCH_ID="${BRANCH_ID:-${RECON_BRANCH_ID:-}}"
DATABASE_URL="${DATABASE_URL:-}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
RETENTION_DAYS="${RETENTION_DAYS:-${RECON_RETENTION_DAYS:-14}}"
NOTIFY_ON_OK="${NOTIFY_ON_OK:-${RECON_NOTIFY_ON_OK:-false}}"
RECON_TEST_ALERT="${RECON_TEST_ALERT:-false}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "[recon-cron] ERROR: DATABASE_URL is required"
  exit 1
fi

BRANCH_LABEL="$(resolve_branch_label)"

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
  send_alert "🚨 Recon SQL gagal\nTanggal: $RECON_DATE\nBranch: $BRANCH_LABEL\nLog: $RAW_OUT"
  exit $PSQL_EXIT
fi

set +e
RECON_DATE="$RECON_DATE" BRANCH_ID="$BRANCH_ID" node "$PARSER" "$RAW_OUT" > "$JSON_OUT"
PARSER_EXIT=$?
set -e

SUMMARY_JSON="$(cat "$JSON_OUT")"
SUMMARY_TEXT="$(format_summary_text "$SUMMARY_JSON")"
echo "[recon-cron] summary: $SUMMARY_JSON"

if [[ $PARSER_EXIT -eq 2 ]]; then
  echo "[recon-cron] ALERT: mismatch detected"
  send_alert "🚨 Recon mismatch terdeteksi\n${SUMMARY_TEXT}\nLog: $RAW_OUT"
  exit 2
fi

if [[ $PARSER_EXIT -ne 0 ]]; then
  echo "[recon-cron] ERROR: parser failed. See $RAW_OUT / $JSON_OUT"
  send_alert "🚨 Recon parser gagal\nTanggal: $RECON_DATE\nBranch: $BRANCH_LABEL\nLog: $RAW_OUT"
  exit $PARSER_EXIT
fi

echo "[recon-cron] OK: no mismatch"
if parse_bool "$RECON_TEST_ALERT"; then
  send_alert "🧪 Recon test notification\n${SUMMARY_TEXT}" || true
elif parse_bool "$NOTIFY_ON_OK"; then
  send_alert "✅ Recon aman\n${SUMMARY_TEXT}" || true
fi
exit 0
