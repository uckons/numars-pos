# Sprint 4 Pilot Control Sheet (Template)

Gunakan template ini sebagai single source of truth selama pilot H+0 sampai H+72.

## 1) Pilot Identity

- Tanggal mulai pilot:
- Pilot branch:
- Environment:
- Incident channel:
- War-room bridge/link:

## 2) Owner Matrix (Wajib)

| Function | PIC | Backup | Kontak | Status |
|---|---|---|---|---|
| Engineering |  |  |  | [ ] Locked |
| QA |  |  |  | [ ] Locked |
| Finance Approver |  |  |  | [ ] Locked |
| Payroll Approver |  |  |  | [ ] Locked |

## 3) Feature Flag Scope Lock

| Flag | Pilot Branch | Non-Pilot Branch | Verified By | Timestamp |
|---|---|---|---|---|
| `FEATURE_AP_ENABLED` | `true` | `false` |  |  |
| `FEATURE_AR_ENABLED` | `true` | `false` |  |  |
| `FEATURE_PAYROLL_STAFF_ENABLED` | `true` | `false` |  |  |

## 4) Bukti Validasi Minimum

| Skenario | Evidence Ref | Hasil | Owner | Timestamp |
|---|---|---|---|---|
| AP invoice -> payment |  | PASS / FAIL |  |  |
| AR invoice -> payment |  | PASS / FAIL |  |  |
| Payroll run close (>=1 periode) |  | PASS / FAIL |  |  |
| Journal posted balance |  | PASS / FAIL |  |  |
| No major incident |  | PASS / FAIL |  |  |

## 5) Rekonsiliasi Harian (Siang + Sore)

| Slot | SQL Recon Result | Mismatch Count | Ticket Ref | Owner | ETA |
|---|---|---:|---|---|---|
| Siang | OK / NOK |  |  |  |  |
| Sore | OK / NOK |  |  |  |  |

## 6) Gate Record H+48 / H+72

### GO/NO-GO Decision
- Decision time:
- Decision: GO / NO-GO
- Decision owner:

### Decision Basis
- [ ] Tidak ada incident major.
- [ ] Aging AP/AR konsisten dengan ledger.
- [ ] Sign-off Finance + Payroll + QA + Engineering lengkap.

### Jika NO-GO
- Immediate containment:
- Rollback executed at:
- RCA owner:
- ETA re-enable pilot-only:
