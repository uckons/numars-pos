const db = require('../../config/db')

const normalizeVariant = (variant = 'DEFAULT') => String(variant || 'DEFAULT').trim().toUpperCase()

const ensurePostingRulesTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS accounting_posting_rules (
      id BIGSERIAL PRIMARY KEY,
      event_code VARCHAR(80) NOT NULL,
      variant VARCHAR(40) NOT NULL DEFAULT 'DEFAULT',
      line_no INT NOT NULL,
      direction VARCHAR(10) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
      account_code VARCHAR(30) NOT NULL REFERENCES chart_of_accounts(code),
      description VARCHAR(255),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_posting_rule UNIQUE (event_code, variant, line_no)
    )
  `)
}

const resolvePostingRules = async (client, eventCode, variant) => {
  const targetVariant = normalizeVariant(variant)
  const { rows } = await client.query(
    `SELECT event_code, variant, line_no, direction, account_code, description
     FROM accounting_posting_rules
     WHERE event_code=$1
       AND is_active=true
       AND variant IN ($2, 'DEFAULT')
     ORDER BY CASE WHEN variant=$2 THEN 0 ELSE 1 END, line_no ASC`,
    [eventCode, targetVariant]
  )

  if (!rows.length) return []

  const preferredVariant = rows.some((r) => normalizeVariant(r.variant) === targetVariant)
    ? targetVariant
    : 'DEFAULT'

  return rows.filter((r) => normalizeVariant(r.variant) === preferredVariant)
}

const createJournalFromRules = async (client, payload = {}) => {
  const {
    event_code,
    variant = 'DEFAULT',
    amount,
    branch_id = null,
    actor_id = null,
    source_ref = null,
    description = null,
    posting_date = new Date()
  } = payload

  const normalizedAmount = Math.round(Number(amount || 0) * 100) / 100
  if (!(normalizedAmount > 0)) return null
  if (!event_code) throw new Error('event_code wajib diisi untuk auto journal')

  await ensurePostingRulesTable(client)
  const rules = await resolvePostingRules(client, String(event_code).trim().toUpperCase(), variant)

  if (!rules.length) return null

  const idempotencyKey = `AUTO:${String(event_code).trim().toUpperCase()}:${normalizeVariant(variant)}:${String(source_ref || '-')}`
  const postingDateOnly = new Date(posting_date).toISOString().slice(0, 10)

  const existing = await client.query(
    `SELECT id FROM journal_entries WHERE idempotency_key=$1 LIMIT 1`,
    [idempotencyKey]
  )
  if (existing.rows.length) return Number(existing.rows[0].id)

  const headerRes = await client.query(
    `INSERT INTO journal_entries
      (branch_id, source_module, source_ref, posting_date, status, description, idempotency_key, created_by, posted_at)
     VALUES ($1,$2,$3,$4,'POSTED',$5,$6,$7,NOW())
     RETURNING id`,
    [
      branch_id,
      'POS',
      source_ref,
      postingDateOnly,
      description || `Auto journal ${event_code}`,
      idempotencyKey,
      actor_id
    ]
  )

  const journalId = Number(headerRes.rows[0].id)

  for (const rule of rules) {
    const debit = String(rule.direction).toUpperCase() === 'DEBIT' ? normalizedAmount : 0
    const credit = String(rule.direction).toUpperCase() === 'CREDIT' ? normalizedAmount : 0

    const accountRes = await client.query(
      `SELECT id FROM chart_of_accounts WHERE code=$1 LIMIT 1`,
      [rule.account_code]
    )

    if (!accountRes.rows.length) {
      throw new Error(`Akun COA ${rule.account_code} tidak ditemukan untuk event ${event_code}`)
    }

    await client.query(
      `INSERT INTO journal_lines
        (journal_entry_id, account_id, line_no, debit, credit, memo)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [journalId, Number(accountRes.rows[0].id), Number(rule.line_no), debit, credit, rule.description || null]
    )
  }

  return journalId
}

const postAutoJournal = async (payload = {}, opts = {}) => {
  const client = opts.client || db
  return createJournalFromRules(client, payload)
}

module.exports = {
  postAutoJournal
}
