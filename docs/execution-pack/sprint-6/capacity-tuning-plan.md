# Sprint 6 — Capacity Tuning Plan

## Scope
- API layer throughput and p95 latency
- Queue worker concurrency and retry profile
- DB query/index optimization for hot paths

## Method
1. Baseline measurement
2. Tuning increment
3. Validate impact
4. Rollback if regression

## Success Criteria
- p95 latency turun vs baseline
- queue backlog peak within threshold
- no increase in major incidents
