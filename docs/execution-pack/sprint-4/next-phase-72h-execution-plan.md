# Sprint 4 — Next Phase 72h Execution Plan

Dokumen ini adalah rencana eksekusi praktis per shift untuk 72 jam setelah keputusan GO.

## 1) Target Outcome

- Wave-1 dan wave-2 aktif sesuai guardrail.
- Tidak ada incident major terbuka sampai H+72.
- H+3 stabilization report siap dan disetujui lintas owner.

## 2) Rencana Per 24 Jam

## H+0 s/d H+24 (Wave-1)

- Aktifkan branch cohort wave-1 (30–40%).
- Jalankan checkpoint monitoring per 4 jam.
- Recon siang + sore wajib.
- Jika ada anomaly kritikal: hold wave-2.

Output:
- `wave-rollout-tracker-template.md` terisi untuk window H+24.
- Daily status terkirim ke stakeholder.

## H+24 s/d H+48 (Decision Wave-2)

- Review trend KPI wave-1 vs baseline pilot.
- Putuskan proceed/hold wave-2.
- Jika proceed: aktifkan wave-2 bertahap per cluster.

Output:
- Update gate note (jika perlu addendum decision).
- Incident & recovery log terbarui.

## H+48 s/d H+72 (Stabilization)

- Pastikan recon mismatch kritikal = 0 atau punya RCA + ETA fix.
- Pastikan payroll close tidak ada kegagalan berulang.
- Validasi sampel transaksi AP/AR/payroll lintas branch.

Output:
- `h-plus-3-stabilization-report-template.md` final.
- Handover readiness status: READY / NOT READY.

## 3) Shift Duty Matrix

| Shift | Fokus | PIC Utama | PIC Backup | Output |
|---|---|---|---|---|
| Pagi | Health check + scope flag audit |  |  | Status check |
| Siang | Recon + mismatch triage |  |  | Recon report |
| Sore | Incident review + daily summary |  |  | Stakeholder update |
| Malam (opsional) | Wave checkpoint |  |  | Checkpoint note |

## 4) Hard Stop Criteria

Hentikan ekspansi rollout jika salah satu terjadi:

- Major incident finansial.
- Jurnal posted unbalanced yang belum ada containment.
- Payroll close gagal berulang tanpa workaround aman.
- AP/AR mismatch tidak terkendali > 1 siklus.

## 5) Exit Criteria H+72

- [ ] Tidak ada major incident open.
- [ ] Recon siang/sore 3 hari lengkap.
- [ ] KPI stabil vs baseline pilot.
- [ ] Sign-off Finance + Payroll + QA + Engineering + Ops.


## 6) Referensi Cepat

- Gunakan `h0-h24-filled-example.md` sebagai baseline pengisian hari pertama.
- Jika UI operasional belum lengkap, ikuti prioritas di `ui-gap-assessment-ap-ar-payroll.md`.
