# Sprint 1 Execution Pack — Foundation & Architecture Lock

Paket ini adalah breakdown eksekusi operasional untuk Sprint 1 (2 minggu) dari `READINESS_ROADMAP_12_MINGGU.md`.

## Objective Sprint 1

- Lock scope dan arsitektur untuk Accounting Standard POS, approval matrix, formula engine, payroll (staff/terapis/agent), dan multi-outlet.
- Menyiapkan baseline database **non-breaking** agar Sprint 2 bisa langsung implement auto-journal POS.

## Deliverables Sprint 1

1. **Scope & Governance**
   - Scope freeze + change control policy.
   - RACI lintas owner/manager/finance/engineering.
2. **Architecture Pack**
   - Event-to-journal map v1 (payment/revert/commission/payroll-settlement).
   - Approval workflow matrix v1.
   - Formula variable dictionary v1.
3. **Data Foundation (Wave A)**
   - Migration additive: COA, journals, approvals, formula versioning.
   - Index baseline untuk query kritikal.
4. **Operational Safety**
   - Feature flags naming standard.
   - Rollback runbook v1.
   - Pilot outlet readiness checklist.

## Sprint Backlog (Template Ticket)

| ID | Epic | Task | Owner | Estimate | Acceptance Criteria |
|---|---|---|---|---|---|
| S1-01 | Governance | Scope freeze workshop + signoff | PM/PO | 1d | Dokumen scope approved semua stakeholder |
| S1-02 | Governance | Definisikan change policy (minor/major) | PM | 0.5d | Policy dipublish di repo/wiki |
| S1-03 | Accounting | Draft COA structure level 1-4 | Finance + BE | 1.5d | COA tree v1 approved |
| S1-04 | Accounting | Event-to-journal mapping matrix v1 | Finance + BE | 2d | Semua event POS prioritas punya debit/kredit mapping |
| S1-05 | Approval | Approval matrix v1 (void, journal, payroll, payment-limit) | PM + BE | 1d | Matrix punya role, SLA, escalation |
| S1-06 | Formula | Formula variable dictionary v1 | BE + Product | 1d | Variabel valid/invalid terdefinisi |
| S1-07 | DB | Implement migration 007 (foundation tables) | BE/DBA | 1d | SQL sukses di staging tanpa downtime |
| S1-08 | Platform | Feature flag namespace + default OFF | BE | 0.5d | Flags terdokumentasi + dapat di-toggle |
| S1-09 | QA | Smoke test POS core pasca migration | QA | 1d | Checkout POS tetap normal |
| S1-10 | Ops | Rollback runbook + dry run | DevOps/BE | 1d | Drill rollback selesai dengan bukti log |

## Definition of Done (Sprint 1)

- Semua artefak S1-01 s/d S1-10 selesai dan disetujui.
- Migration 007 berhasil di staging + smoke test POS PASS.
- Tidak ada query lock berat pada jam operasional simulasi.
- Flag default untuk modul baru = OFF.

## Ceremonies (Recommended)

- **Day 1:** planning + scope freeze.
- **Day 3:** architecture review gate.
- **Day 6:** migration review gate.
- **Day 8:** staging dry-run.
- **Day 10:** sprint review + go/no-go Sprint 2.

## Dependencies

- Ketersediaan finance lead untuk validasi COA + posting rules.
- Akses staging database setara produksi.
- PIC owner/manager untuk approval matrix signoff.

## Risks & Mitigation

- **Risk:** scope creep dari modul advanced.
  - **Mitigation:** gunakan change policy; yang tidak critical dipindah Sprint 2+.
- **Risk:** lock table saat migration.
  - **Mitigation:** additive DDL only + eksekusi off-peak + observasi lock.
- **Risk:** mismatch mapping jurnal.
  - **Mitigation:** event-to-journal walkthrough dengan finance sebelum coding.
