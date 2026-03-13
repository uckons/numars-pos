#!/usr/bin/env node
/*
 * Setup POS_PAYMENT posting rules by payment method.
 *
 * Usage example:
 *   DATABASE_URL=... \
 *   COA_CASH=1101 COA_TRANSFER=1102 COA_QRIS=1103 COA_AR=1201 COA_REVENUE_POS=4101 \
 *   node backend/scripts/setup-pos-payment-rules.js
 */

const db = require('../config/db')

const requiredCoa = {
  CASH: process.env.COA_CASH || '1101',
  TRANSFER: process.env.COA_TRANSFER || '1102',
  QRIS: process.env.COA_QRIS || '1103',
  CREDIT: process.env.COA_AR || '1201'
}

const revenueCoa = process.env.COA_REVENUE_POS || '4101'

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

const assertCoaExists = async (client, code) => {
  const { rows } = await client.query(
    'SELECT code, name, account_type FROM chart_of_accounts WHERE code = $1 LIMIT 1',
    [code]
  )
  if (!rows.length) {
    throw new Error(`COA ${code} tidak ditemukan. Isi env COA_* sesuai chart_of_accounts di database ini.`)
  }
  return rows[0]
}

const upsertRuleLine = async (client, { variant, line_no, direction, account_code, description }) => {
  await client.query(
    `INSERT INTO accounting_posting_rules
      (event_code, variant, line_no, direction, account_code, description, is_active, updated_at)
     VALUES
      ('POS_PAYMENT', $1, $2, $3, $4, $5, true, NOW())
     ON CONFLICT (event_code, variant, line_no)
     DO UPDATE SET
      direction = EXCLUDED.direction,
      account_code = EXCLUDED.account_code,
      description = EXCLUDED.description,
      is_active = true,
      updated_at = NOW()`,
    [variant, line_no, direction, account_code, description]
  )
}

const main = async () => {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    await ensurePostingRulesTable(client)

    console.log('🔎 Validating COA mapping...')
    for (const [variant, coa] of Object.entries(requiredCoa)) {
      const row = await assertCoaExists(client, coa)
      console.log(`  ${variant.padEnd(8)} -> ${row.code} (${row.name})`)
    }

    const revenue = await assertCoaExists(client, revenueCoa)
    console.log(`  REVENUE  -> ${revenue.code} (${revenue.name})`)

    for (const [variant, debitCoa] of Object.entries(requiredCoa)) {
      await upsertRuleLine(client, {
        variant,
        line_no: 1,
        direction: 'DEBIT',
        account_code: debitCoa,
        description: `Auto POS payment ${variant} - debit`
      })

      await upsertRuleLine(client, {
        variant,
        line_no: 2,
        direction: 'CREDIT',
        account_code: revenueCoa,
        description: `Auto POS payment ${variant} - credit revenue`
      })
    }

    await client.query('COMMIT')
    console.log('✅ POS_PAYMENT rules berhasil di-upsert untuk CASH/TRANSFER/QRIS/CREDIT')
  } catch (err) {
    try { await client.query('ROLLBACK') } catch (_) {}
    console.error('❌ Gagal setup POS_PAYMENT rules:', err.message)
    process.exitCode = 1
  } finally {
    client.release()
    await db.end()
  }
}

main()
