# Sprint 3 Task Board Harian (D1–D10)

## D1 — Kickoff & Final Scope
- Finalisasi scope dan acceptance criteria Sprint 3.
- Sinkron role matrix Accounting vs Approver.
- Output: dokumen scope final + owner list.

## D2 — Database Migration Draft
- Buat tabel manual journal headers/lines.
- Buat tabel recurring template + recurring runs.
- Tambah index untuk query status + tanggal.
- Output: SQL migration draft siap review.

## D3 — API Skeleton Backend
- Endpoint create/list/detail manual journal.
- Endpoint submit/approve/reject.
- Endpoint CRUD recurring template.
- Output: route + service skeleton + auth guard.

## D4 — Validation Rules
- Validasi debit/kredit balance.
- Validasi account aktif dan branch scope.
- Validasi transisi state (draft → pending → posted/rejected).
- Output: reusable validator + unit test awal.

## D5 — Approval & Audit Trail
- Implement action log approval.
- Simpan actor, note, old_status, new_status.
- Lock edit ketika status `PENDING_APPROVAL`/`POSTED`.
- Output: audit trail siap ditrace.

## D6 — Recurring Generator Job
- Job scan template `ACTIVE` sesuai schedule.
- Generate draft jurnal periodik.
- Idempotency guard untuk periode yang sama.
- Output: job command + dry-run mode.

## D7 — Frontend Integration (Jika diperlukan)
- Form manual journal draft.
- List approval queue dan action approve/reject.
- List recurring template.
- Output: UI terhubung API staging.

## D8 — QA Internal
- Test skenario happy path + negative path.
- Verify audit trail dan status transition.
- Verify job recurring tidak duplicate.
- Output: daftar bug + severity.

## D9 — UAT Accounting
- Jalankan UAT checklist bersama user accounting.
- Kumpulkan feedback UX + policy.
- Output: sign-off/temuan UAT.

## D10 — Pilot Release
- Deploy ke pilot branch.
- Monitoring error rate + backlog pending approval.
- Status saat ini: **CONDITIONAL PASS**, lanjut pilot.
- Target close final: 2–3 hari pilot tanpa incident major sebelum go/no-go rollout luas.

---

## Definisi Done (Sprint)
- Migration aman dijalankan tanpa downtime signifikan.
- API contract konsisten dengan implementasi.
- UAT critical PASS.
- Runbook rollback tersedia.

## D11 — Go/No-Go Gate
- Review hasil monitoring pilot 2–3 hari.
- Validasi KPI operasional + KPI akuntansi terhadap threshold.
- Output: keputusan GO / NO-GO terdokumentasi.

## D12 — Wave Rollout
- Jika GO: aktifkan wave-1 branch (30–40%).
- Monitor 24 jam sebelum wave-2.
- Output: status rollout per wave + isu terbuka.

## D13 — Final Close
- Konfirmasi rollout penuh dan stabil H+3.
- Finalisasi sign-off Engineering + Finance + QA.
- Output: Sprint 3 status final PASS.

## D14 — GO Live Wave-1
- Eksekusi runbook rollout wave-1 (30–40% branch).
- Monitor 24 jam + recon 2x/hari.
- Output: keputusan lanjut wave-2 / hold.

## D15 — GO Live Wave-2 & Stabilization
- Rollout ke sisa branch jika wave-1 stabil.
- Stabilization H+1 s/d H+3 dan penutupan isu prioritas tinggi.
- Output: final close Sprint 3 = PASS.

## D16 — Post Go-Live Handover
- Jalankan handover checklist ke tim operasi.
- Pastikan evidence pack lengkap dan sign-off lintas fungsi.
- Output: transisi proyek -> operasi harian selesai.
