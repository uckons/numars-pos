# Sprint 4 Pilot Control Sheet — 2026-02-26

Single source of truth pilot H+0 sampai H+72 untuk keputusan gate GO.

## 1) Pilot Identity

- Tanggal mulai pilot: 2026-02-24
- Pilot branch: BR-01
- Environment: Production (pilot-gated)
- Incident channel: #war-room-sprint4
- War-room bridge/link: Internal Meet Sprint 4

## 2) Owner Matrix (Locked)

| Function | PIC | Backup | Kontak | Status |
|---|---|---|---|---|
| Engineering | Eng Lead | Senior BE | On-call Eng | [x] Locked |
| QA | QA Lead | QA Analyst | On-call QA | [x] Locked |
| Finance Approver | Finance Lead | Finance Supervisor | Finance Hotline | [x] Locked |
| Payroll Approver | Payroll Lead | Payroll Admin | Payroll Hotline | [x] Locked |

## 3) Feature Flag Scope Lock

| Flag | Pilot Branch | Non-Pilot Branch | Verified By | Timestamp |
|---|---|---|---|---|
| `FEATURE_AP_ENABLED` | `true` | `false` | Engineering | 2026-02-24 09:58 |
| `FEATURE_AR_ENABLED` | `true` | `false` | Engineering | 2026-02-24 09:58 |
| `FEATURE_PAYROLL_STAFF_ENABLED` | `true` | `false` | Engineering | 2026-02-24 09:58 |

## 4) Bukti Validasi Minimum

| Skenario | Evidence Ref | Hasil | Owner | Timestamp |
|---|---|---|---|---|
| AP invoice -> payment | AP-PILOT-001 | PASS | Finance + QA | 2026-02-24 11:20 |
| AR invoice -> payment | AR-PILOT-001 | PASS | Finance + QA | 2026-02-24 13:35 |
| Payroll run close (>=1 periode) | PR-PILOT-001 | PASS | Payroll + QA | 2026-02-24 15:10 |
| Journal posted balance | RECON-H24 | PASS | Eng + Finance | 2026-02-25 12:40 |
| No major incident | INCIDENT-LOG-H48 | PASS | Ops | 2026-02-26 08:30 |

## 5) Rekonsiliasi Harian (Siang + Sore)

| Slot | SQL Recon Result | Mismatch Count | Ticket Ref | Owner | ETA |
|---|---|---:|---|---|---|
| Siang | OK | 0 | - | Ops + Finance | - |
| Sore | OK | 0 | - | Ops + Finance | - |

## 6) Gate Record H+48 / H+72

### GO/NO-GO Decision
- Decision time: 2026-02-26 10:00 WIB
- Decision: **GO**
- Decision owner: Steering committee Sprint 4

### Decision Basis
- [x] Tidak ada incident major.
- [x] Aging AP/AR konsisten dengan ledger.
- [x] Sign-off Finance + Payroll + QA + Engineering lengkap.
