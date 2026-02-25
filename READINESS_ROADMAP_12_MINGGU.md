# Readiness Roadmap 12 Minggu (Sprint-by-Sprint)

Dokumen ini memetakan kebutuhan target berikut ke rencana delivery 12 minggu tanpa mengganggu operasional POS:

- Accounting Standard POS (GL, journal, AP, AR, bank reconciliation, approval).
- Payroll Staff (gaji pokok sampai slip PDF + auto jurnal).
- Payroll Terapis fleksibel (rule engine: % komisi / % omzet / flat / hybrid).
- Payroll Agent Terapis (model fee fleksibel + auto jurnal + approval).
- Multi Outlet enterprise (transfer stok, transfer kas, konsolidasi HQ).
- Real-time dashboard owner (KPI lengkap).
- Formula Engine (editable tanpa coding + validation + history + approval).
- Approval matrix + audit trail komprehensif.
- Integrasi visualisasi ApexCharts.

---

## Prinsip Implementasi Agar POS Tetap Jalan

1. **Expand-Contract Migration**
   - Tahap 1: tambah tabel/kolom/index baru (non-breaking).
   - Tahap 2: dual-write dari service lama ke skema baru.
   - Tahap 3: backfill data historis per batch.
   - Tahap 4: switch read path bertahap via feature flag.
   - Tahap 5: cleanup kolom/tabel lama setelah stabil.

2. **Zero-Downtime First**
   - Tidak rename/drop kolom kritikal di jam operasional.
   - Semua DDL berat dijalankan off-peak.
   - Index besar dibuat `CONCURRENTLY` (Postgres) untuk menghindari lock panjang.

3. **Feature Flag + Role Gate**
   - Fitur baru (GL/AP/AR/Payroll) dibuka per role dan per outlet pilot.
   - Fallback cepat ke mode lama jika error rate naik.

4. **Auditability by Default**
   - Semua action sensitif (approve/reject/edit) wajib jejak audit.

---

## Sprint Plan (12 Minggu)

> Asumsi: 6 sprint × 2 minggu.

| Sprint | Fokus | Deliverable Fungsional | Deliverable Teknis | Exit Criteria |
|---|---|---|---|---|
| **Sprint 1 (M1-M2)** | **Foundation & Architecture Lock** | Dokumen scope final + matriks requirement → modul | Skema inti accounting v1 (COA, journal header/line draft), tabel approval generik, tabel formula versions draft | Semua ERD disetujui; migration non-breaking lolos staging |
| **Sprint 2 (M3-M4)** | **Accounting Core (GL + Auto Journal POS)** | Auto jurnal dari transaksi POS (payment/revert/commission settle) | Posting engine (journal service), mapping akun per event, idempotency key posting | Trial balance harian seimbang (debit=credit), tanpa ganggu flow kasir |
| **Sprint 3 (M5-M6)** | **Manual & Recurring Journal + Approval Matrix v1** | Manual journal entry (draft→submit→approve→post), recurring template | Workflow approval (maker-checker), audit enrichment, scheduler recurring | Manual journal & recurring berjalan di outlet pilot |
| **Sprint 4 (M7-M8)** | **AP/AR + Payroll Staff v1** | AP: supplier invoice, aging, payment voucher; AR: corporate/member credit; Payroll staff komponen dasar + auto jurnal | Tabel AP/AR, terms, ledger linkage; payroll run table, formula fixed component, PDF slip generator | AP/AR aging akurat; payroll staff bisa close period 1x sukses |
| **Sprint 5 (M9-M10)** | **Payroll Terapis + Payroll Agent Flexible Engine** | 4 model payroll terapis (% komisi / % omzet / flat / hybrid), 4 model payroll agent (share komisi / share omzet / flat per terapis / hybrid), admin bisa edit formula tanpa coding | Formula parser + validator variabel + version history + approval perubahan formula; settlement service terpisah terapis vs agent | Simulasi payroll 3 skenario lolos; perhitungan terapis & agent konsisten; perubahan formula tercatat & ter-approve |
| **Sprint 6 (M11-M12)** | **Multi Outlet Enterprise + Dashboard Owner + Reconciliation** | Transfer stock antar outlet, transfer kas antar outlet, HQ consolidated report, bank reconciliation, dashboard KPI lengkap (ApexCharts), ranking performa agent | Tabel transfer, rekonsiliasi statement matcher, materialized view KPI, optimisasi query | Owner dashboard KPI utama real-time stabil; close bulan multi-outlet berhasil |

---

## Mapping Requirement → Sprint

| Requirement | Sprint Target |
|---|---|
| General Ledger + auto jurnal POS | Sprint 2 |
| Manual journal + recurring journal | Sprint 3 |
| Approval edit/manual journal/payment limit/void | Sprint 3 (v1), Sprint 6 (v2 lengkap) |
| Account Payable (invoice, aging, voucher) | Sprint 4 |
| Account Receivable (corporate/member credit) | Sprint 4 |
| Payroll Staff (komponen + attendance + PDF + auto jurnal) | Sprint 4 (v1), Sprint 6 (integrasi lanjutan) |
| Payroll Terapis flexible engine | Sprint 5 |
| Payroll Agent Terapis flexible engine | Sprint 5 |
| Formula engine advanced | Sprint 5 |
| Multi outlet (separated + HQ consolidated + transfer) | Sprint 6 |
| Real-time dashboard owner + ApexCharts | Sprint 6 |
| Audit trail komprehensif | Sprint 3 onward |

---

## Urutan Migrasi Database Aman (Tanpa Ganggu POS)

## Wave A — Foundation (Sprint 1)
1. Tambah tabel baru:
   - `chart_of_accounts`
   - `journal_entries`
   - `journal_lines`
   - `approval_requests`
   - `formula_definitions`, `formula_versions`
2. Tambah kolom referensi ringan di tabel transaksi existing (nullable, default null).
3. Tambah index non-blocking.
4. Belum ada perubahan alur kasir.

**Catatan aman:** semua objek baru bersifat additive.

## Wave B — Dual-Write Accounting (Sprint 2)
1. Service payment/revert/commission menulis ke jalur lama **dan** jurnal baru.
2. Simpan `posting_status` + `idempotency_key` untuk hindari double posting.
3. Rekonsiliasi harian otomatis: compare total POS vs total jurnal.

**Catatan aman:** read path report tetap lama; write path baru berjalan paralel.

## Wave C — Approval + Recurring (Sprint 3)
1. Tambah tabel:
   - `journal_recurring_templates`
   - `journal_recurring_runs`
2. Tambah kolom state machine:
   - `journal_entries.status` (`DRAFT/SUBMITTED/APPROVED/POSTED/REJECTED`)
3. Tambah audit payload detail untuk action approval.

**Catatan aman:** modul baru isolated dari POS checkout.

## Wave D — AP/AR + Payroll Staff (Sprint 4)
1. AP tables:
   - `vendors`, `ap_invoices`, `ap_invoice_lines`, `ap_payments`
2. AR tables:
   - `customers`, `ar_invoices`, `ar_payments`, `credit_limits`
3. Payroll staff tables:
   - `staff_payroll_runs`, `staff_payroll_items`, `staff_attendance_imports`
4. Ledger link (`journal_entry_id`) di semua dokumen finansial.

**Catatan aman:** ingest awal dilakukan per outlet pilot dulu.

## Wave E — Therapist Formula Engine (Sprint 5)
1. Tambah tabel:
   - `payroll_rule_sets`, `payroll_rule_versions`, `payroll_calculation_runs`
   - `agent_payroll_settlements`, `agent_payroll_run_items`
2. Simpan snapshot input variabel + hasil evaluasi formula per run.
3. Approval wajib untuk aktivasi versi formula.
4. Pisahkan ledger posting payroll terapis vs payroll agent (agar report margin per channel akurat).

**Catatan aman:** rollout bertahap per branch; fallback ke formula fixed jika evaluator gagal.

## Wave F — Multi-Outlet + Reconciliation (Sprint 6)
1. Tambah tabel transfer:
   - `stock_transfer_headers`, `stock_transfer_lines`
   - `cash_transfer_headers`
2. Tambah bank recon:
   - `bank_accounts`, `bank_statements`, `bank_statement_lines`, `bank_recon_matches`
3. Tambah materialized views KPI HQ + index refresh schedule.

**Catatan aman:** transfer & recon tidak menyentuh transaksi kasir real-time secara blocking.

---

## Strategi Rollout Produksi

1. **Pilot outlet**: 1 outlet kecil selama 1 minggu/sprint.
2. **Canary role**: akses awal hanya Owner/Manager.
3. **Observability wajib**:
   - error rate endpoint baru,
   - latency query report,
   - mismatch debit/credit,
   - mismatch settlement payroll.
4. **Rollback plan**:
   - feature flag OFF,
   - stop recurring job,
   - disable posting baru,
   - tetap simpan data yang sudah tertulis (no destructive rollback).

---

## KPI Go-Live per Domain

- **Accounting**: 0 transaksi unbalanced; closing bulanan < 2 jam.
- **AP/AR**: aging report variance < 1% vs cek manual.
- **Payroll Staff**: 100% slip gaji ter-generate, jurnal payroll auto-post.
- **Payroll Terapis**: semua model formula menghasilkan output konsisten di test case.
- **Payroll Agent**: settlement agent 100% traceable per periode dengan approval + jurnal otomatis.
- **Multi Outlet**: transfer stok/kas memiliki status lifecycle lengkap + approval.
- **Dashboard**: KPI owner refresh near-real-time dan sinkron dengan ledger.

---

## Backlog Non-Fungsional Wajib (Paralel)

- Hardening permission RBAC per aksi approval.
- Data retention & archive untuk audit logs.
- Performance budget query dashboard + indexing berkala.
- Contract test antar modul (POS ↔ Accounting ↔ Payroll).
- Runbook incident (jurnal mismatch, stuck approval, gagal settlement).

---

## Output yang Direkomendasikan Setelah 12 Minggu

1. POS tetap stabil operasional.
2. Accounting standard siap audit internal.
3. Payroll staff, payroll terapis, dan payroll agent berjalan dengan engine yang bisa diatur.
4. Multi-outlet enterprise (transfer + konsolidasi) aktif.
5. Dashboard owner lengkap dengan ApexCharts sebagai lapisan visual.
