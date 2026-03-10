const CHANNELS = Object.freeze({
  POS_RECEIPT: "POS_RECEIPT",
  POS_RECAP: "POS_RECAP",
  BAR_INBOX: "BAR_INBOX"
})

const normalizeChannel = (value) => {
  const normalized = String(value || "").trim().toUpperCase()
  if (!Object.values(CHANNELS).includes(normalized)) {
    throw new Error("Channel printer tidak valid")
  }
  return normalized
}

const ensurePrinterTargetsTable = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS printer_targets (
      id SERIAL PRIMARY KEY,
      branch_id INT REFERENCES branches(id) ON DELETE CASCADE,
      channel VARCHAR(40) NOT NULL,
      agent_url TEXT NOT NULL,
      agent_token TEXT,
      agent_printer_name VARCHAR(255),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (branch_id, channel)
    )
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_printer_targets_channel_branch
    ON printer_targets (channel, branch_id, is_active)
  `)
}

const normalizePayload = (payload = {}) => ({
  branch_id: payload.branch_id == null ? null : Number(payload.branch_id),
  channel: normalizeChannel(payload.channel),
  agent_url: String(payload.agent_url || "").trim(),
  agent_token: String(payload.agent_token || "").trim() || null,
  agent_printer_name: String(payload.agent_printer_name || "").trim() || null,
  is_active: payload.is_active !== false
})

const validatePayload = (payload) => {
  if (!payload.agent_url) {
    throw new Error("agent_url wajib diisi")
  }
  if (!/^https?:\/\//i.test(payload.agent_url)) {
    throw new Error("agent_url harus diawali http:// atau https://")
  }
  if (payload.branch_id !== null && (!Number.isInteger(payload.branch_id) || payload.branch_id <= 0)) {
    throw new Error("branch_id tidak valid")
  }
}

const upsertPrinterTarget = async ({ db, payload }) => {
  await ensurePrinterTargetsTable(db)
  const normalized = normalizePayload(payload)
  validatePayload(normalized)

  const { rows } = await db.query(
    `INSERT INTO printer_targets
      (branch_id, channel, agent_url, agent_token, agent_printer_name, is_active, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT (branch_id, channel)
     DO UPDATE SET
      agent_url = EXCLUDED.agent_url,
      agent_token = EXCLUDED.agent_token,
      agent_printer_name = EXCLUDED.agent_printer_name,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
     RETURNING *`,
    [
      normalized.branch_id,
      normalized.channel,
      normalized.agent_url,
      normalized.agent_token,
      normalized.agent_printer_name,
      normalized.is_active
    ]
  )

  return rows[0]
}

const listPrinterTargets = async ({ db, branchId, channel }) => {
  await ensurePrinterTargetsTable(db)
  const params = []
  const where = []

  if (branchId !== undefined && branchId !== null && branchId !== "") {
    params.push(Number(branchId))
    where.push(`pt.branch_id = $${params.length}`)
  }

  if (channel) {
    params.push(normalizeChannel(channel))
    where.push(`pt.channel = $${params.length}`)
  }

  const sql = `
    SELECT pt.*, b.name AS branch_name
    FROM printer_targets pt
    LEFT JOIN branches b ON b.id = pt.branch_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY pt.channel ASC, pt.branch_id ASC NULLS FIRST, pt.id ASC
  `

  return (await db.query(sql, params)).rows
}


const deletePrinterTarget = async ({ db, id }) => {
  await ensurePrinterTargetsTable(db)

  const targetId = Number(id)
  if (!Number.isInteger(targetId) || targetId <= 0) {
    throw new Error("id target printer tidak valid")
  }

  const { rowCount } = await db.query(
    `DELETE FROM printer_targets WHERE id = $1`,
    [targetId]
  )

  if (!rowCount) {
    throw new Error("Printer target tidak ditemukan")
  }

  return { success: true }
}

const getResolvedPrinterTarget = async ({ db, branchId, channel }) => {
  await ensurePrinterTargetsTable(db)
  const normalizedChannel = normalizeChannel(channel)
  const resolvedBranchId = Number(branchId || 0)

  if (!resolvedBranchId) return null

  const { rows } = await db.query(
    `SELECT *
     FROM printer_targets
     WHERE channel = $1
       AND is_active = true
       AND (branch_id = $2 OR branch_id IS NULL)
     ORDER BY CASE WHEN branch_id = $2 THEN 0 ELSE 1 END, id ASC
     LIMIT 1`,
    [normalizedChannel, resolvedBranchId]
  )

  return rows[0] || null
}

module.exports = {
  CHANNELS,
  normalizeChannel,
  ensurePrinterTargetsTable,
  upsertPrinterTarget,
  listPrinterTargets,
  getResolvedPrinterTarget,
  deletePrinterTarget
}
