# Feature Flags Namespace v1 (S1-08)

Default policy Sprint 1: **semua flag baru = OFF**.

## Namespace

- `FEATURE_ACCOUNTING_V2`
- `FEATURE_APPROVAL_MATRIX_V1`
- `FEATURE_FORMULA_ENGINE_V1`
- `FEATURE_PAYROLL_STAFF_V1`
- `FEATURE_PAYROLL_THERAPIST_V1`
- `FEATURE_PAYROLL_AGENT_V1`
- `FEATURE_BANK_RECON_V1`
- `FEATURE_MULTI_OUTLET_TRANSFER_V1`

## Runtime Config

Implementasi baseline ada di:
- `backend/config/feature-flags.js`

Behavior parser:
- `true values`: `1`, `true`, `yes`, `on`, `enabled`
- selain itu dianggap `false`

## Rollout Rule

1. Semua flag OFF di production default.
2. Aktifkan bertahap per outlet pilot.
3. Aktifkan read path setelah write path stabil.
4. Jika error naik, rollback cukup dengan toggle OFF.

## Example

```bash
export FEATURE_ACCOUNTING_V2=false
export FEATURE_APPROVAL_MATRIX_V1=false
export FEATURE_FORMULA_ENGINE_V1=false
```
