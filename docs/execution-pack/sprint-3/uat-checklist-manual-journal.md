# UAT Checklist — Sprint 3 Manual Journal Workflow

## A. Manual Journal Draft

- [ ] User Accounting dapat membuat draft jurnal dengan minimal 2 line.
- [ ] Sistem menolak save jika line kosong semua.
- [ ] Sistem menampilkan total debit dan total kredit.
- [ ] Flag balance berubah realtime saat line diubah.

## B. Submit for Approval

- [ ] Draft balanced bisa submit ke `PENDING_APPROVAL`.
- [ ] Draft tidak balanced tidak bisa submit.
- [ ] Setelah submit, draft tidak bisa diedit oleh creator.

## C. Approval Flow

- [ ] Approver dapat melihat queue `PENDING_APPROVAL`.
- [ ] Approver dapat `APPROVE` dengan note.
- [ ] Approver dapat `REJECT` dengan note.
- [ ] User non-approver tidak bisa approve/reject.

## D. Posting Integrity

- [ ] Jurnal `POSTED` selalu balanced.
- [ ] `POSTED` tidak dapat diubah atau dihapus.
- [ ] Audit trail mencatat actor + timestamp + action.

## E. Recurring Template

- [ ] User dapat membuat template recurring bulanan.
- [ ] Template pause tidak ikut generate run.
- [ ] Template resume kembali ikut generate run.
- [ ] Generator tidak duplicate untuk period yang sama.

## F. Filter & Reporting

- [ ] List jurnal bisa filter by status/date/branch.
- [ ] Total row pagination sesuai data.
- [ ] Detail jurnal menampilkan semua line dengan benar.

## G. Negative Test

- [ ] Submit jurnal non-existing id -> `NOT_FOUND`.
- [ ] Approve status `DRAFT` -> `INVALID_STATUS_TRANSITION`.
- [ ] Payload line dengan debit+credit sekaligus -> `VALIDATION_ERROR`.
- [ ] Account tidak aktif -> `VALIDATION_ERROR`.

## H. Sign-off

- UAT Date:
- QA:
- Accounting Representative:
- Result: **CONDITIONAL PASS** (Sprint 3 lanjut pilot)
- Catatan: Target close final setelah 2–3 hari pilot tanpa incident major.
