# Sprint 4 — UI Gap Assessment (AP/AR/Payroll Staff)

Assessment ini menjawab pertanyaan: apakah perlu perubahan UI karena UI belum full?

## Kesimpulan Singkat

**Ya, perlu perubahan UI tambahan** untuk Sprint 4 AP/AR/Payroll Staff supaya alur operasional end-to-end bisa dijalankan tanpa bergantung penuh ke API/manual script.

## Temuan Current State

1. Router saat ini belum menunjukkan route khusus modul AP/AR/payroll-staff.
2. Dashboard Manager masih fokus ke report umum + payroll terapis (bukan payroll staff v1).
3. Belum ada layar operasional khusus untuk:
   - AP invoice create/submit/payment
   - AR invoice create/receive payment/aging
   - Payroll staff run/close/review period

## Dampak Operasional

- Pilot dan wave rollout bisa jalan di backend, tapi user Finance/Payroll belum punya UI yang lengkap untuk operasi harian.
- Risiko ketergantungan ke query/manual endpoint meningkat saat incident response.
- Evidencing dan audit trail menjadi lebih lambat karena data tersebar lintas menu/tool.

## Prioritas Perubahan UI (Disarankan)

### P0 (Wajib sebelum ekspansi besar)

1. **AP Workspace**
   - Form invoice + line item + due date/terms
   - Submit/approve/payment action
   - Status & aging ringkas per branch
2. **AR Workspace**
   - Form credit invoice
   - Receive payment + outstanding check
   - AR aging per customer
3. **Payroll Staff Workspace**
   - Create run period
   - Preview komponen fixed
   - Close period + lihat hasil posting

### P1 (Wajib sebelum BAU handover)

1. Approval queue terpadu (AP/AR/payroll critical actions)
2. Incident ribbon/banner di halaman terkait saat flag rollback/hold aktif
3. Export evidence (CSV/PDF) untuk gate meeting

### P2 (Nice-to-have)

1. Dashboard lintas modul AP/AR/payroll dengan trend + anomaly cards
2. Drill-down jurnal dari setiap dokumen transaksi

## Rencana Eksekusi UI 2 Sprint (Ringkas)

- Sprint A:
  - AP workspace + AR workspace minimal
  - Hook ke feature flag pilot-only
- Sprint B:
  - Payroll staff workspace + approval queue terpadu
  - Export evidence + stabilization UX polish

## Acceptance Criteria UI Minimum

- User Finance dapat menyelesaikan AP invoice -> payment tanpa pindah tool.
- User Finance dapat menyelesaikan AR invoice -> payment tanpa query manual.
- User Payroll dapat menjalankan close payroll staff minimal 1 periode dari UI.
- Semua aksi kritikal menampilkan status posting dan audit metadata.
