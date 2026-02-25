# Sprint 3 — Pilot 48 Jam Operational Checklist

Checklist ini dipakai setelah status `CONDITIONAL PASS` untuk memastikan keputusan GO/NO-GO berbasis data selama 2–3 hari pilot.

## 1) Scope Pilot

- Branch pilot:
- Approver pilot:
- Start time:
- End time target (H+48/H+72):

## 2) Pre-Flight (H-0)

- [ ] Feature flag accounting aktif hanya untuk branch pilot.
- [ ] Role `ACCOUNTING_STAFF` dan `ACCOUNTING_APPROVER` tervalidasi.
- [ ] Recon script dan alert webhook aktif.
- [ ] Baseline metrik dicatat (error rate, backlog approval, mismatch recon).
- [ ] Channel incident ditunjuk (PIC Engineering + PIC Finance).

## 3) Monitoring Window

## H+12

- [ ] Tidak ada incident major.
- [ ] Queue `PENDING_APPROVAL` masih dalam SLA.
- [ ] Tidak ada duplicate posting dari event POS/payment/revert.
- [ ] Selisih recon harian = 0 atau ada RCA sementara.
- Catatan:

## H+24

- [ ] Tidak ada incident major.
- [ ] Error API accounting stabil.
- [ ] Audit trail submit/approve/reject lengkap.
- [ ] Tidak ada jurnal `POSTED` tidak balance.
- Catatan:

## H+48

- [ ] Tidak ada incident major.
- [ ] Rekonsiliasi terkendali dan terdokumentasi.
- [ ] Backlog approval dalam SLA.
- [ ] Semua issue medium/high punya owner + ETA.
- Catatan:

## 4) Go/No-Go Decision Gate

### GO jika:
- [ ] 48–72 jam tanpa incident major.
- [ ] KPI operasional dan akuntansi sesuai target.
- [ ] Sign-off Engineering + Finance + QA lengkap.

### NO-GO jika:
- [ ] Ada incident major atau data integrity belum aman.
- [ ] Rekonsiliasi belum terkendali.
- [ ] Backlog approval melewati SLA > 1 hari.

## 5) Rollout Execution (Jika GO)

- [ ] Wave-1 aktif (30–40% branch).
- [ ] Monitor 24 jam, recon 2x/hari.
- [ ] Wave-2 aktif (sisa branch) jika wave-1 stabil.
- [ ] H+3 post-rollout review dan final PASS.

## 6) Sign-off

- Engineering Owner:
- Finance Owner:
- QA Owner:
- Keputusan final: GO / NO-GO
- Tanggal:
- Catatan akhir:
