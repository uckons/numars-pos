const service = require("./timer.service")
const { writeAuditLog: writeAuditEntry } = require("../../utils/audit")
const printerService = require("../printers/printer.service")
const printerTargetService = require("../printers/printer-target.service")



const resolveBranchIdFromRequest = async (db, req) => {
  const direct = Number(req.query?.branch_id || req.body?.branch_id || req.user?.branch_id || 0)
  if (Number.isInteger(direct) && direct > 0) return direct

  const userId = Number(req.user?.id || 0)
  if (!Number.isInteger(userId) || userId <= 0) return null

  const userRes = await db.query(
    "SELECT branch_id FROM users WHERE id = $1 LIMIT 1",
    [userId]
  )
  const fromDb = Number(userRes.rows[0]?.branch_id || 0)
  return Number.isInteger(fromDb) && fromDb > 0 ? fromDb : null
}


const queueBarInboxAutoPrint = (req, payload = {}) => {
  Promise.resolve().then(async () => {
    const db = req.app.get("db")
    const target = await printerTargetService.getResolvedPrinterTarget({
      db,
      branchId: payload.branch_id,
      channel: printerTargetService.CHANNELS.BAR_INBOX
    })

    if (!target?.agent_url || target.is_active === false) return

    const { rows: orderMetaRows } = await db.query(
      `SELECT
         r.name AS room_name,
         (
           SELECT string_agg(DISTINCT t_name, ', ' ORDER BY t_name)
           FROM (
             SELECT NULLIF(BTRIM(regexp_split_to_table(COALESCE(oi.therapist_name, ''), ',')), '') AS t_name
             FROM order_items oi
             WHERE oi.order_id = o.id
           ) t
           WHERE t_name IS NOT NULL
         ) AS therapist_name
       FROM orders o
       LEFT JOIN rooms r ON r.id = o.room_id
       WHERE o.id = $1
       LIMIT 1`,
      [payload.order_id]
    )
    const roomName = payload.room_name || orderMetaRows[0]?.room_name || null
    const therapistName = payload.therapist_name || orderMetaRows[0]?.therapist_name || null
    const ticketNote = [roomName ? `Room/Sofa: ${roomName}` : null, payload.note || null]
      .filter(Boolean)
      .join(" | ") || null

    await printerService.printBarInboxTicket({
      ticket: {
        order_id: payload.order_id,
        branch_name: payload.branch_name || "BAR",
        created_at: new Date().toISOString(),
        room_name: roomName,
        therapist_name: therapistName,
        note: ticketNote,
        source: payload.source || "TIMER KTV -> BAR",
        items: Array.isArray(payload.items) ? payload.items : []
      },
      printer: {
        agent_url: target.agent_url,
        agent_token: target.agent_token,
        agent_printer_name: target.agent_printer_name
      }
    })
  }).catch((err) => {
    console.error("BAR AUTO PRINT TIMER ERROR:", err.message || err)
  })
}

exports.start = async (req, res) => {

  const ensureBarOrdersTable = async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS bar_orders (
        id SERIAL PRIMARY KEY,
        order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        branch_id INT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        items_snapshot JSONB NOT NULL,
        note TEXT,
        requested_by INT,
        accepted_by INT,
        delivered_by INT,
        cancelled_by INT,
        created_at TIMESTAMP DEFAULT NOW(),
        accepted_at TIMESTAMP,
        delivered_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
  }

  const emitBarOrderNew = (req, payload) => {
    const io = req.app.get('io')
    if (!io || !payload?.branch_id) return
    const roleRoom = (branchId, role = '') => `branch:${branchId}:role:${String(role).toLowerCase().replace(/\s+/g, '-')}`
    io.to(roleRoom(payload.branch_id, 'Staff Bar')).emit('bar:order:new', payload)
    io.to(roleRoom(payload.branch_id, 'Supervisor')).emit('bar:order:new', payload)
    io.to(roleRoom(payload.branch_id, 'Manager')).emit('bar:order:new', payload)
  }

  try {
    const db = req.app.get("db")

    const {
      order_id,
      service_id,
      service_ids,
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
      service_ids,
      therapist_id,
      room_id
    )

    await writeAuditEntry(db, req.user?.id, "TIMER_ADD", { order_id, service_id, therapist_id, room_id, timer_id: timer?.id })

    res.json(timer)
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

exports.getActive = async (req, res) => {
  try {
    const db = req.app.get("db")
    const branchId = await resolveBranchIdFromRequest(db, req)
    if (!branchId) {
      return res.status(400).json({ message: "User belum terikat ke branch" })
    }

    const timers = await service.getActiveTimers(db, branchId)
    res.json(timers)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.startTimer = async (req, res) => {
  const parseComboQtyFromName = (serviceName, serviceType) => {
    if (!['SPA', 'LC', 'LOUNGE'].includes(serviceType)) return 1
    const match = String(serviceName || '').match(/combo\s*(\d+)/i)
    const qty = match ? Number(match[1]) : 1
    return Number.isInteger(qty) && qty > 1 ? qty : 1
  }

  const parseKaraokeTherapistQtyFromName = (serviceName) => {
    const normalized = String(serviceName || '').toUpperCase().replace(/\s+/g, '')
    if (normalized.includes('KTV-4K') || normalized.includes('KTV4K')) return 2
    return 1
  }

  const normalizeTherapistIds = (therapist_id, therapist_ids) => {
    const raw = Array.isArray(therapist_ids) && therapist_ids.length
      ? therapist_ids
      : (therapist_id ? [therapist_id] : [])

    return [...new Set(raw
      .map(v => Number(v))
      .filter(v => Number.isInteger(v) && v > 0))]
  }


  const normalizeLabel = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const normalizeKtvTag = (value) => String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')

  const resolveKtvPackageTag = (serviceName) => {
    const normalized = normalizeKtvTag(serviceName)
    if (normalized.includes('KTV-2K') || normalized.includes('KTV2K')) return 'KTV-2K'
    if (normalized.includes('KTV-3K') || normalized.includes('KTV3K')) return 'KTV-3K'
    if (normalized.includes('KTV-4K') || normalized.includes('KTV4K')) return 'KTV-4K'
    return 'KTV'
  }

  const extractServiceGradeRule = (serviceName, therapistRows) => {
    const normalizedServiceName = normalizeLabel(serviceName)
    if (!normalizedServiceName) return null

    const gradeCandidates = [...new Set(
      therapistRows
        .map((row) => String(row?.grade_name || '').trim())
        .filter(Boolean)
    )]

    const sortedCandidates = gradeCandidates.sort((a, b) => b.length - a.length)
    for (const gradeName of sortedCandidates) {
      const normalizedGrade = normalizeLabel(gradeName)
      if (!normalizedGrade) continue
      if (normalizedServiceName.includes(normalizedGrade)) {
        return {
          gradeName,
          normalizedGrade
        }
      }
    }

    return null
  }

  const allocateSlots = async (db, branchId, requestedSlot, neededCount) => {
    if (!requestedSlot || requestedSlot < 1 || requestedSlot > 30) {
      throw new Error('Nomor slot harus 1–30')
    }

    const { rows: occupiedRows } = await db.query(
      `SELECT slot_number
       FROM timers
       WHERE branch_id = $1
         AND end_time IS NULL
         AND slot_number IS NOT NULL`,
      [branchId]
    )

    const occupied = new Set(
      occupiedRows
        .map(r => Number(r.slot_number))
        .filter(v => Number.isInteger(v) && v >= 1 && v <= 30)
    )

    if (occupied.has(requestedSlot)) {
      throw new Error(`Slot ${requestedSlot} sudah terisi`)
    }

    const freeSlots = []
    for (let i = 1; i <= 30; i += 1) {
      if (!occupied.has(i) && i !== requestedSlot) freeSlots.push(i)
    }

    const assigned = [requestedSlot, ...freeSlots].slice(0, neededCount)
    if (assigned.length < neededCount) {
      throw new Error('Slot timer tidak cukup untuk combo ini')
    }

    return assigned
  }


  const ensureBarOrdersTable = async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS bar_orders (
        id SERIAL PRIMARY KEY,
        order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        branch_id INT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        items_snapshot JSONB NOT NULL,
        note TEXT,
        requested_by INT,
        accepted_by INT,
        delivered_by INT,
        cancelled_by INT,
        created_at TIMESTAMP DEFAULT NOW(),
        accepted_at TIMESTAMP,
        delivered_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
  }

  const emitBarOrderNew = (req, payload) => {
    const io = req.app.get('io')
    if (!io || !payload?.branch_id) return
    const roleRoom = (branchId, role = '') => `branch:${branchId}:role:${String(role).toLowerCase().replace(/\s+/g, '-')}`
    io.to(roleRoom(payload.branch_id, 'Staff Bar')).emit('bar:order:new', payload)
    io.to(roleRoom(payload.branch_id, 'Supervisor')).emit('bar:order:new', payload)
    io.to(roleRoom(payload.branch_id, 'Manager')).emit('bar:order:new', payload)
  }

  try {
    const db = req.app.get("db")
    const user = req.user

    let branchId = user.branch_id
    if (!branchId && user?.id) {
      const userRes = await db.query(
        "SELECT branch_id FROM users WHERE id=$1",
        [user.id]
      )
      branchId = userRes.rows[0]?.branch_id || null
    }

    if (!branchId) {
      return res.status(400).json({ message: "User belum terikat ke branch" })
    }

    await ensureTherapistAttendanceTable(db)
    const businessDate = await getBusinessDateForBranch(db, branchId)

    await db.query(`
      ALTER TABLE services
      ADD COLUMN IF NOT EXISTS therapist_qty_required INT NOT NULL DEFAULT 1
    `)

    const {
      order_id,
      service_id,
      service_ids,
      therapist_id,
      therapist_ids,
      room_id,
      duration_minutes,
      slot,
      karaoke_fnb_items,
      guest_name = null
    } = req.body

    if (!service_id || !room_id || !duration_minutes) {
      return res.status(400).json({ message: "Data timer tidak lengkap" })
    }

    const { rows: serviceRows } = await db.query(
      `SELECT
         s.id,
         s.name,
         s.type,
         s.duration_minutes,
         COALESCE(s.therapist_qty_required, 1) AS therapist_qty_required,
         CASE
           WHEN s.type = 'FNB'
             AND fi.is_beverage = true
             AND COALESCE(fi.is_package, false) = false
             AND fi.happy_hour_enabled = true
             AND fi.happy_hour_price IS NOT NULL
             AND hh_active.active = true
           THEN fi.happy_hour_price
           WHEN s.type IN ('SPA', 'LC', 'LOUNGE')
             AND s.happy_hour_enabled = true
             AND s.happy_hour_price IS NOT NULL
             AND hh_active.active = true
           THEN s.happy_hour_price
           ELSE COALESCE(fi.price, s.base_price)
         END AS base_price,
         COALESCE(fi.price, s.base_price) AS normal_base_price,
         CASE
           WHEN s.type = 'FNB'
             AND fi.is_beverage = true
             AND COALESCE(fi.is_package, false) = false
             AND fi.happy_hour_enabled = true
             AND fi.happy_hour_price IS NOT NULL
             AND hh_active.active = true
           THEN true
           WHEN s.type IN ('SPA', 'LC', 'LOUNGE')
             AND s.happy_hour_enabled = true
             AND s.happy_hour_price IS NOT NULL
             AND hh_active.active = true
           THEN true
           ELSE false
         END AS is_happy_hour_price
       FROM services s
       LEFT JOIN fnb_items fi ON fi.service_id = s.id
       LEFT JOIN LATERAL (
         SELECT true AS active
         FROM happy_hours hh
         WHERE hh.branch_id = s.branch_id
           AND hh.is_active = true
           AND (
             (
               hh.start_time <= hh.end_time
               AND (timezone('Asia/Jakarta', now()))::time BETWEEN hh.start_time AND hh.end_time
             )
             OR (
               hh.start_time > hh.end_time
               AND (
                 (timezone('Asia/Jakarta', now()))::time >= hh.start_time
                 OR (timezone('Asia/Jakarta', now()))::time <= hh.end_time
               )
             )
           )
           AND (
             hh.service_type IS NULL
             OR hh.service_type = s.type::text
             OR hh.service_type = 'ALL'
             OR (hh.service_type = 'LC' AND s.type = 'LOUNGE')
             OR (hh.service_type = 'LOUNGE' AND s.type = 'LC')
           )
         LIMIT 1
       ) hh_active ON true
       WHERE s.id = $1`,
      [service_id]
    )

    if (!serviceRows.length) {
      return res.status(400).json({ message: "Service tidak ditemukan" })
    }

    const selectedService = serviceRows[0]
    const requiresTherapist = !['LOUNGE'].includes(selectedService.type)
    const isKaraokeService = selectedService.type === 'KARAOKE'
    const requestedComboQty = Number(req.body.combo_qty || 0)
    const comboQtyFromName = parseComboQtyFromName(selectedService.name, selectedService.type)
    const comboQtyFromPayload = Math.max(
      Array.isArray(service_ids) ? service_ids.length : 0,
      (isKaraokeService ? 0 : (Array.isArray(therapist_ids) ? therapist_ids.length : 0))
    )
    const comboQty = isKaraokeService
      ? 1
      : (Number.isInteger(requestedComboQty) && requestedComboQty > 1
          ? requestedComboQty
          : comboQtyFromPayload > 1
            ? comboQtyFromPayload
            : comboQtyFromName)
    const selectedTherapistIds = normalizeTherapistIds(therapist_id, therapist_ids)
    const requiredTherapistCount = isKaraokeService
      ? Math.max(
          1,
          Number(selectedService.therapist_qty_required || 1),
          parseKaraokeTherapistQtyFromName(selectedService.name)
        )
      : comboQty

    if (comboQty > 1 && !['SPA', 'LC'].includes(selectedService.type)) {
      return res.status(400).json({ message: 'Combo hanya berlaku untuk SPA dan LC' })
    }

    if (requiresTherapist) {
      if (!selectedTherapistIds.length) {
        return res.status(400).json({ message: "Silakan pilih terapis" })
      }

      if (selectedTherapistIds.length !== requiredTherapistCount) {
        return res.status(400).json({ message: `Wajib pilih ${requiredTherapistCount} terapis` })
      }
    }

    const therapistIds = requiresTherapist ? selectedTherapistIds : [null]

    const rawServiceIds = isKaraokeService
      ? [service_id]
      : (Array.isArray(service_ids) && service_ids.length
          ? service_ids
          : Array(comboQty).fill(service_id))

    const normalizedServiceIds = rawServiceIds
      .map(v => Number(v))
      .filter(v => Number.isInteger(v) && v > 0)

    if (normalizedServiceIds.length !== comboQty) {
      return res.status(400).json({ message: `Combo membutuhkan ${comboQty} service` })
    }

    const uniqueServiceIds = [...new Set(normalizedServiceIds)]
    const { rows: comboServiceRows } = await db.query(
      `SELECT
         s.id,
         s.name,
         s.type,
         s.duration_minutes,
         COALESCE(s.therapist_qty_required, 1) AS therapist_qty_required,
         CASE
           WHEN s.type = 'FNB'
             AND fi.is_beverage = true
             AND COALESCE(fi.is_package, false) = false
             AND fi.happy_hour_enabled = true
             AND fi.happy_hour_price IS NOT NULL
             AND hh_active.active = true
           THEN fi.happy_hour_price
           WHEN s.type IN ('SPA', 'LC', 'LOUNGE')
             AND s.happy_hour_enabled = true
             AND s.happy_hour_price IS NOT NULL
             AND hh_active.active = true
           THEN s.happy_hour_price
           ELSE COALESCE(fi.price, s.base_price)
         END AS base_price,
         COALESCE(fi.price, s.base_price) AS normal_base_price,
         CASE
           WHEN s.type = 'FNB'
             AND fi.is_beverage = true
             AND COALESCE(fi.is_package, false) = false
             AND fi.happy_hour_enabled = true
             AND fi.happy_hour_price IS NOT NULL
             AND hh_active.active = true
           THEN true
           WHEN s.type IN ('SPA', 'LC', 'LOUNGE')
             AND s.happy_hour_enabled = true
             AND s.happy_hour_price IS NOT NULL
             AND hh_active.active = true
           THEN true
           ELSE false
         END AS is_happy_hour_price
       FROM services s
       LEFT JOIN fnb_items fi ON fi.service_id = s.id
       LEFT JOIN LATERAL (
         SELECT true AS active
         FROM happy_hours hh
         WHERE hh.branch_id = s.branch_id
           AND hh.is_active = true
           AND (
             (
               hh.start_time <= hh.end_time
               AND (timezone('Asia/Jakarta', now()))::time BETWEEN hh.start_time AND hh.end_time
             )
             OR (
               hh.start_time > hh.end_time
               AND (
                 (timezone('Asia/Jakarta', now()))::time >= hh.start_time
                 OR (timezone('Asia/Jakarta', now()))::time <= hh.end_time
               )
             )
           )
           AND (
             hh.service_type IS NULL
             OR hh.service_type = s.type::text
             OR hh.service_type = 'ALL'
             OR (hh.service_type = 'LC' AND s.type = 'LOUNGE')
             OR (hh.service_type = 'LOUNGE' AND s.type = 'LC')
           )
         LIMIT 1
       ) hh_active ON true
       WHERE s.id = ANY($1::int[])`,
      [uniqueServiceIds]
    )

    const serviceMap = new Map(comboServiceRows.map(row => [Number(row.id), row]))
    if (serviceMap.size !== uniqueServiceIds.length) {
      return res.status(400).json({ message: 'Ada service combo yang tidak ditemukan' })
    }

    const invalidTypeService = comboServiceRows.find(row => row.type !== selectedService.type)
    const invalidComboTypeService = comboQty > 1
      ? comboServiceRows.find(row => !['SPA', 'LC'].includes(row.type))
      : null
    if (invalidTypeService) {
      return res.status(400).json({ message: 'Semua service combo harus 1 tipe layanan' })
    }

    if (invalidComboTypeService) {
      return res.status(400).json({ message: 'Combo hanya berlaku untuk SPA dan LC' })
    }

    const comboSelections = isKaraokeService
      ? [{ therapistId: null, service: serviceMap.get(normalizedServiceIds[0]) }]
      : normalizedServiceIds.map((sid, idx) => ({
          therapistId: therapistIds[idx] ?? null,
          service: serviceMap.get(sid)
        }))

    const timerEntries = isKaraokeService
      ? therapistIds.map((tid) => ({ therapistId: tid ?? null, service: serviceMap.get(normalizedServiceIds[0]) }))
      : comboSelections

    const neededSlots = timerEntries.length > 1 ? timerEntries.length : 1
    const slotNumbers = await allocateSlots(
      db,
      branchId,
      Number(slot),
      neededSlots
    )

    const durationNum = Number(duration_minutes)
    if (!durationNum || durationNum <= 0) {
      return res.status(400).json({ message: "Durasi service tidak valid" })
    }

    let finalOrderId = order_id

    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_name VARCHAR(120)`)
    await db.query('BEGIN')

    try {
      if (!finalOrderId) {
        const { rows } = await db.query(
          `
          INSERT INTO orders
            (branch_id, user_id, status, total, guest_name)
          VALUES
            ($1, $2, 'DRAFT', 0, $3)
          RETURNING id
          `,
          [branchId, user.id, String(guest_name || '').trim() || null]
        )
        finalOrderId = rows[0].id
      }

      await db.query(
        `UPDATE orders
         SET therapist_id = $1, room_id = $2, guest_name = COALESCE(NULLIF($4, ''), guest_name)
         WHERE id = $3`,
         [therapistIds[0], room_id, finalOrderId, String(guest_name || '').trim()]
      )

      let therapistNameById = new Map()
      let therapistRows = []
      if (requiresTherapist) {
        const therapistRes = await db.query(
          `SELECT
             t.id,
             t.name,
             tg.name AS grade_name,
             COALESCE(tg.service_addon_amount, 0) AS service_addon_amount,
             COALESCE(ta.status, 'OFF') AS attendance_status
           FROM therapists t
           LEFT JOIN therapist_grades tg ON tg.id = t.grade_id
           LEFT JOIN therapist_attendance ta
             ON ta.therapist_id = t.id
            AND ta.business_date = $2::date
           WHERE t.id = ANY($1::int[])`,
          [therapistIds, businessDate]
        )
        therapistRows = therapistRes.rows
        therapistNameById = new Map(therapistRows.map(t => [Number(t.id), t.name]))

        if (therapistNameById.size !== therapistIds.length) {
          throw new Error('Terapis tidak ditemukan')
        }

        const unavailableTherapists = therapistRows.filter((t) => String(t.attendance_status || 'OFF').toUpperCase() !== 'MASUK')
        if (unavailableTherapists.length) {
          const names = unavailableTherapists.map((t) => t.name).join(', ')
          throw new Error(`Terapis status CLOSE/OFF tidak bisa dipilih: ${names}`)
        }

        const therapistById = new Map(therapistRows.map(t => [Number(t.id), t]))
        for (let idx = 0; idx < comboSelections.length; idx += 1) {
          const selection = comboSelections[idx]
          if (!selection?.therapistId || !selection?.service) continue

          const gradeRule = extractServiceGradeRule(selection.service.name, therapistRows)
          if (!gradeRule) continue

          const therapist = therapistById.get(Number(selection.therapistId))
          const therapistGrade = normalizeLabel(therapist?.grade_name)
          if (!therapistGrade || therapistGrade !== gradeRule.normalizedGrade) {
            throw new Error(
              `Terapis slot #${idx + 1} harus grade ${gradeRule.gradeName} sesuai service ${selection.service.name}`
            )
          }
        }
      }

      const comboTotalRaw = comboSelections.reduce(
        (sum, selection) => sum + Number(selection.service.base_price || 0),
        0
      )
      let comboTotal = Math.round(comboTotalRaw)

      const normalizedKtvFnbItems = Array.isArray(karaoke_fnb_items)
        ? karaoke_fnb_items
            .map((item) => ({
              service_id: Number(item?.service_id || item?.id),
              qty: Number(item?.qty || 0)
            }))
            .filter((item) => Number.isInteger(item.service_id) && item.service_id > 0 && item.qty > 0)
        : []

      if (isKaraokeService && therapistIds.length) {
        const addonPerTherapist = therapistRows.reduce((sum, t) => sum + Number(t.service_addon_amount || 0), 0)
        comboTotal += Math.round(addonPerTherapist)
      }

      const COMBO_DURATION_DEDUCTION_MINUTES = 15
      const timerDurations = timerEntries.map((entry) => {
        const rawMinutes = Number(entry?.service?.duration_minutes || durationNum || 0)
        const baseMinutes = rawMinutes > 0 ? rawMinutes : durationNum

        if (!isKaraokeService && comboQty > 1) {
          return Math.max(1, baseMinutes - COMBO_DURATION_DEDUCTION_MINUTES)
        }

        return baseMinutes
      })
      const comboDurationMinutes = Math.max(...timerDurations, durationNum)
      const comboServiceNames = comboSelections
        .map(selection => selection.service.name)
        .filter(Boolean)

      const comboLabel = comboQty > 1 ? `COMBO SERVICE (${comboQty})` : null

      for (let idx = 0; idx < comboSelections.length; idx += 1) {
        const selection = comboSelections[idx]
        let unitPrice = Math.round(Number(selection.service.base_price || 0))
        let priceLabel = null

        if (isKaraokeService) {
          const normalBasePrice = Math.round(Number(selection.service.normal_base_price || selection.service.base_price || 0))
          unitPrice = idx === 0 ? Math.max(0, comboTotal) : 0
          priceLabel = 'NON HH'
          if (idx > 0 && unitPrice === 0 && normalBasePrice > 0) {
            priceLabel = 'NON HH'
          }
        } else {
          priceLabel = selection.service.is_happy_hour_price ? 'HH' : 'NON HH'
        }

        const baseServiceName = selection.service.name || selectedService.name
        const serviceNameSnapshot = comboLabel
          ? `${comboLabel}: ${baseServiceName}`
          : baseServiceName

        await db.query(
          `
          INSERT INTO order_items
            (order_id, service_id, service_name, qty, price, subtotal, therapist_name, price_label)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            finalOrderId,
            selection.service.id,
            serviceNameSnapshot,
            1,
            unitPrice,
            unitPrice,
            isKaraokeService
              ? therapistRows.map((t) => t.name).filter(Boolean).join(', ') || null
              : (selection.therapistId ? therapistNameById.get(selection.therapistId) || null : null),
            priceLabel
          ]
        )
      }

      let barSnapshot = []
      if (selectedService.type === 'KARAOKE' && normalizedKtvFnbItems.length) {
        const serviceIds = normalizedKtvFnbItems.map((item) => item.service_id)
        const { rows: fnbServices } = await db.query(
          `SELECT s.id, s.name, fi.id AS fnb_item_id, COALESCE(fi.price, s.base_price, 0) AS base_price
           FROM services s
           JOIN fnb_items fi ON fi.service_id = s.id
           WHERE s.id = ANY($1::int[])`,
          [serviceIds]
        )
        const fnbMap = new Map(fnbServices.map((row) => [Number(row.id), row]))

        for (const item of normalizedKtvFnbItems) {
          const fnbService = fnbMap.get(item.service_id)
          if (!fnbService) continue
          const qty = Number(item.qty || 0)
          const unitPrice = 0
          const subtotal = 0
          await db.query(
            `INSERT INTO order_items (order_id, service_id, service_name, qty, price, subtotal, price_label, is_package_snapshot)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [finalOrderId, fnbService.id, fnbService.name, qty, unitPrice, subtotal, 'KTV INCLUDED', true]
          )
          barSnapshot.push({
            fnb_item_id: Number(fnbService.fnb_item_id || 0),
            service_id: Number(fnbService.id),
            service_name: fnbService.name,
            qty
          })
        }

        barSnapshot = barSnapshot.filter((row) => row.fnb_item_id > 0 && row.qty > 0)
      }

      await db.query(
        `UPDATE orders
         SET total = total + $1
         WHERE id = $2`,
        [comboTotal, finalOrderId]
      )

      if (barSnapshot.length) {
        await ensureBarOrdersTable(db)
        const barNote = `Auto from KTV timer order #${finalOrderId}`
        await db.query(
          `INSERT INTO bar_orders (order_id, branch_id, status, items_snapshot, note, requested_by)
           VALUES ($1,$2,'PENDING',$3::jsonb,$4,$5)`,
          [finalOrderId, branchId, JSON.stringify(barSnapshot), barNote, user.id]
        )

        emitBarOrderNew(req, {
          order_id: finalOrderId,
          branch_id: branchId,
          status: 'PENDING',
          note: barNote,
          items: barSnapshot
        })

        queueBarInboxAutoPrint(req, {
          order_id: finalOrderId,
          branch_id: branchId,
          source: "KTV TIMER",
          note: barNote,
          items: barSnapshot
        })
      }

      const createdTimers = []
      for (let idx = 0; idx < timerEntries.length; idx += 1) {
        const selection = timerEntries[idx]
        const start = new Date()
        const timerDurationMinutes = Number(timerDurations[idx] || comboDurationMinutes || durationNum)
        const plannedEnd = new Date(start.getTime() + timerDurationMinutes * 60000)
        const slotNumber = slotNumbers[idx] || slotNumbers[0]

        const { rows: timerRows } = await db.query(
          `
          INSERT INTO timers
            (
              order_id,
              therapist_id,
              service_id,
              room_id,
              start_time,
              planned_end_time,
              paused,
              branch_id,
              slot_number,
              status
            )
          VALUES
            ($1,$2,$3,$4,$5,$6,false,$7,$8,'RUNNING')
          RETURNING *
          `,
          [
            finalOrderId,
            selection.therapistId,
            selection.service.id,
            room_id,
            start,
            plannedEnd,
            branchId,
            slotNumber
          ]
        )

        if (timerRows[0]) {
          createdTimers.push(timerRows[0])
        }
      }

      await db.query('COMMIT')

      await writeAuditEntry(db, req.user?.id, "TIMER_START", {
        order_id: finalOrderId,
        service_id: selectedService.id,
        timer_ids: createdTimers.map((t) => t.id),
        combo_qty: timerEntries.length
      })

      res.json({
        order_id: finalOrderId,
        combo_qty: timerEntries.length,
        timer: createdTimers[0] || null,
        timers: createdTimers,
        combo_duration_minutes: comboDurationMinutes,
        combo_total: comboTotal
      })
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  } catch (err) {
    console.error("START TIMER ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

exports.stop = async (req, res) => {
  try {
    const db = req.app.get("db")
    const id = req.params.id

    const timer = await service.stopTimer(db, id)
    await writeAuditEntry(db, req.user?.id, "TIMER_STOP", { timer_id: Number(id), order_id: timer?.order_id })
    res.json(timer)
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}
exports.create = async (req, res) => {
  const db = req.app.get("db")
  const { order_id, service_id, duration_minutes } = req.body
  const branch_id = req.user.branch_id || null

  const start = new Date()
  const end = new Date(start.getTime() + duration_minutes * 60000)

  const created = await db.query(
    `
    INSERT INTO timers
      (order_id, service_id, branch_id, start_time, planned_end_time)
    VALUES
      ($1,$2,$3,$4,$5)
    RETURNING id
    `,
    [order_id, service_id, branch_id, start, end]
  )

  await writeAuditEntry(db, req.user?.id, "TIMER_CREATE_MANUAL", { order_id, service_id, timer_id: created.rows[0]?.id })

  res.json({ success: true })
}

exports.startManual = async (req, res) => {
  try {
    const db = req.app.get("db")
    const user = req.user
    const branchId = user.branch_id
    const { order_id, service_id } = req.body

    const { rows } = await db.query(
      `SELECT duration_minutes FROM services WHERE id=$1`,
      [service_id]
    )

    if (!rows.length || !rows[0].duration_minutes) {
      return res.status(400).json({ message: "Service tidak punya durasi" })
    }

    const started = await db.query(
      `
      INSERT INTO timers
        (order_id, service_id, branch_id, start_time, planned_end_time)
      VALUES
        ($1,$2,$3, now(),
         now() + ($4 || ' minutes')::interval)
      RETURNING id
      `,
      [
        order_id,
        service_id,
        branchId,
        `${rows[0].duration_minutes} minutes`
      ]
    )

    await writeAuditEntry(db, req.user?.id, "TIMER_START_MANUAL", { order_id, service_id, timer_id: started.rows[0]?.id })

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
    let branchId = user?.branch_id || null

    if (!branchId && user?.id) {
      const userRes = await db.query("SELECT branch_id FROM users WHERE id=$1", [user.id])
      branchId = userRes.rows[0]?.branch_id || null
    }

    if (!branchId) {
      return res.status(400).json({ message: "User belum terikat ke branch" })
    }

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
          branchId,
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

// NEW ENDPOINTS FOR TIMER MODAL


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

/**
 * GET /api/timers/therapists?branch_id=X&service_type=SPA
 * Fetch active therapists from database
 */
exports.getTherapists = async (req, res) => {
  try {
    const db = req.app.get("db")
    await ensureTherapistAttendanceTable(db)

    const branch_id = req.query.branch_id || req.user.branch_id
    const businessDate = await getBusinessDateForBranch(db, branch_id)

    const query = `
      SELECT 
        t.id,
        t.name,
        t.grade_id,
        tg.name AS grade_name,
        COALESCE(ta.status, 'OFF') AS attendance_status,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM timers tm
            WHERE tm.therapist_id = t.id
              AND tm.end_time IS NULL
          ) THEN true
          ELSE false
        END AS is_occupied
      FROM therapists t
      LEFT JOIN therapist_grades tg ON tg.id = t.grade_id
      LEFT JOIN therapist_attendance ta
        ON ta.therapist_id = t.id
       AND ta.business_date = $2::date
      WHERE t.active = true
        AND t.branch_id = $1
        AND COALESCE(ta.status, 'OFF') <> 'OFF'
      ORDER BY t.name ASC
    `

    const { rows } = await db.query(query, [branch_id, businessDate])
    res.json(rows)
  } catch (err) {
    console.error("GET THERAPISTS ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

/**
 * GET /api/timers/rooms?branch_id=X&service_type=SPA
 * Fetch available rooms by service type with occupancy status
 */
exports.getRooms = async (req, res) => {
  try {
    const db = req.app.get("db")
    const branch_id = req.query.branch_id || req.user.branch_id
    const service_type = req.query.service_type

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
          ) THEN true
          ELSE false
        END AS is_occupied
      FROM rooms r
      WHERE r.branch_id = $1
        AND r.is_active = true
    `
    
    const params = [branch_id]
    
    if (service_type) {
      if (service_type === "SPA") {
        query += ` AND r.type = $2`
        params.push('SPA')
      } else if (service_type === "LC") {
        query += ` AND r.type IN ('LC','LOUNGE')`
      } else if (service_type === "LOUNGE") {
        query += ` AND r.type IN ('LC','LOUNGE')`
      } else if (service_type === "KARAOKE") {
        query += ` AND r.type IN ('KTV','KARAOKE')`
      }
    }
    
    query += ` ORDER BY r.name ASC`

    const { rows } = await db.query(query, params)
    
    // Add status field based on occupancy
    const roomsWithStatus = rows.map(room => ({
      ...room,
      status: room.is_occupied ? 'occupied' : 'available'
    }))
    
    res.json(roomsWithStatus)
  } catch (err) {
    console.error("GET ROOMS ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

/**
 * GET /api/timers/slots?branch_id=X
 * Fetch 30 permanent timer slots with active timer data merged in
 */
exports.getTimerSlots = async (req, res) => {
  try {
    const db = req.app.get("db")
    const branchId = await resolveBranchIdFromRequest(db, req)
    if (!branchId) {
      return res.status(400).json({ message: "User belum terikat ke branch" })
    }

    const slots = await service.getTimerSlots(db, branchId)
    res.json(slots)
  } catch (err) {
    console.error("GET TIMER SLOTS ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}
exports.extendTimer = async (req, res) => {
  const db = req.app.get("db")
  const timerId = req.params.id

  try {
    // 🔹 ambil timer + service + order
    const { rows } = await db.query(
      `
      SELECT 
        t.id,
        t.order_id,
        t.service_id,
        s.duration_minutes,
        s.base_price
      FROM timers t
      JOIN services s ON s.id = t.service_id
      WHERE t.id = $1
      `,
      [timerId]
    )

    if (!rows.length) {
      return res.status(404).json({ message: "Timer tidak ditemukan" })
    }

    const timer = rows[0]

    // 🔹 extend timer
    await db.query(
      `
      UPDATE timers
      SET planned_end_time = planned_end_time + ($1 || ' minutes')::interval
      WHERE id = $2
      `,
      [timer.duration_minutes, timerId]
    )

    // 🔹 update order_items (qty + subtotal)
    await db.query(
      `
      UPDATE order_items
      SET
        qty = qty + 1,
        subtotal = subtotal + $1
      WHERE order_id = $2
        AND service_id = $3
      `,
      [
        timer.base_price,
        timer.order_id,
        timer.service_id
      ]
    )

    // 🔹 update orders.total
    await db.query(
      `
      UPDATE orders
      SET total = total + $1
      WHERE id = $2
      `,
      [timer.base_price, timer.order_id]
    )

    res.json({ success: true })
  } catch (err) {
    console.error("EXTEND TIMER ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}
