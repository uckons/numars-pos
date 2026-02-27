# Sprint 6 — Alert Policy v2

## Improvements vs v1
- Alert dedup by fingerprint window
- Correlation by service + incident signature
- Escalation routing based on business impact

## Severity
- Sev-1: data integrity / outage
- Sev-2: degraded core flow
- Sev-3: non-critical anomaly

## Target
- Reduce alert noise >= 30%
- Reduce acknowledge time for Sev-1/Sev-2
