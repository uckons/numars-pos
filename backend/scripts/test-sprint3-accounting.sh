#!/usr/bin/env bash
set -euo pipefail

# Sprint 3 accounting smoke flow:
# create manual journal -> submit -> approve -> create recurring template -> generate recurring runs
#
# Usage:
#   BASE_URL="http://127.0.0.1:3000/api/accounting" TOKEN="..." bash backend/scripts/test-sprint3-accounting.sh
#
# Optional env:
#   BRANCH_ID=1
#   DEBIT_ACCOUNT_CODE=5111
#   CREDIT_ACCOUNT_CODE=1111
#   RECUR_DEBIT_ACCOUNT_CODE=5311
#   RECUR_CREDIT_ACCOUNT_CODE=2111
#   RUN_APPLY=true|false   (default: false)
#   JOURNAL_AMOUNT=100000
#   RECUR_AMOUNT=500000

BASE_URL="${BASE_URL:-http://127.0.0.1:3000/api/accounting}"
TOKEN="${TOKEN:-}"

BRANCH_ID="${BRANCH_ID:-1}"
DEBIT_ACCOUNT_CODE="${DEBIT_ACCOUNT_CODE:-5111}"
CREDIT_ACCOUNT_CODE="${CREDIT_ACCOUNT_CODE:-1111}"
RECUR_DEBIT_ACCOUNT_CODE="${RECUR_DEBIT_ACCOUNT_CODE:-5311}"
RECUR_CREDIT_ACCOUNT_CODE="${RECUR_CREDIT_ACCOUNT_CODE:-2111}"
RUN_APPLY="${RUN_APPLY:-false}"
JOURNAL_AMOUNT="${JOURNAL_AMOUNT:-100000}"
RECUR_AMOUNT="${RECUR_AMOUNT:-500000}"

if [[ -z "$TOKEN" ]]; then
  echo "[ERROR] TOKEN wajib diisi"
  echo "Contoh: TOKEN='xxx' BASE_URL='http://127.0.0.1:3000/api/accounting' bash backend/scripts/test-sprint3-accounting.sh"
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "[ERROR] curl tidak tersedia"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "[ERROR] jq tidak tersedia (dibutuhkan untuk parse response)"
  exit 1
fi

TODAY="$(date +%F)"
AUTH_HEADER="Authorization: Bearer ${TOKEN}"
JSON_HEADER="Content-Type: application/json"

request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"

  if [[ -n "$data" ]]; then
    curl -sS -X "$method" "$url" \
      -H "$AUTH_HEADER" \
      -H "$JSON_HEADER" \
      -d "$data"
  else
    curl -sS -X "$method" "$url" \
      -H "$AUTH_HEADER" \
      -H "$JSON_HEADER"
  fi
}

print_step() {
  echo
  echo "=================================================="
  echo "$1"
  echo "=================================================="
}

assert_no_error() {
  local payload="$1"
  local code
  code="$(echo "$payload" | jq -r '.error.code // empty')"
  if [[ -n "$code" ]]; then
    echo "[ERROR] API error: $(echo "$payload" | jq -c '.error')"
    exit 1
  fi
}

print_step "0) Health check list manual journals"
LIST_RES="$(request GET "$BASE_URL/manual-journals?page=1&page_size=5")"
echo "$LIST_RES" | jq .
assert_no_error "$LIST_RES"

print_step "1) Create manual journal draft"
CREATE_PAYLOAD="$(jq -n \
  --argjson branch_id "$BRANCH_ID" \
  --arg journal_date "$TODAY" \
  --arg description "UAT Sprint3 - Manual Journal Create" \
  --arg debit_account_code "$DEBIT_ACCOUNT_CODE" \
  --arg credit_account_code "$CREDIT_ACCOUNT_CODE" \
  --argjson amount "$JOURNAL_AMOUNT" \
  '{
    branch_id: $branch_id,
    journal_date: $journal_date,
    description: $description,
    lines: [
      { account_code: $debit_account_code, debit: $amount, credit: 0, memo: "beban test" },
      { account_code: $credit_account_code, debit: 0, credit: $amount, memo: "kas test" }
    ]
  }')"

CREATE_RES="$(request POST "$BASE_URL/manual-journals" "$CREATE_PAYLOAD")"
echo "$CREATE_RES" | jq .
assert_no_error "$CREATE_RES"

JOURNAL_ID="$(echo "$CREATE_RES" | jq -r '.id // empty')"
if [[ -z "$JOURNAL_ID" || "$JOURNAL_ID" == "null" ]]; then
  echo "[ERROR] gagal mendapatkan JOURNAL_ID"
  exit 1
fi
echo "[OK] JOURNAL_ID=$JOURNAL_ID"

print_step "2) Submit manual journal"
SUBMIT_RES="$(request POST "$BASE_URL/manual-journals/${JOURNAL_ID}/submit" '{"note":"Submit untuk approval UAT"}')"
echo "$SUBMIT_RES" | jq .
assert_no_error "$SUBMIT_RES"

SUBMIT_STATUS="$(echo "$SUBMIT_RES" | jq -r '.status // empty')"
if [[ "$SUBMIT_STATUS" != "PENDING_APPROVAL" ]]; then
  echo "[ERROR] expected status PENDING_APPROVAL, got: $SUBMIT_STATUS"
  exit 1
fi

print_step "3) Approve manual journal"
APPROVE_RES="$(request POST "$BASE_URL/manual-journals/${JOURNAL_ID}/approve" '{"note":"Approved by script UAT"}')"
echo "$APPROVE_RES" | jq .
assert_no_error "$APPROVE_RES"

APPROVE_STATUS="$(echo "$APPROVE_RES" | jq -r '.status // empty')"
if [[ "$APPROVE_STATUS" != "POSTED" ]]; then
  echo "[ERROR] expected status POSTED, got: $APPROVE_STATUS"
  exit 1
fi

print_step "4) Validate detail + approval logs"
DETAIL_RES="$(request GET "$BASE_URL/manual-journals/${JOURNAL_ID}")"
echo "$DETAIL_RES" | jq .
assert_no_error "$DETAIL_RES"

DETAIL_STATUS="$(echo "$DETAIL_RES" | jq -r '.status // empty')"
if [[ "$DETAIL_STATUS" != "POSTED" ]]; then
  echo "[ERROR] detail status bukan POSTED: $DETAIL_STATUS"
  exit 1
fi

print_step "5) Create recurring template"
TEMPLATE_PAYLOAD="$(jq -n \
  --argjson branch_id "$BRANCH_ID" \
  --arg start_date "$TODAY" \
  --arg name "UAT Sprint3 - Akrual Bulanan" \
  --arg debit_account_code "$RECUR_DEBIT_ACCOUNT_CODE" \
  --arg credit_account_code "$RECUR_CREDIT_ACCOUNT_CODE" \
  --argjson amount "$RECUR_AMOUNT" \
  '{
    branch_id: $branch_id,
    name: $name,
    schedule_type: "MONTHLY",
    schedule_day: 1,
    start_date: $start_date,
    end_date: null,
    description: "Template recurring untuk UAT",
    lines: [
      { account_code: $debit_account_code, debit: $amount, credit: 0, memo: "beban" },
      { account_code: $credit_account_code, debit: 0, credit: $amount, memo: "utang" }
    ]
  }')"

TEMPLATE_RES="$(request POST "$BASE_URL/recurring-journals/templates" "$TEMPLATE_PAYLOAD")"
echo "$TEMPLATE_RES" | jq .
assert_no_error "$TEMPLATE_RES"

TEMPLATE_ID="$(echo "$TEMPLATE_RES" | jq -r '.id // empty')"
if [[ -z "$TEMPLATE_ID" || "$TEMPLATE_ID" == "null" ]]; then
  echo "[ERROR] gagal mendapatkan TEMPLATE_ID"
  exit 1
fi
echo "[OK] TEMPLATE_ID=$TEMPLATE_ID"

print_step "6) Generate recurring runs (dry-run=true)"
GEN_DRY_RES="$(request POST "$BASE_URL/internal/recurring-journals/generate?date=${TODAY}&dry_run=true")"
echo "$GEN_DRY_RES" | jq .
assert_no_error "$GEN_DRY_RES"

if [[ "${RUN_APPLY,,}" == "true" ]]; then
  print_step "7) Generate recurring runs (dry_run=false)"
  GEN_APPLY_RES="$(request POST "$BASE_URL/internal/recurring-journals/generate?date=${TODAY}&dry_run=false")"
  echo "$GEN_APPLY_RES" | jq .
  assert_no_error "$GEN_APPLY_RES"
else
  print_step "7) Skip apply run"
  echo "RUN_APPLY=false, generate apply dilewati"
fi

print_step "DONE"
echo "[SUCCESS] Sprint 3 accounting API smoke flow selesai"
echo "- JOURNAL_ID=$JOURNAL_ID"
echo "- TEMPLATE_ID=$TEMPLATE_ID"
