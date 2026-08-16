const assert = require('node:assert/strict')
const test = require('node:test')

const { PASSWORD_POLICY, parseArgs, resetPassword } = require('../scripts/user-admin')

test('parseArgs membaca username tanpa menerima argumen asing', () => {
  assert.deepEqual(parseArgs(['reset', '--username', 'admin']), {
    command: 'reset',
    options: { username: 'admin' }
  })
  assert.throws(() => parseArgs(['reset', '--password', 'rahasia']), /tidak dikenal/)
})

test('kebijakan password mensyaratkan campuran karakter', () => {
  assert.equal(PASSWORD_POLICY.test('terlalulemah'), false)
  assert.equal(PASSWORD_POLICY.test('AmanBaru!123'), true)
})

test('resetPassword menyimpan hash dan menaikkan token version', async () => {
  const calls = []
  const db = {
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('information_schema.columns')) return { rowCount: 1, rows: [{ '?column?': 1 }] }
      return { rowCount: 1, rows: [{ id: 7, username: 'admin' }] }
    }
  }

  const user = await resetPassword(db, 'admin', 'AmanBaru!123')
  assert.deepEqual(user, { id: 7, username: 'admin' })
  assert.match(calls[1].sql, /token_version = token_version \+ 1/)
  assert.notEqual(calls[1].params[0], 'AmanBaru!123')
  assert.equal(await bcryptCompare('AmanBaru!123', calls[1].params[0]), true)
})

async function bcryptCompare(password, hash) {
  return require('bcrypt').compare(password, hash)
}
