# UAT Checklist — Sprint 4 AP/AR/Payroll Staff v1

## A. Account Payable (AP)

- [ ] User dapat membuat AP invoice dengan supplier, due date, dan line item.
- [ ] Sistem menolak AP invoice tanpa line valid.
- [ ] AP aging menampilkan bucket umur utang dengan benar.
- [ ] Payment voucher tidak bisa melebihi outstanding AP invoice.

## B. Account Receivable (AR)

- [ ] User dapat membuat AR invoice untuk corporate/member credit.
- [ ] Sistem menegakkan credit limit sesuai policy.
- [ ] Pencatatan pembayaran AR mengurangi outstanding dengan benar.
- [ ] AR aging menampilkan bucket umur piutang dengan benar.

## C. Payroll Staff v1

- [ ] User dapat membuat payroll run untuk periode aktif.
- [ ] Komponen fixed (basic/tunjangan/potongan) terhitung sesuai formula v1.
- [ ] Payroll close period menghasilkan jurnal balance.
- [ ] Slip payroll PDF dapat di-generate untuk sample staff.

## D. Approval & Audit

- [ ] Aksi kritikal (void/reverse/limit override) butuh approval.
- [ ] User non-approver tidak bisa approve.
- [ ] Audit trail menyimpan actor, timestamp, action, note.

## E. Integrity & Reconciliation

- [ ] Semua jurnal AP/AR/payroll status `POSTED` balance.
- [ ] Tidak ada payment orphan tanpa referensi dokumen.
- [ ] Rekonsiliasi AP/AR ledger vs jurnal tidak ada mismatch mayor.

## F. Sign-off

- UAT Date:
- QA:
- Finance Representative:
- Payroll Representative:
- Result: PASS / CONDITIONAL PASS / FAIL
- Catatan:
