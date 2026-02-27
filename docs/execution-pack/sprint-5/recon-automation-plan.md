# Sprint 5 — Reconciliation Automation Plan

## Scope
- Automasi query recon AP/AR/payroll
- Auto publish hasil ke folder evidence
- Alert jika mismatch > threshold

## Jobs
- Noon recon job
- Evening recon job

## Outputs
- Summary report (OK/NOK)
- Mismatch detail
- Ticket stub (jika NOK)

## Initial Implementation
- Script: `backend/scripts/sprint4-recon-job.js`
- NPM script: `cd backend && npm run recon:sprint4 -- --date YYYY-MM-DD --branch-id 1`
- Dry run: `cd backend && npm run recon:sprint4 -- --dry-run`
- Exit code contract:
  - `0` = no mismatch
  - `2` = mismatch detected
  - `1` = execution/runtime error
