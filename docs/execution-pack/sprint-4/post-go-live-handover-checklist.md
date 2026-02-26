# Sprint 4 — Post Go-Live Handover Checklist

Checklist ini dipakai setelah wave rollout selesai dan masuk fase BAU (business as usual).

## 1) Operational Handover

- [ ] Ownership runbook dipindah ke tim operasi harian.
- [ ] Jadwal recon SQL 2x/hari final (jam + PIC + backup).
- [ ] Escalation matrix incident dan kontak war-room dikunci.
- [ ] Dashboard AP aging, AR aging, payroll run diserahkan ke owner bisnis.

## 2) Data Integrity Closure

- [ ] Tidak ada jurnal `POSTED` unbalanced pada window H+3.
- [ ] Tidak ada mismatch aging AP/AR yang unresolved kritikal.
- [ ] Tidak ada payroll close gagal berulang yang unresolved.
- [ ] Semua incident major punya RCA + action owner + due date.

## 3) Product & Process Closure

- [ ] Keputusan final feature-flag strategy didokumentasikan (tetap gated / default ON).
- [ ] SOP maker-checker AP/AR/payroll dipublikasikan ke user terkait.
- [ ] Known limitations + workaround diperbarui.
- [ ] Improvement backlog Sprint berikutnya diprioritaskan.

## 4) Documentation Closure

- [ ] Pilot Control Sheet diarsipkan beserta evidence referensi.
- [ ] Task board Sprint 4 ditutup dengan tanggal final.
- [ ] Dokumen next-phase dan handover diberi versi + tanggal efektif.
- [ ] Ringkasan final PASS/COND PASS/NO-GO dipublikasikan (gunakan `stakeholder-communication-template.md`).
- [ ] Governance readiness scorecard dihitung dan diarsipkan (`governance-readiness-scorecard.md`).

## 5) Sign-off

- Engineering Lead:
- Finance Lead:
- Payroll Lead:
- QA Lead:
- Ops Lead:
- Final status: PASS / CONDITIONAL PASS / FAIL
- Date:
- Notes:
