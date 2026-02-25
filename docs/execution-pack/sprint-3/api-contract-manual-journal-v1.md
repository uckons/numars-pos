# API Contract v1 — Manual Journal & Recurring

Base path: `/api/accounting`

## 1) Manual Journal

### Create Draft
`POST /manual-journals`

Request:
```json
{
  "branch_id": 1,
  "journal_date": "2026-02-25",
  "description": "Penyesuaian biaya listrik",
  "lines": [
    { "account_code": "5101", "debit": 1000000, "credit": 0, "memo": "beban" },
    { "account_code": "1101", "debit": 0, "credit": 1000000, "memo": "kas" }
  ]
}
```

Rules tambahan line:
- Boleh kirim `account_id` (PK table `chart_of_accounts`) **atau** `account_code` (mis. `"5101"`).
- Jika keduanya dikirim, backend prioritaskan `account_id`.

Response `201`:
```json
{
  "id": 120,
  "status": "DRAFT",
  "is_balanced": true
}
```

### Submit for Approval
`POST /manual-journals/:id/submit`

Rules:
- Hanya status `DRAFT`.
- Harus balanced (`total_debit == total_credit`).

Response `200`:
```json
{ "id": 120, "status": "PENDING_APPROVAL" }
```

### Approve
`POST /manual-journals/:id/approve`

Request:
```json
{ "note": "OK sesuai bukti" }
```

Rules:
- Hanya role `ACCOUNTING_APPROVER`.
- Hanya status `PENDING_APPROVAL`.

Response `200`:
```json
{ "id": 120, "status": "POSTED", "posted_at": "2026-02-25T09:10:00Z" }
```

### Reject
`POST /manual-journals/:id/reject`

Request:
```json
{ "note": "Account kredit salah" }
```

Response `200`:
```json
{ "id": 120, "status": "REJECTED" }
```

### List
`GET /manual-journals?status=PENDING_APPROVAL&branch_id=1&from=2026-02-01&to=2026-02-29&page=1&page_size=20`

Response `200`:
```json
{
  "data": [
    {
      "id": 120,
      "journal_date": "2026-02-25",
      "description": "Penyesuaian biaya listrik",
      "status": "PENDING_APPROVAL",
      "total_debit": 1000000,
      "total_credit": 1000000
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

## 2) Recurring Template

### Create Template
`POST /recurring-journals/templates`

Request:
```json
{
  "branch_id": 1,
  "name": "Akrual Sewa Bulanan",
  "schedule_type": "MONTHLY",
  "schedule_day": 1,
  "start_date": "2026-03-01",
  "end_date": null,
  "description": "Akrual biaya sewa",
  "lines": [
    { "account_code": "5102", "debit": 5000000, "credit": 0 },
    { "account_code": "2101", "debit": 0, "credit": 5000000 }
  ]
}
```

Response `201`:
```json
{ "id": 15, "status": "ACTIVE" }
```

### Pause / Resume Template
- `POST /recurring-journals/templates/:id/pause`
- `POST /recurring-journals/templates/:id/resume`

### Generate Runs (Internal Job)
`POST /internal/recurring-journals/generate?date=2026-03-01&dry_run=false`

Response `200`:
```json
{
  "generated": 3,
  "skipped_existing": 1,
  "errors": []
}
```

## 3) Error Contract

Format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Journal is not balanced",
    "details": { "total_debit": 1000, "total_credit": 900 }
  }
}
```

Common code:
- `VALIDATION_ERROR`
- `FORBIDDEN`
- `NOT_FOUND`
- `INVALID_STATUS_TRANSITION`
- `IDEMPOTENCY_CONFLICT`
