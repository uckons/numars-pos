-- Sprint 3: Manual Journal Workflow + Recurring Journal Template
-- Additive migration (no destructive alter/drop)

BEGIN;

CREATE TABLE IF NOT EXISTS manual_journal_headers (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  journal_date DATE NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  total_debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_by BIGINT NOT NULL,
  submitted_by BIGINT,
  submitted_at TIMESTAMPTZ,
  approved_by BIGINT,
  approved_at TIMESTAMPTZ,
  rejected_by BIGINT,
  rejected_at TIMESTAMPTZ,
  rejection_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manual_journal_lines (
  id BIGSERIAL PRIMARY KEY,
  header_id BIGINT NOT NULL REFERENCES manual_journal_headers(id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  account_id BIGINT NOT NULL,
  debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_manual_journal_line_one_side
    CHECK (
      (debit > 0 AND credit = 0)
      OR (credit > 0 AND debit = 0)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_manual_journal_lines_header_line
  ON manual_journal_lines(header_id, line_no);

CREATE INDEX IF NOT EXISTS idx_manual_journal_headers_branch_date
  ON manual_journal_headers(branch_id, journal_date DESC);

CREATE INDEX IF NOT EXISTS idx_manual_journal_headers_status
  ON manual_journal_headers(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS manual_journal_approval_logs (
  id BIGSERIAL PRIMARY KEY,
  header_id BIGINT NOT NULL REFERENCES manual_journal_headers(id) ON DELETE CASCADE,
  action VARCHAR(32) NOT NULL,
  actor_id BIGINT NOT NULL,
  note TEXT,
  from_status VARCHAR(32),
  to_status VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_journal_approval_logs_header
  ON manual_journal_approval_logs(header_id, created_at DESC);

CREATE TABLE IF NOT EXISTS recurring_journal_templates (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  schedule_type VARCHAR(20) NOT NULL,
  schedule_day INT,
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_by BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_journal_templates_status
  ON recurring_journal_templates(status, start_date);

CREATE TABLE IF NOT EXISTS recurring_journal_template_lines (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES recurring_journal_templates(id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  account_id BIGINT NOT NULL,
  debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_recurring_template_line_one_side
    CHECK (
      (debit > 0 AND credit = 0)
      OR (credit > 0 AND debit = 0)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_recurring_template_lines_unique
  ON recurring_journal_template_lines(template_id, line_no);

CREATE TABLE IF NOT EXISTS recurring_journal_runs (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES recurring_journal_templates(id) ON DELETE CASCADE,
  period_key VARCHAR(16) NOT NULL,
  run_date DATE NOT NULL,
  generated_header_id BIGINT REFERENCES manual_journal_headers(id),
  status VARCHAR(20) NOT NULL DEFAULT 'GENERATED',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_recurring_journal_runs_template_period
  ON recurring_journal_runs(template_id, period_key);

CREATE INDEX IF NOT EXISTS idx_recurring_journal_runs_status
  ON recurring_journal_runs(status, run_date DESC);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_manual_journal_headers_touch ON manual_journal_headers;
CREATE TRIGGER trg_manual_journal_headers_touch
BEFORE UPDATE ON manual_journal_headers
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_manual_journal_lines_touch ON manual_journal_lines;
CREATE TRIGGER trg_manual_journal_lines_touch
BEFORE UPDATE ON manual_journal_lines
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_recurring_journal_templates_touch ON recurring_journal_templates;
CREATE TRIGGER trg_recurring_journal_templates_touch
BEFORE UPDATE ON recurring_journal_templates
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_recurring_journal_template_lines_touch ON recurring_journal_template_lines;
CREATE TRIGGER trg_recurring_journal_template_lines_touch
BEFORE UPDATE ON recurring_journal_template_lines
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_recurring_journal_runs_touch ON recurring_journal_runs;
CREATE TRIGGER trg_recurring_journal_runs_touch
BEFORE UPDATE ON recurring_journal_runs
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
