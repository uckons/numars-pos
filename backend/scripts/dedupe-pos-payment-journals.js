#!/usr/bin/env node
const path = require('path')
const fs = require('fs')
const dotenv = require('dotenv')
const { Pool } = require('pg')

const envPath = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(envPath)) dotenv.config({ path: envPath })

const APPLY = String(process.env.APPLY || '').toLowerCase() === 'true'

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query(`
      WITH ranked AS (
        SELECT
          je.id,
          je.source_ref,
          ROW_NUMBER() OVER (PARTITION BY je.source_ref ORDER BY je.id DESC) AS rn
        FROM journal_entries je
        WHERE je.source_module = 'POS'
          AND je.source_ref LIKE 'ORDER:%'
          AND je.description ILIKE 'Auto jurnal payment order #%'
      )
      SELECT id, source_ref
      FROM ranked
      WHERE rn > 1
      ORDER BY source_ref, id
    `)

    console.log(`Duplicate candidates: ${rows.length}`)
    if (!rows.length) {
      await client.query('ROLLBACK')
      console.log('No duplicate POS payment journals found.')
      return
    }

    const ids = rows.map((r) => Number(r.id)).filter(Boolean)
    console.log(`IDs: ${ids.join(', ')}`)

    if (!APPLY) {
      await client.query('ROLLBACK')
      console.log('Dry-run only. Re-run with APPLY=true to delete duplicates.')
      return
    }

    await client.query('DELETE FROM journal_entries WHERE id = ANY($1::bigint[])', [ids])
    await client.query('COMMIT')
    console.log(`Deleted ${ids.length} duplicate journal entries.`)
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
