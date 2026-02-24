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
  const config = normalizeConnectionConfig()
  const pool = new Pool(config)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const params = []
    let whereClause = `
      o.status='PAID'
      AND COALESCE(o.total, 0) <= 0
      AND COALESCE(oi.items_subtotal, 0) > 0
    `

    if (Number.isInteger(TARGET_ORDER_ID) && TARGET_ORDER_ID > 0) {
      params.push(TARGET_ORDER_ID)
      whereClause += ` AND o.id = $${params.length}`
    }

    const { rows } = await client.query(
      `SELECT
        o.id AS order_id,
        o.branch_id,
        COALESCE(o.payment_method, 'CASH') AS payment_method,
        COALESCE(o.total, 0) AS order_total,
        COALESCE(oi.items_subtotal, 0) AS items_subtotal
       FROM orders o
       LEFT JOIN (
         SELECT order_id, COALESCE(SUM(subtotal), 0) AS items_subtotal
         FROM order_items
         GROUP BY order_id
       ) oi ON oi.order_id = o.id
       WHERE ${whereClause}
       ORDER BY o.id ASC`,
      params
    )

    console.log(`Found anomalous orders: ${rows.length}`)
    if (!rows.length) {
      await client.query('ROLLBACK')
      console.log('No ZERO_TOTAL_WITH_ITEMS orders found.')
      return
    }

    rows.forEach((r) => {
      console.log(`- order_id=${r.order_id} subtotal=${r.items_subtotal} total=${r.order_total} method=${r.payment_method}`)
    })

    if (!APPLY) {
      await client.query('ROLLBACK')
      console.log('Dry-run only. Re-run with APPLY=true to apply corrections.')
      return
    }

    for (const row of rows) {
      const correctedTotal = Math.round(Number(row.items_subtotal || 0))
      const paymentMethod = String(row.payment_method || 'CASH').toUpperCase()
      const paymentAmount = correctedTotal
      const changeAmount = 0

      await client.query(
        `UPDATE orders
         SET total=$2,
             total_amount=$2,
             discount_amount=0,
             payment_amount=$3,
             change_amount=$4
         WHERE id=$1`,
        [Number(row.order_id), correctedTotal, paymentAmount, changeAmount]
      )

      await postAutoJournal({
        event_code: 'POS_PAYMENT',
        variant: paymentMethod,
        amount: correctedTotal,
        branch_id: row.branch_id || null,
        actor_id: null,
        source_ref: `ORDER:${row.order_id}`,
        description: `Auto jurnal payment order #${row.order_id} (repair zero-total)`
      }, { client })
    }

    await client.query('COMMIT')
    console.log(`Applied correction to ${rows.length} orders.`)
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
