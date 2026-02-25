# API Contract v1 — Sprint 4 (AP/AR/Payroll Staff)

## 1) AP (Account Payable)

### Create AP Invoice
`POST /api/accounting/ap/invoices`

Request:
```json
{
  "branch_id": 1,
  "vendor_id": 22,
  "invoice_no": "INV-SUP-001",
  "invoice_date": "2026-03-01",
  "due_date": "2026-03-30",
  "lines": [
    { "description": "Produk A", "qty": 10, "unit_price": 50000 }
  ]
}
```

Response:
```json
{ "id": 101, "status": "DRAFT", "total_amount": 500000 }
```

### Post AP Payment
`POST /api/accounting/ap/invoices/:id/payments`

Request:
```json
{ "payment_date": "2026-03-10", "amount": 250000, "method": "BANK_TRANSFER" }
```

Response:
```json
{ "id": 901, "status": "POSTED", "remaining_outstanding": 250000 }
```

## 2) AR (Account Receivable)

### Create AR Invoice
`POST /api/accounting/ar/invoices`

Request:
```json
{
  "branch_id": 1,
  "customer_id": 81,
  "invoice_no": "INV-AR-001",
  "invoice_date": "2026-03-01",
  "due_date": "2026-03-15",
  "lines": [
    { "description": "Corporate Service", "qty": 1, "unit_price": 1500000 }
  ]
}
```

Response:
```json
{ "id": 201, "status": "APPROVED", "total_amount": 1500000 }
```

### Receive AR Payment
`POST /api/accounting/ar/invoices/:id/payments`

Request:
```json
{ "payment_date": "2026-03-12", "amount": 1500000, "method": "VIRTUAL_ACCOUNT" }
```

Response:
```json
{ "id": 902, "status": "POSTED", "remaining_outstanding": 0 }
```

## 3) Payroll Staff

### Create Payroll Run
`POST /api/accounting/payroll-staff/runs`

Request:
```json
{ "branch_id": 1, "period_key": "2026-03", "note": "Payroll Maret 2026" }
```

Response:
```json
{ "id": 301, "status": "DRAFT" }
```

### Close Payroll Run
`POST /api/accounting/payroll-staff/runs/:id/close`

Request:
```json
{ "approval_note": "Checked by Payroll Lead" }
```

Response:
```json
{ "id": 301, "status": "POSTED", "journal_entry_id": 8801 }
```

## 4) Common Errors

- `VALIDATION_ERROR`
- `INVALID_STATUS_TRANSITION`
- `OUTSTANDING_EXCEEDED`
- `CREDIT_LIMIT_EXCEEDED`
- `NOT_FOUND`
