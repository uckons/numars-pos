const db = require('../../config/db')

const DOMAIN = {
  THERAPIST: 'PAYROLL_THERAPIST',
  AGENT: 'PAYROLL_AGENT'
}

const MODEL_CATALOG = {
  therapist_commission_percent: {
    key: 'therapist_commission_percent',
    domain: DOMAIN.THERAPIST,
    label: 'Therapist - % Komisi',
    description: 'Komponen utama berbasis persentase komisi terapis.',
    defaultExpression: '(commission_base * commission_rate) + bonus_amount - deduction_total - penalty_amount'
  },
  therapist_revenue_percent: {
    key: 'therapist_revenue_percent',
    domain: DOMAIN.THERAPIST,
    label: 'Therapist - % Omzet',
    description: 'Komponen utama berbasis persentase omzet.',
    defaultExpression: '(total_revenue * revenue_share_rate) + bonus_amount - deduction_total - penalty_amount'
  },
  therapist_flat: {
    key: 'therapist_flat',
    domain: DOMAIN.THERAPIST,
    label: 'Therapist - Flat',
    description: 'Komponen utama berbasis fee flat per pekerjaan.',
    defaultExpression: '(work_count * flat_rate) + bonus_amount - deduction_total - penalty_amount'
  },
  therapist_hybrid: {
    key: 'therapist_hybrid',
    domain: DOMAIN.THERAPIST,
    label: 'Therapist - Hybrid',
    description: 'Gabungan % komisi, % omzet, dan flat.',
    defaultExpression: '((commission_base * commission_rate) + (total_revenue * revenue_share_rate) + (work_count * flat_rate)) + bonus_amount - deduction_total - penalty_amount'
  },
  agent_commission_share: {
    key: 'agent_commission_share',
    domain: DOMAIN.AGENT,
    label: 'Agent - Share Komisi',
    description: 'Agent mendapat share dari total komisi terapis.',
    defaultExpression: '(therapist_commission_total * agent_share_rate) + bonus_amount - deduction_total - penalty_amount'
  },
  agent_revenue_share: {
    key: 'agent_revenue_share',
    domain: DOMAIN.AGENT,
    label: 'Agent - Share Omzet',
    description: 'Agent mendapat share dari omzet.',
    defaultExpression: '(total_revenue * agent_share_rate) + bonus_amount - deduction_total - penalty_amount'
  },
  agent_flat_per_therapist: {
    key: 'agent_flat_per_therapist',
    domain: DOMAIN.AGENT,
    label: 'Agent - Flat per Terapis',
    description: 'Agent mendapat fee flat per therapist aktif.',
    defaultExpression: '(therapist_count * flat_fee) + bonus_amount - deduction_total - penalty_amount'
  },
  agent_hybrid: {
    key: 'agent_hybrid',
    domain: DOMAIN.AGENT,
    label: 'Agent - Hybrid',
    description: 'Gabungan share komisi, share omzet, dan flat per therapist.',
    defaultExpression: '((therapist_commission_total * agent_share_rate) + (total_revenue * revenue_share_rate) + (therapist_count * flat_fee)) + bonus_amount - deduction_total - penalty_amount'
  }
}

const RESERVED_PATTERN = /(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|;|--)/i
const ALLOWED_CHAR_PATTERN = /^[0-9a-zA-Z_+\-*/().,\s]+$/
const TOKEN_PATTERN = /[A-Za-z_][A-Za-z0-9_]*/g
const ALLOWED_FUNCTIONS = new Set(['MIN', 'MAX', 'ROUND'])
const RESERVED_LITERALS = new Set(['Infinity', 'NaN', 'undefined', 'null'])

const sanitizeNumber = (val) => {
  const num = Number(val || 0)
  return Number.isFinite(num) ? num : 0
}

const ensureFormulaTables = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS formula_definitions (
      id BIGSERIAL PRIMARY KEY,
      code VARCHAR(80) UNIQUE NOT NULL,
      name VARCHAR(150) NOT NULL,
      domain VARCHAR(50) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by INT REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS formula_versions (
      id BIGSERIAL PRIMARY KEY,
      formula_id BIGINT NOT NULL REFERENCES formula_definitions(id) ON DELETE CASCADE,
      version_no INT NOT NULL,
      expression TEXT NOT NULL,
      variables JSONB NOT NULL DEFAULT '[]'::jsonb,
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
      created_by INT REFERENCES users(id),
      approved_by INT REFERENCES users(id),
      approved_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_formula_version UNIQUE (formula_id, version_no)
    )
  `)
}

const parseVariables = (expression = '') => {
  const tokens = expression.match(TOKEN_PATTERN) || []
  const vars = new Set()

  tokens.forEach((token) => {
    const upper = token.toUpperCase()
    if (ALLOWED_FUNCTIONS.has(upper)) return
    if (RESERVED_LITERALS.has(token)) return
    vars.add(token)
  })

  return Array.from(vars)
}

const validateExpression = (expression = '') => {
  if (!String(expression || '').trim()) {
    throw new Error('Expression wajib diisi')
  }

  if (RESERVED_PATTERN.test(expression)) {
    throw new Error('Expression mengandung keyword terlarang')
  }

  if (!ALLOWED_CHAR_PATTERN.test(expression)) {
    throw new Error('Expression mengandung karakter yang tidak diizinkan')
  }

  return parseVariables(expression)
}

const expressionToExecutable = (expression) => expression
  .replace(/\bMIN\s*\(/g, 'Math.min(')
  .replace(/\bMAX\s*\(/g, 'Math.max(')
  .replace(/\bROUND\s*\(/g, 'roundFn(')

const evalExpression = (expression, inputs = {}) => {
  const variables = validateExpression(expression)
  const executable = expressionToExecutable(expression)
  const payload = {}
  variables.forEach((key) => {
    payload[key] = sanitizeNumber(inputs[key])
  })

  const scopeNames = Object.keys(payload)
  const scopeValues = Object.values(payload)

  // eslint-disable-next-line no-new-func
  const fn = new Function(
    ...scopeNames,
    'roundFn',
    `"use strict"; return (${executable});`
  )

  const result = fn(...scopeValues, (val, digits = 0) => {
    const n = sanitizeNumber(val)
    const d = Math.max(0, Math.min(6, Math.floor(sanitizeNumber(digits))))
    return Number(n.toFixed(d))
  })

  const amount = sanitizeNumber(result)
  if (!Number.isFinite(amount)) {
    throw new Error('Hasil formula tidak valid')
  }

  return {
    amount,
    normalized_inputs: payload,
    variables
  }
}

const modelCode = (key) => `PAYROLL_FLEX_${String(key || '').toUpperCase()}`

const seedModelDefinitions = async (actorId = null) => {
  for (const item of Object.values(MODEL_CATALOG)) {
    const code = modelCode(item.key)
    const existing = await db.query('SELECT id FROM formula_definitions WHERE code = $1 LIMIT 1', [code])

    let formulaId
    if (!existing.rowCount) {
      const created = await db.query(
        `INSERT INTO formula_definitions (code, name, domain, is_active, created_by)
         VALUES ($1,$2,$3,true,$4)
         RETURNING id`,
        [code, item.label, item.domain, actorId]
      )
      formulaId = created.rows[0].id
    } else {
      formulaId = existing.rows[0].id
    }

    const active = await db.query(
      `SELECT id FROM formula_versions
       WHERE formula_id = $1 AND status = 'ACTIVE'
       ORDER BY version_no DESC LIMIT 1`,
      [formulaId]
    )

    if (!active.rowCount) {
      const vars = parseVariables(item.defaultExpression)
      await db.query(
        `INSERT INTO formula_versions
          (formula_id, version_no, expression, variables, status, created_by, approved_by, approved_at)
         VALUES ($1, 1, $2, $3::jsonb, 'ACTIVE', $4, $4, NOW())`,
        [formulaId, item.defaultExpression, JSON.stringify(vars), actorId]
      )
    }
  }
}

exports.ensureSeeded = async (actorId = null) => {
  await ensureFormulaTables()
  await seedModelDefinitions(actorId)
}

exports.getModelCatalog = () => Object.values(MODEL_CATALOG)

exports.getActiveFormulas = async () => {
  await exports.ensureSeeded()
  const { rows } = await db.query(`
    SELECT
      fd.id AS formula_id,
      fd.code,
      fd.name,
      fd.domain,
      fv.id AS version_id,
      fv.version_no,
      fv.expression,
      fv.variables,
      fv.created_at,
      fv.approved_at
    FROM formula_definitions fd
    JOIN LATERAL (
      SELECT *
      FROM formula_versions
      WHERE formula_id = fd.id AND status = 'ACTIVE'
      ORDER BY version_no DESC
      LIMIT 1
    ) fv ON true
    WHERE fd.code LIKE 'PAYROLL_FLEX_%'
    ORDER BY fd.code ASC
  `)

  const byCode = {}
  rows.forEach((row) => {
    byCode[row.code] = row
  })

  return Object.values(MODEL_CATALOG).map((model) => {
    const code = modelCode(model.key)
    const row = byCode[code]
    return {
      ...model,
      formula_code: code,
      expression: row?.expression || model.defaultExpression,
      version_no: row?.version_no || 1,
      variables: row?.variables || parseVariables(model.defaultExpression)
    }
  })
}

exports.updateFormula = async (actorId, modelKey, expression) => {
  await exports.ensureSeeded(actorId)

  const model = MODEL_CATALOG[modelKey]
  if (!model) {
    throw new Error('Model payroll tidak ditemukan')
  }

  const variables = validateExpression(expression)
  const code = modelCode(modelKey)

  const defRes = await db.query('SELECT id FROM formula_definitions WHERE code = $1 LIMIT 1', [code])
  if (!defRes.rowCount) {
    throw new Error('Formula definition tidak ditemukan')
  }

  const formulaId = defRes.rows[0].id

  const latest = await db.query(
    'SELECT COALESCE(MAX(version_no), 0) AS max_version FROM formula_versions WHERE formula_id = $1',
    [formulaId]
  )
  const nextVersion = Number(latest.rows[0]?.max_version || 0) + 1

  await db.query('UPDATE formula_versions SET status = CASE WHEN status = $2 THEN $3 ELSE status END WHERE formula_id = $1', [formulaId, 'ACTIVE', 'ARCHIVED'])

  const created = await db.query(
    `INSERT INTO formula_versions
      (formula_id, version_no, expression, variables, status, created_by, approved_by, approved_at)
     VALUES ($1,$2,$3,$4::jsonb,'ACTIVE',$5,$5,NOW())
     RETURNING id, version_no, expression, variables, approved_at`,
    [formulaId, nextVersion, expression, JSON.stringify(variables), actorId || null]
  )

  return {
    model_key: modelKey,
    formula_code: code,
    ...created.rows[0]
  }
}

exports.previewPayroll = async ({ model_key, inputs }) => {
  await exports.ensureSeeded()
  const model = MODEL_CATALOG[model_key]
  if (!model) {
    throw new Error('Model payroll tidak ditemukan')
  }

  const code = modelCode(model_key)
  const formulaRes = await db.query(
    `SELECT fv.expression
     FROM formula_definitions fd
     JOIN formula_versions fv ON fv.formula_id = fd.id
     WHERE fd.code = $1 AND fv.status = 'ACTIVE'
     ORDER BY fv.version_no DESC
     LIMIT 1`,
    [code]
  )

  const expression = formulaRes.rows[0]?.expression || model.defaultExpression
  const result = evalExpression(expression, inputs || {})

  return {
    model_key,
    domain: model.domain,
    formula_code: code,
    expression,
    ...result
  }
}

exports._private = {
  parseVariables,
  validateExpression,
  evalExpression,
  MODEL_CATALOG
}
