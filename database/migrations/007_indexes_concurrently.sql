-- Run off-peak only (outside transaction)
-- Recommended after applying 007_sprint1_foundation_accounting.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_entries_branch_date
  ON journal_entries(branch_id, posting_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_entries_status
  ON journal_entries(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_lines_entry
  ON journal_lines(journal_entry_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_requests_module_status
  ON approval_requests(module, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_formula_versions_formula_status
  ON formula_versions(formula_id, status);
