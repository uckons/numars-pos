# Multi-Outlet Enterprise — Active Criteria Checklist (PASS/FAIL)

Dokumen ini dipakai sebagai checklist objektif untuk menyatakan fitur **Multi-outlet enterprise (transfer + konsolidasi)** sudah aktif atau belum.

## Cara Pakai

- Setiap item harus punya bukti (`endpoint`, `UI`, `log`, `query`, atau `dokumen`), lalu diberi status **PASS** atau **FAIL**.
- Status final hanya bisa dinyatakan **ACTIVE** jika seluruh item kategori kritikal (API, posting, RBAC, reconciliation) sudah PASS.
- Kategori dashboard/reporting boleh bertahap, namun item minimum harus PASS sebelum go-live multi-outlet.

## A. API (Transfer + Consolidation)

| No | Kriteria | Bukti Minimum | Status |
|---|---|---|---|
| API-01 | Endpoint create transfer antar outlet tersedia (`POST`) | OpenAPI/route + contoh request/response | FAIL |
| API-02 | Endpoint approve/reject transfer tersedia | Route + audit trail action | FAIL |
| API-03 | Endpoint list transfer per status/periode tersedia | Pagination + filter branch | FAIL |
| API-04 | Endpoint consolidation report (cross-outlet) tersedia | Route report + sample output | FAIL |

## B. UI (Operational)

| No | Kriteria | Bukti Minimum | Status |
|---|---|---|---|
| UI-01 | Form transfer antar outlet tersedia di dashboard accounting | Screenshot + QA notes | FAIL |
| UI-02 | Approval queue transfer tersedia | Screenshot queue + state badge | FAIL |
| UI-03 | Halaman consolidation report tersedia | Screenshot + filter period/outlet | FAIL |
| UI-04 | Empty/loading/error state rapi | UX checklist | PARTIAL |

## C. Posting & Accounting Integrity

| No | Kriteria | Bukti Minimum | Status |
|---|---|---|---|
| POST-01 | Transfer menghasilkan jurnal berpasangan (outlet asal/tujuan) | Journal entries linked by source_ref | FAIL |
| POST-02 | Mapping COA transfer + due-to/due-from tervalidasi | Posting rules + sample journal | FAIL |
| POST-03 | Idempotency posting (no duplicate journal) | Retry test evidence | FAIL |
| POST-04 | Reversal/cancel transfer membuat reversal journal valid | Reversal test evidence | FAIL |

## D. Consolidation Report Quality

| No | Kriteria | Bukti Minimum | Status |
|---|---|---|---|
| CONS-01 | Eliminasi transaksi antar-outlet (intercompany elimination) | Reconciliation worksheet | FAIL |
| CONS-02 | Trial balance consolidated balance (debit=credit) | Report snapshot + SQL check | FAIL |
| CONS-03 | Per-outlet drilldown ke transaksi sumber | Drilldown endpoint/UI evidence | FAIL |
| CONS-04 | Export (CSV/XLS/PDF) untuk finance review | Export artifact | FAIL |

## E. RBAC, Governance, Audit

| No | Kriteria | Bukti Minimum | Status |
|---|---|---|---|
| RBAC-01 | Role matrix jelas (create/approve/view/export) | Matrix doc + middleware mapping | PARTIAL |
| RBAC-02 | Semua aksi kritikal tercatat di audit log | Audit log sample | PARTIAL |
| RBAC-03 | Approval threshold lintas outlet diterapkan | Rule doc + test | FAIL |
| RBAC-04 | Feature flag rollout per outlet tersedia | ENV flag + rollout record | PARTIAL |

## F. Reconciliation & Operability

| No | Kriteria | Bukti Minimum | Status |
|---|---|---|---|
| RECON-01 | Recon harian mencakup transfer + elimination mismatch | Recon job output | FAIL |
| RECON-02 | Alert mismatch terkirim ke channel ops | Alert sample | FAIL |
| RECON-03 | Runbook incident khusus transfer/consolidation tersedia | Runbook link | FAIL |
| RECON-04 | SLA penanganan mismatch didefinisikan | SLA doc + owner | PARTIAL |

## G. Dashboard Visual (ApexCharts) — Cukup atau Tidak?

Jika dashboard accounting diposisikan sebagai **modul operasional**, chart sudah dianggap **cukup** bila item minimum ini PASS:

| No | Kriteria Minimum Chart Operasional | Status |
|---|---|---|
| DASH-01 | Trend KPI utama (revenue, volume, error/mismatch) | PASS |
| DASH-02 | Breakdown kategori/outlet | PASS |
| DASH-03 | Drilldown tabel transaksi sumber | PASS |
| DASH-04 | Fallback state saat chart lib unavailable | PASS |
| DASH-05 | Chart khusus multi-outlet transfer & elimination | FAIL |

Catatan: status saat ini menunjukkan chart umum operasional sudah ada, namun chart spesifik multi-outlet transfer/eliminasi belum tersedia.

## Rekomendasi Gate Decision

- **Saat ini:** `NOT ACTIVE` untuk Multi-outlet enterprise (transfer + konsolidasi).
- **Syarat naik ke ACTIVE:** seluruh item kritikal API/POST/RBAC/RECON minimal PASS, lalu CONS minimum 3/4 PASS.
