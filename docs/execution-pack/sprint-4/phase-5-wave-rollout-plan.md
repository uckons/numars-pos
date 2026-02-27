# Sprint 4 — Next Phase Plan (Pilot -> Wave Rollout -> Handover)

Dokumen ini dipakai setelah pilot H+48/H+72 siap masuk tahap berikutnya.

## 1) Objective

- Menjalankan transisi aman dari pilot ke wave rollout.
- Menjaga integritas AP/AR/Payroll selama perluasan scope branch.
- Menutup Sprint 4 dengan stabilization H+3 dan handover operasi.

## 2) Entry Criteria (Sebelum Wave-1)

Semua syarat berikut harus terpenuhi:

- Pilot Control Sheet terisi lengkap sampai gate decision.
- Keputusan GO terdokumentasi (Finance + Payroll + QA + Engineering).
- 3 bukti validasi minimum lulus (AP, AR, payroll close).
- Recon siang/sore stabil tanpa mismatch kritikal yang unresolved.

## 3) Rollout Strategy

### Wave-1 (30–40% Branch)

- Aktifkan flag AP/AR/payroll untuk cohort branch wave-1.
- Freeze perubahan non-esensial selama 24 jam pertama.
- Monitor KPI operasional setiap 4 jam.

### Wave-2 (Sisa Branch)

- Hanya dieksekusi jika wave-1 stabil 24 jam.
- Terapkan flag dengan pola yang sama dan tetap bertahap per cluster.
- Lanjut monitoring ketat sampai H+3 sejak aktivasi wave-2.

## 4) KPI & Guardrail

### KPI Operasional
- Error API 5xx tidak meningkat signifikan vs baseline pilot.
- Queue/backlog approval tetap dalam SLA internal.
- Tidak ada penumpukan posting AP/AR/payroll yang menunda close harian.

### KPI Integritas Finansial
- Jurnal `POSTED` tetap balance.
- Aging AP/AR konsisten dengan ledger pada recon siang + sore.
- Payroll close period tidak gagal berulang.

### Trigger NO-GO / Partial Rollback
- Ada major incident finansial (double post/loss/data corruption).
- Ada mismatch aging vs ledger yang tidak terkendali > 1 siklus harian.
- Payroll close gagal berulang tanpa workaround aman.

## 5) Ritme Operasi Rollout

- 09:00: health-check service + flag scope audit.
- 13:00: recon SQL + triage mismatch.
- 17:00: recon SQL + daily incident summary + risk update.
- 20:00 (opsional saat wave aktif): quick checkpoint war-room.

## 6) Stabilization H+1 s/d H+3

- Pertahankan monitoring dan recon 2x/hari.
- Tutup seluruh incident severity tinggi/major.
- Validasi ulang sampel transaksi AP, AR, payroll close pada branch berbeda.
- Bekukan perubahan skema/process sampai status stabil.

## 7) Exit & Handover Criteria

Rollout dianggap selesai jika:

- Tidak ada major incident terbuka.
- Recon mismatch kritikal = 0 atau sudah accepted dengan RCA + ETA fix.
- Sign-off lintas owner lengkap.
- Post go-live handover checklist Sprint 4 telah selesai.

## 8) Sign-off

- Engineering Lead:
- Finance Lead:
- Payroll Lead:
- QA Lead:
- Ops Lead:
- Final decision: PASS / CONDITIONAL PASS / NO-GO
- Date:
- Notes:


## 9) Artefak Wajib Selama Next Phase

Pastikan dua dokumen ini aktif dipakai selama rollout:

- `wave-rollout-tracker-template.md` untuk tracking cohort, checkpoint, dan keputusan wave.
- `gate-decision-minutes-template.md` untuk notulen resmi GO/NO-GO.


## 10) Closure Output Setelah Stabilization

Di akhir H+3, publish:

- `h-plus-3-stabilization-report-template.md` (status stabilisasi resmi).
- Ringkasan ke stakeholder menggunakan `stakeholder-communication-template.md`.


## 11) Governance Check Sebelum BAU

Sebelum handover, nilai readiness memakai:

- `next-phase-72h-execution-plan.md` untuk tracking eksekusi H+0..H+72.
- `governance-readiness-scorecard.md` untuk keputusan readiness BAU.
