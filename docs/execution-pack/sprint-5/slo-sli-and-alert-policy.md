# Sprint 5 — SLO/SLI and Alert Policy (Draft)

## Service SLO (Draft)
- API availability: 99.9%
- Queue processing latency p95: < 2 menit
- Recon freshness: report siang+sore tersedia <= 30 menit setelah run window
- Payroll close success rate: 100% untuk periode aktif

## SLI Sources
- API metrics dashboard
- Queue worker metrics
- Recon job logs
- Payroll close audit logs

## Alert Policy
- Sev-1: data integrity risk / unbalanced posted journal
- Sev-2: recon mismatch kritikal > threshold
- Sev-3: queue latency degradation

## Escalation Window
- Sev-1: immediate war-room
- Sev-2: acknowledge <= 15 menit
- Sev-3: acknowledge <= 60 menit
