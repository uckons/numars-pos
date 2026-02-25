-- Sprint 1 Task S1-03 + S1-04
-- Finalisasi COA level 1-4 + lock event-to-journal mapping.
-- Prerequisite: migration 007_sprint1_foundation_accounting.sql

BEGIN;

-- Posting rules table (idempotent + auditable)
CREATE TABLE IF NOT EXISTS accounting_posting_rules (
  id BIGSERIAL PRIMARY KEY,
  event_code VARCHAR(80) NOT NULL, -- POS_PAYMENT / POS_REVERT / THERAPIST_COMMISSION_SETTLE / PAYROLL_SETTLE
  variant VARCHAR(40) NOT NULL DEFAULT 'DEFAULT', -- CASH/QRIS/TRANSFER/DEFAULT
  line_no INT NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  account_code VARCHAR(30) NOT NULL REFERENCES chart_of_accounts(code),
  description VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_posting_rule UNIQUE (event_code, variant, line_no)
);

-- COA Level 1
INSERT INTO chart_of_accounts (code, name, account_type, parent_id)
VALUES
  ('1000', 'ASSET', 'ASSET', NULL),
  ('2000', 'LIABILITY', 'LIABILITY', NULL),
  ('3000', 'EQUITY', 'EQUITY', NULL),
  ('4000', 'REVENUE', 'REVENUE', NULL),
  ('5000', 'EXPENSE', 'EXPENSE', NULL)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    account_type = EXCLUDED.account_type,
    parent_id = EXCLUDED.parent_id,
    updated_at = NOW();

-- COA Level 2
INSERT INTO chart_of_accounts (code, name, account_type, parent_id)
VALUES
  ('1100', 'Current Assets', 'ASSET', (SELECT id FROM chart_of_accounts WHERE code='1000')),
  ('2100', 'Current Liabilities', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE code='2000')),
  ('4100', 'Operating Revenue', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE code='4000')),
  ('5100', 'Revenue Deductions', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE code='5000')),
  ('5200', 'Commission Expenses', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE code='5000')),
  ('5300', 'Payroll Expenses', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE code='5000'))
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    account_type = EXCLUDED.account_type,
    parent_id = EXCLUDED.parent_id,
    updated_at = NOW();

-- COA Level 3
INSERT INTO chart_of_accounts (code, name, account_type, parent_id)
VALUES
  ('1110', 'Cash on Hand', 'ASSET', (SELECT id FROM chart_of_accounts WHERE code='1100')),
  ('1120', 'Bank Account', 'ASSET', (SELECT id FROM chart_of_accounts WHERE code='1100')),
  ('1130', 'QRIS / E-Wallet Clearing', 'ASSET', (SELECT id FROM chart_of_accounts WHERE code='1100')),
  ('2110', 'Payroll Payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE code='2100')),
  ('2120', 'Therapist Commission Payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE code='2100')),
  ('4130', 'POS Service Revenue', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE code='4100')),
  ('5110', 'Sales Return & Reversal', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE code='5100')),
  ('5210', 'Therapist Commission Expense', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE code='5200')),
  ('5310', 'Staff Salary Expense', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE code='5300'))
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    account_type = EXCLUDED.account_type,
    parent_id = EXCLUDED.parent_id,
    updated_at = NOW();

-- COA Level 4 (detail posting accounts)
INSERT INTO chart_of_accounts (code, name, account_type, parent_id)
VALUES
  ('1111', 'Petty Cash Outlet', 'ASSET', (SELECT id FROM chart_of_accounts WHERE code='1110')),
  ('1121', 'Bank Settlement Account', 'ASSET', (SELECT id FROM chart_of_accounts WHERE code='1120')),
  ('1131', 'QRIS In-Transit', 'ASSET', (SELECT id FROM chart_of_accounts WHERE code='1130')),
  ('2111', 'Payroll Staff Payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE code='2110')),
  ('2121', 'Commission Therapist Payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE code='2120')),
  ('4131', 'POS Gross Revenue', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE code='4130')),
  ('5111', 'POS Revert Expense', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE code='5110')),
  ('5211', 'Therapist Commission Expense - Realized', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE code='5210')),
  ('5311', 'Staff Salary Expense - Realized', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE code='5310'))
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    account_type = EXCLUDED.account_type,
    parent_id = EXCLUDED.parent_id,
    updated_at = NOW();

-- Posting rules lock (S1-04)
INSERT INTO accounting_posting_rules (event_code, variant, line_no, direction, account_code, description)
VALUES
  ('POS_PAYMENT', 'CASH',     1, 'DEBIT',  '1111', 'Kas masuk dari pembayaran POS tunai'),
  ('POS_PAYMENT', 'CASH',     2, 'CREDIT', '4131', 'Pendapatan POS tercatat'),

  ('POS_PAYMENT', 'QRIS',     1, 'DEBIT',  '1131', 'Piutang clearing QRIS bertambah'),
  ('POS_PAYMENT', 'QRIS',     2, 'CREDIT', '4131', 'Pendapatan POS tercatat'),

  ('POS_PAYMENT', 'TRANSFER', 1, 'DEBIT',  '1121', 'Dana diterima via bank transfer'),
  ('POS_PAYMENT', 'TRANSFER', 2, 'CREDIT', '4131', 'Pendapatan POS tercatat'),

  ('POS_REVERT',  'CASH',     1, 'DEBIT',  '5111', 'Revert transaksi POS'),
  ('POS_REVERT',  'CASH',     2, 'CREDIT', '1111', 'Kas keluar karena revert'),

  ('POS_REVERT',  'QRIS',     1, 'DEBIT',  '5111', 'Revert transaksi POS'),
  ('POS_REVERT',  'QRIS',     2, 'CREDIT', '1131', 'Clearing QRIS berkurang karena revert'),

  ('POS_REVERT',  'TRANSFER', 1, 'DEBIT',  '5111', 'Revert transaksi POS'),
  ('POS_REVERT',  'TRANSFER', 2, 'CREDIT', '1121', 'Bank berkurang karena revert'),

  ('THERAPIST_COMMISSION_SETTLE', 'DEFAULT', 1, 'DEBIT',  '5211', 'Beban komisi terapis direalisasikan'),
  ('THERAPIST_COMMISSION_SETTLE', 'DEFAULT', 2, 'CREDIT', '2121', 'Hutang komisi terapis tercatat'),

  ('PAYROLL_SETTLE', 'DEFAULT', 1, 'DEBIT',  '5311', 'Beban payroll staff direalisasikan'),
  ('PAYROLL_SETTLE', 'DEFAULT', 2, 'CREDIT', '2111', 'Hutang payroll staff tercatat')
ON CONFLICT (event_code, variant, line_no) DO UPDATE
SET direction = EXCLUDED.direction,
    account_code = EXCLUDED.account_code,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = NOW();

COMMIT;
