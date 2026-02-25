# Database Migrations

## How to Apply Migrations

To apply the database migration for the timer modal feature, run the following SQL script against your PostgreSQL database:

```bash
psql -U your_username -d your_database -f 001_add_rooms_and_update_timers.sql
```

Or connect to your database and execute the SQL file:

```sql
\i database/migrations/001_add_rooms_and_update_timers.sql
```

## Migration 001: Timer Modal Enhancement

**File:** `001_add_rooms_and_update_timers.sql`

**Purpose:** Add rooms table and update timers table to support the new timer modal functionality with dropdown selections.

**Changes:**
- Creates `rooms` table with columns: id, branch_id, name, type, is_active, created_at
- Adds columns to `timers` table: service_id, room_id, branch_id, planned_end_time
- Creates index for faster room occupancy lookups
- Seeds sample room data for branches 1 and 2

**Note:** This migration uses `IF NOT EXISTS` clauses to ensure it's safe to run multiple times.

## Migration 007: Sprint 1 Foundation (Accounting/Approval/Formula)

**File:** `007_sprint1_foundation_accounting.sql`

**Purpose:** Menyediakan fondasi tabel additive (non-breaking) untuk memulai roadmap 12 minggu tanpa mengganggu operasional POS.

**Changes:**
- Creates `chart_of_accounts`
- Creates `journal_entries` + `journal_lines`
- Creates `approval_requests`
- Creates `formula_definitions` + `formula_versions`
- Includes recommended `CREATE INDEX CONCURRENTLY` statements (manual/off-peak)

**Execution Notes:**
- Jalankan di staging terlebih dahulu.
- Untuk index `CONCURRENTLY`, jalankan di luar transaksi seperti komentar di akhir file migration.


**Node Runner (fallback when `psql` is unavailable):**

```bash
node backend/scripts/apply-migration-007.js
```

This runner loads `backend/.env` (or root `.env`) and prints a clearer hint for SCRAM password parsing issues.


## Migration 008: COA Level 1-4 + Posting Rules Lock

**File:** `008_seed_coa_and_posting_rules.sql`

**Purpose:** Menyelesaikan Sprint 1 task S1-03 & S1-04 dengan finalisasi COA level 1-4 dan lock event-to-journal mapping untuk event prioritas.

**Changes:**
- Creates `accounting_posting_rules`
- Seeds COA hierarchy level 1-4 pada `chart_of_accounts`
- Locks posting rules untuk `POS_PAYMENT`, `POS_REVERT`, `THERAPIST_COMMISSION_SETTLE`, `PAYROLL_SETTLE`

**Execution:**
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/008_seed_coa_and_posting_rules.sql
```

## Concurrent Index File (Off-Peak)

**File:** `007_indexes_concurrently.sql`

**Purpose:** Menjalankan index recommendation dari Migration 007 secara aman (di luar transaction, traffic rendah).

**Execution:**
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/007_indexes_concurrently.sql
```


## Migration 010: Sprint 4 AP/AR + Payroll Staff v1

**File:** `010_sprint4_ap_ar_payroll_staff.sql`

**Purpose:** Menambahkan fondasi additive untuk modul AP/AR dan Payroll Staff v1, termasuk linkage ke jurnal (`journal_entry_id`) untuk posting accounting yang konsisten.

**Changes:**
- Creates `vendors`, `ap_invoices`, `ap_invoice_lines`, `ap_payments`
- Creates `customers`, `customer_credit_limits`, `ar_invoices`, `ar_invoice_lines`, `ar_payments`
- Creates `staff_payroll_runs`, `staff_payroll_items`, `staff_payroll_slips`
- Adds index utama untuk query status/due-date/period
- Adds `touch_updated_at` triggers untuk tabel Sprint 4

**Execution:**
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/010_sprint4_ap_ar_payroll_staff.sql
```

**Post-check (recommended):**
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/execution-pack/sprint-4/sql-reconciliation-ap-ar-payroll.sql
```
