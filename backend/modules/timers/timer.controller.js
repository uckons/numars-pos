const service = require("./timer.service")

// GET THERAPISTS FOR TIMER DROPDOWN
exports.getTherapists = async (req, res) => {
  try {
    const db = req.app.get("db")
    const { branch_id, service_type } = req.query

    if (!branch_id) {
      return res.status(400).json({ message: "branch_id is required" })
    }

    const therapists = await service.getTherapists(db, branch_id, service_type)
    res.json(therapists)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
}

// GET ROOMS FOR TIMER DROPDOWN
exports.getRooms = async (req, res) => {
  try {
    const db = req.app.get("db")
    const { branch_id, service_type } = req.query

    if (!branch_id) {
      return res.status(400).json({ message: "branch_id is required" })
    }

    const rooms = await service.getRooms(db, branch_id, service_type)
    res.json(rooms)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
}

exports.start = async (req, res) => {
  try {
    const db = req.app.get("db")

    const {
      order_id,
      service_id,
      therapist_id,
      room_id
    } = req.body

    if (!order_id || !service_id || !therapist_id || !room_id) {
      return res.status(400).json({ message: "Incomplete data" })
    }

    const timer = await service.startTimer(
      db,
      order_id,
      service_id,
      therapist_id,
      room_id
    )

    res.json(timer)
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

//exports.getActive = async (req, res) => {
//  try {
//    const db = req.app.get("db")
//    const branch_id = req.user.branch_id

//    const timers = await service.getActiveTimers(db, branch_id)
//    res.json(timers)
//  } catch (err) {
//    res.status(400).json({ message: err.message })
//  }
//}
//exports.getActive = async (req, res) => {
// const db = req.app.get("db")
//  const branchId = req.user.branch_id

//  const timers = await service.getActiveTimers(db, branchId)
//  res.json(timers)
//}
exports.getActive = async (req, res) => {
  const db = req.app.get("db")
  const timers = await service.getActiveTimers(db, req.user.branch_id)
  res.json(timers)
}


exports.startTimer = async (req, res) => {
  try {
    const db = req.app.get("db")
    const { order_id, therapist_id, service_id, room_id, duration_minutes } = req.body
    const user = req.user

    if (!order_id || !therapist_id || !service_id || !duration_minutes) {
      return res.status(400).json({ message: "Data timer tidak lengkap" })
    }

    // Validate therapist exists and is active
    const therapistCheck = await db.query(
      `SELECT id FROM therapists WHERE id = $1 AND active = true AND branch_id = $2`,
      [therapist_id, user.branch_id]
    )
    if (!therapistCheck.rows.length) {
      return res.status(400).json({ message: "Therapist tidak valid atau tidak aktif" })
    }

    // Validate room exists and is not occupied (if room_id provided)
    if (room_id) {
      const roomCheck = await db.query(
        `SELECT id FROM rooms WHERE id = $1 AND is_active = true AND branch_id = $2`,
        [room_id, user.branch_id]
      )
      if (!roomCheck.rows.length) {
        return res.status(400).json({ message: "Room tidak valid atau tidak aktif" })
      }

      // Check if room is occupied
      const occupancyCheck = await db.query(
        `SELECT id FROM timers 
         WHERE room_id = $1 AND end_time IS NULL AND branch_id = $2`,
        [room_id, user.branch_id]
      )
      if (occupancyCheck.rows.length > 0) {
        return res.status(400).json({ message: "Room sedang digunakan" })
      }
    }

    // Validate service exists
    const serviceCheck = await db.query(
      `SELECT id FROM services WHERE id = $1 AND branch_id = $2`,
      [service_id, user.branch_id]
    )
    if (!serviceCheck.rows.length) {
      return res.status(400).json({ message: "Service tidak valid" })
    }

    const start = new Date()
    const plannedEnd = new Date(start.getTime() + duration_minutes * 60000)

    const { rows } = await db.query(
      `INSERT INTO timers
       (order_id, therapist_id, service_id, room_id, start_time, planned_end_time, paused, branch_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,false,$7,'RUNNING')
       RETURNING *`,
      [
        order_id,
        therapist_id,
        service_id,
        room_id || null,
        start,
        plannedEnd,
        user.branch_id
      ]
    )

    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
}




exports.stop = async (req, res) => {
  try {
    const db = req.app.get("db")
    const id = req.params.id

    const timer = await service.stopTimer(db, id)
    res.json(timer)
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}
exports.create = async (req, res) => {
  const db = req.app.get("db")
  const { order_id, service_id, duration_minutes } = req.body
  const branch_id = req.user.branch_id

  const start = new Date()
  const end = new Date(start.getTime() + duration_minutes * 60000)

  await db.query(
    `
    INSERT INTO timers
      (order_id, service_id, branch_id, start_time, planned_end_time)
    VALUES
      ($1,$2,$3,$4,$5)
    `,
    [order_id, service_id, branch_id, start, end]
  )

  res.json({ success: true })
}

exports.startManual = async (req, res) => {
  try {
    const db = req.app.get("db")
    const user = req.user
    const { order_id, service_id } = req.body

    const { rows } = await db.query(
      `SELECT duration_minutes FROM services WHERE id=$1`,
      [service_id]
    )

    if (!rows.length || !rows[0].duration_minutes) {
      return res.status(400).json({ message: "Service tidak punya durasi" })
    }

    await db.query(
      `
      INSERT INTO timers
        (order_id, service_id, branch_id, start_time, planned_end_time)
      VALUES
        ($1,$2,$3, now(),
         now() + ($4 || ' minutes')::interval)
      `,
      [
        order_id,
        service_id,
        user.branch_id,
        `${rows[0].duration_minutes} minutes`
      ]
    )

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
}

exports.createFromOrder = async (req, res) => {
  try {
    const db = req.app.get("db")
    const { orderId } = req.params
    const user = req.user

    // ambil item order yg punya durasi
    const itemsRes = await db.query(
      `
      SELECT oi.service_id, s.duration_minutes
      FROM order_items oi
      JOIN services s ON s.id = oi.service_id
      WHERE oi.order_id = $1
        AND s.duration_minutes IS NOT NULL
      `,
      [orderId]
    )

    if (!itemsRes.rows.length) {
      return res.json({ success: true, created: 0 })
    }

    let created = 0

    for (const i of itemsRes.rows) {
      const start = new Date()
      const end = new Date(start.getTime() + i.duration_minutes * 60000)

      await db.query(
        `
        INSERT INTO timers
          (order_id, service_id, branch_id, start_time, planned_end_time)
        VALUES
          ($1,$2,$3,$4,$5)
        `,
        [
          orderId,
          i.service_id,
          user.branch_id,
          start,
          end
        ]
      )

      created++
    }

    res.json({ success: true, created })
  } catch (err) {
    console.error("CREATE TIMER ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

