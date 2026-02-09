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
      th.name AS therapist_name,
      r.name AS room_name,
      t.start_time,
      t.planned_end_time,
      EXTRACT(EPOCH FROM (t.planned_end_time - NOW()))::INTEGER AS remaining_seconds
    FROM timers t
    JOIN services s ON s.id = t.service_id
    LEFT JOIN therapists th ON th.id = t.therapist_id
    LEFT JOIN rooms r ON r.id = t.room_id
    WHERE
        t.end_time IS NULL 
     AND t.branch_id = $1
    ORDER BY t.start_time ASC
    `,
    [branchId]
  )

  return rows
}


// timer.service.js
exports.stopTimer = async (db, timerId) => {
  // 1. ambil timer dengan semua data
  const { rows } = await db.query(`
    SELECT 
      t.*,
      th.name AS therapist_name,
      r.name AS room_name,
      s.name AS service_name
    FROM timers t
    LEFT JOIN therapists th ON th.id = t.therapist_id
    LEFT JOIN rooms r ON r.id = t.room_id
    LEFT JOIN services s ON s.id = t.service_id
    WHERE t.id = $1
  `, [timerId])

  if (!rows.length) throw new Error("Timer tidak ditemukan")

  const timer = rows[0]

  // 2. stop timer
  await db.query(`
    UPDATE timers
    SET end_time = now(), status = 'FINISHED'
    WHERE id = $1
  `, [timerId])

  // 3. Update order_items dengan therapist dan room
  if (timer.order_id !== null && timer.service_id !== null) {
    await db.query(
      `
      WITH target AS (
        SELECT id
        FROM order_items
        WHERE order_id = $3
          AND service_id = $4
          AND (
            therapist_name IS NULL
            OR therapist_name = ''
            OR therapist_name = $1
          )
        ORDER BY id ASC
        LIMIT 1
      )
      UPDATE order_items oi
      SET
        therapist_name = $1,
        room_name = $2
      FROM target
      WHERE oi.id = target.id
      `,
      [
        timer.therapist_name || null,
        timer.room_name || null,
        timer.order_id,
        timer.service_id
      ]
    )

    // 4. Cek apakah semua timer sudah selesai untuk order ini
    const { rows: runningTimers } = await db.query(
      `SELECT COUNT(*) as count FROM timers 
       WHERE order_id = $1 AND status = 'RUNNING'`,
      [timer.order_id]
    )

    // 5. Update status order menjadi DRAFT jika semua timer selesai
    if (parseInt(runningTimers[0].count) === 0) {
      const updateResult = await db.query(
        `UPDATE orders SET status = 'DRAFT' WHERE id = $1 AND status != 'PAID' RETURNING status`,
        [timer.order_id]
      )
      
      if (updateResult.rows.length === 0) {
        console.warn(`⚠️ Order ${timer.order_id} tidak diupdate ke DRAFT (kemungkinan sudah PAID)`)
      }
    }
  }

  return timer
}


exports.getTimerSlots = async (db, branchId) => {
  // Generate 30 permanent slots (1-30)
  const slots = Array.from({ length: 30 }, (_, i) => ({
    slot_number: i + 1,
    status: 'EMPTY',
    timer_id: null,
    order_id: null,
    service_id: null,
    therapist_name: null,
    service_name: null,
    room_name: null,
    start_time: null,
    planned_end_time: null,
    remaining_seconds: 0
  }))

  // Fetch all active timers for this branch
  const { rows } = await db.query(
    `
    SELECT
      t.id,
      t.slot_number,
      t.order_id,
      t.service_id,
      s.name AS service_name,
      th.name AS therapist_name,
      r.name AS room_name,
      t.start_time,
      t.planned_end_time,
      EXTRACT(EPOCH FROM (t.planned_end_time - NOW()))::INTEGER AS remaining_seconds
    FROM timers t
    JOIN services s ON s.id = t.service_id
    LEFT JOIN therapists th ON th.id = t.therapist_id
    LEFT JOIN rooms r ON r.id = t.room_id
    WHERE
      t.end_time IS NULL 
      AND t.branch_id = $1
      AND t.slot_number IS NOT NULL
      AND t.slot_number >= 1
      AND t.slot_number <= 30
    ORDER BY t.slot_number ASC
    `,
    [branchId]
  )

  // Merge active timer data into respective slots by slot_number
  rows.forEach(timer => {
    const slotIndex = timer.slot_number - 1
    if (slotIndex >= 0 && slotIndex < 30) {
      slots[slotIndex] = {
        slot_number: timer.slot_number,
        status: 'RUNNING',
        timer_id: timer.id,
        order_id: timer.order_id,
        service_id: timer.service_id,
        therapist_name: timer.therapist_name,
        service_name: timer.service_name,
        room_name: timer.room_name,
        start_time: timer.start_time,
        planned_end_time: timer.planned_end_time,
        remaining_seconds: Math.max(0, timer.remaining_seconds || 0)
      }
    }
  })

  return slots
}
