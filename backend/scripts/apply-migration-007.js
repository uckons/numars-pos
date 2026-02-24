#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { Pool } = require('pg')

const rootDir = path.resolve(__dirname, '..', '..')
const backendEnvPath = path.resolve(__dirname, '..', '.env')
const rootEnvPath = path.resolve(rootDir, '.env')

if (fs.existsSync(backendEnvPath)) dotenv.config({ path: backendEnvPath })
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath, override: false })

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
    throw new Error(
      'Konfigurasi DB tidak lengkap. Set DATABASE_URL atau DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME di backend/.env'
    )
  }

  return {
    host,
    port,
    user,
    password,
    database
  }
}

const run = async () => {
  const migrationPath = path.resolve(rootDir, 'database', 'migrations', '007_sprint1_foundation_accounting.sql')
  const sql = fs.readFileSync(migrationPath, 'utf8')
  const config = normalizeConnectionConfig()
  const pool = new Pool(config)

  try {
    const client = await pool.connect()
    try {
      await client.query(sql)
      console.log('✅ Migration 007 applied successfully')
    } finally {
      client.release()
    }
  } catch (err) {
    const msg = String(err?.message || err)
    const details = Array.isArray(err?.errors) ? err.errors.map((e) => e?.message || String(e)).join(' | ') : ''
    const combined = [msg, details].filter(Boolean).join(' | ')

    if (combined.includes('client password must be a string')) {
      console.error('❌ DB auth error: password terbaca invalid/non-string.')
      console.error('   Periksa backend/.env:')
      console.error('   - Jika pakai DATABASE_URL, pastikan format valid dan password di-URL-encode.')
      console.error('   - Jika pakai DB_PASS, pastikan nilainya ada (tidak kosong) dan tidak terpotong karakter khusus.')
    }

    if (combined.includes('ECONNREFUSED')) {
      console.error('❌ DB connection refused: pastikan service PostgreSQL aktif dan host/port benar.')
    }

    console.error('Migration failed:', combined || msg)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

run()
