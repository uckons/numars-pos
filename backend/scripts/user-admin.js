#!/usr/bin/env node

const bcrypt = require('bcrypt')
const path = require('node:path')

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

function usage() {
  return [
    'Penggunaan:',
    '  npm run user-admin -- list',
    '  npm run user-admin -- reset --username <username>',
    '',
    'Password dibaca dari ADMIN_NEW_PASSWORD agar tidak tersimpan di shell history.',
    'Password minimal 8 karakter dan harus memuat huruf kecil, huruf besar, angka, dan simbol.'
  ].join('\n')
}

function parseArgs(argv) {
  const [command, ...rest] = argv
  const options = {}

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]
    if (argument === '--username') {
      options.username = rest[index + 1]
      index += 1
    } else {
      throw new Error(`Argumen tidak dikenal: ${argument}`)
    }
  }

  return { command, options }
}

async function listUsers(db) {
  const { rows } = await db.query(`
    SELECT u.id, u.username, u.name, r.name AS role, b.name AS branch,
           u.is_active, u.deleted_at
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN branches b ON b.id = u.branch_id
     ORDER BY u.id
  `)
  console.table(rows)
  return rows
}

async function resetPassword(db, username, password) {
  if (!username) throw new Error('--username wajib diisi')
  if (!password) throw new Error('Environment variable ADMIN_NEW_PASSWORD wajib diisi')
  if (!PASSWORD_POLICY.test(password)) {
    throw new Error('Password tidak memenuhi kebijakan keamanan')
  }

  const hash = await bcrypt.hash(password, 12)
  const tokenVersion = await db.query(`
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'users'
       AND column_name = 'token_version'
  `)
  const revokeSessions = tokenVersion.rowCount > 0 ? ', token_version = token_version + 1' : ''
  const result = await db.query(
    `UPDATE users
        SET password = $1${revokeSessions}
      WHERE username = $2 AND deleted_at IS NULL
      RETURNING id, username`,
    [hash, username]
  )

  if (result.rowCount !== 1) throw new Error(`User aktif '${username}' tidak ditemukan`)
  return result.rows[0]
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum dikonfigurasi')

  const { command, options } = parseArgs(process.argv.slice(2))
  if (!['list', 'reset'].includes(command)) throw new Error(usage())

  const { Pool } = require('pg')
  const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  try {
    if (command === 'list') {
      await listUsers(db)
    } else {
      const user = await resetPassword(db, options.username, process.env.ADMIN_NEW_PASSWORD)
      console.log(`Password untuk '${user.username}' berhasil diganti. Semua sesi lama dicabut jika didukung database.`)
    }
  } finally {
    await db.end()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Gagal: ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = { PASSWORD_POLICY, listUsers, parseArgs, resetPassword, usage }
