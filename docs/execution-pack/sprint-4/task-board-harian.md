# Sprint 4 Task Board Harian (D1–D10)

## Immediate (Pasca Merge Terakhir)
- Lock 1 pilot branch + approver Finance + approver Payroll.
- Aktifkan feature flag AP/AR/payroll staff hanya untuk pilot branch.
- Jalankan 3 transaksi bukti (AP, AR, payroll close) + recon siang/sore.
- Publish daily status + incident log untuk gate H+48/H+72.

## D1 — Kickoff Scope & Owner Lock
- Finalisasi scope AP/AR/Payroll Staff v1.
- Tetapkan owner (Eng, QA, Finance, Payroll).
- Output: scope baseline + owner matrix.

## D2 — Database Migration Draft
- Tambah tabel AP: vendor, invoice, invoice_line, payment.
- Tambah tabel AR: customer credit, invoice, payment, credit limit.
- Tambah tabel payroll staff run + payroll item.
- Output: SQL migration additive siap review.

## D3 — API Skeleton
- Endpoint CRUD AP invoice + submit.
- Endpoint CRUD AR invoice + receive payment.
- Endpoint create payroll run + close period.
- Output: route/controller/service skeleton siap QA awal.

## D4 — Validation Rules
- Validasi due date + terms.
- Validasi overpayment AP/AR.
- Validasi payroll komponen minimal.
- Output: validator + negative test awal.

## D5 — Ledger Link & Auto Journal
- Mapping jurnal AP invoice, AP payment.
- Mapping jurnal AR invoice, AR payment.
- Mapping jurnal payroll staff close.
- Output: auto-journal AP/AR/payroll tercatat idempotent.

## D6 — Approval & Audit
- Approval untuk aksi kritikal (void/reverse/limit override).
- Audit trail actor + action + timestamp + note.
- Output: approval trail bisa ditrace end-to-end.

## D7 — UI/Reporting Integration
- Form AP/AR invoice & payment v1.
- List aging AP/AR.
- Payroll run summary + slip generation status.
- Output: UI staging terhubung API.

## D8 — QA Internal
- Happy path + negative path AP/AR/payroll.
- Verify reconciliation AP/AR vs journal.
- Verify payroll close menghasilkan jurnal balance.
- Output: buglist severity + fix plan.

## D9 — UAT User
- UAT bersama Finance + Payroll representative.
- Finalisasi feedback policy dan UX.
- Output: sign-off / temuan blocking.

## D10 — Pilot Release
- Rollout ke 1 branch pilot.
- Monitor error rate, aging mismatch, payroll anomalies.
- Output: keputusan COND PASS / PASS / NO-GO.


## D11 — Go/No-Go Gate
- Review hasil pilot H+48/H+72 dan incident log.
- Validasi AP/AR aging consistency + payroll close integrity.
- Output: keputusan GO / NO-GO.

## D12 — Wave Rollout + Stabilization
- Rollout bertahap ke branch wave-1 lalu wave-2 jika stabil.
- Stabilization H+1 s/d H+3 + handover operasi.
- Output: status Sprint 4 final (PASS/COND PASS).
