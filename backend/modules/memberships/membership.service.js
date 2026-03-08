const MEMBERSHIP_LEVELS = ['SILVER', 'GOLD', 'VIP']
let ensureMembershipTablesPromise = null

const normalizeLevel = (value) => {
  const lvl = String(value || '').trim().toUpperCase()
  if (!MEMBERSHIP_LEVELS.includes(lvl)) throw new Error('Level membership tidak valid')
  return lvl
}

const normalizeDuration = (value) => {
  const v = String(value || '').trim().toUpperCase()
  if (v === 'MONTHLY') return 'MONTHLY'
  if (v === '6_MONTHS' || v === 'HALF_YEAR') return '6_MONTHS'
  if (v === 'YEARLY' || v === 'ANNUAL') return 'YEARLY'
  throw new Error('Durasi membership tidak valid')
}

const durationMonths = (duration) => {
  if (duration === 'MONTHLY') return 1
  if (duration === '6_MONTHS') return 6
  return 12
}

const ensureMembershipTables = async (db) => {
  if (ensureMembershipTablesPromise) return ensureMembershipTablesPromise

  ensureMembershipTablesPromise = (async () => {
    await db.query('SELECT pg_advisory_lock($1)', [9152701])
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS membership_plans (
          id SERIAL PRIMARY KEY,
          branch_id INT NOT NULL,
          level VARCHAR(20) NOT NULL,
          duration_type VARCHAR(20) NOT NULL,
          discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(branch_id, level, duration_type)
        )
      `)

      await db.query(`
        CREATE TABLE IF NOT EXISTS membership_members (
          id SERIAL PRIMARY KEY,
          branch_id INT NOT NULL,
          card_no VARCHAR(60) NOT NULL,
          full_name VARCHAR(120) NOT NULL,
          phone VARCHAR(40),
          level VARCHAR(20) NOT NULL,
          duration_type VARCHAR(20) NOT NULL,
          discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
          starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
          ends_at TIMESTAMP NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          created_by INT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(branch_id, card_no)
        )
      `)

      await db.query(`
        CREATE TABLE IF NOT EXISTS membership_configs (
          branch_id INT PRIMARY KEY,
          card_prefix VARCHAR(20) NOT NULL DEFAULT 'MBR',
          next_sequence BIGINT NOT NULL DEFAULT 77889900001,
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `)


      await db.query(`ALTER TABLE membership_configs ALTER COLUMN next_sequence TYPE BIGINT`)
      await db.query(`ALTER TABLE membership_configs ALTER COLUMN next_sequence SET DEFAULT 77889900001`)

      await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS membership_member_id INT`)
      await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS membership_card_no VARCHAR(60)`)
      await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS membership_discount_amount NUMERIC(12,2) DEFAULT 0`)

      await db.query(`ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS manual_price NUMERIC(12,2) NOT NULL DEFAULT 0`)

      await db.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'services'
              AND column_name = 'type'
              AND udt_name = 'service_type'
          ) THEN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_type t
              JOIN pg_enum e ON e.enumtypid = t.oid
              WHERE t.typname = 'service_type'
                AND e.enumlabel = 'MEMBERSHIP'
            ) THEN
              ALTER TYPE service_type ADD VALUE 'MEMBERSHIP';
            END IF;
          END IF;
        END $$;
      `)


      for (const level of MEMBERSHIP_LEVELS) {
        await db.query(
          `INSERT INTO membership_plans (branch_id, level, duration_type, discount_percent, manual_price)
           SELECT b.id, $1, d.duration_type, d.discount_percent, d.manual_price
           FROM branches b
           CROSS JOIN (VALUES
             ('MONTHLY', 5, 0),
             ('6_MONTHS', 8, 0),
             ('YEARLY', 10, 0)
           ) AS d(duration_type, discount_percent, manual_price)
           ON CONFLICT (branch_id, level, duration_type) DO NOTHING`,
          [level]
        )
      }
    } finally {
      await db.query('SELECT pg_advisory_unlock($1)', [9152701])
    }
  })()

  try {
    await ensureMembershipTablesPromise
  } catch (err) {
    ensureMembershipTablesPromise = null
    throw err
  }
}

const resolveBranchId = (user, payload = {}) => {
  const role = String(user?.role || '')
  const isPrivileged = ['SuperAdmin', 'Owner', 'Manager'].includes(role)
  const branchId = isPrivileged && Number(payload.branch_id) > 0
    ? Number(payload.branch_id)
    : Number(user?.branch_id)
  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw new Error('branch_id tidak valid')
  }
  return branchId
}

const getConfig = async (db, user, query = {}) => {
  await ensureMembershipTables(db)
  const branchId = resolveBranchId(user, query)
  const { rows } = await db.query(
    `SELECT branch_id, card_prefix, next_sequence FROM membership_configs WHERE branch_id=$1 LIMIT 1`,
    [branchId]
  )
  if (!rows.length) {
    const defaultPrefix = `MBR${branchId}`
    await db.query(`INSERT INTO membership_configs (branch_id, card_prefix, next_sequence) VALUES ($1,$2,$3) ON CONFLICT (branch_id) DO NOTHING`, [branchId, defaultPrefix, 77889900001])
    return { branch_id: branchId, card_prefix: defaultPrefix, next_sequence: 77889900001 }
  }
  return rows[0]
}

const saveConfig = async (db, user, payload = {}) => {
  await ensureMembershipTables(db)
  const branchId = resolveBranchId(user, payload)
  const fallbackPrefix = `MBR${branchId}`
  const prefix = String(payload.card_prefix || fallbackPrefix).trim().toUpperCase().slice(0, 20) || fallbackPrefix
  const nextSeq = Math.max(77889900001, Math.floor(Number(payload.next_sequence || 77889900001)))

  const { rows: prefixConflictRows } = await db.query(
    `SELECT branch_id FROM membership_configs WHERE UPPER(card_prefix)=UPPER($1) AND branch_id <> $2 LIMIT 1`,
    [prefix, branchId]
  )
  if (prefixConflictRows.length) {
    throw new Error('Prefix kartu sudah dipakai outlet lain, gunakan prefix berbeda')
  }
  const { rows } = await db.query(
    `INSERT INTO membership_configs (branch_id, card_prefix, next_sequence)
     VALUES ($1,$2,$3)
     ON CONFLICT (branch_id)
     DO UPDATE SET card_prefix=EXCLUDED.card_prefix, next_sequence=EXCLUDED.next_sequence, updated_at=NOW()
     RETURNING branch_id, card_prefix, next_sequence`,
    [branchId, prefix, nextSeq]
  )
  return rows[0]
}

const listPlans = async (db, user, query = {}) => {
  await ensureMembershipTables(db)
  const branchId = resolveBranchId(user, query)
  const { rows } = await db.query(
    `SELECT id, branch_id, level, duration_type, discount_percent, manual_price, is_active
     FROM membership_plans
     WHERE branch_id=$1
     ORDER BY CASE level WHEN 'SILVER' THEN 1 WHEN 'GOLD' THEN 2 ELSE 3 END, duration_type`,
    [branchId]
  )
  return rows
}


const buildMembershipServiceName = (level, durationType) => {
  const durationLabel = durationType === 'MONTHLY' ? '1 Bulan' : durationType === '6_MONTHS' ? '6 Bulan' : '12 Bulan'
  return `Membership ${level} - ${durationLabel}`
}

const syncMembershipPlanAsService = async (db, { branchId, level, durationType, manualPrice, isActive }) => {
  const serviceName = buildMembershipServiceName(level, durationType)
  const price = Math.max(0, Number(manualPrice || 0))

  const { rows: existingRows } = await db.query(
    `SELECT id FROM services WHERE branch_id=$1 AND type='MEMBERSHIP' AND name=$2 LIMIT 1`,
    [branchId, serviceName]
  )

  if (existingRows.length) {
    await db.query(
      `UPDATE services
       SET base_price=$1, is_active=$2
       WHERE id=$3`,
      [price, Boolean(isActive), existingRows[0].id]
    )
    return
  }

  await db.query(
    `INSERT INTO services (branch_id, name, type, base_price, duration_minutes, is_active, happy_hour_enabled, happy_hour_price)
     VALUES ($1,$2,'MEMBERSHIP',$3,NULL,$4,false,NULL)`,
    [branchId, serviceName, price, Boolean(isActive)]
  )
}

const savePlan = async (db, user, payload = {}) => {
  await ensureMembershipTables(db)
  const branchId = resolveBranchId(user, payload)
  const level = normalizeLevel(payload.level)
  const durationType = normalizeDuration(payload.duration_type)
  const discountPercent = Math.max(0, Math.min(100, Number(payload.discount_percent || 0)))
  const manualPrice = Math.max(0, Number(payload.manual_price || 0))
  const isActive = payload.is_active !== false

  const { rows } = await db.query(
    `INSERT INTO membership_plans (branch_id, level, duration_type, discount_percent, manual_price, is_active)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (branch_id, level, duration_type)
     DO UPDATE SET discount_percent=EXCLUDED.discount_percent, manual_price=EXCLUDED.manual_price, is_active=EXCLUDED.is_active, updated_at=NOW()
     RETURNING *`,
    [branchId, level, durationType, discountPercent, manualPrice, isActive]
  )

  await syncMembershipPlanAsService(db, { branchId, level, durationType, manualPrice, isActive })

  return rows[0]
}

const generateCardNo = async (db, branchId) => {
  const { rows } = await db.query(`SELECT card_prefix, next_sequence FROM membership_configs WHERE branch_id=$1 LIMIT 1`, [branchId])
  if (!rows.length) {
    await db.query(`INSERT INTO membership_configs (branch_id, card_prefix, next_sequence) VALUES ($1,$2,$3) ON CONFLICT (branch_id) DO NOTHING`, [branchId, `MBR${branchId}`, 77889900001])
  }
  const prefix = String(rows[0]?.card_prefix || `MBR${branchId}`)
  const seq = Math.max(77889900001, Number(rows[0]?.next_sequence || 77889900001))
  const cardNo = `${prefix}${String(seq)}`
  await db.query(`UPDATE membership_configs SET next_sequence = $2, updated_at = NOW() WHERE branch_id = $1`, [branchId, seq + 1])
  return cardNo
}

const createMember = async (db, user, payload = {}) => {
  await ensureMembershipTables(db)
  const branchId = resolveBranchId(user, payload)
  const fullName = String(payload.full_name || '').trim()
  if (!fullName) throw new Error('Nama member wajib diisi')

  const level = normalizeLevel(payload.level)
  const durationType = normalizeDuration(payload.duration_type)

  const { rows: planRows } = await db.query(
    `SELECT discount_percent FROM membership_plans
     WHERE branch_id=$1 AND level=$2 AND duration_type=$3 AND is_active=true
     LIMIT 1`,
    [branchId, level, durationType]
  )
  if (!planRows.length) throw new Error('Plan membership tidak aktif / tidak ditemukan')

  const discountPercent = Number(planRows[0].discount_percent || 0)
  const months = durationMonths(durationType)
  const cardNo = String(payload.card_no || '').trim() || await generateCardNo(db, branchId)

  const { rows } = await db.query(
    `INSERT INTO membership_members
      (branch_id, card_no, full_name, phone, level, duration_type, discount_percent, starts_at, ends_at, status, created_by)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,NOW(), NOW() + ($8 || ' months')::interval, 'ACTIVE', $9)
     RETURNING *`,
    [branchId, cardNo, fullName, String(payload.phone || '').trim() || null, level, durationType, discountPercent, `${months}`, user?.id || null]
  )

  return rows[0]
}

const listMembers = async (db, user, query = {}) => {
  await ensureMembershipTables(db)
  const branchId = resolveBranchId(user, query)
  const search = String(query.search || '').trim()
  const onlyActive = String(query.active || '').toLowerCase() === 'true'

  const params = [branchId]
  const filters = ['branch_id=$1']
  if (search) {
    params.push(`%${search}%`)
    filters.push(`(full_name ILIKE $${params.length} OR card_no ILIKE $${params.length} OR COALESCE(phone,'') ILIKE $${params.length})`)
  }
  if (onlyActive) filters.push(`status='ACTIVE' AND ends_at >= NOW()`)

  const { rows } = await db.query(
    `SELECT * FROM membership_members
     WHERE ${filters.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT 500`,
    params
  )
  return rows
}

const resolveMember = async (db, branchId, cardNo) => {
  const { rows } = await db.query(
    `SELECT * FROM membership_members
     WHERE branch_id=$1 AND UPPER(card_no)=UPPER($2)
     LIMIT 1`,
    [branchId, String(cardNo || '').trim()]
  )
  const member = rows[0]
  if (!member) throw new Error('No kartu member tidak ditemukan')
  if (String(member.status).toUpperCase() !== 'ACTIVE') throw new Error('Status member tidak aktif')
  if (new Date(member.ends_at).getTime() < Date.now()) throw new Error('Membership sudah expired')
  return member
}

const computeMembershipDiscount = async (db, input = {}) => {
  await ensureMembershipTables(db)
  const branchId = Number(input.branch_id)
  if (!(branchId > 0)) throw new Error('branch_id tidak valid')
  const cardNo = String(input.card_no || '').trim()
  if (!cardNo) return { member: null, discount_amount: 0, eligible_subtotal: 0, details: [] }

  const member = await resolveMember(db, branchId, cardNo)
  const items = Array.isArray(input.items) ? input.items : []
  if (!items.length) return { member, discount_amount: 0, eligible_subtotal: 0, details: [] }

  const resolvedLines = items.map((it) => ({
    service_id: Number(it?.variant_service_id || it?.id || it?.service_id || 0),
    qty: Math.max(0, Number(it?.qty || 0)),
    unit_price: Math.max(0, Number(it?.base_price ?? it?.price ?? 0)),
    price_label: String(it?.price_label || '').trim().toUpperCase(),
    is_happy_hour_price: it?.is_happy_hour_price === true
  })).filter((it) => it.service_id > 0 && it.qty > 0)

  if (!resolvedLines.length) return { member, discount_amount: 0, eligible_subtotal: 0, details: [] }

  const serviceIds = [...new Set(resolvedLines.map((x) => x.service_id))]
  const { rows: fnbRows } = await db.query(
    `SELECT fi.service_id,
            COALESCE(fi.membership_tag, false) AS membership_tag,
            COALESCE(fi.happy_hour_enabled, false) AS happy_hour_enabled,
            s.type
     FROM fnb_items fi
     JOIN services s ON s.id = fi.service_id
     WHERE fi.branch_id = $1
       AND fi.service_id = ANY($2::int[])`,
    [branchId, serviceIds]
  )
  const fnbMap = new Map(fnbRows.map((r) => [Number(r.service_id), r]))

  const asOf = input.as_of ? new Date(input.as_of) : new Date()
  const hhTime = `${String(asOf.getHours()).padStart(2, '0')}:${String(asOf.getMinutes()).padStart(2, '0')}:00`
  const { rows: hhRows } = await db.query(
    `SELECT 1 FROM happy_hours
     WHERE branch_id = $1
       AND is_active = true
       AND ($2::time BETWEEN start_time AND end_time)
       AND (service_type IS NULL OR service_type = 'FNB' OR service_type = 'ALL')
     LIMIT 1`,
    [branchId, hhTime]
  )
  const isFnbHappyHourActive = hhRows.length > 0

  let eligibleSubtotal = 0
  const details = []
  const nonHhProgressByService = new Map()

  for (const row of resolvedLines) {
    const meta = fnbMap.get(row.service_id)
    if (!meta || String(meta.type || '').toUpperCase() !== 'FNB' || !meta.membership_tag) continue

    const hasHhLabel = row.price_label.includes('HH') && !row.price_label.includes('NON HH')
    const lineIsHappyHour = meta.happy_hour_enabled && (row.is_happy_hour_price || hasHhLabel || (!row.price_label && isFnbHappyHourActive))

    const nonHhQtyBefore = Number(nonHhProgressByService.get(row.service_id) || 0)
    const nonHhQtyAfter = nonHhQtyBefore + (lineIsHappyHour ? 0 : row.qty)
    const eligibleBefore = Math.max(0, nonHhQtyBefore - 1)
    const eligibleAfter = Math.max(0, nonHhQtyAfter - 1)
    const eligibleQty = Math.max(0, eligibleAfter - eligibleBefore)

    if (!lineIsHappyHour) {
      nonHhProgressByService.set(row.service_id, nonHhQtyAfter)
    }

    const lineEligible = Math.max(0, eligibleQty * row.unit_price)
    eligibleSubtotal += lineEligible
    details.push({
      service_id: row.service_id,
      qty: row.qty,
      eligible_qty: eligibleQty,
      unit_price: row.unit_price,
      eligible_subtotal: lineEligible,
      rule: lineIsHappyHour
        ? 'HH_LINE_NO_DISCOUNT'
        : (meta.happy_hour_enabled ? 'NON_HH_FROM_2ND' : 'FROM_2ND')
    })
  }

  const discountAmount = Math.round(eligibleSubtotal * (Number(member.discount_percent || 0) / 100))
  return {
    member: {
      id: member.id,
      card_no: member.card_no,
      full_name: member.full_name,
      level: member.level,
      duration_type: member.duration_type,
      discount_percent: Number(member.discount_percent || 0),
      ends_at: member.ends_at
    },
    discount_amount: Math.max(0, discountAmount),
    eligible_subtotal: Math.max(0, Math.round(eligibleSubtotal)),
    details
  }
}

const getReports = async (db, user, query = {}) => {
  await ensureMembershipTables(db)
  const branchId = resolveBranchId(user, query)
  const dateFrom = String(query.date_from || '').trim()
  const dateTo = String(query.date_to || '').trim()

  const params = [branchId]
  const dateFilter = []
  if (dateFrom) { params.push(`${dateFrom}T00:00:00.000Z`); dateFilter.push(`o.created_at >= $${params.length}`) }
  if (dateTo) { params.push(`${dateTo}T23:59:59.999Z`); dateFilter.push(`o.created_at <= $${params.length}`) }

  const { rows: activeRows } = await db.query(
    `SELECT level, COUNT(*)::int AS active_count
     FROM membership_members
     WHERE branch_id=$1 AND status='ACTIVE' AND ends_at >= NOW()
     GROUP BY level
     ORDER BY level`,
    [branchId]
  )

  const { rows: omzetRows } = await db.query(
    `SELECT
      COUNT(*)::int AS trx_count,
      COALESCE(SUM(o.total),0) AS omzet_member,
      COALESCE(SUM(COALESCE(o.membership_discount_amount,0)),0) AS benefit_used
     FROM orders o
     WHERE o.branch_id=$1 AND o.status='PAID' AND o.membership_member_id IS NOT NULL
       ${dateFilter.length ? `AND ${dateFilter.join(' AND ')}` : ''}`,
    params
  )

  return {
    branch_id: branchId,
    active_members: activeRows,
    omzet_member: Number(omzetRows[0]?.omzet_member || 0),
    benefit_usage: Number(omzetRows[0]?.benefit_used || 0),
    member_transactions: Number(omzetRows[0]?.trx_count || 0)
  }
}

module.exports = { ensureMembershipTables, getConfig, saveConfig, listPlans, savePlan, createMember, listMembers, computeMembershipDiscount, getReports }
