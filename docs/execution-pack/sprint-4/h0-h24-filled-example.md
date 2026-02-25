# Sprint 4 — Contoh Terisi H+0..H+24 (Wave-1)

> Catatan: ini **contoh terisi** untuk mempermudah eksekusi hari pertama.
> Ganti nama branch/PIC sesuai branch list final tim Anda.

## 1) Context Hari Pertama

- Tanggal: 2026-02-25
- Release manager: Rani (Eng)
- Incident channel: #war-room-s4
- Scope wave-1: 3 branch (30%)

## 2) Branch List Wave-1 (Contoh)

| Branch | AP | AR | Payroll Staff | Aktivasi | PIC |
|---|---|---|---|---|---|
| BR-01 / Menteng | ON | ON | ON | 09:45 | Fajar |
| BR-03 / Kemang | ON | ON | ON | 09:47 | Nisa |
| BR-05 / BSD | ON | ON | ON | 09:49 | Deni |

## 3) Bukti Pilot Control (Ringkas)

- Approver Finance: Siska
- Approver Payroll: Bimo
- Owner matrix: locked (Eng/QA/Finance/Payroll)
- Scope non-pilot: flag tetap OFF

## 4) Checkpoint T+0 s/d T+24 (Contoh)

| Checkpoint | API 5xx | Queue Backlog | AP/AR Mismatch | Payroll Anomaly | Decision |
|---|---:|---:|---:|---:|---|
| T+0 (10:00) | 0.12% | 3 | 0 | 0 | Continue |
| T+4 (14:00) | 0.15% | 4 | 0 | 0 | Continue |
| T+8 (18:00) | 0.14% | 2 | 1 (minor) | 0 | Continue + create ticket |
| T+12 (22:00) | 0.13% | 1 | 0 | 0 | Continue |
| T+24 (next 10:00) | 0.11% | 2 | 0 | 0 | Eligible for Wave-2 review |

## 5) Rekonsiliasi Siang & Sore (Contoh)

| Slot | Hasil | Keterangan |
|---|---|---|
| Siang | OK | Tidak ada unbalanced posted journal |
| Sore | OK | 1 mismatch minor closed (RCA: delay queue, bukan data integrity) |

## 6) Daily Status (Contoh Copy-Paste)

**Subject:** Sprint 4 Daily Status — 2026-02-25 — Wave-1

**Summary**
- Scope aktif: BR-01, BR-03, BR-05
- KPI ringkas: 5xx stabil < 0.2%, backlog normal
- Recon result: siang OK, sore OK
- Incident major: tidak ada
- Risiko utama: potensi backlog saat peak malam (dipantau)

**Action Next 24h**
1. Review kelayakan proceed wave-2 di H+24/H+36.
2. Lanjut checkpoint per 4 jam.
3. Finalisasi addendum gate note bila semua KPI tetap stabil.

## 7) Keputusan Sementara

- Status H+24: **GO CANDIDATE** untuk wave-2 (pending review lintas owner).
- Prasyarat wave-2: tidak ada major incident baru sampai checkpoint berikutnya.
