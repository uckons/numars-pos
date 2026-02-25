# Sprint 3 Execution Pack — Manual Journal + Recurring + Approval

Sprint 3 berfokus ke penguatan kontrol akuntansi operasional: entry jurnal manual yang terkontrol, recurring journal template, dan approval flow yang jelas.

## Status Update

- Status saat ini: **CONDITIONAL PASS**.
- Keputusan: **lanjut pilot** (scope terbatas: 1 branch + 1 approver).
- Target close final: setelah **2–3 hari pilot** tanpa incident major.

## Scope Sprint 3

1. **Manual Journal Workflow**
   - Draft jurnal manual oleh role Accounting.
   - Validasi keseimbangan debit/kredit sebelum submit.
   - Submit ke state `PENDING_APPROVAL`.
2. **Approval Journal Workflow**
   - Reviewer approver dapat `APPROVE` / `REJECT`.
   - Setelah approve, jurnal masuk state `POSTED`.
   - Semua aksi approval wajib audit trail.
3. **Recurring Journal Template**
   - Template jurnal bulanan/mingguan.
   - Job generator membuat draft otomatis sesuai schedule.
   - Tetap memerlukan approval sebelum posting.

## Deliverables

- API contract v1 manual journal + recurring.
- Draft migration additive untuk tabel baru Sprint 3.
- UAT checklist end-to-end workflow.
- Task board harian D1–D10 agar eksekusi tim sinkron.
- Next phase plan (pilot -> full rollout): `phase-4-full-rollout-plan.md`.
- Pilot execution checklist 48 jam: `pilot-48h-operational-checklist.md`.

## Dependency

- Sprint 1 foundation accounting sudah aktif.
- Sprint 2 auto-journal POS tetap berjalan tanpa perubahan perilaku.
- Role matrix minimal:
  - `ACCOUNTING_STAFF`
  - `ACCOUNTING_APPROVER`
  - `SUPERADMIN`

## Rollout Plan

1. **Week 1 (Build + Internal QA)**
   - Finalisasi schema + endpoint + unit test.
2. **Week 2 (UAT + Pilot Branch)**
   - UAT bersama user accounting.
   - Pilot di 1 branch dengan volume terbatas.
3. **Week 3 (Stabilization)**
   - Perbaikan feedback UAT.
   - Aktifkan untuk seluruh branch setelah metrik stabil.

## Exit Criteria

- Semua UAT critical scenario status PASS.
- Tidak ada jurnal manual `POSTED` yang tidak balance.
- Approval trail lengkap (actor, action, timestamp, note).
- Recurring generator idempotent (tidak double-generate untuk periode sama).
- Pilot 2–3 hari berjalan tanpa incident major (loss data, double post, atau blocking operasional).

## Risk dan Mitigasi

- **Risk:** Approver terlambat memproses backlog draft.
  - **Mitigasi:** Tambah dashboard aging `PENDING_APPROVAL` + SLA.
- **Risk:** Template recurring salah akun nominal.
  - **Mitigasi:** Mandatory review sebelum template `ACTIVE`.
- **Risk:** Double-generate recurring saat retry job.
  - **Mitigasi:** Unique key (`template_id`, `period_key`) pada run table.
