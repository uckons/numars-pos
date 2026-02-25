# Sprint 4 Rollback Runbook v1

Runbook rollback untuk AP/AR/Payroll Staff v1 jika terjadi incident major.

## 1) Kapan Rollback

Lakukan rollback jika terjadi salah satu:
- Data integrity issue mayor (double posting/loss).
- Error berulang pada close payroll run.
- Mismatch AP/AR aging vs ledger tidak terkendali.

## 2) Langkah Immediate (0–30 menit)

1. Nonaktifkan feature flags:
   - `FEATURE_AP_ENABLED=false`
   - `FEATURE_AR_ENABLED=false`
   - `FEATURE_PAYROLL_STAFF_ENABLED=false`
2. Stop job/scheduler payroll staff.
3. Freeze endpoint write AP/AR/payroll (maintenance mode per module).
4. Umumkan incident status ke channel war-room.

## 3) Stabilization (30–120 menit)

- Verifikasi tidak ada write baru masuk ke modul Sprint 4.
- Snapshot data untuk RCA.
- Jalankan query anomali dari SQL reconciliation pack.
- Dokumentasikan dampak dan scope branch terdampak.

## 4) Recovery Path

- Jalankan script repair khusus jika tersedia.
- Reconcile ulang sampai mismatch terkendali.
- Re-enable flag hanya untuk 1 branch pilot.
- Monitor 24 jam sebelum ekspansi wave.

## 5) Evidence Wajib

- Timeline incident.
- RCA awal.
- Daftar transaksi terdampak.
- Approval keputusan rollback + re-enable.
