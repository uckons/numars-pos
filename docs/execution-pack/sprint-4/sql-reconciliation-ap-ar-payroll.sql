-- Sprint 4 Reconciliation SQL (AP/AR/Payroll Staff)
-- Tujuan: validasi konsistensi outstanding dan jurnal posting

-- 1) AP outstanding by invoice
SELECT
  ai.id AS ap_invoice_id,
  ai.invoice_no,
  ai.total_amount,
  COALESCE(SUM(ap.amount), 0) AS paid_amount,
  (ai.total_amount - COALESCE(SUM(ap.amount), 0)) AS outstanding
FROM ap_invoices ai
LEFT JOIN ap_payments ap ON ap.ap_invoice_id = ai.id
GROUP BY ai.id, ai.invoice_no, ai.total_amount
ORDER BY ai.id DESC;

-- 2) AR outstanding by invoice
SELECT
  ai.id AS ar_invoice_id,
  ai.invoice_no,
  ai.total_amount,
  COALESCE(SUM(ap.amount), 0) AS received_amount,
  (ai.total_amount - COALESCE(SUM(ap.amount), 0)) AS outstanding
FROM ar_invoices ai
LEFT JOIN ar_payments ap ON ap.ar_invoice_id = ai.id
GROUP BY ai.id, ai.invoice_no, ai.total_amount
ORDER BY ai.id DESC;

-- 3) Payroll run and linked journal
SELECT
  spr.id AS payroll_run_id,
  spr.period_key,
  spr.status,
  spr.total_amount,
  spr.journal_entry_id,
  je.status AS journal_status
FROM staff_payroll_runs spr
LEFT JOIN journal_entries je ON je.id = spr.journal_entry_id
ORDER BY spr.id DESC;

-- 4) Detect AP payment without journal link (anomali)
SELECT ap.id, ap.ap_invoice_id, ap.amount, ap.payment_date
FROM ap_payments ap
WHERE ap.journal_entry_id IS NULL
ORDER BY ap.id DESC;

-- 5) Detect AR payment without journal link (anomali)
SELECT ap.id, ap.ar_invoice_id, ap.amount, ap.payment_date
FROM ar_payments ap
WHERE ap.journal_entry_id IS NULL
ORDER BY ap.id DESC;

-- 6) Quick trial-balance subset for Sprint 4 modules
-- NOTE: current schema uses source_module/source_ref (not reference_type/reference_id)
SELECT
  je.id,
  je.source_module,
  je.source_ref,
  SUM(jl.debit) AS total_debit,
  SUM(jl.credit) AS total_credit,
  (SUM(jl.debit) - SUM(jl.credit)) AS delta
FROM journal_entries je
JOIN journal_lines jl ON jl.journal_entry_id = je.id
WHERE je.source_module IN ('AP', 'AR', 'PAYROLL')
GROUP BY je.id, je.source_module, je.source_ref
HAVING SUM(jl.debit) <> SUM(jl.credit)
ORDER BY je.id DESC;
