# Sprint 4 Pilot & Go-Live Checklist

Checklist ini dipakai untuk fase pilot sampai go-live AP/AR/Payroll Staff v1.

## 1) Pilot Setup

- [ ] Scope pilot branch ditentukan.
- [ ] Approver Finance dan Payroll ditentukan.
- [ ] Feature flag AP/AR/payroll aktif hanya di pilot branch.
- [ ] Monitoring dashboard AP aging, AR aging, payroll run siap.

## 2) Pilot Validation (H+24 / H+48)

- [ ] AP invoice -> payment flow berjalan tanpa mismatch.
- [ ] AR invoice -> payment flow berjalan tanpa mismatch.
- [ ] Payroll run close sukses minimal 1 periode.
- [ ] Jurnal AP/AR/payroll `POSTED` tetap balance.
- [ ] Tidak ada incident major data integrity.

## 3) Go/No-Go Gate

### GO jika
- [ ] 48–72 jam pilot tanpa incident major.
- [ ] Aging AP/AR konsisten dengan ledger.
- [ ] Sign-off Finance + Payroll + QA + Engineering.

### NO-GO jika
- [ ] Ada issue finansial kritikal (double post/loss).
- [ ] Payroll close period gagal berulang tanpa workaround aman.
- [ ] Mismatch aging/ledger tidak terkendali.

## 4) Wave Rollout

- [ ] Wave-1 (30–40% branch) aktif.
- [ ] Monitor 24 jam + recon 2x/hari.
- [ ] Wave-2 (sisa branch) aktif jika stabil.
- [ ] H+3 stabilization dan handover operasi.

## 5) Final Sign-off

- Engineering Lead:
- Finance Lead:
- Payroll Lead:
- QA Lead:
- Final result: PASS / CONDITIONAL PASS / FAIL
- Notes:
