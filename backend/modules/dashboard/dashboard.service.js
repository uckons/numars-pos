const db = require("../../config/db")

exports.kasir = async (user) => {
  const branchId = user.branch_id

  const activeOrders = await db.query(
    `SELECT COUNT(*) FROM orders WHERE status='OPEN' AND branch_id=$1`,
    [branchId]
  )

  const todayRevenue = await db.query(
    `WITH branch_schedule AS (
       SELECT open_time, close_time
       FROM branches
       WHERE id = $1
     ),
     outlet_window AS (
       SELECT
         CASE
           WHEN close_time <= open_time AND CURRENT_TIME < close_time
             THEN (CURRENT_DATE - INTERVAL '1 day') + open_time
           WHEN close_time <= open_time
             THEN CURRENT_DATE + open_time
           WHEN CURRENT_TIME >= open_time
             THEN CURRENT_DATE + open_time
           ELSE (CURRENT_DATE - INTERVAL '1 day') + open_time
         END AS start_at,
         CASE
           WHEN close_time <= open_time AND CURRENT_TIME < close_time
             THEN CURRENT_DATE + close_time
           WHEN close_time <= open_time
             THEN (CURRENT_DATE + INTERVAL '1 day') + close_time
           WHEN CURRENT_TIME >= open_time
             THEN CURRENT_DATE + close_time
           ELSE CURRENT_DATE + close_time
         END AS end_at
       FROM branch_schedule
     )
     SELECT COALESCE(SUM(o.total), 0)
     FROM orders o
     CROSS JOIN outlet_window w
     WHERE o.status = 'PAID'
       AND o.branch_id = $1
       AND o.created_at >= w.start_at
       AND o.created_at < w.end_at`,
    [branchId]
  )

  const activeTherapists = await db.query(
    `SELECT COUNT(DISTINCT therapist_id)
     FROM timers
     WHERE end_time IS NULL
     AND branch_id=$1`,
    [branchId]
  )

  return {
    activeOrders: Number(activeOrders.rows[0].count),
    todayRevenue: Number(todayRevenue.rows[0].coalesce),
    activeTherapists: Number(activeTherapists.rows[0].count)
  }
}

const formatDateOnly = (date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const parseDateInput = (raw) => {
  if (!raw) return null
  const value = String(raw).trim()
  if (!value) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [a, b, y] = value.split("/")
    const dayFirst = Number(a) > 12
    const day = dayFirst ? a : b
    const month = dayFirst ? b : a
    const parsed = new Date(`${y}-${month}-${day}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const resolveRange = ({ preset, date_from, date_to }) => {
  const now = new Date()
  let from
  let to

  if (preset === "daily") {
    from = new Date(now)
    from.setHours(0, 0, 0, 0)
    to = new Date(from)
    to.setDate(to.getDate() + 1)
  } else if (preset === "weekly") {
    from = new Date(now)
    from.setDate(from.getDate() - 6)
    from.setHours(0, 0, 0, 0)
    to = new Date(now)
    to.setHours(23, 59, 59, 999)
    to = new Date(to.getTime() + 1)
  } else {
    from = new Date(now)
    from.setDate(from.getDate() - 29)
    from.setHours(0, 0, 0, 0)
    to = new Date(now)
    to.setHours(23, 59, 59, 999)
    to = new Date(to.getTime() + 1)
  }

  if (date_from) {
    const parsedFrom = parseDateInput(date_from)
    if (!parsedFrom) throw new Error("Invalid date_from")
    from = parsedFrom
    from.setHours(0, 0, 0, 0)
  }
  if (date_to) {
    const parsedTo = parseDateInput(date_to)
    if (!parsedTo) throw new Error("Invalid date_to")
    to = parsedTo
    to.setHours(23, 59, 59, 999)
    to = new Date(to.getTime() + 1)
  }

  if (!(from instanceof Date) || Number.isNaN(from.getTime())) {
    throw new Error("Invalid date_from")
  }
  if (!(to instanceof Date) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date_to")
  }
  if (from >= to) {
    to = new Date(from)
    to.setDate(to.getDate() + 1)
  }

  return { from, to }
}

exports.kasirAnalytics = async (user, query = {}) => {
  const branchId = user.branch_id
  const preset = String(query.preset || "monthly").toLowerCase()
  const { from, to } = resolveRange({
    preset,
    date_from: query.date_from,
    date_to: query.date_to
  })

  const summaryRes = await db.query(
    `SELECT
       COUNT(DISTINCT o.id) AS paid_orders,
       COALESCE(SUM(o.total), 0) AS revenue,
       COALESCE(SUM(oi.qty), 0) AS items_sold
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.status = 'PAID'
       AND o.branch_id = $1
       AND o.created_at >= $2
       AND o.created_at < $3`,
    [branchId, from, to]
  )

  const breakdownRes = await db.query(
    `SELECT
       CASE
         WHEN s.type::text IN ('KARAOKE', 'KTV') THEN 'KTV'
         WHEN s.type::text = 'LOUNGE' THEN 'LC'
         ELSE s.type::text
       END AS category,
       COALESCE(SUM(oi.subtotal), 0) AS revenue,
       COALESCE(SUM(oi.qty), 0) AS qty
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN services s ON s.id = oi.service_id
     WHERE o.status = 'PAID'
       AND o.branch_id = $1
       AND o.created_at >= $2
       AND o.created_at < $3
     GROUP BY 1`,
    [branchId, from, to]
  )

  const topFnbRes = await db.query(
    `SELECT
       oi.service_id,
       oi.service_name,
       COALESCE(SUM(oi.qty), 0) AS qty,
       COALESCE(SUM(oi.subtotal), 0) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN services s ON s.id = oi.service_id
     WHERE o.status = 'PAID'
       AND o.branch_id = $1
       AND o.created_at >= $2
       AND o.created_at < $3
       AND s.type = 'FNB'
     GROUP BY oi.service_id, oi.service_name
     ORDER BY qty DESC, revenue DESC
     LIMIT 5`,
    [branchId, from, to]
  )

  const topTherapistRes = await db.query(
    `WITH therapist_rows AS (
       SELECT
         o.id AS order_id,
         oi.subtotal,
         BTRIM(raw_name) AS therapist_name
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       CROSS JOIN LATERAL regexp_split_to_table(COALESCE(oi.therapist_name, ''), ',') AS raw_name
       WHERE o.status = 'PAID'
         AND o.branch_id = $1
         AND o.created_at >= $2
         AND o.created_at < $3
     )
     SELECT
       tr.therapist_name,
       COALESCE(grade_info.grade_name, '-') AS grade_name,
       COUNT(DISTINCT tr.order_id) AS orders,
       COALESCE(SUM(tr.subtotal), 0) AS revenue
     FROM therapist_rows tr
     LEFT JOIN LATERAL (
       SELECT tg.name AS grade_name
       FROM therapists t
       LEFT JOIN therapist_grades tg ON tg.id = t.grade_id
       WHERE LOWER(t.name) = LOWER(tr.therapist_name)
         AND t.branch_id = $1
       ORDER BY t.active DESC NULLS LAST, t.id DESC
       LIMIT 1
     ) grade_info ON true
     WHERE tr.therapist_name <> ''
     GROUP BY tr.therapist_name, grade_info.grade_name
     ORDER BY revenue DESC, orders DESC
     LIMIT 5`,
    [branchId, from, to]
  )

  const categoryTrendRes = await db.query(
    `WITH mapped AS (
       SELECT
         DATE(o.created_at) AS bucket,
         CASE
           WHEN s.type::text IN ('KARAOKE', 'KTV') THEN 'KTV'
           WHEN s.type::text = 'LOUNGE' THEN 'LC'
           ELSE s.type::text
         END AS category,
         COALESCE(oi.subtotal, 0) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN services s ON s.id = oi.service_id
       WHERE o.status = 'PAID'
         AND o.branch_id = $1
         AND o.created_at >= $2
         AND o.created_at < $3
     )
     SELECT
       bucket,
       COALESCE(SUM(CASE WHEN category = 'SPA' THEN revenue END), 0) AS spa,
       COALESCE(SUM(CASE WHEN category = 'LC' THEN revenue END), 0) AS lc,
       COALESCE(SUM(CASE WHEN category = 'FNB' THEN revenue END), 0) AS fnb,
       COALESCE(SUM(CASE WHEN category = 'KTV' THEN revenue END), 0) AS ktv
     FROM mapped
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [branchId, from, to]
  )

  const trendRes = await db.query(
    `SELECT
       DATE(o.created_at) AS bucket,
       COUNT(*) AS orders,
       COALESCE(SUM(o.total), 0) AS revenue
     FROM orders o
     WHERE o.status = 'PAID'
       AND o.branch_id = $1
       AND o.created_at >= $2
       AND o.created_at < $3
     GROUP BY DATE(o.created_at)
     ORDER BY DATE(o.created_at) ASC`,
    [branchId, from, to]
  )

  return {
    range: {
      from: formatDateOnly(from),
      to: formatDateOnly(new Date(to.getTime() - 1))
    },
    summary: {
      paid_orders: Number(summaryRes.rows[0]?.paid_orders || 0),
      revenue: Number(summaryRes.rows[0]?.revenue || 0),
      items_sold: Number(summaryRes.rows[0]?.items_sold || 0)
    },
    breakdown: breakdownRes.rows.map((row) => ({
      category: row.category,
      revenue: Number(row.revenue || 0),
      qty: Number(row.qty || 0)
    })),
    top_fnb: topFnbRes.rows.map((row) => ({
      service_id: Number(row.service_id),
      service_name: row.service_name,
      qty: Number(row.qty || 0),
      revenue: Number(row.revenue || 0)
    })),
    top_therapists: topTherapistRes.rows.map((row) => ({
      therapist_name: row.therapist_name,
      grade_name: row.grade_name,
      orders: Number(row.orders || 0),
      revenue: Number(row.revenue || 0)
    })),
    trend: trendRes.rows.map((row) => ({
      label: formatDateOnly(row.bucket),
      orders: Number(row.orders || 0),
      revenue: Number(row.revenue || 0)
    })),
    category_trend: categoryTrendRes.rows.map((row) => ({
      label: formatDateOnly(row.bucket),
      spa: Number(row.spa || 0),
      lc: Number(row.lc || 0),
      fnb: Number(row.fnb || 0),
      ktv: Number(row.ktv || 0)
    }))
  }
}
