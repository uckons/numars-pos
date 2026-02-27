# Sprint 6 Task Board Harian (D1–D10)

## Status Update Terbaru
- Sprint 6: **Completed (PASS) — Ready for Go-Live**.
- Fokus final: closure evidence lock + BAU handover.
- Next step: eksekusi go-live window + hypercare 72 jam.
- Evidence status: `next-phase-72h-status-2026-03-07.md`, `next-phase-h72-decision-2026-03-10.md`, `closure-gate-minutes-2026-03-12.md`.

## D1 — Kickoff Sprint 6
- Lock scope dan owner matrix (Eng, Ops, QA, Finance).
- Tetapkan baseline KPI dari akhir Sprint 5.
- Output: scope baseline + owner map.

## D2 — Capacity Baseline
- Audit bottleneck API, queue, DB.
- Definisikan target capacity per domain kritikal.
- Output: capacity baseline report.

## D3 — Design Batch-1
- Rancang tuning query/indexing + queue worker profile.
- Rancang dashboard observability v1.
- Output: design doc batch-1.

## D4 — Implement Batch-1
- Implement top-priority scale/hardening changes.
- Integrasi metric tambahan untuk KPI.
- Output: PR batch-1 + smoke evidence.

## D5 — Alert Policy v2
- Implement dedup + severity routing improvement.
- Validasi war-room notification policy.
- Output: alert policy v2 draft.

## D6 — Observability Dashboard
- Publish dashboard v1 (API, queue, recon, payroll).
- Validasi data freshness dan akurasi.
- Output: dashboard spec + live links.

## D7 — Implement Batch-2
- Lanjut tuning residual bottleneck.
- Stabilkan workload peak simulation.
- Output: PR batch-2.

## D8 — QA + Drill
- Chaos-lite + incident drill end-to-end.
- Verifikasi rollback path masih sesuai guardrails.
- Output: drill report.

## D9 — UAT Operasional
- UAT lintas fungsi untuk workflow BAU.
- Validasi trend KPI sesuai target Sprint 6.
- Output: sign-off operasional.

## D10 — Closure Gate Sprint 6
- Review exit criteria metric-based.
- Putuskan PASS / CONDITIONAL PASS / EXTEND.
- Output: closure minutes Sprint 6.
