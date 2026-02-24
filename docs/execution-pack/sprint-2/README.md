# Sprint 2 Execution Notes — Accounting Core (Auto Journal POS)

Implementasi awal Sprint 2 mencakup auto-journal event utama berbasis `accounting_posting_rules`:

- `POS_PAYMENT`
- `POS_REVERT`
- `THERAPIST_COMMISSION_SETTLE`

## What is implemented

1. Service posting jurnal otomatis:
   - `backend/modules/accounting/journal-posting.service.js`
   - Resolve rules by `event_code + variant` (fallback `DEFAULT`)
   - Idempotency dengan `journal_entries.idempotency_key`
   - Idempotency POS payment dikunci per `source_ref` order agar tidak double jurnal saat klik bayar ulang pada order yang sama
2. Hook ke flow pembayaran order POS:
   - `orders.close`
   - `orders.createFromPos`
   - `orders.payBulk`
3. Hook ke flow revert payment:
   - `revert-payment.revertPayment`
4. Hook ke settlement payroll terapis:
   - `superadmin.settleTherapistPayroll`

## Verification SQL

```sql
SELECT id, source_ref, status, description, created_at
FROM journal_entries
ORDER BY id DESC
LIMIT 20;

SELECT je.id, je.source_ref, jl.line_no, coa.code, coa.name, jl.debit, jl.credit
FROM journal_entries je
JOIN journal_lines jl ON jl.journal_entry_id = je.id
JOIN chart_of_accounts coa ON coa.id = jl.account_id
ORDER BY je.id DESC, jl.line_no ASC
LIMIT 50;
```

## Rollout safety

- Keep `FEATURE_ACCOUNTING_V2` OFF by default, enable by pilot branch only.
- Monitor mismatch: jumlah order paid vs jurnal event `POS_PAYMENT`.

## VPS Setup Note (Feature Flag)

Jika di VPS belum ada `FEATURE_ACCOUNTING_V2`, tambahkan manual di `backend/.env`:

```bash
FEATURE_ACCOUNTING_V2=false
```

Rekomendasi: copy dari template baru `backend/.env.example` agar namespace flags lengkap.

```bash
cp backend/.env.example backend/.env
# lalu sesuaikan DB credential sesuai server
```


## Paket Operasional Harian (VPS Ready)

Tambahan artefak untuk dipakai langsung tim operasional:

1. SQL rekonsiliasi harian POS vs jurnal:
   - `docs/execution-pack/sprint-2/sql-reconciliation-harian.sql`
2. Checklist operasional harian:
   - `docs/execution-pack/sprint-2/checklist-operasional-harian.md`

Tujuan: memastikan mismatch `order paid` vs `journal POS_PAYMENT` cepat terdeteksi setiap hari, termasuk deteksi missing journal, jurnal tidak balance, dan amount mismatch.

Catatan interpretasi report: order `PAID` dengan `total <= 0` dipisah menjadi `ZERO_TOTAL_WITH_ITEMS` (perlu investigasi karena item subtotal > 0) dan `NO_JOURNAL_EXPECTED_ZERO_TOTAL` (informational), karena auto-journal hanya dibuat untuk amount > 0.


Tool repair tersedia untuk kasus historical `ZERO_TOTAL_WITH_ITEMS`:
- `npm --prefix backend run journal:repair:zero-total` (dry-run semua data)
- `RECON_DATE=YYYY-MM-DD npm --prefix backend run journal:repair:zero-total` (dry-run per tanggal)
- `ORDER_ID=<id> APPLY=true npm --prefix backend run journal:repair:zero-total` (apply terarah)
- `RECON_DATE=YYYY-MM-DD APPLY=true npm --prefix backend run journal:repair:zero-total` (apply massal per tanggal)


## Cron + Parser Auto Alert

Tersedia script otomasi untuk menjalankan recon SQL, parse output, dan kirim alert webhook jika mismatch:

```bash
cd /workspace/numars-pos/backend
RECON_DATE="$(date +%F)" BRANCH_ID="1" ALERT_WEBHOOK_URL="https://example-webhook" bash scripts/cron-recon-alert.sh
```

Komponen:
- `backend/scripts/cron-recon-alert.sh`
- `backend/scripts/recon-output-parser.js`
