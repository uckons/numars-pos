# Sprint 3 Backend Implementation Order

Dokumen ini jadi urutan implementasi praktis untuk backend Sprint 3 (manual journal + recurring + approval).

## 1) File Order (disarankan)

1. `backend/modules/accounting/manual-journal.service.js`
   - Source of truth business rule + SQL query.
2. `backend/modules/accounting/manual-journal.controller.js`
   - Mapping HTTP request/response + error contract.
3. `backend/modules/accounting/manual-journal.route.js`
   - Endpoint registry.
4. `backend/modules/accounting/accounting.route.js`
   - Mount route baru ke namespace accounting.
5. `backend/app.js`
   - Mount `/api/accounting`.

## 2) Function Signature (service layer)

### Manual journal

- `createManualJournal(payload, user)`
- `listManualJournals(query, user)`
- `getManualJournalDetail(id, user)`
- `transitionStatus({ id, user, action, note })`

### Recurring

- `createRecurringTemplate(payload, user)`
- `updateRecurringTemplateStatus(id, status, user)`
- `generateRecurringRuns({ date, dryRun }, user)`

## 3) Endpoint Mapping (controller/route)

- `POST /api/accounting/manual-journals`
- `GET /api/accounting/manual-journals`
- `GET /api/accounting/manual-journals/:id`
- `POST /api/accounting/manual-journals/:id/submit`
- `POST /api/accounting/manual-journals/:id/approve`
- `POST /api/accounting/manual-journals/:id/reject`
- `POST /api/accounting/recurring-journals/templates`
- `POST /api/accounting/recurring-journals/templates/:id/pause`
- `POST /api/accounting/recurring-journals/templates/:id/resume`
- `POST /api/accounting/internal/recurring-journals/generate?date=YYYY-MM-DD&dry_run=false`

## 4) SQL per endpoint (ringkas)

### Create manual draft
- `INSERT manual_journal_headers (...) VALUES (..., 'DRAFT', ...) RETURNING id`
- `INSERT manual_journal_lines (...)` per line.

### Submit
- `SELECT ... FOR UPDATE` header.
- Validate status + balance.
- `UPDATE manual_journal_headers SET status='PENDING_APPROVAL', submitted_by, submitted_at`.
- `INSERT manual_journal_approval_logs (action='SUBMIT')`.

### Approve
- `SELECT ... FOR UPDATE` header.
- Validate status `PENDING_APPROVAL`.
- `UPDATE manual_journal_headers SET status='POSTED', approved_by, approved_at`.
- `INSERT manual_journal_approval_logs (action='APPROVE')`.

### Reject
- `SELECT ... FOR UPDATE` header.
- Validate status `PENDING_APPROVAL`.
- `UPDATE manual_journal_headers SET status='REJECTED', rejected_by, rejected_at, rejection_note`.
- `INSERT manual_journal_approval_logs (action='REJECT')`.

### Create recurring template
- `INSERT recurring_journal_templates (...) VALUES (..., 'ACTIVE', ...) RETURNING id`
- `INSERT recurring_journal_template_lines (...)` per line.

### Pause/Resume template
- `UPDATE recurring_journal_templates SET status='PAUSED'/'ACTIVE' WHERE id=? RETURNING ...`

### Generate runs
- Scan template `ACTIVE` by date window.
- Check duplicate run via unique key (`template_id`, `period_key`).
- Create `manual_journal_headers` + `manual_journal_lines` untuk draft generated.
- Record ke `recurring_journal_runs`.

## 5) Validation Rules (minimum)

- Minimal 2 line.
- Tiap line wajib debit xor credit (> 0, tidak boleh dua-duanya).
- Semua account harus ada dan aktif di `chart_of_accounts`.
- Header submit/approve/reject wajib state transition valid.
- Hanya role approver (`SuperAdmin/Owner/Manager`) yang boleh approve/reject dan trigger generate.

## 6) UAT Hook

Setiap endpoint di atas harus diverifikasi menggunakan:
- `docs/execution-pack/sprint-3/uat-checklist-manual-journal.md`
- `docs/execution-pack/sprint-3/api-contract-manual-journal-v1.md`
