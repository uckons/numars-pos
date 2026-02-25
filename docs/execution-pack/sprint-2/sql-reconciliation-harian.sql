-- SQL Reconciliation Harian POS vs Jurnal (Sprint 2)
-- Cara pakai di psql:
--   \set recon_date '2026-02-24'
--   \set branch_id 1
--   \i docs/execution-pack/sprint-2/sql-reconciliation-harian.sql
--
-- Catatan:
-- - branch_id opsional. Jika tidak ingin filter cabang, isi branch_id dengan string kosong.
-- - Query ini fokus event POS_PAYMENT (auto journal saat order paid).
-- - Order PAID dengan total <= 0 dibedakan menjadi:
--   * ZERO_TOTAL_WITH_ITEMS: item subtotal > 0 tetapi total order 0 (perlu investigasi).
--   * NO_JOURNAL_EXPECTED_ZERO_TOTAL: memang tidak ada nilai transaksi (informational).

DROP TABLE IF EXISTS tmp_recon_pos_payment;

CREATE TEMP TABLE tmp_recon_pos_payment AS
WITH params AS (
  SELECT
    CAST(:'recon_date' AS DATE) AS recon_date,
    CAST(NULLIF(:'branch_id', '') AS INT) AS branch_id
),
paid_orders AS (
  SELECT
    o.id AS order_id,
    o.branch_id,
    o.payment_method,
    o.total AS order_total,
    COALESCE(oi.subtotal_items, 0) AS items_subtotal
  FROM orders o
  LEFT JOIN (
    SELECT order_id, COALESCE(SUM(subtotal), 0) AS subtotal_items
    FROM order_items
    GROUP BY order_id
  ) oi ON oi.order_id = o.id
  CROSS JOIN params p
  WHERE o.status = 'PAID'
    AND o.created_at::date = p.recon_date
    AND (p.branch_id IS NULL OR o.branch_id = p.branch_id)
),
pos_payment_journals AS (
  SELECT
    je.id AS journal_id,
    je.branch_id,
    je.source_ref,
    je.posting_date,
    je.status,
    COALESCE(SUM(jl.debit), 0) AS total_debit,
    COALESCE(SUM(jl.credit), 0) AS total_credit
  FROM journal_entries je
  LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
  CROSS JOIN params p
  WHERE je.source_module = 'POS'
    AND je.idempotency_key LIKE 'AUTO:POS_PAYMENT:%'
    AND je.posting_date = p.recon_date
    AND (p.branch_id IS NULL OR je.branch_id = p.branch_id)
  GROUP BY je.id, je.branch_id, je.source_ref, je.posting_date, je.status
)
SELECT
  po.order_id,
  po.branch_id,
  po.payment_method,
  po.order_total,
  po.items_subtotal,
  (COALESCE(po.items_subtotal, 0) - COALESCE(po.order_total, 0)) AS inferred_discount,
  CONCAT('ORDER:', po.order_id) AS expected_source_ref,
  pj.journal_id,
  pj.status AS journal_status,
  pj.total_debit,
  pj.total_credit,
  CASE
    WHEN COALESCE(po.order_total, 0) <= 0 AND COALESCE(po.items_subtotal, 0) > 0 THEN 'ZERO_TOTAL_WITH_ITEMS'
    WHEN COALESCE(po.order_total, 0) <= 0 THEN 'NO_JOURNAL_EXPECTED_ZERO_TOTAL'
    WHEN pj.journal_id IS NULL THEN 'MISSING_JOURNAL'
    WHEN ABS(COALESCE(pj.total_debit, 0) - COALESCE(pj.total_credit, 0)) > 0.01 THEN 'UNBALANCED_JOURNAL'
    WHEN ABS(COALESCE(pj.total_debit, 0) - po.order_total) > 0.01 THEN 'AMOUNT_MISMATCH'
    ELSE 'OK'
  END AS recon_status
FROM paid_orders po
LEFT JOIN pos_payment_journals pj
  ON pj.source_ref = CONCAT('ORDER:', po.order_id);

-- Summary harian.
SELECT
  recon_status,
  COUNT(*) AS total_rows,
  COALESCE(SUM(order_total), 0) AS total_order_amount
FROM tmp_recon_pos_payment
GROUP BY recon_status
ORDER BY recon_status;

-- Detail mismatch untuk investigasi cepat.
SELECT
  order_id,
  branch_id,
  payment_method,
  order_total,
  items_subtotal,
  inferred_discount,
  expected_source_ref,
  journal_id,
  journal_status,
  total_debit,
  total_credit,
  recon_status
FROM tmp_recon_pos_payment
WHERE recon_status <> 'OK'
ORDER BY order_id;

-- Duplikasi jurnal per order (harusnya 1).
WITH params AS (
  SELECT
    CAST(:'recon_date' AS DATE) AS recon_date,
    CAST(NULLIF(:'branch_id', '') AS INT) AS branch_id
)
SELECT
  je.source_ref,
  COUNT(*) AS journal_count,
  ARRAY_AGG(je.id ORDER BY je.id DESC) AS journal_ids
FROM journal_entries je
CROSS JOIN params p
WHERE je.source_module = 'POS'
  AND je.idempotency_key LIKE 'AUTO:POS_PAYMENT:%'
  AND je.posting_date = p.recon_date
  AND (p.branch_id IS NULL OR je.branch_id = p.branch_id)
GROUP BY je.source_ref
HAVING COUNT(*) > 1
ORDER BY journal_count DESC, source_ref;
