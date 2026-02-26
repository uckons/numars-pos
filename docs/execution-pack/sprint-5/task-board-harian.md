# Sprint 5 Task Board Harian (D1–D10)

## D1 — Sprint 5 Kickoff & Scope Lock
- Finalisasi objective Sprint 5 (reliability, hardening, BAU optimization).
- Lock owner matrix lintas fungsi (Eng, Ops, QA, Finance).
- Output: scope baseline + timeline + owner map.

## D2 — Incident Recurrence Analysis
- Kumpulkan top recurring incidents dari Sprint 4.
- Kelompokkan akar masalah: infra, app logic, process gap.
- Output: shortlist 10 hardening item prioritas.

## D3 — Hardening Design
- Definisikan perbaikan idempotency, retry policy, timeout, queue handling.
- Definisikan mekanisme dead-letter / replay strategy.
- Output: technical design hardening v1.

## D4 — Recon Automation Design
- Mapping query recon manual ke job otomatis.
- Definisikan alerting mismatch (severity + routing).
- Output: recon automation plan + SLA matrix.

## D5 — SLO/SLI Draft
- Tetapkan SLO API, queue, payroll close, recon freshness.
- Tentukan SLI dan threshold alert.
- Output: draft SLO/SLI dan policy alert.

## D6 — Implementation Batch-1
- Implement hardening prioritas tinggi (batch-1).
- Tambah logging/audit field yang diperlukan troubleshooting.
- Output: PR batch-1 + smoke test evidence.

## D7 — Implementation Batch-2
- Lanjut item hardening menengah + recon automation increment.
- Integrasi alert channel dengan on-call process.
- Output: PR batch-2 + runbook update.

## D8 — QA, Chaos-lite, and Drill
- Jalankan skenario failure terkontrol (chaos-lite).
- Verifikasi rollback/runbook dapat dieksekusi cepat.
- Output: drill report + gap list final.

## D9 — UAT Operasional BAU+
- Validasi bersama Ops/Finance pada beban operasional normal.
- Pastikan alert & escalation bekerja end-to-end.
- Output: sign-off operasional.

## D10 — Sprint 5 Closure Gate
- Review KPI improvement vs baseline Sprint 4.
- Putuskan PASS / CONDITIONAL PASS / EXTEND.
- Output: closure minutes + next-sprint carry-over.
