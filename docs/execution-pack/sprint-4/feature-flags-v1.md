# Sprint 4 Feature Flags v1 (AP/AR/Payroll Staff)

## 1) Flags

- `FEATURE_AP_ENABLED`
- `FEATURE_AR_ENABLED`
- `FEATURE_PAYROLL_STAFF_ENABLED`
- `FEATURE_AP_AR_APPROVAL_ENABLED`

Default: `false` untuk rollout bertahap.

## 2) Strategy Rollout

1. Internal QA: enable all di staging.
2. Pilot: enable hanya untuk 1 branch.
3. Wave-1: 30–40% branch.
4. Wave-2: sisa branch jika stabil.

## 3) Guard Rules

- Endpoint AP return `403 FEATURE_DISABLED` jika flag off.
- Endpoint AR return `403 FEATURE_DISABLED` jika flag off.
- Payroll close period hanya aktif jika `FEATURE_PAYROLL_STAFF_ENABLED=true`.
- Approval override endpoint wajib `FEATURE_AP_AR_APPROVAL_ENABLED=true`.

## 4) Monitoring Minimal

- Error rate per endpoint AP/AR/payroll.
- Jumlah dokumen gagal posting jurnal.
- Mismatch aging vs ledger.
