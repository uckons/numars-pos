exports.getAll = async (db, user) => {
  const { rows } = await db.query(
  //  `SELECT * FROM fnb_items WHERE branch_id=$1 ORDER BY name`,
    `SELECT
      fi.id,
      fi.branch_id,
      fi.service_id,
      fi.name,
      fi.cost_price,
      fi.stock,
      fi.alert_stock,
      fi.is_beverage,
      fi.happy_hour_enabled,
      fi.happy_hour_price,
      fi.is_package,
      fi.package_qty,
      fi.package_group,
      COALESCE(s.base_price, 0) AS sell_price,
      COALESCE(s.base_price, 0) AS price,
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
     WHERE fi.branch_id=$1
     ORDER BY fi.name`,
    [user.branch_id]
  )
  return rows
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
    package_group
  } = data
 //const { rows } = await db.query(
 //   `INSERT INTO fnb_items
 //    (branch_id, name, price, stock, alert_stock)
 //    VALUES ($1,$2,$3,$4,$5)
 //    RETURNING *`,
 //   [user.branch_id, name, price, stock, alert_stock]
 // )
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
       (branch_id, service_id, name, cost_price, is_beverage, happy_hour_enabled, happy_hour_price, is_package, package_qty, package_group, stock, alert_stock)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        user.branch_id,
        serviceId,
        name,
        cost_price ?? 0,
        Boolean(is_beverage),
        Boolean(happy_hour_enabled),
        happy_hour_price ?? null,
        Boolean(is_package),
        Number(package_qty || 0) || null,
        package_group || null,
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
    package_group
  } = data  
  //const { rows } = await db.query(
  //  `UPDATE fnb_items
  //   SET name=$1, price=$2, stock=$3, alert_stock=$4
  //   WHERE id=$5
  //   RETURNING *`,
  //  [name, price, stock, alert_stock, id]
  //)
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
           stock=$3,
           alert_stock=$4,
           service_id=$5,
           is_beverage=$6,
           happy_hour_enabled=$7,
           happy_hour_price=$8,
           is_package=$9,
           package_qty=$10,
           package_group=$11
       WHERE id=$12
       RETURNING *`,
      [
        name,
        cost_price ?? 0,
        stock,
        alert_stock,
        serviceId,
        Boolean(is_beverage),
        Boolean(happy_hour_enabled),
        happy_hour_price ?? null,
        Boolean(is_package),
        Number(package_qty || 0) || null,
        package_group || null,
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
