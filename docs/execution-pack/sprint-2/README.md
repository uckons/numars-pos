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
