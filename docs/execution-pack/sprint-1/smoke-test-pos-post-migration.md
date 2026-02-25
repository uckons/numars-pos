# POS Smoke Test Pasca Migration (S1-09)

Tujuan: memastikan alur POS existing tetap aman setelah migration 007/008 + concurrent indexes.

## Pre-check

- DB migration 007, 008, dan index concurrent sudah sukses.
- Backend service berjalan normal.
- Minimal ada 1 akun kasir aktif untuk test transaksi.

## Test Cases

| ID | Scenario | Expected |
|---|---|---|
| ST-01 | Login user kasir | Login sukses, token valid |
| ST-02 | Ambil list services | Endpoint services sukses (200) |
| ST-03 | Buat order POS (draft/open) | Order tercipta tanpa error |
| ST-04 | Pay order CASH | Status order jadi paid, tidak crash |
| ST-05 | Pay order non-cash (QRIS/TRANSFER jika ada) | Flow tetap normal |
| ST-06 | Timer create/start (jika service timer) | Timer endpoint tetap berjalan |
| ST-07 | Dashboard kasir load | Tidak ada query error |
| ST-08 | Existing report endpoint | Tidak regress setelah migration |

## DB Sanity Checks

```sql
SELECT COUNT(*) FROM chart_of_accounts;
SELECT COUNT(*) FROM accounting_posting_rules;
SELECT COUNT(*) FROM journal_entries;
SELECT COUNT(*) FROM approval_requests;
```

Expected minimal:
- `chart_of_accounts >= 29`
- `accounting_posting_rules >= 16`

## Exit Criteria

- Semua test case critical (ST-01 s/d ST-05) PASS.
- Tidak ada error 5xx baru di endpoint core POS.
- Tidak ada lock/slow query mayor pasca deployment migration.
