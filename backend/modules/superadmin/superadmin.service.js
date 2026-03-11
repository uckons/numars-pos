const db = require("../../config/db")
const bcrypt = require("bcrypt")
const printerTargetService = require("../printers/printer-target.service")
const journalPostingService = require("../accounting/journal-posting.service")

exports.dashboard = async () => {
  const users = await db.query("SELECT COUNT(*) FROM users")
  const branches = await db.query("SELECT COUNT(*) FROM branches")
  const orders = await db.query("SELECT COUNT(*) FROM orders WHERE status='PAID'")
  const revenue = await db.query("SELECT COALESCE(SUM(total),0) FROM orders WHERE status='PAID'")

  return {
    users: users.rows[0].count,
    branches: branches.rows[0].count,
    orders: orders.rows[0].count,
    revenue: revenue.rows[0].coalesce
  }
}

exports.users = async () => {
  return (await db.query(`
    SELECT u.id,u.username,u.role,u.active,b.name branch
    FROM users u
    LEFT JOIN branches b ON b.id=u.branch_id
    ORDER BY u.id
  `)).rows
}

exports.createUser = async ({ username, password, role, branch_id }) => {
  const hash = await bcrypt.hash(password, 10)
  return db.query(
    "INSERT INTO users(username,password,role,branch_id) VALUES($1,$2,$3,$4)",
    [username, hash, role, branch_id || null]
  )
}

exports.toggleUser = async (id) => {
  return db.query("UPDATE users SET active = NOT active WHERE id=$1", [id])
}

exports.resetPassword = async (id) => {
  const hash = await bcrypt.hash("Numars!212#", 10)
  return db.query("UPDATE users SET password=$1 WHERE id=$2", [hash, id])
}

exports.branches = async () => {
  return (await db.query("SELECT * FROM branches ORDER BY id")).rows
}

exports.createBranch = async ({ name }) => {
  return db.query("INSERT INTO branches(name) VALUES($1)", [name])
}

//exports.orders = async () => {
//  return (await db.query(`
//    SELECT id, total, category, created_at
//    FROM orders
//    ORDER BY created_at DESC
//    LIMIT 50
//  `)).rows
//}
//exports.orders = async (db) => {
//  const rows = await db.query(`
//    SELECT
//      COUNT(DISTINCT o.id) AS total_orders,

//      COUNT(DISTINCT o.id) FILTER (WHERE s.type = 'SPA') AS spa,
//      COUNT(DISTINCT o.id) FILTER (WHERE s.type = 'LC') AS lc,
//      COUNT(DISTINCT o.id) FILTER (WHERE s.type = 'FNB') AS fnb,
//      COUNT(DISTINCT o.id) FILTER (WHERE s.type = 'KARAOKE') AS karaoke

//    FROM orders o
//    LEFT JOIN order_items oi ON oi.order_id = o.id
//    LEFT JOIN services s ON s.id = oi.service_id
//    WHERE DATE(o.created_at) = CURRENT_DATE
//  `)
//
//  return rows.rows[0]
//}
exports.orders = async () => {
  const { rows: fnbCostColumnRows } = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fnb_items'
      AND column_name IN ('cost_price', 'modal')
  `)

  const fnbCostColumns = new Set(fnbCostColumnRows.map((row) => String(row.column_name || '').toLowerCase()))
  const fnbCostExpr = fnbCostColumns.has('cost_price')
    ? 'COALESCE(fi.cost_price, 0)'
    : (fnbCostColumns.has('modal') ? 'COALESCE(fi.modal, 0)' : '0')

  const { rows } = await db.query(`
    SELECT
      o.id,
      o.branch_id,
      b.name AS branch_name,
      o.status,
      COALESCE(SUM(oi.subtotal), 0) AS total,
      COALESCE(SUM(CASE WHEN s.type = 'FNB' THEN oi.qty * ${fnbCostExpr} ELSE 0 END), 0) AS fnb_modal_cost,
      o.created_at,
      STRING_AGG(DISTINCT s.type::text, ', ') AS category
    FROM orders o
    LEFT JOIN branches b ON b.id = o.branch_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN services s ON s.id = COALESCE(oi.variant_service_id, oi.service_id)
    LEFT JOIN fnb_items fi ON fi.service_id = COALESCE(oi.variant_service_id, oi.service_id)
    GROUP BY o.id, o.branch_id, b.name, o.status, o.created_at
    ORDER BY o.created_at DESC
    LIMIT 2000
  `)

  return rows
}



exports.timers = async () => {
  return (await db.query(`
    SELECT t.*, u.name therapist, b.name AS branch_name
    FROM timers t
    LEFT JOIN therapists u ON u.id=t.therapist_id
    LEFT JOIN branches b ON b.id = t.branch_id
    ORDER BY t.start_time DESC
  `)).rows
}
exports.revenueChart = async () => {
  const q = await db.query(`
    SELECT DATE(created_at) as day, SUM(total) as total
    FROM orders
    WHERE status='PAID'
    GROUP BY day
    ORDER BY day
  `)
  return q.rows
}

exports.forceLogout = async (userId) => {
  await db.query("UPDATE users SET token_version = token_version + 1 WHERE id=$1",[userId])
}
exports.auditLogs = async ({ user_id, from, to }) => {
  const params = []
  let where = []

  if (user_id) {
    params.push(user_id)
    where.push(`a.user_id = $${params.length}`)
  }

  if (from) {
    params.push(from)
    where.push(`a.created_at >= $${params.length}`)
  }

  if (to) {
    params.push(to)
    where.push(`a.created_at <= $${params.length}`)
  }

  const sql = `
    SELECT 
      a.id,
      a.action,
      a.created_at,
      u.username
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY a.created_at DESC
    LIMIT 200
  `

  return (await db.query(sql, params)).rows
}

const parseDate = (raw, label) => {
  if (!raw) throw new Error(`${label} wajib diisi`)
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) throw new Error(`${label} tidak valid`)
  return dt
}

const ensureTherapistPayrollTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS therapist_payroll_settlements (
      id SERIAL PRIMARY KEY,
      branch_id INT,
      date_from DATE NOT NULL,
      date_to DATE NOT NULL,
      therapist_id INT NOT NULL,
      work_count INT NOT NULL DEFAULT 0,
      commission_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      paid_at TIMESTAMP NOT NULL DEFAULT NOW(),
      paid_by INT,
      note TEXT
    )
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_therapist_payroll_branch_dates
    ON therapist_payroll_settlements (branch_id, date_from, date_to)
  `)
}


const ensureAgentProfileStorage = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS agent_profiles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS agent_profile_grade_cuts (
      id SERIAL PRIMARY KEY,
      agent_profile_id INT NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
      grade_id INT NOT NULL REFERENCES therapist_grades(id) ON DELETE CASCADE,
      cut_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (agent_profile_id, grade_id)
    )
  `)

  await db.query(`
    ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS agent_profile_id INT REFERENCES agent_profiles(id)
  `)

  await db.query(`
    ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS agent_cut_override NUMERIC(14,2)
  `)
}

const resolveCommissionExpr = async () => {
  const { rows } = await db.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'therapist_grades' AND column_name = 'commission_amount'
    ) AS has_commission_amount
  `)

  return rows[0]?.has_commission_amount
    ? 'COALESCE(g.commission_amount, g.commission_percent, 0)'
    : 'COALESCE(g.commission_percent, 0)'
}

exports.getTherapistPayrollSummary = async ({ branch_id, date_from, date_to }) => {
  await ensureTherapistPayrollTable()
  await ensureAgentProfileStorage()

  const from = parseDate(date_from, 'Tanggal mulai')
  const to = parseDate(date_to, 'Tanggal akhir')
  if (to < from) throw new Error('Tanggal akhir tidak boleh kurang dari tanggal mulai')

  const commissionExpr = await resolveCommissionExpr()
  const params = [from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)]
  let branchFilter = ''

  if (branch_id && String(branch_id).toUpperCase() !== 'ALL') {
    params.push(branch_id)
    branchFilter = ` AND t.branch_id = $${params.length}`
  }

  const payrollQuery = `
    WITH work_rows AS (
      SELECT
        t.therapist_id,
        COUNT(*)::int AS work_count,
        COUNT(*) FILTER (WHERE s.type = 'SPA')::int AS spa_work_count,
        COUNT(*) FILTER (WHERE s.type IN ('LC', 'LOUNGE'))::int AS lc_work_count
      FROM timers t
      LEFT JOIN services s ON s.id = t.service_id
      WHERE t.end_time IS NOT NULL
        AND t.therapist_id IS NOT NULL
        AND DATE(t.end_time) BETWEEN $1::date AND $2::date
        ${branchFilter}
      GROUP BY t.therapist_id
    ), settlements AS (
      SELECT therapist_id, COALESCE(SUM(amount),0) AS paid_amount
      FROM therapist_payroll_settlements
      WHERE date_from = $1::date
        AND date_to = $2::date
        ${branchFilter.replaceAll('t.', '')}
      GROUP BY therapist_id
    )
    SELECT
      w.therapist_id,
      COALESCE(th.name, 'Unknown Therapist') AS therapist_name,
      COALESCE(g.name, '-') AS grade_name,
      COALESCE(ap.name, '-') AS agent_profile_name,
      ${commissionExpr} AS commission_amount,
      COALESCE(th.agent_cut_override, apgc.cut_amount, 0)::numeric(14,2) AS agent_cut_amount,
      w.spa_work_count,
      w.lc_work_count,
      w.work_count,
      (w.work_count * ${commissionExpr})::numeric(14,2) AS gross_amount,
      (w.work_count * COALESCE(th.agent_cut_override, apgc.cut_amount, 0))::numeric(14,2) AS agent_deduction_amount,
      ((w.work_count * ${commissionExpr}) - (w.work_count * COALESCE(th.agent_cut_override, apgc.cut_amount, 0)))::numeric(14,2) AS net_amount,
      COALESCE(s.paid_amount, 0)::numeric(14,2) AS paid_amount,
      (((w.work_count * ${commissionExpr}) - (w.work_count * COALESCE(th.agent_cut_override, apgc.cut_amount, 0))) - COALESCE(s.paid_amount, 0))::numeric(14,2) AS unsettled_amount,
      CASE WHEN COALESCE(s.paid_amount,0) > 0 THEN true ELSE false END AS already_paid
    FROM work_rows w
    LEFT JOIN therapists th ON th.id = w.therapist_id
    LEFT JOIN therapist_grades g ON g.id = th.grade_id
    LEFT JOIN agent_profiles ap ON ap.id = th.agent_profile_id
    LEFT JOIN agent_profile_grade_cuts apgc ON apgc.agent_profile_id = th.agent_profile_id AND apgc.grade_id = th.grade_id
    LEFT JOIN settlements s ON s.therapist_id = w.therapist_id
    ORDER BY therapist_name ASC
  `

  const rows = (await db.query(payrollQuery, params)).rows
  const hasSettled = rows.some((r) => Number(r.paid_amount || 0) > 0)

  return {
    range: { date_from: params[0], date_to: params[1], branch_id: branch_id || 'ALL' },
    has_settlement_in_range: hasSettled,
    rows: rows.map((r) => ({
      therapist_id: Number(r.therapist_id),
      therapist_name: r.therapist_name,
      grade_name: r.grade_name,
      agent_profile_name: r.agent_profile_name,
      spa_work_count: Number(r.spa_work_count || 0),
      lc_work_count: Number(r.lc_work_count || 0),
      work_count: Number(r.work_count || 0),
      commission_amount: Number(r.commission_amount || 0),
      gross_amount: Number(r.gross_amount || 0),
      agent_cut_amount: Number(r.agent_cut_amount || 0),
      agent_deduction_amount: Number(r.agent_deduction_amount || 0),
      net_amount: Number(r.net_amount || 0),
      paid_amount: Number(r.paid_amount || 0),
      unsettled_amount: Number(r.unsettled_amount || 0),
      already_paid: Boolean(r.already_paid)
    }))
  }
}

exports.settleTherapistPayroll = async (user, { branch_id, date_from, date_to, note }) => {
  const summary = await exports.getTherapistPayrollSummary({ branch_id, date_from, date_to })

  if (summary.has_settlement_in_range) {
    throw new Error('Range sudah memiliki pembayaran terapis. Pilih range lain agar tidak double hitung.')
  }

  const dateFrom = summary.range.date_from
  const dateTo = summary.range.date_to
  const settleRows = summary.rows.filter((r) => r.unsettled_amount > 0)

  if (!settleRows.length) {
    throw new Error('Tidak ada nominal payroll yang perlu disettle di range ini')
  }

  await ensureTherapistPayrollTable()

  for (const row of settleRows) {
    await db.query(
      `INSERT INTO therapist_payroll_settlements
        (branch_id, date_from, date_to, therapist_id, work_count, commission_amount, amount, paid_by, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        summary.range.branch_id === 'ALL' ? null : summary.range.branch_id,
        dateFrom,
        dateTo,
        row.therapist_id,
        row.work_count,
        row.commission_amount,
        row.unsettled_amount,
        user?.id || null,
        note || null
      ]
    )
  }


  const settledAmount = settleRows.reduce((a, r) => a + Number(r.unsettled_amount || 0), 0)

  await journalPostingService.postAutoJournal({
    event_code: 'THERAPIST_COMMISSION_SETTLE',
    variant: 'DEFAULT',
    amount: settledAmount,
    branch_id: summary.range.branch_id === 'ALL' ? null : summary.range.branch_id,
    actor_id: user?.id || null,
    source_ref: `THERAPIST_PAYROLL:${dateFrom}:${dateTo}:${summary.range.branch_id || 'ALL'}`,
    description: `Auto jurnal settle payroll terapis ${dateFrom} s/d ${dateTo}`
  })

  return {
    message: 'Payroll terapis berhasil disettle',
    settled_count: settleRows.length,
    settled_amount: settledAmount
  }
}


exports.getPrinterTargets = async ({ branch_id, channel }) => {
  return printerTargetService.listPrinterTargets({
    db,
    branchId: branch_id,
    channel
  })
}

exports.upsertPrinterTarget = async (payload = {}) => {
  return printerTargetService.upsertPrinterTarget({
    db,
    payload
  })
}

exports.deletePrinterTarget = async (id) => {
  return printerTargetService.deletePrinterTarget({
    db,
    id
  })
}
