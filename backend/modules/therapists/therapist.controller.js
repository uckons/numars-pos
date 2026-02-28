
const canAccessAllBranches = (role = '') => ['SuperAdmin', 'Manager', 'Owner'].includes(String(role))


const ensureGradeCommissionStorage = async (db) => {
  await db.query(`
    ALTER TABLE therapist_grades
    ALTER COLUMN commission_percent TYPE NUMERIC(14,2)
  `)

  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'therapist_grades' AND column_name = 'commission_amount'
      ) THEN
        ALTER TABLE therapist_grades ADD COLUMN commission_amount NUMERIC(14,2);
        UPDATE therapist_grades SET commission_amount = COALESCE(commission_percent, 0);
      END IF;
    END $$;
  `)

  await db.query(`
    ALTER TABLE therapist_grades
    ADD COLUMN IF NOT EXISTS service_addon_amount NUMERIC(14,2) NOT NULL DEFAULT 0
  `)
}


const ensureTherapistAttendanceTable = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS therapist_attendance (
      id SERIAL PRIMARY KEY,
      therapist_id INT NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
      branch_id INT NOT NULL,
      business_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL,
      pin_input VARCHAR(50),
      updated_by INT,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (therapist_id, business_date)
    )
  `)
}

const getBusinessDateForBranch = async (db, branchId) => {
  const { rows } = await db.query(
    `WITH cfg AS (
       SELECT
         COALESCE(open_time, '10:00:00'::time) AS open_time,
         COALESCE(close_time, '03:00:00'::time) AS close_time,
         timezone('Asia/Jakarta', NOW()) AS now_jkt
       FROM branches
       WHERE id = $1
     )
     SELECT
       CASE
         WHEN cfg.close_time <= cfg.open_time AND cfg.now_jkt::time < cfg.close_time THEN (cfg.now_jkt::date - INTERVAL '1 day')::date
         ELSE cfg.now_jkt::date
       END AS business_date
     FROM cfg`,
    [branchId]
  )

  return rows[0]?.business_date || null
}

const resolveGradeCommissionExpression = async (db) => {
  const { rows } = await db.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'therapist_grades'
        AND column_name = 'commission_amount'
    ) AS has_commission_amount
  `)

  return rows[0]?.has_commission_amount
    ? 'COALESCE(tg.commission_amount, tg.commission_percent, 0)'
    : 'COALESCE(tg.commission_percent, 0)'
}

// 📋 GET ALL THERAPISTS (with pagination & filters)
exports.getTherapists = async (req, res) => {
  try {
    const db = req.app.get("db")
    const { 
      page = 1, 
      limit = 25, 
      grade_id, 
      active, 
      branch_id,
      search 
    } = req.query

    const offset = (page - 1) * limit
    const gradeCommissionExpr = await resolveGradeCommissionExpression(db)
    
    // Build WHERE clause
    let whereConditions = []
    let params = []
    let paramIndex = 1

    // Filter by branch (strict for non-privileged roles)
    const requestedBranchId = branch_id
    const effectiveBranchId = canAccessAllBranches(req.user?.role)
      ? requestedBranchId
      : req.user?.branch_id

    if (effectiveBranchId) {
      whereConditions.push(`t.branch_id = $${paramIndex}`)
      params.push(effectiveBranchId)
      paramIndex++
    }

    // Filter by grade
    if (grade_id) {
      whereConditions.push(`t.grade_id = $${paramIndex}`)
      params.push(grade_id)
      paramIndex++
    }

    // Filter by active status
    if (active !== undefined) {
      whereConditions.push(`t.active = $${paramIndex}`)
      params.push(active === 'true')
      paramIndex++
    }

    // Search by name
    if (search) {
      whereConditions.push(`t.name ILIKE $${paramIndex}`)
      params.push(`%${search}%`)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : ''

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM therapists t
      ${whereClause}
    `
    const { rows: countRows } = await db.query(countQuery, params)
    const totalRecords = parseInt(countRows[0].count)
    const totalPages = Math.ceil(totalRecords / limit)

    // Get therapists data
    const dataQuery = `
      SELECT 
        t.id,
        t.name,
        t.branch_id,
        t.grade_id,
        t.active,
        tg.name AS grade_name,
        ${gradeCommissionExpr} AS commission_amount,
        ${gradeCommissionExpr} AS commission_percent,
        b.name AS branch_name
      FROM therapists t
      LEFT JOIN therapist_grades tg ON tg.id = t.grade_id
      LEFT JOIN branches b ON b.id = t.branch_id
      ${whereClause}
      ORDER BY t.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    
    params.push(limit, offset)
    const { rows: therapists } = await db.query(dataQuery, params)

    res.json({
      data: therapists,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalRecords,
        totalPages
      }
    })
  } catch (err) {
    console.error("GET THERAPISTS ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

// 📋 GET SINGLE THERAPIST
exports.getTherapist = async (req, res) => {
  try {
    const db = req.app.get("db")
    const { id } = req.params
    const gradeCommissionExpr = await resolveGradeCommissionExpression(db)

    const { rows } = await db.query(`
      SELECT 
        t.id,
        t.name,
        t.branch_id,
        t.grade_id,
        t.active,
        tg.name AS grade_name,
        ${gradeCommissionExpr} AS commission_amount,
        ${gradeCommissionExpr} AS commission_percent,
        b.name AS branch_name
      FROM therapists t
      LEFT JOIN therapist_grades tg ON tg.id = t.grade_id
      LEFT JOIN branches b ON b.id = t.branch_id
      WHERE t.id = $1
    `, [id])

    if (rows.length === 0) {
      return res.status(404).json({ message: "Therapist not found" })
    }

    res.json(rows[0])
  } catch (err) {
    console.error("GET THERAPIST ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

exports.getTherapistAttendance = async (req, res) => {
  try {
    const db = req.app.get("db")
    await ensureTherapistAttendanceTable(db)

    const branchId = req.user?.branch_id
    const businessDate = await getBusinessDateForBranch(db, branchId)

    const { rows } = await db.query(
      `SELECT
         t.id,
         t.name,
         t.active,
         COALESCE(ta.status, 'OFF') AS attendance_status,
         ta.updated_at
       FROM therapists t
       LEFT JOIN therapist_attendance ta
         ON ta.therapist_id = t.id
        AND ta.business_date = $2::date
       WHERE t.branch_id = $1
         AND t.active = true
       ORDER BY t.name ASC`,
      [branchId, businessDate]
    )

    res.json({
      business_date: businessDate,
      data: rows
    })
  } catch (err) {
    console.error('GET THERAPIST ATTENDANCE ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}

exports.setTherapistAttendance = async (req, res) => {
  try {
    const db = req.app.get("db")
    await ensureTherapistAttendanceTable(db)

    const therapistId = Number(req.params.id)
    const status = String(req.body?.status || '').trim().toUpperCase()
    const pinInput = String(req.body?.pin || '').trim()

    if (!Number.isInteger(therapistId) || therapistId <= 0) {
      return res.status(400).json({ message: 'Therapist tidak valid' })
    }
    if (!['MASUK', 'OFF', 'CLOSE'].includes(status)) {
      return res.status(400).json({ message: 'Status absensi tidak valid' })
    }
    if ((status === 'MASUK' || status === 'CLOSE') && !pinInput) {
      return res.status(400).json({ message: 'PIN wajib diisi untuk status MASUK/CLOSE' })
    }

    const branchId = req.user?.branch_id
    const businessDate = await getBusinessDateForBranch(db, branchId)

    const therapistRes = await db.query(
      `SELECT id FROM therapists WHERE id = $1 AND branch_id = $2 AND active = true`,
      [therapistId, branchId]
    )
    if (!therapistRes.rows.length) {
      return res.status(404).json({ message: 'Terapis tidak ditemukan' })
    }

    const { rows } = await db.query(
      `INSERT INTO therapist_attendance (therapist_id, branch_id, business_date, status, pin_input, updated_by, updated_at)
       VALUES ($1, $2, $3::date, $4, $5, $6, NOW())
       ON CONFLICT (therapist_id, business_date)
       DO UPDATE SET
         status = EXCLUDED.status,
         pin_input = EXCLUDED.pin_input,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING therapist_id, business_date, status, updated_at`,
      [therapistId, branchId, businessDate, status, pinInput || null, req.user?.id || null]
    )

    res.json({ success: true, attendance: rows[0] })
  } catch (err) {
    console.error('SET THERAPIST ATTENDANCE ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}

// ✅ CREATE THERAPIST
exports.createTherapist = async (req, res) => {
  try {
    const db = req.app.get("db")
    const { name, grade_id, branch_id } = req.body

    // Validation
    if (!name || !grade_id) {
      return res.status(400).json({ message: "Name and grade are required" })
    }

    // Use user's branch if not provided
    const finalBranchId = branch_id || req.user.branch_id

    const { rows } = await db.query(`
      INSERT INTO therapists (name, grade_id, branch_id, active)
      VALUES ($1, $2, $3, true)
      RETURNING id, name, grade_id, branch_id, active
    `, [name, grade_id, finalBranchId])

    res.status(201).json(rows[0])
  } catch (err) {
    console.error("CREATE THERAPIST ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

// ✏️ UPDATE THERAPIST
exports.updateTherapist = async (req, res) => {
  try {
    const db = req.app.get("db")
    const { id } = req.params
    const { name, grade_id, branch_id, active } = req.body

    // Build update fields
    let updateFields = []
    let params = []
    let paramIndex = 1

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex}`)
      params.push(name)
      paramIndex++
    }

    if (grade_id !== undefined) {
      updateFields.push(`grade_id = $${paramIndex}`)
      params.push(grade_id)
      paramIndex++
    }

    if (branch_id !== undefined) {
      updateFields.push(`branch_id = $${paramIndex}`)
      params.push(branch_id)
      paramIndex++
    }

    if (active !== undefined) {
      updateFields.push(`active = $${paramIndex}`)
      params.push(active)
      paramIndex++
    }


    if (service_addon_amount !== undefined) {
      const normalizedAddon = Number(service_addon_amount)
      if (Number.isNaN(normalizedAddon) || normalizedAddon < 0) {
        return res.status(400).json({ message: "Service addon amount must be greater than or equal to 0" })
      }
      updateFields.push(`service_addon_amount = $${paramIndex}`)
      params.push(normalizedAddon)
      paramIndex++
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: "No fields to update" })
    }

    params.push(id)

    const { rows } = await db.query(`
      UPDATE therapists
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, grade_id, branch_id, active
    `, params)

    if (rows.length === 0) {
      return res.status(404).json({ message: "Therapist not found" })
    }

    res.json(rows[0])
  } catch (err) {
    console.error("UPDATE THERAPIST ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

// ❌ DELETE THERAPIST (soft delete - set active=false)
exports.deleteTherapist = async (req, res) => {
  try {
    const db = req.app.get("db")
    const { id } = req.params

    // Check if therapist exists
    const { rows: checkRows } = await db.query(`
      SELECT id, name, active
      FROM therapists
      WHERE id = $1
    `, [id])

    if (checkRows.length === 0) {
      return res.status(404).json({ 
        message: "Therapist not found" 
      })
    }

    if (!checkRows[0].active) {
      return res.status(400).json({ 
        message: "Therapist sudah tidak aktif" 
      })
    }

    // Check if therapist has active timers/orders
    const { rows: activeTimers } = await db.query(`
      SELECT COUNT(*) as count
      FROM timers
      WHERE therapist_id = $1 AND status IN ('RUNNING', 'PAUSED')
    `, [id])

    if (parseInt(activeTimers[0].count) > 0) {
      return res.status(400).json({ 
        message: "Tidak dapat menonaktifkan terapis yang masih memiliki timer aktif",
        hasActiveTimers: true
      })
    }

    // Soft delete
    const { rows } = await db.query(`
      UPDATE therapists
      SET active = false
      WHERE id = $1
      RETURNING id, name
    `, [id])

    res.json({ 
      message: "Therapist berhasil dinonaktifkan", 
      therapist: rows[0] 
    })
  } catch (err) {
    console.error("DELETE THERAPIST ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

// 📋 GET ALL GRADES
exports.getGrades = async (req, res) => {
  try {
    const db = req.app.get("db")
    await ensureGradeCommissionStorage(db)
    
    const gradeCommissionExpr = await resolveGradeCommissionExpression(db)

    const { rows } = await db.query(`
      SELECT id, name,
        ${gradeCommissionExpr} AS commission_amount,
        ${gradeCommissionExpr} AS commission_percent,
        COALESCE(service_addon_amount, 0) AS service_addon_amount
      FROM therapist_grades tg
      ORDER BY ${gradeCommissionExpr} ASC
    `)

    res.json(rows)
  } catch (err) {
    console.error("GET GRADES ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

// ✅ CREATE GRADE
exports.createGrade = async (req, res) => {
  try {
    const db = req.app.get("db")
    const { name, commission_amount, commission_percent, service_addon_amount } = req.body

    // Validation
    const commissionValue = Number(commission_amount ?? commission_percent)

    if (!name || Number.isNaN(commissionValue)) {
      return res.status(400).json({ 
        message: "Name and commission amount are required" 
      })
    }

    if (commissionValue < 0) {
      return res.status(400).json({ 
        message: "Commission amount must be greater than or equal to 0" 
      })
    }

    // Check duplicate name
    const { rows: checkRows } = await db.query(`
      SELECT id FROM therapist_grades WHERE LOWER(name) = LOWER($1)
    `, [name])

    if (checkRows.length > 0) {
      return res.status(400).json({ 
        message: "Grade dengan nama tersebut sudah ada" 
      })
    }

    await ensureGradeCommissionStorage(db)
    const gradeCommissionExpr = await resolveGradeCommissionExpression(db)
    const hasCommissionAmount = gradeCommissionExpr.includes("commission_amount")

    const insertSql = hasCommissionAmount
      ? `
      INSERT INTO therapist_grades (name, commission_amount, commission_percent, service_addon_amount)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, ${gradeCommissionExpr} AS commission_amount, ${gradeCommissionExpr} AS commission_percent, COALESCE(service_addon_amount, 0) AS service_addon_amount
    `
      : `
      INSERT INTO therapist_grades (name, commission_percent, service_addon_amount)
      VALUES ($1, $2, $3)
      RETURNING id, name, ${gradeCommissionExpr} AS commission_amount, ${gradeCommissionExpr} AS commission_percent, COALESCE(service_addon_amount, 0) AS service_addon_amount
    `

    const insertParams = hasCommissionAmount
      ? [name, commissionValue, commissionValue, Number(service_addon_amount || 0)]
      : [name, commissionValue, Number(service_addon_amount || 0)]

    const { rows } = await db.query(insertSql, insertParams)

    res.status(201).json(rows[0])
  } catch (err) {
    console.error("CREATE GRADE ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

// ✏️ UPDATE GRADE
exports.updateGrade = async (req, res) => {
  try {
    const db = req.app.get("db")
    await ensureGradeCommissionStorage(db)
    const { id } = req.params
    const { name, commission_amount, commission_percent, service_addon_amount } = req.body

    // Build update fields
    let updateFields = []
    let params = []
    let paramIndex = 1

    if (name !== undefined) {
      // Check duplicate name (exclude current grade)
      const { rows: checkRows } = await db.query(`
        SELECT id FROM therapist_grades 
        WHERE LOWER(name) = LOWER($1) AND id != $2
      `, [name, id])

      if (checkRows.length > 0) {
        return res.status(400).json({ 
          message: "Grade dengan nama tersebut sudah ada" 
        })
      }

      updateFields.push(`name = $${paramIndex}`)
      params.push(name)
      paramIndex++
    }

    const commissionValue = commission_amount ?? commission_percent
    if (commissionValue !== undefined) {
      const normalizedCommission = Number(commissionValue)
      if (Number.isNaN(normalizedCommission) || normalizedCommission < 0) {
        return res.status(400).json({ 
          message: "Commission amount must be greater than or equal to 0" 
        })
      }

      await ensureGradeCommissionStorage(db)
      const gradeCommissionExpr = await resolveGradeCommissionExpression(db)
      if (gradeCommissionExpr.includes("commission_amount")) {
        updateFields.push(`commission_amount = $${paramIndex}`)
        params.push(normalizedCommission)
        paramIndex++
      }

      updateFields.push(`commission_percent = $${paramIndex}`)
      params.push(normalizedCommission)
      paramIndex++
    }


    if (service_addon_amount !== undefined) {
      const normalizedAddon = Number(service_addon_amount)
      if (Number.isNaN(normalizedAddon) || normalizedAddon < 0) {
        return res.status(400).json({ message: "Service addon amount must be greater than or equal to 0" })
      }
      updateFields.push(`service_addon_amount = $${paramIndex}`)
      params.push(normalizedAddon)
      paramIndex++
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: "No fields to update" })
    }

    params.push(id)

    const { rows } = await db.query(`
      UPDATE therapist_grades
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, COALESCE(commission_amount, commission_percent, 0) AS commission_amount, COALESCE(commission_amount, commission_percent, 0) AS commission_percent, COALESCE(service_addon_amount, 0) AS service_addon_amount
    `, params)

    if (rows.length === 0) {
      return res.status(404).json({ message: "Grade not found" })
    }

    res.json(rows[0])
  } catch (err) {
    console.error("UPDATE GRADE ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

// ❌ DELETE GRADE (with validation)
exports.deleteGrade = async (req, res) => {
  try {
    const db = req.app.get("db")
    const { id } = req.params

    // Check if grade exists
    const { rows: checkRows } = await db.query(`
      SELECT id, name FROM therapist_grades WHERE id = $1
    `, [id])

    if (checkRows.length === 0) {
      return res.status(404).json({ message: "Grade not found" })
    }

    // Check if any therapists using this grade
    const { rows: therapistRows } = await db.query(`
      SELECT COUNT(*) as count FROM therapists WHERE grade_id = $1
    `, [id])

    if (parseInt(therapistRows[0].count) > 0) {
      return res.status(400).json({ 
        message: "Tidak dapat menghapus grade yang masih digunakan oleh terapis",
        hasTherapists: true,
        count: parseInt(therapistRows[0].count)
      })
    }

    // Delete grade
    await db.query(`DELETE FROM therapist_grades WHERE id = $1`, [id])

    res.json({ 
      message: "Grade berhasil dihapus", 
      grade: checkRows[0] 
    })
  } catch (err) {
    console.error("DELETE GRADE ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}
