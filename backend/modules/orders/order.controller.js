const service = require("./order.service")
const stockService = require("../stock/stock.service")

const parseOrderId = (rawId) => {
  const orderId = Number(rawId)
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new Error("Invalid order id")
  }
  return orderId
}

exports.create = async (req, res) => {
  try {
    const db = req.app.get("db")
    const user = req.user

    const order = await service.createOrder(db, user)
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
        const unitPrice = Number(i.base_price ?? 0)

        await db.query(
          `INSERT INTO order_items (order_id, service_id, service_name, qty, price, subtotal, price_label, is_package_snapshot)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
           [orderId, i.id, serviceName, qty, unitPrice, qty * unitPrice, i.price_label || null, Boolean(i.is_package)]
        )
      }
    //}

    // Hitung total baru
    const totalResult = await db.query(
      `SELECT COALESCE(SUM(subtotal), 0) as total 
       FROM order_items 
       WHERE order_id = $1`,
      [orderId]
    )
    const total = totalResult.rows[0].total

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
//exports.createFromPos = async (req, res) => {
//  try {
//  const db = req.app.get("db")  //  🔴 INI YANG HILANG
//  const { items, payment_method, total } = req.body
//  const user_id = req.user.id

//  const order = await db.one(
//    `INSERT INTO orders (user_id, total, payment_method)
//     VALUES ($1,$2,$3) RETURNING id`,
//    [user_id, total, payment_method]
//  )

//  for (const i of items) {
//    await db.none(
//      `INSERT INTO order_items
//       (order_id, service_id, qty, price)
//       VALUES ($1,$2,$3,$4)`,
//      [order.id, i.id, i.qty, i.base_price]
//    )
//  }

//  res.json({ success: true, order_id: order.id })
//  } catch (err) {
//    res.status(400).json({ message: err.message })
//  }
//}
//exports.createFromPos = async (req, res) => {
//  try {
//    const db = req.app.get("db")   // ✅ WAJIB
//    const user = req.user
//    const { items, payment_method, total } = req.body
//    const user_id = req.user.id

//    const orderRes = await db.query(
//      `INSERT INTO orders (branch_id, cashier_id, total, payment_method, status)
//       VALUES ($1,$2,$3,$4,'PAID')
//       RETURNING *`,
//      [user.branch_id, user.id, total, payment_method]
//    )

//    const order = orderRes.rows[0]

//    for (const i of items) {
//      await db.query(
//        `INSERT INTO order_items
//         (order_id, service_id, qty, price)
//         VALUES ($1,$2,$3,$4)`,
//        [order.id, i.id, i.qty, i.base_price]
//      )
//    }

//    res.json({ success: true, order })
//  } catch (err) {
//    console.error(err)
//    res.status(400).json({ message: err.message })
//  }
//}
//exports.createFromPos = async (req, res) => {
//  try {
//    const db = req.app.get("db")
//    const user = req.user

//    if (!user.branch_id) {
//      return res.status(400).json({ message: "User belum terikat ke branch" })
//    }

//    const { items, payment_method, total } = req.body

//    const { rows } = await db.query(
//      `INSERT INTO orders
//        (branch_id, user_id, total, payment_method, status)
//       VALUES ($1, $2, $3, $4, 'PAID')
//       RETURNING id`,
//      [
//        user.branch_id,
//        user.id,
//        total || 0,
//        payment_method || "CASH"
 //     ]
   // )

//    const orderId = rows[0].id

//    for (const i of items) {
//      await db.query(
//        `INSERT INTO order_items
//         (order_id, service_id, qty, price)
//         VALUES ($1, $2, $3, $4)`,
//        [orderId, i.id, i.qty, i.base_price]
//      )
//    }

//    res.json({ success: true, order_id: orderId })
 // } catch (err) {
   // console.error(err)
   // res.status(500).json({ message: err.message })
//  }
//}
//exports.cancel = async (req, res) => {
//  try {
//    const db = req.app.get("db")
//    const orderId = parseOrderId(req.params.id)

//    await db.query(
//      `DELETE FROM order_items WHERE order_id=$1`,
//      [orderId]
//    )

//    await db.query(
//      `DELETE FROM orders WHERE id=$1`,
//      [orderId]
//    )

//    res.json({ success: true })
//  } catch (err) {
//    res.status(400).json({ message: err.message })
//  }
//}
exports.cancel = async (req, res) => {
  const db = req.app.get("db")
  const orderId = parseOrderId(req.params.id)

  await db.query(
    "UPDATE orders SET status='CANCELLED' WHERE id=$1",
    [orderId]
  )

  res.json({ success: true })
}


exports.createFromPos = async (req, res) => {
  try {
    const db = req.app.get("db")
    const user = req.user
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

    const orderId = orderRes.rows[0].id
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

    const orderId = orderRes.rows[0].id
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

    await db.query("COMMIT")
    inTransaction = false

    res.json({ success: true, order_id: idOrder, status: "DRAFT", total })
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

    // Filter by therapist
    if (therapist_id) {
      whereConditions.push(`o.therapist_id = $${paramIndex}`)
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
        th.name AS therapist_name,
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
      LEFT JOIN rooms r ON r.id = o.room_id

      WHERE ${whereClause}
      GROUP BY o.id, th.name, r.name
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

    res.json(order)
  } catch (err) {
    console.error("GET ORDER DETAIL ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}
