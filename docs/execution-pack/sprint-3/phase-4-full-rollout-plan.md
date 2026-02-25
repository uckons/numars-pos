# Sprint 3 — Next Phase Plan (Pilot to Full Rollout)

Dokumen ini dipakai saat status Sprint 3 sudah **CONDITIONAL PASS** dan tim masuk ke fase berikutnya: verifikasi pilot 2–3 hari, lalu keputusan full rollout.

## 1) Objective

- Menutup fase pilot dengan bukti operasional yang jelas.
- Menjalankan go/no-go gate secara terukur.
- Rollout bertahap ke seluruh branch tanpa incident major.

## 2) Entry Criteria

Semua syarat ini harus terpenuhi sebelum lanjut ke full rollout:

- UAT sign-off status `CONDITIONAL PASS` sudah terdokumentasi.
- Pilot aktif minimal di 1 branch + 1 approver.
- Recon harian berjalan (minimal 2x/hari) dan alert channel aktif.
- Tidak ada issue blocker yang open.

## 3) Monitoring Window (2–3 hari)

### A. KPI Operasional
- Error API accounting (5xx) stabil dan tidak meningkat signifikan.
- Backlog `PENDING_APPROVAL` dalam SLA internal.
- Tidak ada duplicate posting pada event POS/payment/revert.

### B. KPI Akuntansi
- 100% jurnal `POSTED` balance.
- Selisih reconciliation harian = 0 untuk transaksi pilot (atau ada RCA + action plan jika belum 0).
- Audit trail lengkap untuk submit/approve/reject.

### C. Incident Definition (Major)
Incident major meliputi:
- Data loss jurnal.
- Double posting yang berdampak finansial.
- Fitur approval/posting tidak bisa dipakai operasional.
- Kegagalan berulang tanpa workaround yang aman.

## 4) Go/No-Go Gate

### GO jika:
- 2–3 hari pilot tanpa incident major.
- KPI operasional dan akuntansi sesuai threshold.
- Owner Finance + Tech Lead menyetujui.

### NO-GO jika:
- Ada incident major.
- Rekonsiliasi tidak terkendali.
- Backlog approval di luar SLA > 1 hari.

Untuk NO-GO, kembali ke scope pilot, jalankan perbaikan, ulangi monitoring window.

## 5) Full Rollout Steps

1. Aktifkan branch wave-1 (maks 30–40% branch).
2. Monitor 24 jam; jika stabil lanjut wave-2 (sisa branch).
3. Freeze perubahan non-esensial selama rollout window.
4. Jalankan daily recon + incident review hingga H+3 rollout penuh.

## 6) Owners & Sign-off

- Engineering Owner:
- Finance Owner:
- QA Owner:
- Start Pilot Date:
- Gate Decision Date:
- Final Decision: GO / NO-GO
- Notes:
