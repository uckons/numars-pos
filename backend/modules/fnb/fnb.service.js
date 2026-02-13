exports.getAll = async (db, user, query = {}) => {
  const { rows } = await db.query(
  //  `SELECT * FROM fnb_items WHERE branch_id=$1 ORDER BY name`,
    `SELECT
      fi.id,
      fi.branch_id,
      fi.service_id,
      fi.name,
      b.name AS branch_name,
      fi.cost_price,
      fi.stock,
      fi.alert_stock,
      fi.is_beverage,
      fi.happy_hour_enabled,
      fi.happy_hour_price,
      fi.is_package,
      fi.package_qty,
      fi.package_group,
      fi.package_price,
      fi.package_name,
      COALESCE(fi.price, s.base_price, 0) AS sell_price,
      COALESCE(fi.price, s.base_price, 0) AS price,
      s.is_active AS service_active
     FROM fnb_items fi
     LEFT JOIN services s ON s.id = fi.service_id
     LEFT JOIN LATERAL (
       SELECT true AS active
       FROM happy_hours hh
       WHERE hh.branch_id = fi.branch_id
         AND hh.is_active = true
         AND CURRENT_TIME BETWEEN hh.start_time AND hh.end_time
         AND (hh.service_type IS NULL OR hh.service_type = 'FNB' OR hh.service_type = 'ALL')
       LIMIT 1
     ) hh_active ON true
     LEFT JOIN branches b ON b.id = fi.branch_id
     WHERE 1=1
       AND (
         $1::text = 'ALL'
         OR fi.branch_id = $1::int
       )
     ORDER BY fi.name`,
    [
      (query.branch_id && String(query.branch_id).toUpperCase() !== 'ALL')
        ? String(query.branch_id)
        : (['SuperAdmin','Manager','Owner'].includes(user.role) ? 'ALL' : String(user.branch_id || '0'))
    ]
  )

  return rows.map((r) => ({
    ...r,
    branch_name: r.branch_name || r.branch || null
  }))
}

exports.create = async (db, user, data) => {
 // const { name, price, stock, alert_stock } = data
      const {
    name,
    cost_price,
    sell_price,
    price,
    stock,
    alert_stock,
    is_beverage,
    happy_hour_enabled,
    happy_hour_price,
    is_package,
    package_qty,
    package_group,
    package_price,
    package_name
  } = data
  if (Boolean(is_package) && Number(package_qty || 0) <= 0) {
    throw new Error("package_qty wajib diisi untuk item paket")
  }
  await db.query("BEGIN")

  try {
    const serviceRes = await db.query(
      `INSERT INTO services
       (branch_id, type, name, base_price, duration_minutes, is_active)
       VALUES ($1,'FNB',$2,$3,NULL,true)
       RETURNING id`,
      [user.branch_id, name, sell_price ?? price ?? 0]
    )

    const serviceId = serviceRes.rows[0].id 
  //return rows[0]
  const { rows } = await db.query(
      `INSERT INTO fnb_items
       (branch_id, service_id, name, cost_price, price, is_beverage, happy_hour_enabled, happy_hour_price, is_package, package_qty, package_group, package_price, package_name, stock, alert_stock)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        user.branch_id,
        serviceId,
        name,
        cost_price ?? 0,
        Number(sell_price ?? price ?? 0),
        Boolean(is_beverage),
        Boolean(happy_hour_enabled),
        happy_hour_price ?? null,
        Boolean(is_package),
        Number(package_qty || 0) || null,
        package_group || null,
        package_price !== undefined && package_price !== null ? Number(package_price) : null,
        package_name || null,
        stock,
        alert_stock
      ]
    )

    await db.query("COMMIT")
    return rows[0]
  } catch (error) {
    await db.query("ROLLBACK")
    throw error
  }
}


exports.update = async (db, id, data) => {
//  const { name, price, stock, alert_stock } = data
  const {
    name,
    cost_price,
    sell_price,
    price,
    stock,
    alert_stock,
    is_beverage,
    happy_hour_enabled,
    happy_hour_price,
    is_package,
    package_qty,
    package_group,
    package_price,
    package_name
  } = data  
  
   await db.query("BEGIN")

  try {
    const itemRes = await db.query(
      `SELECT service_id, branch_id FROM fnb_items WHERE id=$1`,
      [id]
    )

    if (!itemRes.rows.length) {
      throw new Error("Item not found")
    }

    let serviceId = itemRes.rows[0].service_id
    const branchId = itemRes.rows[0].branch_id

    if (!serviceId) {
      const existingService = await db.query(
        `SELECT id FROM services
         WHERE branch_id=$1 AND type='FNB' AND name=$2
         LIMIT 1`,
        [branchId, name]
      )

      if (existingService.rows.length) {
        serviceId = existingService.rows[0].id
      } else {
        const created = await db.query(
          `INSERT INTO services
           (branch_id, type, name, base_price, duration_minutes, is_active)
           VALUES ($1,'FNB',$2,$3,NULL,true)
           RETURNING id`,
          [branchId, name, sell_price ?? price ?? 0]
        )
        serviceId = created.rows[0].id
      }
    }

    await db.query(
      `UPDATE services
       SET name=$1, base_price=$2
       WHERE id=$3`,
      [name, sell_price ?? price ?? 0, serviceId]
    )

    const { rows } = await db.query(
      `UPDATE fnb_items
       SET name=$1,
           cost_price=$2,
           price=$3,
           stock=$4,
           alert_stock=$5,
           service_id=$6,
           is_beverage=$7,
           happy_hour_enabled=$8,
           happy_hour_price=$9,
           is_package=$10,
           package_qty=$11,
           package_group=$12,
           package_price=$13,
           package_name=$14
       WHERE id=$15
       RETURNING *`,
      [
        name,
        cost_price ?? 0,
        Number(sell_price ?? price ?? 0),
        stock,
        alert_stock,
        serviceId,
        Boolean(is_beverage),
        Boolean(happy_hour_enabled),
        happy_hour_price ?? null,
        Boolean(is_package),
        Number(package_qty || 0) || null,
        package_group || null,
        package_price !== undefined && package_price !== null ? Number(package_price) : null,
        package_name || null,
        id
      ]
    ) 
  //return rows[0]
   await db.query("COMMIT")
    return rows[0]
  } catch (error) {
    await db.query("ROLLBACK")
    throw error
  }
}

const ensureStockApprovalTable = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS fnb_stock_adjustment_requests (
      id SERIAL PRIMARY KEY,
      branch_id INT NOT NULL,
      fnb_item_id INT NOT NULL REFERENCES fnb_items(id) ON DELETE CASCADE,
      qty_change INT NOT NULL,
      reason TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      requested_by INT,
      reviewed_by INT,
      review_note TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      reviewed_at TIMESTAMP
    )
  `)
}

exports.requestStockAdjustment = async (db, user, fnbItemId, data = {}) => {
  await ensureStockApprovalTable(db)

  const qtyChange = Number(data.qty_change || 0)
  if (!qtyChange) {
    throw new Error("qty_change harus diisi")
  }

  const check = await db.query(
    `SELECT id, branch_id, name FROM fnb_items WHERE id=$1`,
    [Number(fnbItemId)]
  )

  if (!check.rows.length) {
    throw new Error("Item FNB tidak ditemukan")
  }

  if (Number(check.rows[0].branch_id) !== Number(user.branch_id)) {
    throw new Error("Item FNB bukan milik branch anda")
  }

  const { rows } = await db.query(
    `INSERT INTO fnb_stock_adjustment_requests
      (branch_id, fnb_item_id, qty_change, reason, status, requested_by)
     VALUES ($1,$2,$3,$4,'PENDING',$5)
     RETURNING *`,
    [user.branch_id, Number(fnbItemId), qtyChange, data.reason || null, user.id]
  )

  return rows[0]
}

exports.getStockAdjustmentRequests = async (db, user, query = {}) => {
  await ensureStockApprovalTable(db)

  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 20))
  const offset = (page - 1) * pageSize
  const status = String(query.status || 'PENDING').toUpperCase()

  const whereStatus = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'].includes(status) ? status : 'PENDING'
  const whereClause = whereStatus === 'ALL' ? 'r.branch_id=$1' : 'r.branch_id=$1 AND r.status=$2'
  const baseParams = whereStatus === 'ALL' ? [user.branch_id] : [user.branch_id, whereStatus]

  const [{ rows }, countRes] = await Promise.all([
    db.query(
      `SELECT r.*, fi.name AS item_name,
              fi.stock AS current_stock,
              req_user.name AS requested_by_name,
              rev_user.name AS reviewed_by_name
       FROM fnb_stock_adjustment_requests r
       JOIN fnb_items fi ON fi.id = r.fnb_item_id
       LEFT JOIN users req_user ON req_user.id = r.requested_by
       LEFT JOIN users rev_user ON rev_user.id = r.reviewed_by
       WHERE ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`,
      [...baseParams, pageSize, offset]
    ),
    db.query(`SELECT COUNT(*)::int AS total FROM fnb_stock_adjustment_requests r WHERE ${whereClause}`, baseParams)
  ])

  const total = Number(countRes.rows[0]?.total || 0)

  return {
    data: rows,
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize))
    }
  }
}

exports.approveStockAdjustment = async (db, user, requestId) => {
  await ensureStockApprovalTable(db)
  await db.query("BEGIN")

  try {
    const { rows } = await db.query(
      `SELECT * FROM fnb_stock_adjustment_requests
       WHERE id=$1 AND branch_id=$2
       FOR UPDATE`,
      [Number(requestId), user.branch_id]
    )

    if (!rows.length) throw new Error("Request tidak ditemukan")

    const request = rows[0]
    if (request.status !== "PENDING") throw new Error("Request sudah diproses")

    await db.query(
      `UPDATE fnb_items SET stock = stock + $1 WHERE id=$2`,
      [Number(request.qty_change), Number(request.fnb_item_id)]
    )

    await db.query(
      `INSERT INTO stock_logs (fnb_item_id, qty_change)
       VALUES ($1,$2)`,
      [Number(request.fnb_item_id), Number(request.qty_change)]
    )

    const updateRes = await db.query(
      `UPDATE fnb_stock_adjustment_requests
       SET status='APPROVED', reviewed_by=$1, reviewed_at=NOW(), review_note=$2
       WHERE id=$3
       RETURNING *`,
      [user.id, null, Number(requestId)]
    )

    await db.query("COMMIT")
    return updateRes.rows[0]
  } catch (err) {
    await db.query("ROLLBACK")
    throw err
  }
}

exports.rejectStockAdjustment = async (db, user, requestId, data = {}) => {
  await ensureStockApprovalTable(db)

  const { rows } = await db.query(
    `UPDATE fnb_stock_adjustment_requests
     SET status='REJECTED', reviewed_by=$1, reviewed_at=NOW(), review_note=$2
     WHERE id=$3 AND branch_id=$4 AND status='PENDING'
     RETURNING *`,
    [user.id, data.review_note || data.reason || "Rejected", Number(requestId), user.branch_id]
  )

  if (!rows.length) throw new Error("Request tidak ditemukan / sudah diproses")
  return rows[0]
}
