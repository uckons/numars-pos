# Sprint 4 Execution Pack — AP/AR + Payroll Staff v1

Sprint 4 fokus ke penguatan transaksi finansial operasional setelah Sprint 3 closed PASS:

1. **Account Payable (AP)**
   - Supplier invoice (header + line + terms).
   - AP aging by due date.
   - Payment voucher + posting ke ledger.
2. **Account Receivable (AR)**
   - Corporate/member credit invoice.
   - AR aging + payment tracking.
   - Credit limit guardrail dasar.
3. **Payroll Staff v1**
   - Payroll run periodik staff non-terapis.
   - Komponen fixed dasar (gaji pokok, tunjangan, potongan).
   - Auto-journal payroll + slip PDF v1.

## Deliverables Sprint 4

- Dokumen scope + acceptance criteria AP/AR/Payroll Staff.
- Task board harian D1–D10.
- UAT checklist AP/AR/Payroll Staff.
- Draft migration additive AP/AR/payroll staff.
- API contract awal untuk AP/AR/payroll run (`api-contract-ap-ar-payroll-v1.md`).
- Backend implementation order (`backend-implementation-order.md`).
- Pilot + go-live checklist (`pilot-go-live-checklist.md`).
- Migration plan AP/AR/payroll (`migration-plan-ap-ar-payroll-v1.md`).
- Feature flags AP/AR/payroll (`feature-flags-v1.md`).

## Dependency

- Sprint 3 status final **PASS**.
- Posting engine dan chart of accounts dari Sprint 1–3 aktif.
- Feature flags tetap dipakai untuk rollout bertahap per branch.

## Rollout Plan

1. **Week 1 (Build + Internal QA)**
   - Implement schema + endpoint inti AP/AR/payroll run.
2. **Week 2 (UAT + Pilot Branch)**
   - UAT finance/payroll user pada 1 branch pilot.
3. **Week 3 (Stabilization + Rollout)**
   - Perbaikan feedback dan rollout bertahap.

## Exit Criteria Sprint 4

- AP aging akurat dan konsisten dengan invoice/payment.
- AR aging akurat dan tidak ada payment orphan.
- Payroll staff berhasil close 1 periode tanpa incident major.
- Jurnal AP/AR/payroll selalu balance (debit = credit).
- Approval trail untuk aksi kritikal terekam lengkap.
