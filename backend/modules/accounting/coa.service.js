const db = require('../../config/db')

class HttpError extends Error {
  constructor(status, code, message, details = null) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

const ALLOWED_TYPES = new Set(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])

const ensureCoaTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS chart_of_accounts (
      id SERIAL PRIMARY KEY,
      code VARCHAR(30) UNIQUE NOT NULL,
      name VARCHAR(150) NOT NULL,
      account_type VARCHAR(30) NOT NULL,
      parent_id INT REFERENCES chart_of_accounts(id),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent
    ON chart_of_accounts(parent_id)
  `)
}

const normalizeType = (raw) => String(raw || '').trim().toUpperCase()

const listCoa = async ({ include_inactive, account_type, q }) => {
  await ensureCoaTable()

  const where = []
  const params = []

  if (String(include_inactive || 'false').toLowerCase() !== 'true') {
    where.push('coa.is_active = true')
  }

  const type = normalizeType(account_type)
  if (type) {
    params.push(type)
    where.push(`coa.account_type = $${params.length}`)
  }

  if (q) {
    params.push(`%${String(q).trim()}%`)
    where.push(`(coa.code ILIKE $${params.length} OR coa.name ILIKE $${params.length})`)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const { rows } = await db.query(
    `SELECT
      coa.id,
      coa.code,
      coa.name,
      coa.account_type,
      coa.parent_id,
      parent.code AS parent_code,
      parent.name AS parent_name,
      coa.is_active,
      coa.created_at,
      coa.updated_at
    FROM chart_of_accounts coa
    LEFT JOIN chart_of_accounts parent ON parent.id = coa.parent_id
    ${whereSql}
    ORDER BY coa.code ASC`,
    params
  )

  return rows
}

const createCoa = async (payload = {}) => {
  await ensureCoaTable()

  const code = String(payload.code || '').trim()
  const name = String(payload.name || '').trim()
  const accountType = normalizeType(payload.account_type)
  const parentId = payload.parent_id ? Number(payload.parent_id) : null

  if (!code || !name || !accountType) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'code, name, account_type wajib diisi')
  }

  if (!ALLOWED_TYPES.has(accountType)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'account_type harus salah satu: ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE')
  }

  if (parentId) {
    const parent = await db.query('SELECT id FROM chart_of_accounts WHERE id = $1 LIMIT 1', [parentId])
    if (!parent.rows.length) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'parent_id tidak ditemukan')
    }
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO chart_of_accounts (code, name, account_type, parent_id, is_active, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       RETURNING id, code, name, account_type, parent_id, is_active, created_at, updated_at`,
      [code, name, accountType, parentId]
    )
    return rows[0]
  } catch (err) {
    if (String(err?.code) === '23505') {
      throw new HttpError(409, 'DUPLICATE_CODE', 'Code COA sudah digunakan')
    }
    throw err
  }
}

const updateCoa = async (id, payload = {}) => {
  await ensureCoaTable()

  const coaId = Number(id)
  if (!Number.isInteger(coaId) || coaId <= 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'id COA tidak valid')
  }

  const fields = []
  const params = []
  let idx = 1

  if (payload.code !== undefined) {
    const code = String(payload.code || '').trim()
    if (!code) throw new HttpError(400, 'VALIDATION_ERROR', 'code tidak boleh kosong')
    fields.push(`code = $${idx++}`)
    params.push(code)
  }

  if (payload.name !== undefined) {
    const name = String(payload.name || '').trim()
    if (!name) throw new HttpError(400, 'VALIDATION_ERROR', 'name tidak boleh kosong')
    fields.push(`name = $${idx++}`)
    params.push(name)
  }

  if (payload.account_type !== undefined) {
    const accountType = normalizeType(payload.account_type)
    if (!ALLOWED_TYPES.has(accountType)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'account_type tidak valid')
    }
    fields.push(`account_type = $${idx++}`)
    params.push(accountType)
  }

  if (payload.parent_id !== undefined) {
    const parentId = payload.parent_id ? Number(payload.parent_id) : null
    if (parentId === coaId) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'parent_id tidak boleh sama dengan akun sendiri')
    }
    if (parentId) {
      const parent = await db.query('SELECT id FROM chart_of_accounts WHERE id = $1 LIMIT 1', [parentId])
      if (!parent.rows.length) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'parent_id tidak ditemukan')
      }
    }
    fields.push(`parent_id = $${idx++}`)
    params.push(parentId)
  }

  if (payload.is_active !== undefined) {
    fields.push(`is_active = $${idx++}`)
    params.push(Boolean(payload.is_active))
  }

  if (!fields.length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Tidak ada field yang diupdate')
  }

  fields.push('updated_at = NOW()')
  params.push(coaId)

  try {
    const { rows } = await db.query(
      `UPDATE chart_of_accounts
       SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id, code, name, account_type, parent_id, is_active, created_at, updated_at`,
      params
    )

    if (!rows.length) {
      throw new HttpError(404, 'NOT_FOUND', 'COA tidak ditemukan')
    }

    return rows[0]
  } catch (err) {
    if (String(err?.code) === '23505') {
      throw new HttpError(409, 'DUPLICATE_CODE', 'Code COA sudah digunakan')
    }
    throw err
  }
}

module.exports = {
  HttpError,
  listCoa,
  createCoa,
  updateCoa
}
