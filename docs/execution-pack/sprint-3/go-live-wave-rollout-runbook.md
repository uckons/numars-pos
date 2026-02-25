# Sprint 3 — GO Live Wave Rollout Runbook

Runbook ini digunakan ketika status gate sudah **GO** untuk mengeksekusi rollout bertahap dan menjaga stabilitas sampai final close.

## 1) Scope & Tujuan

- Rollout fitur accounting Sprint 3 ke seluruh branch secara bertahap.
- Menjaga continuity operasional POS dan proses approval accounting.
- Memastikan data integrity tetap aman selama dan setelah rollout.

## 2) Pre-Rollout Checklist (H-0)

- [ ] Gate keputusan tercatat: `GO`.
- [ ] Branch grouping wave-1 dan wave-2 final.
- [ ] Owner on-duty ditetapkan (Eng, QA, Finance, Ops).
- [ ] Alert channel + escalation path aktif.
- [ ] Backup/restore readiness tervalidasi.
- [ ] Freeze perubahan non-esensial di window rollout.

## 3) Wave Execution

## Wave-1 (30–40% branch)

- [ ] Aktifkan feature flag untuk branch wave-1.
- [ ] Validasi smoke flow per branch: create draft -> submit -> approve.
- [ ] Jalankan recon harian minimal 2x.
- [ ] Catat incident, severity, owner, ETA.

Kriteria lanjut wave-2:
- [ ] Tidak ada incident major selama 24 jam.
- [ ] Tidak ada jurnal posted yang unbalanced.
- [ ] Backlog `PENDING_APPROVAL` dalam SLA.

## Wave-2 (sisa branch)

- [ ] Aktifkan feature flag untuk seluruh branch tersisa.
- [ ] Ulangi smoke flow sampling per cluster branch.
- [ ] Pastikan KPI tetap dalam threshold.

## 4) Incident Handling Ringkas

### Jika incident major terjadi

1. Stop ekspansi wave berikutnya.
2. Isolasi ke branch terdampak (scope containment).
3. Jalankan rollback flag jika perlu.
4. Tulis RCA awal maksimal 4 jam.
5. Re-evaluate status GO sebelum lanjut.

## 5) Stabilization (H+1 s/d H+3)

- [ ] Daily recon konsisten 2x/hari.
- [ ] Review approval queue aging dan SLA.
- [ ] Review error trend API accounting.
- [ ] Tutup isu high-priority dengan verifikasi QA.

## 6) Final Close Criteria

- [ ] 3 hari pasca-rollout tanpa incident major baru.
- [ ] Rekonsiliasi terkendali (0 mismatch atau RCA+action plan disetujui).
- [ ] Sign-off Engineering + Finance + QA lengkap.
- [ ] Status Sprint 3 dinaikkan menjadi **PASS**.

## 7) Bukti Wajib Disimpan

- Snapshot dashboard error/queue per hari.
- Output recon harian.
- Log incident + timeline handling.
- Dokumen sign-off final.
