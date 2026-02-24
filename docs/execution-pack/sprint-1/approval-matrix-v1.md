# Approval Matrix v1 (S1-05)

Dokumen ini memfinalkan approval matrix Sprint 1 untuk area kritikal:
- Void transaksi
- Manual journal
- Payroll settle/edit
- Payment di atas limit

## Principles

1. **Maker-Checker** wajib untuk semua aksi high-risk.
2. **No self-approval**: maker tidak boleh menjadi approver request yang sama.
3. **Audit trail mandatory**: semua request harus punya reason + review note.
4. **SLA-aware**: setiap jenis approval punya target waktu respons.

## Matrix

| Action | Maker (Allowed) | Checker/Approver (Allowed) | SLA | Escalation | Mandatory Data |
|---|---|---|---|---|---|
| VOID_TRANSACTION | Kasir, Supervisor | Supervisor, Manager, Owner | 15 menit | Manager -> Owner | order_id, reason |
| MANUAL_JOURNAL_POST | Staff Finance, Manager | Manager, Owner | 4 jam | Owner | journal_id, reason, attachment(optional) |
| PAYROLL_SETTLE | HR/Payroll Admin, Manager | Manager, Owner | 1 hari kerja | Owner | period, amount, note |
| PAYROLL_EDIT | HR/Payroll Admin | Manager, Owner | 4 jam | Owner | payroll_run_id, field_changes, reason |
| PAYMENT_OVER_LIMIT | Kasir, Supervisor | Supervisor, Manager, Owner | 15 menit | Manager -> Owner | order_id/payment_ref, amount, limit_snapshot, reason |

## Decision Rules

- `PAYMENT_OVER_LIMIT` dipicu jika nominal > limit per-role/per-outlet.
- `VOID_TRANSACTION` untuk order PAID/CANCELLED yang butuh reversal policy.
- `MANUAL_JOURNAL_POST` hanya boleh post bila status `SUBMITTED`.
- `PAYROLL_EDIT` wajib menyimpan before/after values di audit payload.

## API/DB Contract (Target)

`approval_requests` (existing foundation table) dipakai sebagai generic workflow.

Suggested enum values:
- `module`: `VOID`, `JOURNAL`, `PAYROLL`, `PAYMENT_LIMIT`
- `status`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`

Suggested payload mapping by action:
- `ref_id`: ID dokumen utama (`order_id`, `journal_entry_id`, `payroll_run_id`, dst)
- `reason`: alasan maker
- `review_note`: catatan approver

## Acceptance Checklist (S1-05)

- [ ] Semua action kritikal punya maker/checker.
- [ ] SLA dan escalation disetujui Owner/Manager.
- [ ] No self-approval rule tervalidasi di service layer.
- [ ] Audit payload minimum telah disepakati tim.
