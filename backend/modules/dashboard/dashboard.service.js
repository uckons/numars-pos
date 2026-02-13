const db = require("../../config/db")

exports.kasir = async (user) => {
  const branchId = user.branch_id

  const activeOrders = await db.query(
    `SELECT COUNT(*) FROM orders WHERE status='DRAFT' AND branch_id=$1`,
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

const parseTimeToMinutes = (value, fallback) => {
  const raw = String(value || fallback || "00:00:00")
  const [h = "0", m = "0", s = "0"] = raw.split(":")
  const hh = Number(h)
  const mm = Number(m)
  const ss = Number(s)
  if ([hh, mm, ss].some((v) => Number.isNaN(v))) return 0
  return hh * 60 + mm + ss / 60
}

const shiftDateOnly = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const getCurrentBusinessDate = (now, openTime, closeTime) => {
  const openMinutes = parseTimeToMinutes(openTime, "10:00:00")
  const closeMinutes = parseTimeToMinutes(closeTime, "03:00:00")
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  const overnight = closeMinutes <= openMinutes
  const businessDate = new Date(now)
  businessDate.setHours(0, 0, 0, 0)

  if (overnight) {
    if (nowMinutes < closeMinutes) {
      businessDate.setDate(businessDate.getDate() - 1)
    }
    return businessDate
  }

  if (nowMinutes < openMinutes) {
    businessDate.setDate(businessDate.getDate() - 1)
  }
  return businessDate
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

const resolveRange = ({ preset, date_from, date_to, open_time, close_time }) => {
  const now = new Date()
  const currentBusinessDate = getCurrentBusinessDate(now, open_time, close_time)
  let from
  let to

  if (preset === "daily") {
    from = new Date(currentBusinessDate)
    to = shiftDateOnly(from, 1)
  } else if (preset === "weekly") {
    from = shiftDateOnly(currentBusinessDate, -6)
    to = shiftDateOnly(currentBusinessDate, 1)
  } else {
    from = shiftDateOnly(currentBusinessDate, -29)
    to = shiftDateOnly(currentBusinessDate, 1)
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
    parsedTo.setHours(0, 0, 0, 0)
    to = shiftDateOnly(parsedTo, 1)
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

  const scheduleRes = await db.query(
    `SELECT open_time, close_time FROM branches WHERE id = $1`,
    [branchId]
  )
  const schedule = scheduleRes.rows[0] || { open_time: "10:00:00", close_time: "03:00:00" }

  const { from, to } = resolveRange({
    preset,
    date_from: query.date_from,
    date_to: query.date_to,
    open_time: schedule.open_time,
    close_time: schedule.close_time
  })

  const scopedOrderCte = `WITH branch_schedule AS (
      SELECT
        COALESCE(open_time, '10:00:00'::time) AS open_time,
        COALESCE(close_time, '03:00:00'::time) AS close_time
      FROM branches
      WHERE id = $1
    ),
    business_windows AS (
      SELECT
        day::date AS business_date,
        (day::timestamp + bs.open_time) AS window_start,
        CASE
          WHEN bs.close_time <= bs.open_time THEN (day::timestamp + INTERVAL '1 day' + bs.close_time)
          ELSE (day::timestamp + bs.close_time)
        END AS window_end
      FROM branch_schedule bs
      CROSS JOIN LATERAL generate_series(($2::date - INTERVAL '1 day')::timestamp, $3::date::timestamp, INTERVAL '1 day') AS day
    ),
    orders_scoped AS (
      SELECT
        o.id,
        o.total,
        o.created_at,
        bw.business_date
      FROM orders o
      JOIN business_windows bw
        ON o.created_at >= bw.window_start
       AND o.created_at < bw.window_end
      WHERE o.status = 'PAID'
        AND o.branch_id = $1
        AND bw.business_date >= $2::date
        AND bw.business_date < $3::date
    )`

  const summaryRes = await db.query(
    `${scopedOrderCte}
     , item_summary AS (
       SELECT COALESCE(SUM(oi.qty), 0) AS items_sold
       FROM order_items oi
       JOIN orders_scoped o ON o.id = oi.order_id
     )
     SELECT
       COUNT(*) AS paid_orders,
       COALESCE(SUM(o.total), 0) AS revenue,
       (SELECT items_sold FROM item_summary) AS items_sold
     FROM orders_scoped o
     `,
    [branchId, from, to]
  )

  const breakdownRes = await db.query(
    `${scopedOrderCte}
     SELECT
       CASE
         WHEN s.type::text IN ('KARAOKE', 'KTV') THEN 'KTV'
         WHEN s.type::text = 'LOUNGE' THEN 'LC'
         ELSE s.type::text
       END AS category,
       COALESCE(SUM(oi.subtotal), 0) AS revenue,
       COALESCE(SUM(oi.qty), 0) AS qty
     FROM order_items oi
     JOIN orders_scoped o ON o.id = oi.order_id
     JOIN services s ON s.id = oi.service_id
     GROUP BY 1`,
    [branchId, from, to]
  )

  const topFnbRes = await db.query(
    `${scopedOrderCte}
     SELECT
       oi.service_id,
       oi.service_name,
       COALESCE(SUM(oi.qty), 0) AS qty,
       COALESCE(SUM(oi.subtotal), 0) AS revenue
     FROM order_items oi
     JOIN orders_scoped o ON o.id = oi.order_id
     JOIN services s ON s.id = oi.service_id
     WHERE s.type = 'FNB'
     GROUP BY oi.service_id, oi.service_name
     ORDER BY qty DESC, revenue DESC
     LIMIT 5`,
    [branchId, from, to]
  )

  const topTherapistRes = await db.query(
    `${scopedOrderCte},
     therapist_rows AS (
       SELECT
         o.id AS order_id,
         oi.subtotal,
         BTRIM(raw_name) AS therapist_name
       FROM order_items oi
       JOIN orders_scoped o ON o.id = oi.order_id
       CROSS JOIN LATERAL regexp_split_to_table(COALESCE(oi.therapist_name, ''), ',') AS raw_name
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
    `${scopedOrderCte},
     mapped AS (
       SELECT
         o.business_date AS bucket,
         CASE
           WHEN s.type::text IN ('KARAOKE', 'KTV') THEN 'KTV'
           WHEN s.type::text = 'LOUNGE' THEN 'LC'
           ELSE s.type::text
         END AS category,
         COALESCE(oi.subtotal, 0) AS revenue
      FROM order_items oi
      JOIN orders_scoped o ON o.id = oi.order_id
      JOIN services s ON s.id = oi.service_id
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
    `${scopedOrderCte}
     SELECT
       o.business_date AS bucket,
       COUNT(*) AS orders,
       COALESCE(SUM(o.total), 0) AS revenue
     FROM orders_scoped o
     GROUP BY o.business_date
     ORDER BY o.business_date ASC`,
    [branchId, from, to]
  )


  const serviceDetailRes = await db.query(
    `${scopedOrderCte}
     SELECT
       CASE
         WHEN s.type::text IN ('KARAOKE', 'KTV') THEN 'KTV'
         WHEN s.type::text = 'LOUNGE' THEN 'LC'
         ELSE s.type::text
       END AS category,
       oi.service_id,
       oi.service_name,
       COALESCE(SUM(oi.qty), 0) AS qty,
       COALESCE(SUM(oi.subtotal), 0) AS revenue
     FROM order_items oi
     JOIN orders_scoped o ON o.id = oi.order_id
     JOIN services s ON s.id = oi.service_id
     GROUP BY 1, oi.service_id, oi.service_name
     ORDER BY 1 ASC, revenue DESC, qty DESC`,
    [branchId, from, to]
  )

  const therapistDetailRes = await db.query(
    `${scopedOrderCte},
     therapist_rows AS (
       SELECT
         o.id AS order_id,
         oi.subtotal,
         BTRIM(raw_name) AS therapist_name
       FROM order_items oi
       JOIN orders_scoped o ON o.id = oi.order_id
       CROSS JOIN LATERAL regexp_split_to_table(COALESCE(oi.therapist_name, ''), ',') AS raw_name
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
     ORDER BY revenue DESC, orders DESC`,
    [branchId, from, to]
  )


  const pnlServiceRes = await db.query(
    `${scopedOrderCte},
     mapped_rows AS (
       SELECT
         oi.service_id,
         oi.service_name,
         CASE
           WHEN s.type::text IN ('KARAOKE', 'KTV') THEN 'KTV'
           WHEN s.type::text = 'LOUNGE' THEN 'LC'
           ELSE s.type::text
         END AS category,
         COALESCE(oi.qty, 0) AS qty,
         COALESCE(oi.subtotal, 0) AS subtotal,
         COALESCE(oi.is_package_snapshot, false) AS is_package,
         LOWER(COALESCE(oi.price_label, '')) IN ('hh', 'non hh', 'happy', 'happy hour', 'non happy hour') AS is_hh_tagged,
         COALESCE(
           LOWER(COALESCE(oi.price_label, '')) IN ('hh', 'happy', 'happy hour')
           OR hh_match.active = true,
           false
         ) AS is_happy
       FROM order_items oi
       JOIN orders_scoped o ON o.id = oi.order_id
       JOIN services s ON s.id = oi.service_id
       LEFT JOIN LATERAL (
         SELECT true AS active
         FROM happy_hours hh
         WHERE hh.branch_id = $1
           AND (
             (
               hh.start_time <= hh.end_time
               AND timezone('Asia/Jakarta', o.created_at)::time BETWEEN hh.start_time AND hh.end_time
             )
             OR (
               hh.start_time > hh.end_time
               AND (
                 timezone('Asia/Jakarta', o.created_at)::time >= hh.start_time
                 OR timezone('Asia/Jakarta', o.created_at)::time <= hh.end_time
               )
             )
           )
           AND (
             hh.service_type IS NULL
             OR hh.service_type = s.type::text
             OR hh.service_type = 'ALL'
             OR (hh.service_type = 'LC' AND s.type = 'LOUNGE')
             OR (hh.service_type = 'LOUNGE' AND s.type = 'LC')
           )
         LIMIT 1
       ) hh_match ON true
     )
     SELECT
       service_id,
       service_name,
       category,
       COALESCE(SUM(qty), 0) AS qty,
       COALESCE(SUM(CASE WHEN is_happy THEN subtotal END), 0) AS happy_hour_revenue,
       COALESCE(SUM(CASE WHEN (category <> 'FNB' AND NOT is_happy) OR (category = 'FNB' AND is_hh_tagged AND NOT is_happy) THEN subtotal END), 0) AS non_happy_hour_revenue,
       COALESCE(SUM(CASE WHEN category = 'FNB' AND NOT is_happy AND is_package THEN subtotal END), 0) AS package_revenue,
       COALESCE(SUM(CASE WHEN category = 'FNB' AND NOT is_happy AND NOT is_package AND NOT is_hh_tagged THEN subtotal END), 0) AS non_package_revenue,
       COALESCE(SUM(subtotal), 0) AS total_revenue
     FROM mapped_rows
     GROUP BY service_id, service_name, category
     ORDER BY category ASC, total_revenue DESC, qty DESC`,
    [branchId, from, to]
  )

  const therapistPnlRes = await db.query(
    `${scopedOrderCte},
     therapist_rows AS (
       SELECT
         o.id AS order_id,
         oi.service_name,
         COALESCE(oi.qty, 0) AS qty,
         CASE
           WHEN s.type::text IN ('KARAOKE', 'KTV') THEN 'KTV'
           WHEN s.type::text = 'LOUNGE' THEN 'LC'
           ELSE s.type::text
         END AS category,
         COALESCE(oi.subtotal, 0) AS subtotal,
         COALESCE(oi.is_package_snapshot, false) AS is_package,
         LOWER(COALESCE(oi.price_label, '')) IN ('hh', 'non hh', 'happy', 'happy hour', 'non happy hour') AS is_hh_tagged,
         COALESCE(
           LOWER(COALESCE(oi.price_label, '')) IN ('hh', 'happy', 'happy hour')
           OR hh_match.active = true,
           false
         ) AS is_happy,
         BTRIM(raw_name) AS therapist_name
       FROM order_items oi
       JOIN orders_scoped o ON o.id = oi.order_id
       JOIN services s ON s.id = oi.service_id
       LEFT JOIN LATERAL (
         SELECT true AS active
         FROM happy_hours hh
         WHERE hh.branch_id = $1
           AND (
             (
               hh.start_time <= hh.end_time
               AND timezone('Asia/Jakarta', o.created_at)::time BETWEEN hh.start_time AND hh.end_time
             )
             OR (
               hh.start_time > hh.end_time
               AND (
                 timezone('Asia/Jakarta', o.created_at)::time >= hh.start_time
                 OR timezone('Asia/Jakarta', o.created_at)::time <= hh.end_time
               )
             )
           )
           AND (
             hh.service_type IS NULL
             OR hh.service_type = s.type::text
             OR hh.service_type = 'ALL'
             OR (hh.service_type = 'LC' AND s.type = 'LOUNGE')
             OR (hh.service_type = 'LOUNGE' AND s.type = 'LC')
           )
         LIMIT 1
       ) hh_match ON true
       CROSS JOIN LATERAL regexp_split_to_table(COALESCE(oi.therapist_name, ''), ',') AS raw_name
     )
     SELECT
       tr.therapist_name,
       tr.category,
       tr.service_name,
       COALESCE(COUNT(DISTINCT tr.order_id), 0) AS orders,
       COALESCE(SUM(tr.qty), 0) AS qty,
       COALESCE(SUM(CASE WHEN tr.is_happy THEN tr.subtotal END), 0) AS happy_hour_revenue,
       COALESCE(SUM(CASE WHEN (tr.category <> 'FNB' AND NOT tr.is_happy) OR (tr.category = 'FNB' AND tr.is_hh_tagged AND NOT tr.is_happy) THEN tr.subtotal END), 0) AS non_happy_hour_revenue,
       COALESCE(SUM(CASE WHEN tr.category = 'FNB' AND NOT tr.is_happy AND tr.is_package THEN tr.subtotal END), 0) AS package_revenue,
       COALESCE(SUM(CASE WHEN tr.category = 'FNB' AND NOT tr.is_happy AND NOT tr.is_package AND NOT tr.is_hh_tagged THEN tr.subtotal END), 0) AS non_package_revenue,
       COALESCE(SUM(tr.subtotal), 0) AS total_revenue,
       COALESCE(SUM(SUM(tr.subtotal)) OVER (PARTITION BY tr.therapist_name), 0) AS therapist_total_kerja,
       COALESCE(grade_info.grade_name, '-') AS grade_name
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
       AND tr.category IN ('SPA', 'LC')
     GROUP BY tr.therapist_name, tr.category, tr.service_name, grade_info.grade_name
     ORDER BY tr.therapist_name ASC, tr.category ASC, total_revenue DESC`,
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
    })),
    service_details: serviceDetailRes.rows.map((row) => ({
      category: row.category,
      service_id: Number(row.service_id),
      service_name: row.service_name,
      qty: Number(row.qty || 0),
      revenue: Number(row.revenue || 0)
    })),
    therapist_details: therapistDetailRes.rows.map((row) => ({
      therapist_name: row.therapist_name,
      grade_name: row.grade_name,
      orders: Number(row.orders || 0),
      revenue: Number(row.revenue || 0)
    })),
    pnl_services: pnlServiceRes.rows.map((row) => ({
      service_id: Number(row.service_id),
      service_name: row.service_name,
      category: row.category,
      qty: Number(row.qty || 0),
      happy_hour_revenue: Number(row.happy_hour_revenue || 0),
      non_happy_hour_revenue: Number(row.non_happy_hour_revenue || 0),
      package_revenue: Number(row.package_revenue || 0),
      non_package_revenue: Number(row.non_package_revenue || 0),
      non_happy_package_revenue: Number(row.package_revenue || 0),
      non_happy_non_package_revenue: Number(row.non_package_revenue || 0),
      total_revenue: Number(row.total_revenue || 0)
    })),
    therapist_pnl: therapistPnlRes.rows.map((row) => ({
      therapist_name: row.therapist_name,
      grade_name: row.grade_name,
      category: row.category,
      service_name: row.service_name,
      orders: Number(row.orders || 0),
      qty: Number(row.qty || 0),
      happy_hour_revenue: Number(row.happy_hour_revenue || 0),
      non_happy_hour_revenue: Number(row.non_happy_hour_revenue || 0),
      package_revenue: Number(row.package_revenue || 0),
      non_package_revenue: Number(row.non_package_revenue || 0),
      non_happy_package_revenue: Number(row.package_revenue || 0),
      non_happy_non_package_revenue: Number(row.non_package_revenue || 0),
      total_revenue: Number(row.total_revenue || 0),
      therapist_total_kerja: Number(row.therapist_total_kerja || 0)
    }))
  }
}

const ensureOutletSessionTable = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS outlet_sessions (
      id SERIAL PRIMARY KEY,
      branch_id INT NOT NULL,
      business_date DATE NOT NULL,
      opened_by INT NOT NULL,
      opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
      closed_by INT,
      closed_at TIMESTAMP,
      note TEXT
    )
  `)
}

exports.getOutletSessionStatus = async (user) => {
  const branchId = user.branch_id
  await ensureOutletSessionTable(db)

  const { rows } = await db.query(
    `SELECT * FROM outlet_sessions WHERE branch_id=$1 ORDER BY opened_at DESC LIMIT 1`,
    [branchId]
  )

  return rows[0] || null
}

exports.openOutletSession = async (user, data = {}) => {
  const branchId = user.branch_id
  await ensureOutletSessionTable(db)

  const existing = await db.query(
    `SELECT id FROM outlet_sessions WHERE branch_id=$1 AND closed_at IS NULL LIMIT 1`,
    [branchId]
  )
  if (existing.rows.length) throw new Error('Outlet sudah dalam status OPEN')

  const businessDate = data.business_date || new Date().toISOString().slice(0, 10)
  const { rows } = await db.query(
    `INSERT INTO outlet_sessions (branch_id, business_date, opened_by, note)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [branchId, businessDate, user.id, data.note || null]
  )

  return rows[0]
}

exports.closeOutletSession = async (user, data = {}) => {
  const branchId = user.branch_id
  await ensureOutletSessionTable(db)

  const { rows } = await db.query(
    `UPDATE outlet_sessions
     SET closed_by=$1, closed_at=NOW(), note=COALESCE($2, note)
     WHERE id = (
       SELECT id FROM outlet_sessions
       WHERE branch_id=$3 AND closed_at IS NULL
       ORDER BY opened_at DESC
       LIMIT 1
     )
     RETURNING *`,
    [user.id, data.note || null, branchId]
  )

  if (!rows.length) throw new Error('Tidak ada session OPEN untuk ditutup')
  return rows[0]
}

exports.ensureOutletCanReceiveOrder = async (user) => {
  const branchId = user.branch_id
  await ensureOutletSessionTable(db)

  const active = await db.query(
    `SELECT id FROM outlet_sessions WHERE branch_id=$1 AND closed_at IS NULL LIMIT 1`,
    [branchId]
  )
  if (active.rows.length) return

  const scheduleRes = await db.query(`SELECT open_time FROM branches WHERE id=$1`, [branchId])
  const openTime = scheduleRes.rows[0]?.open_time || '10:00:00'

  const now = new Date()
  const [h, m, s] = String(openTime).split(':').map((v) => Number(v || 0))
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  const openMinutes = h * 60 + m + s / 60

  if (nowMinutes < openMinutes) {
    throw new Error('Outlet belum buka, mohon contact supervisor untuk start jam outlet.')
  }
}
