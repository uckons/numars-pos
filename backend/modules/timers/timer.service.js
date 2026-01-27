// GET THERAPISTS FOR DROPDOWN
exports.getTherapists = async (db, branch_id, service_type) => {
  let query = `
    SELECT 
      id,
      name,
      grade_id
    FROM therapists
    WHERE branch_id = $1 AND active = true
    ORDER BY name ASC
  `
  
  const { rows } = await db.query(query, [branch_id])
  return rows
}

// GET ROOMS WITH OCCUPANCY STATUS
exports.getRooms = async (db, branch_id, service_type) => {
  let query = `
    SELECT 
      r.id,
      r.name,
      r.type,
      r.is_active,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM timers t 
          WHERE t.room_id = r.id 
          AND t.end_time IS NULL 
          AND t.branch_id = $1
        ) THEN true
        ELSE false
      END as is_occupied
    FROM rooms r
    WHERE r.branch_id = $1 AND r.is_active = true
  `
  
  const params = [branch_id]
  
  // Filter by service type if provided
  if (service_type) {
    query += ` AND r.type = $2`
    params.push(service_type)
  }
  
  query += ` ORDER BY r.name ASC`
  
  const { rows } = await db.query(query, params)
  
  // Add status field for better UX
  return rows.map(room => ({
    ...room,
    status: room.is_occupied ? 'occupied' : 'free'
  }))
}

exports.startTimer = async (db, order_id, therapist_id, room_id) => {
  const dur = await db.query(`
    SELECT COALESCE(SUM(duration_minutes), 60) AS duration
    FROM order_items
    WHERE order_id = $1
  `, [order_id])

  const duration = dur.rows[0].duration

  const { rows } = await db.query(`
    INSERT INTO timers
    (therapist_id, room_id, start_time, end_time)
    VALUES
    ($1, $2, $3, NOW(), NOW() + INTERVAL '1 minute' * $4)
    RETURNING *
  `, [order_id, therapist_id, room_id, duration])

  return rows[0]
}

//exports.getActiveTimers = async (db, branch_id) => {
//  const { rows } = await db.query(`
//    SELECT
//      t.id,
//      t.start_time,
//      t.planned_end_time,
//      th.name AS therapist,
//      r.name AS room,
//      s.name AS service
      //EXTRACT(EPOCH FROM (t.planned_end_time - NOW())) AS remaining_seconds
//    FROM timers t
//    LEFT JOIN therapists th ON th.id = t.therapist_id
//    LEFT JOIN rooms r ON r.id = t.room_id
//    WHERE t.branch_id = $1
//      AND t.planned_end_time > NOW()
//    ORDER BY t.start_time ASC
//  `, [branch_id])

//  return rows
//}

//exports.getActiveTimers = async (db, branch_id) => {
//  const { rows } = await db.query(`
//    SELECT
//      t.id,
//      t.start_time,
//     t.planned_end_time,
//      t.paused,
//      u.name AS therapist,
//      r.name AS room,
//      s.name AS service
//    FROM timers t
//    JOIN therapists u ON u.id = t.therapist_id
//    JOIN services s ON s.id = t.service_id
 //   LEFT JOIN rooms r ON r.id = t.room_id
//    WHERE t.end_time IS NULL
//      AND t.branch_id = $1
//    ORDER BY t.start_time ASC
//  `, [branch_id])

//  return rows
//}
exports.getActiveTimers = async (db, branchId) => {
  const { rows } = await db.query(
    `
    SELECT
      t.id,
      t.order_id,
      t.service_id,
      s.name AS service_name,
      t.start_time,
      t.planned_end_time
    FROM timers t
    JOIN services s ON s.id = t.service_id
    WHERE
 -- t.status = 'RUNNING'
        t.end_time IS NULL 
     AND t.branch_id = $1
    ORDER BY t.start_time ASC
    `,
    [branchId]
  )

  return rows
}


exports.stopTimer = async (db, id) => {
  const { rows } = await db.query(
    `
    UPDATE timers
    SET status = 'FINISHED', end_time = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id]
  )

  if (!rows.length) {
    throw new Error("Timer not found")
  }

  return rows[0]
}
