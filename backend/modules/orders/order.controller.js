const service = require("./order.service")
const stockService = require("../stock/stock.service")
const { writeAuditLog: writeAuditEntry } = require("../../utils/audit")
const dashboardService = require("../dashboard/dashboard.service")

const parseOrderId = (rawId) => {
  const orderId = Number(rawId)
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new Error("Invalid order id")
  }
  return orderId
}

const VOID_UNDO_WINDOW_MINUTES = 10

const roleRoom = (branchId, role = "") => `branch:${branchId}:role:${String(role).toLowerCase().replace(/\s+/g, "-")}`

const ensureBarWorkflowTables = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS bar_orders (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      branch_id INT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      items_snapshot JSONB NOT NULL,
      note TEXT,
      requested_by INT,
      accepted_by INT,
      delivered_by INT,
      cancelled_by INT,
      created_at TIMESTAMP DEFAULT NOW(),
      accepted_at TIMESTAMP,
      delivered_at TIMESTAMP,
      cancelled_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS bar_messages (
      id SERIAL PRIMARY KEY,
      branch_id INT NOT NULL,
      order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      bar_order_id INT REFERENCES bar_orders(id) ON DELETE SET NULL,
      type VARCHAR(30) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      payload JSONB,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      read_at TIMESTAMP
    )
  `)
}

const ensureUndoVoidApprovalTable = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS undo_void_requests (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      branch_id INT NOT NULL,
      requested_by INT NOT NULL,
      reason TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      reviewed_by INT,
      review_note TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      reviewed_at TIMESTAMP
    )
  `)
}

const buildBarOrderSnapshot = async (db, orderId) => {
  const { rows } = await db.query(
    [
      "SELECT fi.id AS fnb_item_id, oi.service_id, oi.service_name, oi.qty",
      "FROM order_items oi",
      "JOIN services s ON s.id = oi.service_id",
      "JOIN fnb_items fi ON fi.service_id = s.id",
      "WHERE oi.order_id=$1 AND s.type='FNB'"
    ].join(" "),
    [orderId]
  )
  return rows.map(r => ({
    fnb_item_id: Number(r.fnb_item_id),
    service_id: Number(r.service_id),
    service_name: r.service_name,
    qty: Number(r.qty || 0)
  }))
}


const mapQtyByService = (rows = []) => {
  const map = new Map()
  for (const row of rows) {
    const key = Number(row.service_id)
    const qty = Number(row.qty || 0)
    map.set(key, (map.get(key) || 0) + qty)
  }
  return map
}

const buildIncrementalFnbSnapshot = async (db, orderId, previousRows = []) => {
  const latestRows = await buildBarOrderSnapshot(db, orderId)
  const prevQtyByService = mapQtyByService(previousRows)

  return latestRows
    .map(item => {
      const prevQty = Number(prevQtyByService.get(Number(item.service_id)) || 0)
      const deltaQty = Number(item.qty || 0) - prevQty
      return {
        ...item,
        qty: deltaQty
      }
    })
    .filter(item => Number(item.qty || 0) > 0)
}

const emitBarOrderNew = (req, payload) => {
  const io = req.app.get("io")
  if (!io) return
  io.to(roleRoom(payload.branch_id, "Staff Bar")).emit("bar:order:new", payload)
  io.to(roleRoom(payload.branch_id, "Supervisor")).emit("bar:order:new", payload)
  io.to(roleRoom(payload.branch_id, "Manager")).emit("bar:order:new", payload)
}

const emitKasirOrderUpdate = (req, payload) => {
  const io = req.app.get("io")
  if (!io) return
  io.to(roleRoom(payload.branch_id, "Kasir")).emit("bar:order:update", payload)
}

const emitUndoVoidRequestNew = (req, payload) => {
  const io = req.app.get("io")
  if (!io) return
  io.to(roleRoom(payload.branch_id, "Supervisor")).emit("orders:undo-void:request:new", payload)
  io.to(roleRoom(payload.branch_id, "Manager")).emit("orders:undo-void:request:new", payload)
}

const createKasirBarMessage = async (db, payload = {}) => {
  const { rows } = await db.query(
    `INSERT INTO bar_messages
      (branch_id, order_id, bar_order_id, type, title, message, payload, is_read)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,false)
     RETURNING *`,
    [
      payload.branch_id,
      payload.order_id,
      payload.bar_order_id || null,
      payload.type || "INFO",
      payload.title || "Update dari Staff Bar",
      payload.message || null,
      JSON.stringify(payload.payload || {})
    ]
  )

  return rows[0]
}


exports.create = async (req, res) => {
  try {
    const db = req.app.get("db")
    const user = req.user
    await dashboardService.ensureOutletCanReceiveOrder(user)

    const order = await service.createOrder(db, user)
    await writeAuditEntry(db, req.user?.id, "ORDER_CREATE", { order_id: order?.id || null, branch_id: user?.branch_id || null })
    res.json(order)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.addItem = async (req, res) => {
  try {
    const db = req.app.get("db")
    const orderId = parseOrderId(req.params.id)
    const { service_id, qty } = req.body

    const item = await service.addItem(db, orderId, service_id, qty || 1)
    await writeAuditEntry(db, req.user?.id, "ORDER_ADD_ITEM", { order_id: orderId, service_id, qty: Number(qty || 1) })
    res.json(item)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.getAll = async (req, res) => {
  try {
    const db = req.app.get("db")
    const user = req.user

    const orders = await service.getOrdersByBranch(db, user)
    res.json(orders)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.close = async (req, res) => {
  try {
    const db = req.app.get("db")
    const orderId = parseOrderId(req.params.id)
    const { items, payment_method } = req.body
    const orderStatusRes = await db.query(
      "SELECT status FROM orders WHERE id = $1",
      [orderId]
    )
    const previousStatus = orderStatusRes.rows[0]?.status
    // 🆕 Validasi: items tidak boleh kosong
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Cannot close order with empty items" })
    }

    const { rows: existingOrderItems } = await db.query(
      `SELECT service_id, service_name, qty, price, subtotal, therapist_name, room_name
       FROM order_items
       WHERE order_id = $1
       ORDER BY id ASC`,
      [orderId]
    )

    const existingByKey = new Map()
    for (const row of existingOrderItems) {
      const serviceId = Number(row.service_id)
      const serviceName = String(row.service_name || "")
      const key = `${serviceId}::${serviceName}`
      const bucket = existingByKey.get(key) || []
      bucket.push(row)
      existingByKey.set(key, bucket)
    }

    // Hapus items lama
    await db.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId])

    // Insert items baru
    for (const i of items) {
      const svcResult = await db.query(
        `SELECT name FROM services WHERE id = $1`,
        [i.id]
      )

      const serviceName = i.name || svcResult.rows[0]?.name || "Unknown Service"
      const qty = Number(i.qty || 1)
      const serviceId = Number(i.id)
      const key = `${serviceId}::${serviceName}`
      const existingSnapshot = (existingByKey.get(key) || []).shift() || null

      let unitPrice = Math.round(Number(i.base_price ?? 0))
      let subtotal = Math.round(qty * unitPrice)

      if (existingSnapshot) {
        const snapshotQty = Number(existingSnapshot.qty || 0)
        if (snapshotQty === qty) {
          subtotal = Math.round(Number(existingSnapshot.subtotal || subtotal))
          if (!(unitPrice > 0)) {
            unitPrice = Math.round(Number(existingSnapshot.price || unitPrice))
          }
        }
      }

      await db.query(
        `INSERT INTO order_items (order_id, service_id, service_name, qty, price, subtotal, therapist_name, room_name, price_label, is_package_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          orderId,
          serviceId,
          serviceName,
          qty,
          unitPrice,
          subtotal,
          i.therapist_name || existingSnapshot?.therapist_name || null,
          i.room_name || existingSnapshot?.room_name || null,
          i.price_label || null,
          Boolean(i.is_package)
        ]
      )
    }
  
    // Hitung total baru
    const totalResult = await db.query(
      `SELECT COALESCE(SUM(subtotal), 0) as total 
       FROM order_items 
       WHERE order_id = $1`,
      [orderId]
    )
    const total = Math.round(Number(totalResult.rows[0].total || 0))

    // Update order dengan payment & status PAID
    const result = await db.query(
      `UPDATE orders
       SET status = 'PAID', 
           payment_method = $2,
           total = $3,
           total_amount = $3
       WHERE id = $1
       RETURNING *`,
      [orderId, payment_method || 'CASH', total]
    )

    if (!result.rows.length) {
      throw new Error("Order not found")
    }
    if (previousStatus !== "DRAFT") {
      const fnbItemsRes = await db.query(
        [
          "SELECT fi.id AS fnb_item_id, oi.qty",
          "FROM order_items oi",
          "JOIN services s ON s.id = oi.service_id",
          "JOIN fnb_items fi ON fi.service_id = s.id",
          "WHERE oi.order_id=$1 AND s.type='FNB'"
        ].join(" "),
        [orderId]
      )
        for (const item of fnbItemsRes.rows) {
        await stockService.reduceFnbStock(
          db,
          item.fnb_item_id,
          item.qty
        )
      }
    }

    await writeAuditEntry(db, req.user?.id, "ORDER_PAID", {
      order_id: result.rows[0].id,
      total: result.rows[0].total,
      payment_method: payment_method || "CASH",
      item_count: Array.isArray(items) ? items.length : 0
    })

    res.json({ 
      order_id: result.rows[0].id,
      total: result.rows[0].total,
      status: result.rows[0].status
    })
  } catch (err) {
    console.error("CLOSE ORDER ERROR:", err)
    res.status(400).json({ message: err.message })
  }
}

exports.cancel = async (req, res) => {
  const db = req.app.get("db")
  const orderId = parseOrderId(req.params.id)
  const reason = String(req.body?.reason || "").trim()

  if (!reason) {
    return res.status(400).json({ message: "Void reason wajib diisi" })
  }

  try {
    await db.query('BEGIN')

    const { rows: orderRows } = await db.query(
      `SELECT id, status FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    )

    if (!orderRows.length) {
      await db.query('ROLLBACK')
      return res.status(404).json({ message: 'Order tidak ditemukan' })
    }

    const status = String(orderRows[0].status || '').toUpperCase()
    if (status !== 'DRAFT') {
      await db.query('ROLLBACK')
      return res.status(400).json({ message: 'Void hanya untuk order DRAFT' })
    }

    const { rows: fnbItems } = await db.query(
      [
        "SELECT fi.id AS fnb_item_id, oi.qty",
        "FROM order_items oi",
        "JOIN services s ON s.id = oi.service_id",
        "JOIN fnb_items fi ON fi.service_id = s.id",
        "WHERE oi.order_id=$1 AND s.type='FNB'"
      ].join(" "),
      [orderId]
    )

    for (const item of fnbItems) {
      await stockService.increaseFnbStock(
        db,
        item.fnb_item_id,
        Number(item.qty || 0)
      )
    }

    await db.query(`DELETE FROM commissions WHERE order_id = $1`, [orderId])
    await db.query(`DELETE FROM timers WHERE order_id = $1`, [orderId])

    await db.query(
      "UPDATE orders SET status='CANCELLED' WHERE id=$1",
      [orderId]
    )

    await writeAuditEntry(db, req.user.id, 'VOID_DRAFT_ORDER', {
      order_id: orderId,
      reason,
      at: new Date().toISOString()
    })

    await db.query('COMMIT')
    res.json({ success: true, reason })
  } catch (err) {
    try { await db.query('ROLLBACK') } catch (_) {}
    console.error('VOID ORDER ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}

const performUndoVoid = async (db, { orderId, actorId }) => {
  const { rows: fnbItems } = await db.query(
    [
      "SELECT fi.id AS fnb_item_id, oi.qty",
      "FROM order_items oi",
      "JOIN services s ON s.id = oi.service_id",
      "JOIN fnb_items fi ON fi.service_id = s.id",
      "WHERE oi.order_id=$1 AND s.type='FNB'"
    ].join(" "),
    [orderId]
  )

  for (const item of fnbItems) {
    await stockService.reduceFnbStock(db, item.fnb_item_id, Number(item.qty || 0))
  }

  await db.query("UPDATE orders SET status='DRAFT' WHERE id=$1", [orderId])

  await writeAuditEntry(db, actorId, 'UNDO_VOID_DRAFT_ORDER', {
    order_id: orderId,
    at: new Date().toISOString(),
    window_minutes: VOID_UNDO_WINDOW_MINUTES
  })
}

exports.requestUndoVoid = async (req, res) => {
  const db = req.app.get("db")
  const orderId = parseOrderId(req.params.id)

  try {
    await ensureUndoVoidApprovalTable(db)
    await db.query('BEGIN')

    const { rows: orderRows } = await db.query(
      `SELECT id, status, branch_id FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    )

    if (!orderRows.length) {
      await db.query('ROLLBACK')
      return res.status(404).json({ message: 'Order tidak ditemukan' })
    }

    const status = String(orderRows[0].status || '').toUpperCase()
    if (status !== 'CANCELLED') {
      await db.query('ROLLBACK')
      return res.status(400).json({ message: 'Undo hanya untuk order CANCELLED' })
    }

    const { rows: voidRows } = await db.query(
      `SELECT created_at
       FROM audit_logs
       WHERE action = 'VOID_DRAFT_ORDER'
         AND target::text LIKE $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [`%\"order_id\":${orderId}%`]
    )

    if (!voidRows.length) {
      await db.query('ROLLBACK')
      return res.status(400).json({ message: 'Data audit void tidak ditemukan' })
    }

    const voidedAt = new Date(voidRows[0].created_at)
    const maxUndoAt = new Date(voidedAt.getTime() + VOID_UNDO_WINDOW_MINUTES * 60 * 1000)
    if (new Date() > maxUndoAt) {
      await db.query('ROLLBACK')
      return res.status(400).json({ message: `Undo hanya bisa dalam ${VOID_UNDO_WINDOW_MINUTES} menit setelah void` })
    }

    const existingReq = await db.query(
      `SELECT id FROM undo_void_requests
       WHERE order_id=$1 AND branch_id=$2 AND status='PENDING'
       LIMIT 1`,
      [orderId, req.user.branch_id]
    )

    if (existingReq.rows.length) {
      await db.query('ROLLBACK')
      return res.status(400).json({ message: 'Request undo untuk order ini masih menunggu approval' })
    }

    const reason = String(req.body?.reason || 'Kasir meminta undo void').trim()
    const { rows } = await db.query(
      `INSERT INTO undo_void_requests
       (order_id, branch_id, requested_by, reason, status)
       VALUES ($1,$2,$3,$4,'PENDING')
       RETURNING *`,
      [orderId, req.user.branch_id, req.user.id, reason]
    )

    await db.query('COMMIT')

    emitUndoVoidRequestNew(req, {
      request_id: rows[0].id,
      branch_id: req.user.branch_id,
      order_id: orderId,
      requested_by: req.user.id,
      reason
    })

    res.json({ success: true, message: 'Request undo dikirim ke supervisor/manager', request: rows[0] })
  } catch (err) {
    try { await db.query('ROLLBACK') } catch (_) {}
    console.error('REQUEST UNDO VOID ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}

exports.getUndoVoidRequests = async (req, res) => {
  try {
    const db = req.app.get("db")
    await ensureUndoVoidApprovalTable(db)

    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size) || 20))
    const offset = (page - 1) * pageSize
    const status = String(req.query.status || 'PENDING').toUpperCase()

    const whereStatus = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'].includes(status) ? status : 'PENDING'
    const whereClause = whereStatus === 'ALL' ? 'r.branch_id=$1' : 'r.branch_id=$1 AND r.status=$2'
    const baseParams = whereStatus === 'ALL' ? [req.user.branch_id] : [req.user.branch_id, whereStatus]

    const [{ rows }, countRes] = await Promise.all([
      db.query(
        `SELECT r.*, o.total AS order_total, o.created_at AS order_created_at,
                req_user.name AS requested_by_name,
                rev_user.name AS reviewed_by_name
         FROM undo_void_requests r
         JOIN orders o ON o.id = r.order_id
         LEFT JOIN users req_user ON req_user.id = r.requested_by
         LEFT JOIN users rev_user ON rev_user.id = r.reviewed_by
         WHERE ${whereClause}
         ORDER BY r.created_at DESC
         LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`,
        [...baseParams, pageSize, offset]
      ),
      db.query(`SELECT COUNT(*)::int AS total FROM undo_void_requests r WHERE ${whereClause}`, baseParams)
    ])

    const total = Number(countRes.rows[0]?.total || 0)
    res.json({
      data: rows,
      pagination: { page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) }
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.approveUndoVoidRequest = async (req, res) => {
  const db = req.app.get("db")
  const requestId = Number(req.params.requestId)

  try {
    await ensureUndoVoidApprovalTable(db)
    await db.query('BEGIN')

    const { rows } = await db.query(
      `SELECT * FROM undo_void_requests
       WHERE id=$1 AND branch_id=$2
       FOR UPDATE`,
      [requestId, req.user.branch_id]
    )

    if (!rows.length) {
      await db.query('ROLLBACK')
      return res.status(404).json({ message: 'Request tidak ditemukan' })
    }

    const reqRow = rows[0]
    if (reqRow.status !== 'PENDING') {
      await db.query('ROLLBACK')
      return res.status(400).json({ message: 'Request sudah diproses' })
    }

    const { rows: orderRows } = await db.query(`SELECT id, status FROM orders WHERE id=$1 FOR UPDATE`, [reqRow.order_id])

    if (!orderRows.length) {
      await db.query('ROLLBACK')
      return res.status(404).json({ message: 'Order tidak ditemukan' })
    }

    if (String(orderRows[0].status || '').toUpperCase() !== 'CANCELLED') {
      await db.query('ROLLBACK')
      return res.status(400).json({ message: 'Order tidak lagi berstatus CANCELLED' })
    }

    await performUndoVoid(db, { orderId: reqRow.order_id, actorId: req.user.id })

    const updated = await db.query(
      `UPDATE undo_void_requests
       SET status='APPROVED', reviewed_by=$1, reviewed_at=NOW(), review_note=$2
       WHERE id=$3
       RETURNING *`,
      [req.user.id, String(req.body?.review_note || 'Approved').trim(), requestId]
    )

    await db.query('COMMIT')
    res.json({ success: true, request: updated.rows[0], order_status: 'DRAFT' })
  } catch (err) {
    try { await db.query('ROLLBACK') } catch (_) {}
    res.status(500).json({ message: err.message })
  }
}

exports.rejectUndoVoidRequest = async (req, res) => {
  try {
    const db = req.app.get("db")
    await ensureUndoVoidApprovalTable(db)

    const { rows } = await db.query(
      `UPDATE undo_void_requests
       SET status='REJECTED', reviewed_by=$1, reviewed_at=NOW(), review_note=$2
       WHERE id=$3 AND branch_id=$4 AND status='PENDING'
       RETURNING *`,
      [req.user.id, String(req.body?.review_note || 'Rejected').trim(), Number(req.params.requestId), req.user.branch_id]
    )

    if (!rows.length) {
      return res.status(404).json({ message: 'Request tidak ditemukan / sudah diproses' })
    }

    res.json({ success: true, request: rows[0] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.undoVoid = async (req, res) => {
  return res.status(400).json({
    message: 'Undo void harus melalui approval supervisor/manager. Silakan kirim request undo terlebih dahulu.'
  })
}



exports.createFromPos = async (req, res) => {
  try {
    const db = req.app.get("db")
    const user = req.user
    await dashboardService.ensureOutletCanReceiveOrder(user)
    const { items, payment_method } = req.body

    // 1️⃣ ambil branch
    const userRes = await db.query(
      "SELECT branch_id FROM users WHERE id=$1",
      [user.id]
    )

    if (!userRes.rows[0]?.branch_id) {
      return res.status(400).json({ message: "User belum terikat ke branch" })
    }

    const branchId = userRes.rows[0].branch_id

    // 2️⃣ validasi
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Item kosong" })
    }

    // 3️⃣ create order (PAID)
    const orderRes = await db.query(
      `
      INSERT INTO orders
        (branch_id, user_id, status, payment_method, total)
      VALUES
      ($1,$2,'PAID',$3,0)
      RETURNING id
      `,
      [branchId, user.id, payment_method || "CASH"]
    )

    const orderId = Number(orderRes.rows[0].id)
    let total = 0

    // 4️⃣ loop item (SATU KALI SAJA)
    for (const i of items) {
      const svcRes = await db.query(
        `SELECT id, name, duration_minutes FROM services WHERE id=$1`,
        [i.id]
      )

      if (!svcRes.rows.length) {
        throw new Error("Service tidak ditemukan")
      }

      const svc = svcRes.rows[0]
      const qty = Number(i.qty || 1)
      const unitPrice = Number(i.base_price ?? 0)
      const subtotal = unitPrice * qty

      total += subtotal

      await db.query(
        `
        INSERT INTO order_items
          (order_id, service_id, service_name, qty, price, subtotal, price_label, is_package_snapshot)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [orderId, svc.id, i.name || svc.name, qty, unitPrice, subtotal, i.price_label || null, Boolean(i.is_package)]
      )

      if (svc.duration_minutes && svc.duration_minutes > 0) {
        await db.query(
          `
          INSERT INTO timers
            (order_id, service_id, branch_id, start_time, planned_end_time)
          VALUES
            ($1,$2,$3, now(),
             now() + ($4 || ' minutes')::interval)
          `,
          [
            orderId,
            svc.id,
            branchId,
            `${svc.duration_minutes} minutes`
          ]
        )
      }
    }

    // 5️⃣ update total
    await db.query(
    //  "UPDATE orders SET total=$1 WHERE id=$2",
    //  [total, orderId]
    //"UPDATE orders SET total=$1, payment_method=$2, status='PAID' WHERE id=$3",
     // [total, payment_method || "CASH", orderId]
     "UPDATE orders SET total=$1, payment_method=$2, status='PAID' WHERE id=$3",
      [total, payment_method || "CASH", orderId]
    )
     const fnbItemsRes = await db.query(
      [
        "SELECT fi.id AS fnb_item_id, oi.qty",
        "FROM order_items oi",
        "JOIN services s ON s.id = oi.service_id",
        "JOIN fnb_items fi ON fi.service_id = s.id",
        "WHERE oi.order_id=$1 AND s.type='FNB'"
      ].join(" "),
      [orderId]
    )

    for (const item of fnbItemsRes.rows) {
      await stockService.reduceFnbStock(
        db,
        item.fnb_item_id,
        item.qty
      )
    } 
    res.json({
      success: true,
      order_id: orderId,
    //  total
      total,
      status: "PAID"
    })
  } catch (err) {
    console.error("CREATE POS ORDER ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}
//order draft
exports.createDraftFromPos = async (req, res) => {
  try {
    const db = req.app.get("db")
    const user = req.user
    await dashboardService.ensureOutletCanReceiveOrder(user)
    const { items } = req.body

    const userRes = await db.query(
      "SELECT branch_id FROM users WHERE id=$1",
      [user.id]
    )

    if (!userRes.rows[0]?.branch_id) {
      return res.status(400).json({ message: "User belum terikat ke branch" })
    }

    const branchId = userRes.rows[0].branch_id

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Item kosong" })
    }

    const orderRes = await db.query(
      `
      INSERT INTO orders
        (branch_id, user_id, status, payment_method, total)
      VALUES
        ($1,$2,'DRAFT','CASH',0)
      RETURNING id
      `,
      [branchId, user.id]
    )

    const orderId = Number(orderRes.rows[0].id)
    let total = 0

    for (const i of items) {
      const svcRes = await db.query(
      `SELECT s.id, s.name FROM services s WHERE s.id=$1`, 
        [i.id]
      )

      if (!svcRes.rows.length) {
        throw new Error("Service tidak ditemukan")
      }

      const svc = svcRes.rows[0]
      const qty = Number(i.qty || 1)
      const unitPrice = Number(i.base_price ?? 0)
      const subtotal = unitPrice * qty

      total += subtotal

      await db.query(
        `
        INSERT INTO order_items
          (order_id, service_id, service_name, qty, price, subtotal, price_label, is_package_snapshot)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [orderId, svc.id, i.name || svc.name, qty, unitPrice, subtotal, i.price_label || null, Boolean(i.is_package)]
      )
    }

    await db.query(
      "UPDATE orders SET total=$1 WHERE id=$2",
      [total, orderId]
    )

    await ensureBarWorkflowTables(db)
    const fnbSnapshot = await buildBarOrderSnapshot(db, orderId)
    if (fnbSnapshot.length) {
      await db.query(
        `INSERT INTO bar_orders (order_id, branch_id, status, items_snapshot, requested_by)
         VALUES ($1,$2,'PENDING',$3::jsonb,$4)`,
        [orderId, branchId, JSON.stringify(fnbSnapshot), user.id]
      )

      emitBarOrderNew(req, {
        order_id: orderId,
        branch_id: branchId,
        status: "PENDING",
        items: fnbSnapshot
      })
    }

    res.json({
      success: true,
      order_id: orderId,
      total,
      status: "DRAFT"
    })
  } catch (err) {
    console.error("CREATE POS DRAFT ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

exports.saveDraft = async (req, res) => {
  const db = req.app.get("db")
  let inTransaction = false

  try {
    const idOrder = parseOrderId(req.params.id)
    const { items } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Item kosong" })
    }

    await db.query("BEGIN")
    inTransaction = true

    const previousFnbRows = await buildBarOrderSnapshot(db, idOrder)

    await db.query("DELETE FROM order_items WHERE order_id = $1", [idOrder])

    let total = 0

    for (const item of items) {
      const svcRes = await db.query("SELECT name FROM services WHERE id = $1", [item.id])

      if (!svcRes.rows.length) {
        throw new Error("Service tidak ditemukan")
      }

      const qty = Number(item.qty || 1)
      const unitPrice = Number(item.base_price ?? 0)
      const subtotal = qty * unitPrice
      total += subtotal

      await db.query(
        `INSERT INTO order_items (order_id, service_id, service_name, qty, price, subtotal, price_label, is_package_snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [idOrder, item.id, item.name || svcRes.rows[0].name, qty, unitPrice, subtotal, item.price_label || null, Boolean(item.is_package)]
      )
    }

    await db.query(
      `UPDATE orders
       SET status = 'DRAFT', total = $2, total_amount = $2
       WHERE id = $1`,
      [idOrder, total]
    )

    await ensureBarWorkflowTables(db)
    const incrementalFnbSnapshot = await buildIncrementalFnbSnapshot(db, idOrder, previousFnbRows)

    if (incrementalFnbSnapshot.length) {
      await db.query(
        `INSERT INTO bar_orders (order_id, branch_id, status, items_snapshot, requested_by)
         VALUES ($1,$2,'PENDING',$3::jsonb,$4)`,
        [idOrder, req.user.branch_id, JSON.stringify(incrementalFnbSnapshot), req.user.id]
      )

      emitBarOrderNew(req, {
        order_id: idOrder,
        branch_id: req.user.branch_id,
        status: "PENDING",
        items: incrementalFnbSnapshot
      })
    }

    await db.query("COMMIT")
    inTransaction = false

    res.json({
      success: true,
      order_id: idOrder,
      status: "DRAFT",
      total,
      bar_queued: Boolean(incrementalFnbSnapshot.length),
      queued_items: incrementalFnbSnapshot
    })
  } catch (err) {
    try {
      if (inTransaction) {
        await db.query("ROLLBACK")
      }
    } catch (rollbackErr) {
      console.error("ROLLBACK SAVE DRAFT ERROR:", rollbackErr)
    }

    console.error("SAVE DRAFT ERROR:", err)
    res.status(400).json({ message: err.message })
  }
}


exports.getKasirOrders = async (req, res) => {
  try {
    const db = req.app.get("db")
    const branchId = req.user.branch_id
    
    // 🔍 FILTER PARAMS
    const { 
      status,
      date_from,
      date_to,
      therapist_id,
      room_id,
      page = 1,        // 📄 PAGINATION
      limit = 25       // 📄 PAGINATION
    } = req.query

    // 🏗️ BUILD DYNAMIC WHERE CONDITIONS
    let whereConditions = ['o.branch_id = $1']
    let queryParams = [branchId]
    let paramIndex = 2

    // Filter by status
    if (status && status !== 'ALL') {
      whereConditions.push(`o.status = $${paramIndex}`)
      queryParams.push(status)
      paramIndex++
    }

    // Filter by date range
    if (date_from) {
      whereConditions.push(`o.created_at >= $${paramIndex}::date`)
      queryParams.push(date_from)
      paramIndex++
    }
    
    if (date_to) {
      whereConditions.push(`o.created_at < ($${paramIndex}::date + interval '1 day')`)
      queryParams.push(date_to)
      paramIndex++
    }

    // Filter by therapist (source of truth dari timers)
    if (therapist_id) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM timers tm
        WHERE tm.order_id = o.id
          AND tm.therapist_id = $${paramIndex}
      )`)
      queryParams.push(therapist_id)
      paramIndex++
    }

    // Filter by room
    if (room_id) {
      whereConditions.push(`o.room_id = $${paramIndex}`)
      queryParams.push(room_id)
      paramIndex++
    }

    const whereClause = whereConditions.join(' AND ')

    // 📊 COUNT TOTAL RECORDS
    const countQuery = `
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      WHERE ${whereClause}
    `
    const { rows: countRows } = await db.query(countQuery, queryParams)
    const totalRecords = parseInt(countRows[0].total)
    const totalPages = Math.ceil(totalRecords / limit)

    // 📄 PAGINATION PARAMS
    const offset = (page - 1) * limit
    queryParams.push(limit, offset)

    // 📄 GET PAGINATED DATA
    const { rows } = await db.query(`
      SELECT
        o.id,
        o.status,
        o.created_at,
        o.total,
        COALESCE(ot.therapist_name, th.name) AS therapist_name,
        r.name AS room_name,

        json_agg(
          DISTINCT jsonb_build_object(
            'service_id', oi.service_id,
            'service_name', oi.service_name,
            'qty', oi.qty,
            'subtotal', oi.subtotal
          )
        ) FILTER (WHERE oi.id IS NOT NULL) AS items

      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN therapists th ON th.id = o.therapist_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          (
            SELECT string_agg(DISTINCT oi2.therapist_name, ', ' ORDER BY oi2.therapist_name)
            FROM order_items oi2
            WHERE oi2.order_id = o.id
              AND oi2.therapist_name IS NOT NULL
              AND oi2.therapist_name <> ''
          ),
          (
            SELECT string_agg(DISTINCT t.name, ', ' ORDER BY t.name)
            FROM timers tm
            JOIN therapists t ON t.id = tm.therapist_id
            WHERE tm.order_id = o.id
          )
        ) AS therapist_name
      ) ot ON true
      LEFT JOIN rooms r ON r.id = o.room_id

      WHERE ${whereClause}
      GROUP BY o.id, ot.therapist_name, th.name, r.name
      ORDER BY o.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, queryParams)

    res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalRecords,
        totalPages
      }
    })
  } catch (err) {
    console.error("GET KASIR ORDERS ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}
exports.getById = async (req, res) => {
  const db = req.app.get("db")
  const orderId = parseOrderId(req.params.id)

  try {
    const { rows } = await db.query(
      `
      SELECT 
        o.*,
        json_agg(
          json_build_object(
            'service_id', oi.service_id,
            'service_name', oi.service_name,
            'qty', oi.qty,
            'price', oi.price,
            'subtotal', oi.subtotal,
            'price_label', oi.price_label,
            'is_package', oi.is_package_snapshot
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL) as items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN services s ON s.id = oi.service_id
      WHERE o.id = $1
      GROUP BY o.id
      `,
      [orderId]
    )

    if (!rows.length) {
      return res.status(404).json({ message: "Order not found" })
    }

    res.json(rows[0])
  } catch (err) {
    console.error("GET ORDER BY ID ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}
// 🖨️ GET ORDER DETAIL FOR REPRINT
exports.getOrderDetail = async (req, res) => {
  try {
    const db = req.app.get("db")
    const orderId = parseOrderId(req.params.id)
    const branchId = req.user.branch_id

    // Get order header
    const { rows: orderRows } = await db.query(`
      SELECT
        o.id,
        o.status,
        o.total,
        o.payment_method,
        o.created_at,
        th.name AS therapist_name,
        r.name AS room_name,
        b.name AS branch_name,
        b.address AS branch_address,
        u.name AS cashier_name
      FROM orders o
      LEFT JOIN therapists th ON th.id = o.therapist_id
      LEFT JOIN rooms r ON r.id = o.room_id
      LEFT JOIN branches b ON b.id = o.branch_id
      LEFT JOIN users u ON u.id = o.user_id
      WHERE o.id = $1 AND o.branch_id = $2
    `, [orderId, branchId])

    if (orderRows.length === 0) {
      return res.status(404).json({ message: "Order not found" })
    }

    const order = orderRows[0]

    // Get order items
    const { rows: items } = await db.query(`
      SELECT
        service_id,
        service_name,
        qty,
        price,
        subtotal,
        price_label,
        is_package_snapshot AS is_package
      FROM order_items
      WHERE order_id = $1
      ORDER BY id ASC
    `, [orderId])

    order.items = items
    
    // Set default payment info (columns don't exist in table)
    order.payment_amount = order.total
    order.change_amount = 0
    
    // Set default phone (column doesn't exist in branches table)
    order.branch_phone = "021-xxx-xxxx"

    await writeAuditEntry(db, req.user?.id, "ORDER_REPRINT_VIEW", { order_id: orderId, branch_id: branchId })

    res.json(order)
  } catch (err) {
    console.error("GET ORDER DETAIL ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}


exports.getBarInbox = async (req, res) => {
  try {
    const db = req.app.get("db")
    await ensureBarWorkflowTables(db)

    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size) || 20))
    const offset = (page - 1) * pageSize

    const [{ rows }, countRes] = await Promise.all([
      db.query(
        `SELECT bo.id, bo.order_id, bo.status, bo.items_snapshot, bo.note, bo.created_at,
                o.status AS order_status
         FROM bar_orders bo
         JOIN orders o ON o.id = bo.order_id
         WHERE bo.branch_id=$1
         ORDER BY bo.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user.branch_id, pageSize, offset]
      ),
      db.query(`SELECT COUNT(*)::int AS total FROM bar_orders WHERE branch_id=$1`, [req.user.branch_id])
    ])

    const total = Number(countRes.rows[0]?.total || 0)
    res.json({
      data: rows,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize))
      }
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.acceptBarOrder = async (req, res) => {
  try {
    const db = req.app.get("db")
    const barOrderId = Number(req.params.barOrderId)
    await ensureBarWorkflowTables(db)

    const { rows } = await db.query(
      `UPDATE bar_orders
       SET status='ACCEPTED', accepted_by=$1, accepted_at=NOW(), updated_at=NOW()
       WHERE id=$2 AND branch_id=$3
       RETURNING *`,
      [req.user.id, barOrderId, req.user.branch_id]
    )

    if (!rows.length) return res.status(404).json({ message: "Inbox order not found" })

    res.json(rows[0])
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.deliverBarOrder = async (req, res) => {
  const db = req.app.get("db")
  try {
    await db.query("BEGIN")
    await ensureBarWorkflowTables(db)

    const barOrderId = Number(req.params.barOrderId)
    const { rows } = await db.query(
      `SELECT * FROM bar_orders WHERE id=$1 AND branch_id=$2 FOR UPDATE`,
      [barOrderId, req.user.branch_id]
    )

    if (!rows.length) {
      await db.query("ROLLBACK")
      return res.status(404).json({ message: "Inbox order not found" })
    }

    const bo = rows[0]
    if (!["PENDING", "ACCEPTED"].includes(bo.status)) {
      await db.query("ROLLBACK")
      return res.status(400).json({ message: "Status order tidak valid" })
    }

    const items = Array.isArray(bo.items_snapshot) ? bo.items_snapshot : []
    for (const item of items) {
      await stockService.reduceFnbStock(db, item.fnb_item_id, Number(item.qty || 0))
    }

    await db.query(
      `UPDATE bar_orders
       SET status='DELIVERED', delivered_by=$1, delivered_at=NOW(), updated_at=NOW()
       WHERE id=$2`,
      [req.user.id, barOrderId]
    )

    const kasirMessage = await createKasirBarMessage(db, {
      branch_id: bo.branch_id,
      order_id: bo.order_id,
      bar_order_id: barOrderId,
      type: "DELIVERED",
      title: `Order #${bo.order_id} siap dikirim`,
      message: "Items dari staff bar sudah delivered.",
      payload: { items }
    })

    await db.query("COMMIT")

    emitKasirOrderUpdate(req, {
      order_id: bo.order_id,
      branch_id: bo.branch_id,
      status: "READY",
      items,
      message: `Order #${bo.order_id} siap dikirim`,
      message_id: kasirMessage.id
    })

    res.json({ success: true, message_id: kasirMessage.id })
  } catch (err) {
    try { await db.query("ROLLBACK") } catch (_) {}
    res.status(500).json({ message: err.message })
  }
}

exports.cancelBarOrder = async (req, res) => {
  const db = req.app.get("db")
  try {
    await db.query("BEGIN")
    await ensureBarWorkflowTables(db)

    const barOrderId = Number(req.params.barOrderId)
    const { rows } = await db.query(
      `SELECT * FROM bar_orders WHERE id=$1 AND branch_id=$2 FOR UPDATE`,
      [barOrderId, req.user.branch_id]
    )

    if (!rows.length) {
      await db.query("ROLLBACK")
      return res.status(404).json({ message: "Inbox order not found" })
    }

    const bo = rows[0]
    if (!["PENDING", "ACCEPTED"].includes(bo.status)) {
      await db.query("ROLLBACK")
      return res.status(400).json({ message: "Status order tidak valid" })
    }

    const note = String(req.body?.note || "cancelled by SB").trim() || "cancelled by SB"
    const items = Array.isArray(bo.items_snapshot) ? bo.items_snapshot : []

    await db.query(
      `UPDATE bar_orders
       SET status='CANCELLED', note=$1, cancelled_by=$2, cancelled_at=NOW(), updated_at=NOW()
       WHERE id=$3`,
      [note, req.user.id, barOrderId]
    )

    const kasirMessage = await createKasirBarMessage(db, {
      branch_id: bo.branch_id,
      order_id: bo.order_id,
      bar_order_id: barOrderId,
      type: "CANCELLED",
      title: `Item tambahan order #${bo.order_id} dibatalkan`,
      message: `Alasan: ${note}`,
      payload: { items, note }
    })

    await db.query("COMMIT")

    emitKasirOrderUpdate(req, {
      order_id: bo.order_id,
      branch_id: bo.branch_id,
      status: "CANCELLED",
      items,
      message: `Item tambahan order #${bo.order_id} dibatalkan oleh SB`,
      note,
      message_id: kasirMessage.id
    })

    res.json({ success: true, order_id: bo.order_id, note, message_id: kasirMessage.id })
  } catch (err) {
    try { await db.query("ROLLBACK") } catch (_) {}
    res.status(500).json({ message: err.message })
  }
}


exports.getKasirBarMessages = async (req, res) => {
  try {
    const db = req.app.get("db")
    await ensureBarWorkflowTables(db)

    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size) || 20))
    const offset = (page - 1) * pageSize

    const [{ rows }, countRes] = await Promise.all([
      db.query(
        `SELECT id, order_id, bar_order_id, type, title, message, payload, is_read, created_at, read_at
         FROM bar_messages
         WHERE branch_id=$1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user.branch_id, pageSize, offset]
      ),
      db.query(`SELECT COUNT(*)::int AS total FROM bar_messages WHERE branch_id=$1`, [req.user.branch_id])
    ])

    const total = Number(countRes.rows[0]?.total || 0)
    res.json({
      data: rows,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize))
      }
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.markKasirBarMessageRead = async (req, res) => {
  try {
    const db = req.app.get("db")
    const messageId = Number(req.params.messageId)
    await ensureBarWorkflowTables(db)

    const { rows } = await db.query(
      `UPDATE bar_messages
       SET is_read=true, read_at=NOW()
       WHERE id=$1 AND branch_id=$2
       RETURNING *`,
      [messageId, req.user.branch_id]
    )

    if (!rows.length) {
      return res.status(404).json({ message: "Message not found" })
    }

    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
