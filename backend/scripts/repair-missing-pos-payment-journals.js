#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { Pool } = require('pg')
const { postAutoJournal } = require('../modules/accounting/journal-posting.service')

const rootDir = path.resolve(__dirname, '..', '..')
const backendEnvPath = path.resolve(__dirname, '..', '.env')
const rootEnvPath = path.resolve(rootDir, '.env')

if (fs.existsSync(backendEnvPath)) dotenv.config({ path: backendEnvPath })
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath, override: false })

const APPLY = String(process.env.APPLY || '').toLowerCase() === 'true'
const TARGET_ORDER_ID = Number(process.env.ORDER_ID || 0)
const RECON_DATE = String(process.env.RECON_DATE || '').trim()
const BRANCH_ID = Number(process.env.BRANCH_ID || 0)

const normalizeConnectionConfig = () => {
  const directUrl = process.env.DATABASE_URL
  if (directUrl && String(directUrl).trim().length > 0) {
    return { connectionString: String(directUrl).trim() }
  }

  const host = String(process.env.DB_HOST || '127.0.0.1')
  const port = Number(process.env.DB_PORT || 5432)
  const user = process.env.DB_USER !== undefined ? String(process.env.DB_USER) : ''
  const password = process.env.DB_PASS !== undefined ? String(process.env.DB_PASS) : ''
  const database = process.env.DB_NAME !== undefined ? String(process.env.DB_NAME) : ''

  if (!user || !database) {
    throw new Error('Konfigurasi DB tidak lengkap. Set DATABASE_URL atau DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME')
  }

  return { host, port, user, password, database }
}

async function main() {
  const pool = new Pool(normalizeConnectionConfig())
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const params = []
    let whereClause = `
      o.status='PAID'
      AND COALESCE(o.total, 0) > 0
      AND je.id IS NULL
    `

    if (Number.isInteger(TARGET_ORDER_ID) && TARGET_ORDER_ID > 0) {
      params.push(TARGET_ORDER_ID)
      whereClause += ` AND o.id = $${params.length}`
    }

    if (RECON_DATE) {
      params.push(RECON_DATE)
      whereClause += ` AND o.created_at::date = $${params.length}::date`
    }

    if (Number.isInteger(BRANCH_ID) && BRANCH_ID > 0) {
      params.push(BRANCH_ID)
      whereClause += ` AND o.branch_id = $${params.length}`
    }

    const { rows } = await client.query(
      `SELECT
         o.id AS order_id,
         o.branch_id,
         COALESCE(o.payment_method, 'CASH') AS payment_method,
         COALESCE(o.total, 0) AS order_total,
         o.created_at::date AS order_date
       FROM orders o
       LEFT JOIN journal_entries je
         ON je.source_module='POS'
        AND je.source_ref = CONCAT('ORDER:', o.id)
        AND je.idempotency_key LIKE 'AUTO:POS_PAYMENT:%'
       WHERE ${whereClause}
       ORDER BY o.id ASC`,
      params
    )

    console.log(`Mode => ORDER_ID=${TARGET_ORDER_ID || '-'} RECON_DATE=${RECON_DATE || '-'} BRANCH_ID=${BRANCH_ID || '-'} APPLY=${APPLY}`)
    console.log(`Missing POS journals found: ${rows.length}`)

    if (!rows.length) {
      await client.query('ROLLBACK')
      console.log('No missing POS payment journals found.')
      return
    }

    rows.forEach((r) => {
      console.log(`- order_id=${r.order_id} date=${r.order_date} total=${r.order_total} method=${r.payment_method}`)
    })

    if (!APPLY) {
      await client.query('ROLLBACK')
      console.log('Dry-run only. Re-run with APPLY=true to create missing journals.')
      return
    }

    let createdCount = 0
    for (const row of rows) {
      const journalId = await postAutoJournal({
        event_code: 'POS_PAYMENT',
        variant: String(row.payment_method || 'CASH').toUpperCase(),
        amount: Number(row.order_total || 0),
        branch_id: Number(row.branch_id || 0) || null,
        actor_id: null,
        source_ref: `ORDER:${row.order_id}`,
        description: `Auto jurnal payment order #${row.order_id} (repair missing)`
      }, { client })

      if (!journalId) {
        throw new Error(
          `Gagal membuat jurnal untuk ORDER:${row.order_id}. Kemungkinan posting rules POS_PAYMENT belum tersedia/aktif untuk variant ${String(row.payment_method || 'CASH').toUpperCase()}.`
        )
      }

      createdCount += 1
      console.log(`  created journal_id=${journalId} for ORDER:${row.order_id}`)
    }

    await client.query('COMMIT')
    console.log(`Created journals for ${createdCount} orders.`)
  } catch (err) {
    try { await client.query('ROLLBACK') } catch (_) {}
    console.error(err.message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
