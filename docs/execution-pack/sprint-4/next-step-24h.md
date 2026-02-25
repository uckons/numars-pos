# Sprint 4 — Next Step Eksekusi (24–72 Jam)

Dokumen ini merangkum langkah paling tepat setelah merge terakhir Sprint 4.
Fokusnya adalah memastikan pilot terkontrol sebelum rollout wave.

## 1) Kunci Scope Pilot (Hari Ini)

Wajib ditetapkan sebelum toggle production:

- 1 branch pilot (nama branch operasional yang jelas).
- 1 approver Finance.
- 1 approver Payroll.

Output wajib:

- Owner matrix final (PIC + backup + kontak).
- Scope pilot branch tertulis di daily status.

## 2) Aktifkan Feature Flag Hanya untuk Pilot

Aktifkan flag berikut **hanya** pada branch pilot:

- `FEATURE_AP_ENABLED=true`
- `FEATURE_AR_ENABLED=true`
- `FEATURE_PAYROLL_STAFF_ENABLED=true`

Catatan:

- Jangan aktifkan global.
- Rollout tetap bertahap: pilot -> wave-1 -> wave-2.

## 3) Jalankan Validasi H+24 / H+48

Bukti minimum yang harus lolos:

- AP invoice -> payment tanpa mismatch.
- AR invoice -> payment tanpa mismatch.
- Payroll run close sukses minimal 1 periode.
- Jurnal AP/AR/payroll posted dalam kondisi balance (debit = credit).
- Tidak ada major incident data integrity.

## 4) Operasional Harian (Wajib)

### Pagi

- Cek health service utama.
- Cek queue depth & backlog.
- Verifikasi scope flag tetap pilot-only.

### Siang

- Jalankan recon SQL Sprint 4.
- Simpan hasil recon (OK / mismatch + tiket insiden).

### Sore

- Review incident harian.
- Share summary status dan risiko ke owner lintas fungsi.


## Output yang Harus Terbit (Supaya Bisa Diaudit)

Sebelum masuk gate GO/NO-GO, pastikan artefak ini sudah ada:

- 1 dokumen **Pilot Control Sheet** (gunakan `pilot-control-sheet-template.md`).
- 1 ringkasan **daily status** per hari (minimal H+0, H+1, H+2).
- 1 catatan keputusan gate H+48/H+72 (GO/NO-GO + alasan + sign-off).

## Urutan Eksekusi Cepat (Disarankan)

1. Jam 09:00 — Lock branch pilot + owner matrix + approver.
2. Jam 10:00 — Toggle 3 feature flag untuk pilot branch saja.
3. Jam 11:00 — Jalankan AP invoice -> payment (capture evidence).
4. Jam 13:00 — Jalankan AR invoice -> payment + recon SQL siang.
5. Jam 15:00 — Jalankan payroll close 1 periode (capture evidence).
6. Jam 17:00 — Recon SQL sore + publish daily status + incident log.

## 5) Gate Keputusan H+48 / H+72

### GO jika

- Tidak ada incident major.
- Aging AP/AR konsisten dengan ledger.
- Sudah ada sign-off lintas owner (Finance, Payroll, QA, Engineering).

### NO-GO jika

- Ada issue finansial kritikal.
- Payroll close gagal berulang.
- Mismatch aging/jurnal tidak terkendali.

## 6) Jika GO: Lanjut Wave Rollout

- Wave-1: 30–40% branch, monitor 24 jam.
- Wave-2: aktifkan sisa branch jika stabil.
- H+3: stabilization + handover operasi.

## 7) Jika Ada Major Incident: Rollback Cepat

Ikuti rollback runbook Sprint 4:

- Disable flag AP/AR/payroll.
- Stop scheduler payroll.
- Freeze write endpoint terkait.
- Bentuk war-room + RCA.
- Re-enable pilot-only setelah stabil.

## Prioritas Praktis 24 Jam Ke Depan

1. Finalkan owner matrix + branch pilot.
2. Toggle feature flag pilot-only.
3. Jalankan 3 transaksi uji nyata:
   - 1 AP invoice + payment.
   - 1 AR invoice + payment.
   - 1 payroll run close.
4. Jalankan recon SQL siang dan sore.
5. Tulis daily status + incident log (jika ada).
