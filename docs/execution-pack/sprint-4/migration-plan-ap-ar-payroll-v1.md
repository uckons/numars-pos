# Sprint 4 Migration Plan — AP/AR/Payroll Staff v1

Dokumen ini jadi panduan implementasi migration additive untuk Sprint 4.

## 1) Prinsip Migration

- Semua perubahan **additive** (tanpa drop/rename kolom existing).
- Semua FK memakai `ON UPDATE CASCADE` sesuai kebutuhan, delete behavior explicit.
- Index berat dibuat off-peak bila perlu.
- Rollback by disable feature flag + stop write path baru.

## 2) Draft Object Database

### AP
- `vendors`
- `ap_invoices`
- `ap_invoice_lines`
- `ap_payments`

### AR
- `customers`
- `customer_credit_limits`
- `ar_invoices`
- `ar_invoice_lines`
- `ar_payments`

### Payroll Staff
- `staff_payroll_runs`
- `staff_payroll_items`
- `staff_payroll_slips`

### Cross Link
- Tambah `journal_entry_id` nullable di `ap_payments`, `ar_payments`, `staff_payroll_runs`.

## 3) Urutan Eksekusi

1. Buat tabel master (`vendors`, `customers`, `customer_credit_limits`).
2. Buat tabel dokumen AP/AR (`*_invoices`, `*_lines`, `*_payments`).
3. Buat tabel payroll staff (`staff_payroll_*`).
4. Tambah kolom `journal_entry_id` + FK ke `journal_entries`.
5. Tambah index query utama (`status`, `due_date`, `branch_id`, `period_key`).
6. Seed data minimal (payment terms default, customer tier default jika diperlukan).

## 4) Query Pattern yang Wajib Didukung

- AP aging per branch & bucket umur.
- AR aging per branch & bucket umur.
- Payroll run by period + status.
- Outstanding dokumen AP/AR by vendor/customer.

## 5) Acceptance Check Pasca Migration

- Semua tabel terbuat sesuai naming convention.
- FK dan index tervalidasi.
- Insert sample AP/AR/payroll dokumen sukses.
- Link ke `journal_entries` dapat diisi tanpa error.
- Tidak ada impact ke POS flow existing.

## 6) Rollback Strategy

- Nonaktifkan feature flag AP/AR/payroll.
- Hentikan scheduler/worker payroll run.
- Isolasi endpoint baru (deny route by flag).
- Analisis RCA sebelum re-enable.
