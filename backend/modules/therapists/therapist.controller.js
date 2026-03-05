
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

  await db.query(`
    ALTER TABLE therapist_attendance
    ADD COLUMN IF NOT EXISTS salon_used BOOLEAN NOT NULL DEFAULT false
  `)

  await db.query(`
    ALTER TABLE therapist_attendance
    ADD COLUMN IF NOT EXISTS absence_qty INT NOT NULL DEFAULT 0
  `)
}

const ensureTherapistPinColumn = async (db) => {
  await db.query(`
    ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS attendance_pin VARCHAR(50)
  `)
}

const ensureAgentProfileStorage = async (db) => {
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
    await ensureTherapistPinColumn(db)
    await ensureAgentProfileStorage(db)
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
        (t.attendance_pin IS NOT NULL AND t.attendance_pin <> '') AS has_attendance_pin,
        t.agent_profile_id,
        ap.name AS agent_profile_name,
        t.agent_cut_override,
        COALESCE(t.agent_cut_override, apgc.cut_amount, 0) AS agent_cut_amount,
        tg.name AS grade_name,
        ${gradeCommissionExpr} AS commission_amount,
        ${gradeCommissionExpr} AS commission_percent,
        b.name AS branch_name
      FROM therapists t
      LEFT JOIN therapist_grades tg ON tg.id = t.grade_id
      LEFT JOIN agent_profiles ap ON ap.id = t.agent_profile_id
      LEFT JOIN agent_profile_grade_cuts apgc ON apgc.agent_profile_id = t.agent_profile_id AND apgc.grade_id = t.grade_id
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
    await ensureTherapistPinColumn(db)
    await ensureAgentProfileStorage(db)
    const { id } = req.params
    const gradeCommissionExpr = await resolveGradeCommissionExpression(db)

    const { rows } = await db.query(`
      SELECT 
        t.id,
        t.name,
        t.branch_id,
        t.grade_id,
        t.active,
        (t.attendance_pin IS NOT NULL AND t.attendance_pin <> '') AS has_attendance_pin,
        t.agent_profile_id,
        ap.name AS agent_profile_name,
        t.agent_cut_override,
        COALESCE(t.agent_cut_override, apgc.cut_amount, 0) AS agent_cut_amount,
        tg.name AS grade_name,
        ${gradeCommissionExpr} AS commission_amount,
        ${gradeCommissionExpr} AS commission_percent,
        b.name AS branch_name
      FROM therapists t
      LEFT JOIN therapist_grades tg ON tg.id = t.grade_id
      LEFT JOIN agent_profiles ap ON ap.id = t.agent_profile_id
      LEFT JOIN agent_profile_grade_cuts apgc ON apgc.agent_profile_id = t.agent_profile_id AND apgc.grade_id = t.grade_id
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
    await ensureTherapistPinColumn(db)

    const branchId = req.user?.branch_id
    const businessDate = await getBusinessDateForBranch(db, branchId)
    const page = Math.max(1, Number(req.query?.page || 1))
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 10)))
    const search = String(req.query?.search || '').trim()
    const gradeId = Number(req.query?.grade_id || 0)
    const offset = (page - 1) * limit

    const countWhereFilters = ['t.branch_id = $1', 't.active = true']
    const countParams = [branchId]
    let countParamIndex = 2

    if (search) {
      countWhereFilters.push(`t.name ILIKE $${countParamIndex}`)
      countParams.push(`%${search}%`)
      countParamIndex += 1
    }

    if (gradeId > 0) {
      countWhereFilters.push(`t.grade_id = $${countParamIndex}`)
      countParams.push(gradeId)
      countParamIndex += 1
    }

    const countWhereClause = `WHERE ${countWhereFilters.join(' AND ')}`

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM therapists t
      ${countWhereClause}
    `
    const { rows: countRows } = await db.query(countQuery, countParams)
    const totalRecords = Number(countRows[0]?.total || 0)
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit))

    const rowWhereFilters = ['t.branch_id = $1', 't.active = true']
    const rowParams = [branchId, businessDate]
    let rowParamIndex = 3

    if (search) {
      rowWhereFilters.push(`t.name ILIKE $${rowParamIndex}`)
      rowParams.push(`%${search}%`)
      rowParamIndex += 1
    }

    if (gradeId > 0) {
      rowWhereFilters.push(`t.grade_id = $${rowParamIndex}`)
      rowParams.push(gradeId)
      rowParamIndex += 1
    }

    const rowWhereClause = `WHERE ${rowWhereFilters.join(' AND ')}`

    const { rows } = await db.query(
      `SELECT
         t.id,
         t.name,
         t.grade_id,
         COALESCE(tg.name, '-') AS grade_name,
         t.active,
       (t.attendance_pin IS NOT NULL AND t.attendance_pin <> '') AS has_attendance_pin,
       COALESCE(ta.status, 'OFF') AS attendance_status,
       COALESCE(ta.salon_used, false) AS salon_used,
       COALESCE(ta.absence_qty, 0) AS absence_qty,
       ta.updated_at
       FROM therapists t
       LEFT JOIN therapist_grades tg ON tg.id = t.grade_id
       LEFT JOIN therapist_attendance ta
         ON ta.therapist_id = t.id
        AND ta.business_date = $2::date
       ${rowWhereClause}
       ORDER BY t.name ASC
       LIMIT $${rowParamIndex} OFFSET $${rowParamIndex + 1}`,
      [...rowParams, limit, offset]
    )

    res.json({
      business_date: businessDate,
      data: rows,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages
      }
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
    await ensureTherapistPinColumn(db)

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
      `SELECT id, COALESCE(attendance_pin, '') AS attendance_pin
       FROM therapists
       WHERE id = $1 AND branch_id = $2 AND active = true`,
      [therapistId, branchId]
    )
    if (!therapistRes.rows.length) {
      return res.status(404).json({ message: 'Terapis tidak ditemukan' })
    }

    const therapistPin = String(therapistRes.rows[0].attendance_pin || '').trim()
    if ((status === 'MASUK' || status === 'CLOSE') && !therapistPin) {
      return res.status(400).json({ message: 'PIN absensi terapis belum diset. Atur PIN di menu Master Terapis.' })
    }
    if ((status === 'MASUK' || status === 'CLOSE') && therapistPin !== pinInput) {
      return res.status(400).json({ message: 'PIN absensi tidak sesuai' })
    }

    const salonUsed = Boolean(req.body?.salon_used)

    const { rows } = await db.query(
      `INSERT INTO therapist_attendance (therapist_id, branch_id, business_date, status, pin_input, salon_used, updated_by, updated_at)
       VALUES ($1, $2, $3::date, $4, $5, $6, $7, NOW())
       ON CONFLICT (therapist_id, business_date)
       DO UPDATE SET
         status = EXCLUDED.status,
         pin_input = EXCLUDED.pin_input,
         salon_used = CASE WHEN EXCLUDED.status = 'OFF' THEN false ELSE EXCLUDED.salon_used END,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING therapist_id, business_date, status, salon_used, absence_qty, updated_at`,
      [therapistId, branchId, businessDate, status, pinInput || null, status === 'OFF' ? false : salonUsed, req.user?.id || null]
    )

    res.json({ success: true, attendance: rows[0] })
  } catch (err) {
    console.error('SET THERAPIST ATTENDANCE ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}


exports.addTherapistAbsence = async (req, res) => {
  try {
    const db = req.app.get('db')
    await ensureTherapistAttendanceTable(db)

    const therapistId = Number(req.params.id)
    if (!Number.isInteger(therapistId) || therapistId <= 0) {
      return res.status(400).json({ message: 'Terapis tidak valid' })
    }

    const qtyDelta = 1
    const branchId = req.user?.branch_id
    const businessDate = await getBusinessDateForBranch(db, branchId)

    const attendanceRes = await db.query(
      `SELECT therapist_id, status, absence_qty
       FROM therapist_attendance
       WHERE therapist_id = $1 AND branch_id = $2 AND business_date = $3::date
       LIMIT 1`,
      [therapistId, branchId, businessDate]
    )

    if (!attendanceRes.rows.length) {
      const { rows } = await db.query(
        `INSERT INTO therapist_attendance (therapist_id, branch_id, business_date, status, absence_qty, updated_by, updated_at)
         VALUES ($1, $2, $3::date, 'OFF', $4, $5, NOW())
         RETURNING therapist_id, business_date, status, salon_used, absence_qty, updated_at`,
        [therapistId, branchId, businessDate, qtyDelta, req.user?.id || null]
      )
      return res.json({ success: true, attendance: rows[0] })
    }

    const currentStatus = String(attendanceRes.rows[0].status || 'OFF').toUpperCase()
    if (currentStatus === 'MASUK') {
      return res.status(400).json({ message: 'Status MASUK tidak dapat ditambahkan absen.' })
    }

    const currentAbsenceQty = Number(attendanceRes.rows[0].absence_qty || 0)
    if (currentAbsenceQty >= 1) {
      return res.status(400).json({ message: 'Absen hanya bisa 1x per hari.' })
    }

    const { rows } = await db.query(
      `UPDATE therapist_attendance
       SET absence_qty = $1,
           updated_by = $2,
           updated_at = NOW()
       WHERE therapist_id = $3 AND branch_id = $4 AND business_date = $5::date
       RETURNING therapist_id, business_date, status, salon_used, absence_qty, updated_at`,
      [qtyDelta, req.user?.id || null, therapistId, branchId, businessDate]
    )

    res.json({ success: true, attendance: rows[0] })
  } catch (err) {
    console.error('ADD THERAPIST ABSENCE ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}

exports.setTherapistSalonUsage = async (req, res) => {
  try {
    const db = req.app.get('db')
    await ensureTherapistAttendanceTable(db)

    const therapistId = Number(req.params.id)
    const salonUsed = Boolean(req.body?.salon_used)
    if (!Number.isInteger(therapistId) || therapistId <= 0) {
      return res.status(400).json({ message: 'Terapis tidak valid' })
    }

    const branchId = req.user?.branch_id
    const businessDate = await getBusinessDateForBranch(db, branchId)

    const attendanceRes = await db.query(
      `SELECT therapist_id, status, absence_qty
       FROM therapist_attendance
       WHERE therapist_id = $1 AND branch_id = $2 AND business_date = $3::date
       LIMIT 1`,
      [therapistId, branchId, businessDate]
    )

    if (!attendanceRes.rows.length) {
      return res.status(400).json({ message: 'Terapis belum absen hari ini. Absen MASUK terlebih dahulu.' })
    }

    const currentStatus = String(attendanceRes.rows[0].status || 'OFF').toUpperCase()
    if (currentStatus === 'OFF') {
      return res.status(400).json({ message: 'Status OFF tidak bisa menggunakan salon.' })
    }

    const { rows } = await db.query(
      `UPDATE therapist_attendance
       SET salon_used = $1,
           updated_by = $2,
           updated_at = NOW()
       WHERE therapist_id = $3 AND branch_id = $4 AND business_date = $5::date
       RETURNING therapist_id, business_date, status, salon_used, updated_at`,
      [salonUsed, req.user?.id || null, therapistId, branchId, businessDate]
    )

    res.json({ success: true, attendance: rows[0] })
  } catch (err) {
    console.error('SET THERAPIST SALON USAGE ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}

exports.getTherapistSalonUsageSummary = async (req, res) => {
  try {
    const db = req.app.get('db')
    await ensureTherapistAttendanceTable(db)
    const requestedBranchId = req.query?.branch_id
    const branchId = canAccessAllBranches(req.user?.role)
      ? Number(requestedBranchId || req.user?.branch_id)
      : Number(req.user?.branch_id)

    const from = req.query?.date_from ? new Date(req.query.date_from) : new Date()
    const to = req.query?.date_to ? new Date(req.query.date_to) : new Date()
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ message: 'Format tanggal tidak valid' })
    }

    const fromIso = from.toISOString().slice(0, 10)
    const toIso = to.toISOString().slice(0, 10)

    const { rows } = await db.query(
      `SELECT
         t.id AS therapist_id,
         t.name AS therapist_name,
         COALESCE(COUNT(*) FILTER (WHERE ta.salon_used = true AND ta.status <> 'OFF'), 0) AS salon_usage_qty
       FROM therapists t
       LEFT JOIN therapist_attendance ta
         ON ta.therapist_id = t.id
        AND ta.branch_id = $1
        AND ta.business_date BETWEEN $2::date AND $3::date
       WHERE t.branch_id = $1
         AND t.active = true
       GROUP BY t.id, t.name
       ORDER BY t.name ASC`,
      [branchId, fromIso, toIso]
    )

    res.json({
      branch_id: branchId,
      date_from: fromIso,
      date_to: toIso,
      data: rows.map((row) => ({
        therapist_id: Number(row.therapist_id),
        therapist_name: row.therapist_name,
        salon_usage_qty: Number(row.salon_usage_qty || 0)
      }))
    })
  } catch (err) {
    console.error('GET THERAPIST SALON USAGE SUMMARY ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}



exports.getTherapistAbsenceSummary = async (req, res) => {
  try {
    const db = req.app.get('db')
    await ensureTherapistAttendanceTable(db)
    const requestedBranchId = req.query?.branch_id
    const branchId = canAccessAllBranches(req.user?.role)
      ? Number(requestedBranchId || req.user?.branch_id)
      : Number(req.user?.branch_id)

    const from = req.query?.date_from ? new Date(req.query.date_from) : new Date()
    const to = req.query?.date_to ? new Date(req.query.date_to) : new Date()
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ message: 'Format tanggal tidak valid' })
    }

    const fromIso = from.toISOString().slice(0, 10)
    const toIso = to.toISOString().slice(0, 10)

    const { rows } = await db.query(
      `SELECT
         t.id AS therapist_id,
         t.name AS therapist_name,
         COALESCE(SUM(CASE WHEN ta.status <> 'OFF' THEN COALESCE(ta.absence_qty, 0) ELSE 0 END), 0) AS absence_qty
       FROM therapists t
       LEFT JOIN therapist_attendance ta
         ON ta.therapist_id = t.id
        AND ta.branch_id = $1
        AND ta.business_date BETWEEN $2::date AND $3::date
       WHERE t.branch_id = $1
         AND t.active = true
       GROUP BY t.id, t.name
       ORDER BY t.name ASC`,
      [branchId, fromIso, toIso]
    )

    res.json({
      branch_id: branchId,
      date_from: fromIso,
      date_to: toIso,
      data: rows.map((row) => ({
        therapist_id: Number(row.therapist_id),
        therapist_name: row.therapist_name,
        absence_qty: Number(row.absence_qty || 0)
      }))
    })
  } catch (err) {
    console.error('GET THERAPIST ABSENCE SUMMARY ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}

// ✅ CREATE THERAPIST
exports.createTherapist = async (req, res) => {
  try {
    const db = req.app.get("db")
    await ensureTherapistPinColumn(db)
    await ensureAgentProfileStorage(db)
    const { name, grade_id, branch_id, attendance_pin, agent_profile_id, agent_cut_override } = req.body

    // Validation
    if (!name || !grade_id) {
      return res.status(400).json({ message: "Name and grade are required" })
    }

    // Use user's branch if not provided
    const finalBranchId = branch_id || req.user.branch_id

    const normalizedPin = String(attendance_pin || '').trim()
    if (normalizedPin && normalizedPin.length < 4) {
      return res.status(400).json({ message: 'PIN absensi minimal 4 karakter' })
    }

    const normalizedAgentOverride = agent_cut_override === undefined || agent_cut_override === null || agent_cut_override === ''
      ? null
      : Number(agent_cut_override)
    if (normalizedAgentOverride !== null && (Number.isNaN(normalizedAgentOverride) || normalizedAgentOverride < 0)) {
      return res.status(400).json({ message: 'Potongan agent manual harus angka >= 0' })
    }

    const { rows } = await db.query(`
      INSERT INTO therapists (name, grade_id, branch_id, active, attendance_pin, agent_profile_id, agent_cut_override)
      VALUES ($1, $2, $3, true, $4, $5, $6)
      RETURNING id, name, grade_id, branch_id, active,
        (attendance_pin IS NOT NULL AND attendance_pin <> '') AS has_attendance_pin,
        agent_profile_id,
        agent_cut_override
    `, [name, grade_id, finalBranchId, normalizedPin || null, agent_profile_id || null, normalizedAgentOverride])

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
    await ensureTherapistPinColumn(db)
    await ensureAgentProfileStorage(db)
    const { id } = req.params
    const { name, grade_id, branch_id, active, attendance_pin, service_addon_amount, agent_profile_id, agent_cut_override } = req.body

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

    if (attendance_pin !== undefined) {
      const normalizedPin = String(attendance_pin || '').trim()
      if (normalizedPin && normalizedPin.length < 4) {
        return res.status(400).json({ message: 'PIN absensi minimal 4 karakter' })
      }
      updateFields.push(`attendance_pin = $${paramIndex}`)
      params.push(normalizedPin || null)
      paramIndex++
    }

    if (agent_profile_id !== undefined) {
      updateFields.push(`agent_profile_id = $${paramIndex}`)
      params.push(agent_profile_id || null)
      paramIndex++
    }

    if (agent_cut_override !== undefined) {
      const normalizedOverride = agent_cut_override === null || agent_cut_override === ''
        ? null
        : Number(agent_cut_override)
      if (normalizedOverride !== null && (Number.isNaN(normalizedOverride) || normalizedOverride < 0)) {
        return res.status(400).json({ message: 'Potongan agent manual harus angka >= 0' })
      }
      updateFields.push(`agent_cut_override = $${paramIndex}`)
      params.push(normalizedOverride)
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
      RETURNING id, name, grade_id, branch_id, active,
        (attendance_pin IS NOT NULL AND attendance_pin <> '') AS has_attendance_pin,
        agent_profile_id,
        agent_cut_override
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

exports.getAgentProfiles = async (req, res) => {
  try {
    const db = req.app.get('db')
    await ensureAgentProfileStorage(db)
    const { include_inactive } = req.query

    const where = include_inactive === 'true' ? '' : 'WHERE ap.active = true'
    const { rows } = await db.query(
      `SELECT
         ap.id,
         ap.name,
         ap.active,
         COALESCE(
           json_agg(
             json_build_object(
               'grade_id', g.id,
               'grade_name', g.name,
               'cut_amount', COALESCE(apgc.cut_amount, 0)
             )
             ORDER BY g.name
           ) FILTER (WHERE g.id IS NOT NULL),
           '[]'::json
         ) AS grade_cuts
       FROM agent_profiles ap
       LEFT JOIN therapist_grades g ON true
       LEFT JOIN agent_profile_grade_cuts apgc
         ON apgc.agent_profile_id = ap.id
        AND apgc.grade_id = g.id
       ${where}
       GROUP BY ap.id
       ORDER BY ap.name ASC`
    )

    res.json(rows)
  } catch (err) {
    console.error('GET AGENT PROFILES ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}

exports.createAgentProfile = async (req, res) => {
  try {
    const db = req.app.get('db')
    await ensureAgentProfileStorage(db)
    const name = String(req.body?.name || '').trim()
    const gradeCuts = Array.isArray(req.body?.grade_cuts) ? req.body.grade_cuts : []

    if (!name) {
      return res.status(400).json({ message: 'Nama agent profile wajib diisi' })
    }

    const { rows } = await db.query(
      `INSERT INTO agent_profiles (name, active)
       VALUES ($1, true)
       RETURNING id, name, active`,
      [name]
    )

    const profile = rows[0]
    for (const item of gradeCuts) {
      const gradeId = Number(item?.grade_id)
      const cutAmount = Number(item?.cut_amount || 0)
      if (!Number.isInteger(gradeId) || gradeId <= 0) continue
      if (Number.isNaN(cutAmount) || cutAmount < 0) {
        return res.status(400).json({ message: 'Nominal potongan grade harus angka >= 0' })
      }
      await db.query(
        `INSERT INTO agent_profile_grade_cuts (agent_profile_id, grade_id, cut_amount)
         VALUES ($1, $2, $3)
         ON CONFLICT (agent_profile_id, grade_id)
         DO UPDATE SET cut_amount = EXCLUDED.cut_amount`,
        [profile.id, gradeId, cutAmount]
      )
    }

    res.status(201).json(profile)
  } catch (err) {
    console.error('CREATE AGENT PROFILE ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}

exports.updateAgentProfile = async (req, res) => {
  try {
    const db = req.app.get('db')
    await ensureAgentProfileStorage(db)
    const profileId = Number(req.params.id)
    const { name, active, grade_cuts } = req.body || {}

    if (!Number.isInteger(profileId) || profileId <= 0) {
      return res.status(400).json({ message: 'Agent profile tidak valid' })
    }

    const fields = []
    const params = []
    let idx = 1
    if (name !== undefined) {
      fields.push(`name = $${idx++}`)
      params.push(String(name || '').trim())
    }
    if (active !== undefined) {
      fields.push(`active = $${idx++}`)
      params.push(Boolean(active))
    }

    if (fields.length) {
      params.push(profileId)
      const updated = await db.query(
        `UPDATE agent_profiles
         SET ${fields.join(', ')}
         WHERE id = $${idx}
         RETURNING id, name, active`,
        params
      )
      if (!updated.rows.length) {
        return res.status(404).json({ message: 'Agent profile tidak ditemukan' })
      }
    }

    if (Array.isArray(grade_cuts)) {
      for (const item of grade_cuts) {
        const gradeId = Number(item?.grade_id)
        const cutAmount = Number(item?.cut_amount || 0)
        if (!Number.isInteger(gradeId) || gradeId <= 0) continue
        if (Number.isNaN(cutAmount) || cutAmount < 0) {
          return res.status(400).json({ message: 'Nominal potongan grade harus angka >= 0' })
        }
        await db.query(
          `INSERT INTO agent_profile_grade_cuts (agent_profile_id, grade_id, cut_amount)
           VALUES ($1, $2, $3)
           ON CONFLICT (agent_profile_id, grade_id)
           DO UPDATE SET cut_amount = EXCLUDED.cut_amount`,
          [profileId, gradeId, cutAmount]
        )
      }
    }

    const latest = await db.query(
      'SELECT id, name, active FROM agent_profiles WHERE id = $1',
      [profileId]
    )

    if (!latest.rows.length) {
      return res.status(404).json({ message: 'Agent profile tidak ditemukan' })
    }

    res.json(latest.rows[0])
  } catch (err) {
    console.error('UPDATE AGENT PROFILE ERROR:', err)
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
