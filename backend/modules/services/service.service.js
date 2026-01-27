const db = require("../../config/db")

exports.list = async ({ branch_id, type }) => {
  const params = []
  let where = "s.deleted_at IS NULL"

  if (branch_id) {
    params.push(branch_id)
    where += ` AND s.branch_id = $${params.length}`
  }

  if (type) {
    params.push(type)
    where += ` AND s.type = $${params.length}`
  }

  const { rows } = await db.query(`
    SELECT
      s.id,
      s.name,
      s.type,
      s.base_price,
      s.duration_minutes,
      s.is_active,
      b.name AS branch
    FROM services s
    JOIN branches b ON b.id = s.branch_id
    WHERE ${where}
    ORDER BY s.id DESC
  `, params)

  return rows
}

// GET SERVICES BY TYPE
exports.getByType = async (type, branch_id) => {
  const { rows } = await db.query(`
    SELECT
      s.id,
      s.name,
      s.type,
      s.base_price,
      s.duration_minutes,
      s.is_active
    FROM services s
    WHERE s.type = $1 
      AND s.branch_id = $2
      AND s.is_active = true
      AND s.deleted_at IS NULL
    ORDER BY s.name ASC
  `, [type, branch_id])

  return rows
}

exports.create = async (data, actor) => {
  const {
    branch_id,
    type,
    name,
    base_price,
    duration_minutes,
    is_active = true
  } = data

  if (!branch_id || !type || !name) {
    throw new Error("Missing required fields")
  }

  await db.query(`
    INSERT INTO services
    (branch_id, type, name, base_price, duration_minutes, is_active)
    VALUES ($1,$2,$3,$4,$5,$6)
  `, [
    branch_id,
    type,
    name,
    base_price || 0,
    duration_minutes || null,
    is_active
  ])
}

//exports.update = async (id, data) => {
//  await db.query(`
//    UPDATE services
//    SET base_price = $1,
//        duration_minutes = $2
//    WHERE id = $3
//  `, [data.base_price, data.duration_minutes, id])
//}

exports.update = async (id, data) => {
  await db.query(`
    UPDATE services
    SET
      name=$1,
      type=$2,
      base_price=$3,
      duration_minutes=$4,
      is_active=$5
    WHERE id=$6
  `, [
    data.name,
    data.type,
    data.base_price,
    data.duration_minutes,
    data.is_active,
    id
  ])
}

exports.toggle = async (id) => {
  await db.query(`
    UPDATE services
    SET is_active = NOT is_active
    WHERE id = $1
  `, [id])
}
//TAMBAHAN
exports.toggleStatus = async (id) => {
  const q = `
    UPDATE services
    SET is_active = NOT is_active
    WHERE id = $1
    RETURNING id, is_active
  `
  const { rows } = await db.query(q, [id])
  return rows[0]
}

exports.cloneFromBranch = async (sourceBranchId, targetBranchId, actor) => {
  await db.query("BEGIN")

  try {
    // Ambil semua service dari source
    const { rows: services } = await db.query(`
      SELECT
        type,
        name,
        base_price,
        duration_minutes
      FROM services
      WHERE branch_id = $1
        AND deleted_at IS NULL
    `, [sourceBranchId])

    if (!services.length) {
      throw new Error("No services to clone from source branch")
    }

    // Insert ke branch target
    for (const s of services) {
      await db.query(`
        INSERT INTO services (
          branch_id,
          type,
          name,
          base_price,
          duration_minutes,
          is_active
        )
        VALUES ($1,$2,$3,$4,$5,false)
      `, [
        targetBranchId,
        s.type,
        s.name,
        s.base_price,
        s.duration_minutes
      ])
    }

    await db.query("COMMIT")
    return { success: true, total: services.length }

  } catch (err) {
    await db.query("ROLLBACK")
    throw err
  }
}