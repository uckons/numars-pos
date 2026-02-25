# Sprint 4 Checklist Operasional Harian

Checklist ini dipakai selama pilot/go-live AP/AR/Payroll Staff v1.

## A. Pagi (Start of Day)

- [ ] Cek status service backend dan error log 12 jam terakhir.
- [ ] Cek queue approval AP/AR/payroll.
- [ ] Cek backlog dokumen pending posting.
- [ ] Konfirmasi feature flag scope masih sesuai wave aktif.

## B. Siang (Mid-Day)

- [ ] Jalankan rekonsiliasi SQL Sprint 4 (`sql-reconciliation-ap-ar-payroll.sql`).
- [ ] Cek anomali payment tanpa `journal_entry_id`.
- [ ] Cek mismatch outstanding AP/AR.
- [ ] Catat issue + owner + ETA.

## C. Sore (End of Day)

- [ ] Review payroll run status (jika ada run aktif).
- [ ] Review incident severity dan status recovery.
- [ ] Kirim ringkasan harian ke channel Finance/Engineering.
- [ ] Update dashboard metrik: error rate, mismatch count, aging anomalies.

## D. Trigger Eskalasi

Eskalasi ke incident major jika:
- [ ] Ada double posting berdampak finansial.
- [ ] Ada data loss/korupsi dokumen AP/AR/payroll.
- [ ] Payroll close period gagal berulang tanpa workaround aman.
- [ ] Mismatch aging vs ledger tidak terkendali > 1 hari.
