-- Sprint 1 Foundation Migration (Additive / Non-Breaking)
-- Safe to run multiple times.

BEGIN;

-- 1) Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  account_type VARCHAR(30) NOT NULL, -- ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE
  parent_id INT REFERENCES chart_of_accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2) Journal headers
CREATE TABLE IF NOT EXISTS journal_entries (
  id BIGSERIAL PRIMARY KEY,
  branch_id INT REFERENCES branches(id),
  source_module VARCHAR(50) NOT NULL, -- POS/AP/AR/PAYROLL/ADJUSTMENT
  source_ref VARCHAR(100),
  posting_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT/SUBMITTED/APPROVED/POSTED/REJECTED
  description TEXT,
  idempotency_key VARCHAR(120),
  created_by INT REFERENCES users(id),
  approved_by INT REFERENCES users(id),
  approved_at TIMESTAMP,
  posted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_journal_entries_idempotency UNIQUE (idempotency_key)
);

-- 3) Journal lines
CREATE TABLE IF NOT EXISTS journal_lines (
  id BIGSERIAL PRIMARY KEY,
  journal_entry_id BIGINT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id INT NOT NULL REFERENCES chart_of_accounts(id),
  line_no INT NOT NULL,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_journal_line_non_negative CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT chk_journal_line_one_side CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0)
  ),
  CONSTRAINT uq_journal_line_order UNIQUE (journal_entry_id, line_no)
);

-- 4) Generic approval requests
CREATE TABLE IF NOT EXISTS approval_requests (
  id BIGSERIAL PRIMARY KEY,
  module VARCHAR(50) NOT NULL, -- JOURNAL/PAYROLL/VOID/PAYMENT_LIMIT
  ref_id VARCHAR(100) NOT NULL,
  branch_id INT REFERENCES branches(id),
  requested_by INT REFERENCES users(id),
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING/APPROVED/REJECTED/CANCELLED
  reviewer_id INT REFERENCES users(id),
  reviewed_at TIMESTAMP,
  reason TEXT,
  review_note TEXT
);

-- 5) Formula definition + versioning
CREATE TABLE IF NOT EXISTS formula_definitions (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(80) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  domain VARCHAR(50) NOT NULL, -- PAYROLL_STAFF/PAYROLL_THERAPIST/PAYROLL_AGENT
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS formula_versions (
  id BIGSERIAL PRIMARY KEY,
  formula_id BIGINT NOT NULL REFERENCES formula_definitions(id) ON DELETE CASCADE,
  version_no INT NOT NULL,
  expression TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT/SUBMITTED/APPROVED/ACTIVE/REJECTED/ARCHIVED
  created_by INT REFERENCES users(id),
  approved_by INT REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_formula_version UNIQUE (formula_id, version_no)
);

COMMIT;

-- Recommended online indexes (run off-peak, outside transaction):
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_entries_branch_date ON journal_entries(branch_id, posting_date);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_requests_module_status ON approval_requests(module, status);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_formula_versions_formula_status ON formula_versions(formula_id, status);
