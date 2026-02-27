# Sprint 6 — Next Phase 72h Execution Plan

Dokumen ini dipakai untuk eksekusi cepat 72 jam awal Sprint 6.
Fokus: lock baseline kapasitas, jalankan batch-1 tuning, dan aktifkan observability v1.

## Target 72 Jam

- 3 item P0 backlog masuk status **In Progress**.
- Baseline KPI capacity/latency terdokumentasi.
- Alert policy v2 draft tervalidasi awal.
- Dashboard observability v1 siap dipakai untuk review harian.

## H+0 s/d H+24

1. Lock owner matrix Sprint 6 (Eng/Ops/QA/Finance).
2. Capture baseline KPI:
   - API p95 latency
   - Queue backlog peak
   - Error rate API
3. Publish daily status #1 + daftar bottleneck awal.

## H+24 s/d H+48

1. Implement batch-1 tuning untuk P0 (API, Queue, DB).
2. Jalankan smoke validation pada jam operasional normal.
3. Draft alert-policy v2 dengan threshold sementara.
4. Publish daily status #2 + residual risk.

## H+48 s/d H+72

1. Publish observability dashboard v1.
2. Review dampak tuning terhadap KPI baseline.
3. Putuskan GO/HOLD untuk lanjut batch-2.
4. Publish daily status #3 + keputusan H+72.

## Artefak Wajib

- `task-board-harian.md`
- `scale-hardening-backlog.md`
- `alert-policy-v2.md`
- `observability-dashboard-spec.md`
- `capacity-tuning-plan.md`

## Checkpoint H+72

### GO jika
- Tidak ada regression kritikal (Sev-1 open).
- KPI p95 latency menunjukkan perbaikan awal.
- Queue backlog peak dalam threshold sementara.

### HOLD jika
- Ada regression kritikal akibat tuning.
- Alert noise meningkat signifikan.
- KPI utama tidak membaik / memburuk.
