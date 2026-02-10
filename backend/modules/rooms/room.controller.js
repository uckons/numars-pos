const normalizeType = (value) => String(value || '').toUpperCase().trim()
const VALID_TYPES = new Set(['SPA', 'LC', 'LOUNGE', 'KTV'])

const resolveBranchId = (req) => {
  const fromQuery = Number(req.query.branch_id)
  const fromBody = Number(req.body?.branch_id)

  if (Number.isInteger(fromQuery) && fromQuery > 0) return fromQuery
  if (Number.isInteger(fromBody) && fromBody > 0) return fromBody

  const userBranch = Number(req.user?.branch_id)
  return Number.isInteger(userBranch) && userBranch > 0 ? userBranch : null
}

const ensureRoomNotOccupied = async (db, roomId) => {
  const { rows } = await db.query(
    `SELECT 1 FROM timers WHERE room_id = $1 AND end_time IS NULL LIMIT 1`,
    [roomId]
  )
  if (rows.length) {
    throw new Error('Room sedang dipakai timer aktif')
  }
}

exports.getRooms = async (req, res) => {
  try {
    const db = req.app.get('db')
    const requestedBranchId = resolveBranchId(req)
    const includeInactive = String(req.query.include_inactive || 'false') === 'true'

    const where = []
    const params = []

    if (requestedBranchId) {
      params.push(requestedBranchId)
      where.push(`r.branch_id = $${params.length}`)
    } else if (String(req.user?.role || '').toLowerCase() !== 'superadmin') {
      return res.status(400).json({ message: 'branch_id wajib untuk user non-superadmin' })
    }

    if (!includeInactive) {
      where.push('r.is_active = true')
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const { rows } = await db.query(
      `SELECT
         r.id,
         r.name,
         r.type,
         r.is_active,
         r.branch_id,
         b.name AS branch_name,
         CASE WHEN EXISTS (
           SELECT 1 FROM timers t
           WHERE t.room_id = r.id
             AND t.end_time IS NULL
         ) THEN true ELSE false END AS is_occupied
       FROM rooms r
       LEFT JOIN branches b ON b.id = r.branch_id
       ${whereClause}
       ORDER BY r.branch_id ASC, r.type ASC, r.name ASC`
      ,
      params
    )

    res.json(rows)
  } catch (err) {
    console.error('GET ROOMS ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}

exports.createRoom = async (req, res) => {
  try {
    const db = req.app.get('db')
    const branchId = resolveBranchId(req)
    const name = String(req.body.name || '').trim()
    const type = normalizeType(req.body.type)

    if (!branchId) return res.status(400).json({ message: 'branch_id wajib diisi' })
    if (!name) return res.status(400).json({ message: 'Nama room wajib diisi' })
    if (!VALID_TYPES.has(type)) return res.status(400).json({ message: 'Tipe room tidak valid' })

    const { rows } = await db.query(
      `INSERT INTO rooms (branch_id, name, type, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, branch_id, name, type, is_active`,
      [branchId, name, type]
    )

    res.status(201).json(rows[0])
  } catch (err) {
    console.error('CREATE ROOM ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}

exports.updateRoom = async (req, res) => {
  try {
    const db = req.app.get('db')
    const roomId = Number(req.params.id)
    const name = String(req.body.name || '').trim()
    const type = normalizeType(req.body.type)

    if (!Number.isInteger(roomId) || roomId <= 0) {
      return res.status(400).json({ message: 'ID room tidak valid' })
    }

    if (!name) return res.status(400).json({ message: 'Nama room wajib diisi' })
    if (!VALID_TYPES.has(type)) return res.status(400).json({ message: 'Tipe room tidak valid' })

    const { rows } = await db.query(
      `UPDATE rooms
       SET name = $1,
           type = $2
       WHERE id = $3
       RETURNING id, branch_id, name, type, is_active`,
      [name, type, roomId]
    )

    if (!rows.length) return res.status(404).json({ message: 'Room tidak ditemukan' })

    res.json(rows[0])
  } catch (err) {
    console.error('UPDATE ROOM ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}

exports.toggleRoom = async (req, res) => {
  try {
    const db = req.app.get('db')
    const roomId = Number(req.params.id)

    if (!Number.isInteger(roomId) || roomId <= 0) {
      return res.status(400).json({ message: 'ID room tidak valid' })
    }

    const { rows: existingRows } = await db.query(
      `SELECT id, is_active FROM rooms WHERE id = $1`,
      [roomId]
    )
    if (!existingRows.length) return res.status(404).json({ message: 'Room tidak ditemukan' })

    const nextActive = !Boolean(existingRows[0].is_active)
    if (!nextActive) {
      await ensureRoomNotOccupied(db, roomId)
    }

    const { rows } = await db.query(
      `UPDATE rooms
       SET is_active = $1
       WHERE id = $2
       RETURNING id, branch_id, name, type, is_active`,
      [nextActive, roomId]
    )

    res.json(rows[0])
  } catch (err) {
    console.error('TOGGLE ROOM ERROR:', err)
    res.status(400).json({ message: err.message })
  }
}

exports.deleteRoom = async (req, res) => {
  try {
    const db = req.app.get('db')
    const roomId = Number(req.params.id)

    if (!Number.isInteger(roomId) || roomId <= 0) {
      return res.status(400).json({ message: 'ID room tidak valid' })
    }

    await ensureRoomNotOccupied(db, roomId)

    const { rows } = await db.query(
      `UPDATE rooms
       SET is_active = false
       WHERE id = $1
       RETURNING id`,
      [roomId]
    )

    if (!rows.length) return res.status(404).json({ message: 'Room tidak ditemukan' })

    res.json({ success: true })
  } catch (err) {
    console.error('DELETE ROOM ERROR:', err)
    res.status(400).json({ message: err.message })
  }
}
