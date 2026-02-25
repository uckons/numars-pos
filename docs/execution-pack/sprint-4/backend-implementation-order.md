# Sprint 4 Backend Implementation Order

Dokumen ini menjadi urutan implementasi backend praktis untuk Sprint 4 (AP/AR + Payroll Staff v1).

## 1) Migration & Schema (D2)

### AP
- `vendors`
- `ap_invoices`
- `ap_invoice_lines`
- `ap_payments`

### AR
- `customers`
- `ar_invoices`
- `ar_invoice_lines`
- `ar_payments`
- `customer_credit_limits`

### Payroll Staff
- `staff_payroll_runs`
- `staff_payroll_items`
- `staff_payroll_slips`

### Cross-cutting
- Tambah `journal_entry_id` nullable pada dokumen finansial utama.
- Tambah index untuk `status`, `due_date`, `branch_id`, `period_key`.
- Semua migration additive (tanpa breaking change).

## 2) Module Skeleton (D3)

- `backend/modules/accounting/ap/*`
  - route/controller/service
- `backend/modules/accounting/ar/*`
  - route/controller/service
- `backend/modules/accounting/payroll-staff/*`
  - route/controller/service

Pastikan semua endpoint guarded sesuai role.

## 3) Validation Rules (D4)

### AP
- Invoice total = sum line.
- Payment tidak boleh melebihi outstanding.
- Due date tidak boleh sebelum invoice date.

### AR
- Credit limit check sebelum approve invoice credit.
- Payment tidak boleh melebihi outstanding.
- Status transition valid (DRAFT -> APPROVED -> PARTIAL/PAID).

### Payroll Staff
- Payroll run unik per branch + period.
- Komponen wajib tersedia untuk setiap staff aktif.
- Close period hanya jika run balanced & approved.

## 4) Journal Integration (D5)

Gunakan posting engine existing dengan event baru:
- `AP_INVOICE_POSTED`
- `AP_PAYMENT_POSTED`
- `AR_INVOICE_POSTED`
- `AR_PAYMENT_RECEIVED`
- `STAFF_PAYROLL_POSTED`

Tambahkan idempotency key per dokumen finansial.

## 5) Approval & Audit Trail (D6)

- Approval untuk aksi sensitif:
  - void AP/AR payment
  - credit limit override
  - payroll re-open period
- Simpan actor/action/timestamp/note/old_value/new_value.

## 6) QA Readiness (D8)

Minimal checklist teknis sebelum UAT:
- Endpoint AP/AR/payroll happy path lulus.
- Negative path validasi lulus.
- Posting jurnal balance (debit=credit).
- Rekonsiliasi dasar AP/AR vs journal tidak mismatch mayor.
