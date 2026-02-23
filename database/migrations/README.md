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
