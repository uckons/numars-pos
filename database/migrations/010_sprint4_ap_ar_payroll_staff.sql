-- Sprint 4: AP/AR + Payroll Staff v1
-- Additive migration (non-breaking)

BEGIN;

-- =====================================================
-- AP (Account Payable)
-- =====================================================
CREATE TABLE IF NOT EXISTS vendors (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT REFERENCES branches(id),
  vendor_code VARCHAR(50),
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(150),
  address TEXT,
  payment_term_days INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id),
  updated_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_vendors_branch_code UNIQUE (branch_id, vendor_code)
);

CREATE TABLE IF NOT EXISTS ap_invoices (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id),
  vendor_id BIGINT NOT NULL REFERENCES vendors(id),
  invoice_no VARCHAR(80) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- DRAFT/APPROVED/PARTIAL/PAID/VOID
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by BIGINT REFERENCES users(id),
  approved_by BIGINT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_ap_invoice_branch_no UNIQUE (branch_id, invoice_no),
  CONSTRAINT chk_ap_invoice_due_date CHECK (due_date >= invoice_date)
);

CREATE TABLE IF NOT EXISTS ap_invoice_lines (
  id BIGSERIAL PRIMARY KEY,
  ap_invoice_id BIGINT NOT NULL REFERENCES ap_invoices(id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  description TEXT NOT NULL,
  qty NUMERIC(14,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_ap_invoice_lines UNIQUE (ap_invoice_id, line_no),
  CONSTRAINT chk_ap_invoice_line_non_negative CHECK (qty >= 0 AND unit_price >= 0 AND line_total >= 0)
);

CREATE TABLE IF NOT EXISTS ap_payments (
  id BIGSERIAL PRIMARY KEY,
  ap_invoice_id BIGINT NOT NULL REFERENCES ap_invoices(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES branches(id),
  payment_no VARCHAR(80),
  payment_date DATE NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  method VARCHAR(40),
  status VARCHAR(30) NOT NULL DEFAULT 'POSTED', -- POSTED/VOID
  journal_entry_id BIGINT REFERENCES journal_entries(id),
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_ap_payment_branch_no UNIQUE (branch_id, payment_no),
  CONSTRAINT chk_ap_payment_amount_positive CHECK (amount > 0)
);

-- =====================================================
-- AR (Account Receivable)
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT REFERENCES branches(id),
  customer_code VARCHAR(50),
  name VARCHAR(150) NOT NULL,
  customer_type VARCHAR(30) NOT NULL DEFAULT 'MEMBER', -- MEMBER/CORPORATE
  phone VARCHAR(50),
  email VARCHAR(150),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id),
  updated_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_customers_branch_code UNIQUE (branch_id, customer_code)
);

CREATE TABLE IF NOT EXISTS customer_credit_limits (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES branches(id),
  credit_limit NUMERIC(18,2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_customer_credit_limit_non_negative CHECK (credit_limit >= 0),
  CONSTRAINT chk_customer_credit_limit_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS ar_invoices (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id),
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  invoice_no VARCHAR(80) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- DRAFT/APPROVED/PARTIAL/PAID/VOID
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by BIGINT REFERENCES users(id),
  approved_by BIGINT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_ar_invoice_branch_no UNIQUE (branch_id, invoice_no),
  CONSTRAINT chk_ar_invoice_due_date CHECK (due_date >= invoice_date)
);

CREATE TABLE IF NOT EXISTS ar_invoice_lines (
  id BIGSERIAL PRIMARY KEY,
  ar_invoice_id BIGINT NOT NULL REFERENCES ar_invoices(id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  description TEXT NOT NULL,
  qty NUMERIC(14,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_ar_invoice_lines UNIQUE (ar_invoice_id, line_no),
  CONSTRAINT chk_ar_invoice_line_non_negative CHECK (qty >= 0 AND unit_price >= 0 AND line_total >= 0)
);

CREATE TABLE IF NOT EXISTS ar_payments (
  id BIGSERIAL PRIMARY KEY,
  ar_invoice_id BIGINT NOT NULL REFERENCES ar_invoices(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES branches(id),
  payment_no VARCHAR(80),
  payment_date DATE NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  method VARCHAR(40),
  status VARCHAR(30) NOT NULL DEFAULT 'POSTED', -- POSTED/VOID
  journal_entry_id BIGINT REFERENCES journal_entries(id),
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_ar_payment_branch_no UNIQUE (branch_id, payment_no),
  CONSTRAINT chk_ar_payment_amount_positive CHECK (amount > 0)
);

-- =====================================================
-- Payroll Staff v1
-- =====================================================
CREATE TABLE IF NOT EXISTS staff_payroll_runs (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id),
  period_key VARCHAR(20) NOT NULL, -- e.g. 2026-03
  period_start DATE,
  period_end DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- DRAFT/APPROVED/POSTED/CANCELLED
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  employee_count INT NOT NULL DEFAULT 0,
  note TEXT,
  journal_entry_id BIGINT REFERENCES journal_entries(id),
  created_by BIGINT REFERENCES users(id),
  approved_by BIGINT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_staff_payroll_run_branch_period UNIQUE (branch_id, period_key)
);

CREATE TABLE IF NOT EXISTS staff_payroll_items (
  id BIGSERIAL PRIMARY KEY,
  payroll_run_id BIGINT NOT NULL REFERENCES staff_payroll_runs(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES users(id),
  base_salary NUMERIC(18,2) NOT NULL DEFAULT 0,
  allowance_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  deduction_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(18,2) NOT NULL DEFAULT 0,
  detail_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_staff_payroll_item_unique UNIQUE (payroll_run_id, staff_id)
);

CREATE TABLE IF NOT EXISTS staff_payroll_slips (
  id BIGSERIAL PRIMARY KEY,
  payroll_run_id BIGINT NOT NULL REFERENCES staff_payroll_runs(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES users(id),
  file_url TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_staff_payroll_slip_unique UNIQUE (payroll_run_id, staff_id)
);

-- =====================================================
-- Indexes (non-concurrent, safe in transaction)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_ap_invoices_branch_status_due
  ON ap_invoices(branch_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_ap_payments_invoice_date
  ON ap_payments(ap_invoice_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_ar_invoices_branch_status_due
  ON ar_invoices(branch_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_ar_payments_invoice_date
  ON ar_payments(ar_invoice_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_runs_branch_period
  ON staff_payroll_runs(branch_id, period_key, status);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_items_run
  ON staff_payroll_items(payroll_run_id);

-- shared trigger function (already used by Sprint 3 tables)
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vendors_touch ON vendors;
CREATE TRIGGER trg_vendors_touch
BEFORE UPDATE ON vendors
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_ap_invoices_touch ON ap_invoices;
CREATE TRIGGER trg_ap_invoices_touch
BEFORE UPDATE ON ap_invoices
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_ap_invoice_lines_touch ON ap_invoice_lines;
CREATE TRIGGER trg_ap_invoice_lines_touch
BEFORE UPDATE ON ap_invoice_lines
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_ap_payments_touch ON ap_payments;
CREATE TRIGGER trg_ap_payments_touch
BEFORE UPDATE ON ap_payments
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_customers_touch ON customers;
CREATE TRIGGER trg_customers_touch
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_customer_credit_limits_touch ON customer_credit_limits;
CREATE TRIGGER trg_customer_credit_limits_touch
BEFORE UPDATE ON customer_credit_limits
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_ar_invoices_touch ON ar_invoices;
CREATE TRIGGER trg_ar_invoices_touch
BEFORE UPDATE ON ar_invoices
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_ar_invoice_lines_touch ON ar_invoice_lines;
CREATE TRIGGER trg_ar_invoice_lines_touch
BEFORE UPDATE ON ar_invoice_lines
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_ar_payments_touch ON ar_payments;
CREATE TRIGGER trg_ar_payments_touch
BEFORE UPDATE ON ar_payments
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_staff_payroll_runs_touch ON staff_payroll_runs;
CREATE TRIGGER trg_staff_payroll_runs_touch
BEFORE UPDATE ON staff_payroll_runs
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_staff_payroll_items_touch ON staff_payroll_items;
CREATE TRIGGER trg_staff_payroll_items_touch
BEFORE UPDATE ON staff_payroll_items
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_staff_payroll_slips_touch ON staff_payroll_slips;
CREATE TRIGGER trg_staff_payroll_slips_touch
BEFORE UPDATE ON staff_payroll_slips
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;

-- Optional off-peak concurrent indexes can be added in separate file if needed.
