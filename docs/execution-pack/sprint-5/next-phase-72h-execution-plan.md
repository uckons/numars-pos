# Sprint 5 — Next Phase 72h Execution Plan

Dokumen ini dipakai untuk mengeksekusi fase awal Sprint 5 secara cepat setelah kickoff.
Fokus 72 jam pertama: stabilkan reliability baseline, aktifkan recon automation, dan lock alert governance.

## Target 72 Jam

- P0 hardening backlog mulai dieksekusi (minimal 2 item aktif).
- Recon automation berjalan untuk slot siang dan sore.
- SLO/SLI draft disepakati sementara oleh Eng + Ops.
- Escalation policy untuk Sev-1/Sev-2 aktif dan teruji.

## H+0 s/d H+24

1. Lock owner matrix untuk hardening, recon, dan alerting.
2. Jalankan `npm run recon:sprint4 -- --dry-run` sebagai validasi job.
3. Tentukan baseline KPI harian:
   - API availability
   - Queue latency p95
   - Mismatch count
   - Payroll close failure count
4. Publish daily status #1 (risiko + blocker + action owner).

## H+24 s/d H+48

1. Implementasi hardening batch-1 (P0).
2. Aktifkan recon job siang/sore (manual trigger atau scheduler sementara).
3. Verifikasi alert routing untuk Sev-1/Sev-2 (war-room drill singkat).
4. Publish daily status #2 + update RCA prevention tracker.

## H+48 s/d H+72

1. Review dampak hardening awal terhadap KPI baseline.
2. Lock draft SLO/SLI + alert threshold sementara.
3. Putuskan lanjut batch-2 atau hold untuk perbaikan residual.
4. Publish daily status #3 + keputusan next-step.

## Artefak Wajib

- `task-board-harian.md` (update progres D1–D3).
- `hardening-backlog.md` (status Planned -> In Progress).
- `slo-sli-and-alert-policy.md` (target sementara terisi).
- `recon-automation-plan.md` (status run evidence).
- `rca-prevention-tracker.md` (item incident/prevention terisi).

## Go/No-Go Checkpoint (akhir H+72)

### GO jika
- P0 batch-1 berjalan tanpa regression kritikal.
- Recon job produce evidence konsisten (>=2 siklus/hari).
- Tidak ada Sev-1 open > 4 jam.

### HOLD jika
- Terdapat mismatch kritikal berulang tanpa root cause jelas.
- Alert noise terlalu tinggi dan mengganggu operasi.
- Hardening batch-1 memicu regresi operasional utama.
