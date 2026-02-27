const test = require('node:test')
const assert = require('node:assert/strict')

const { parseArgs, toStatus, sendWebhook } = require('../scripts/sprint4-recon-job')

test('parseArgs parses date branch dry-run and json flags', () => {
  const opts = parseArgs(['--date', '2026-03-01', '--branch-id', '7', '--dry-run', '--json'])
  assert.equal(opts.date, '2026-03-01')
  assert.equal(opts.branchId, 7)
  assert.equal(opts.dryRun, true)
  assert.equal(opts.jsonOnly, true)
})

test('toStatus marks ALERT when any mismatch exists', () => {
  const payload = toStatus({
    recon_date: '2026-03-01',
    branch_id: 'ALL',
    totals: {},
    checks: {
      ap_negative_outstanding: 0,
      ar_negative_outstanding: 2,
      payroll_not_posted: 0,
      unbalanced_posted_journal: 1
    }
  })

  assert.equal(payload.mismatch_total, 3)
  assert.equal(payload.status, 'ALERT')
})

test('sendWebhook uses discord content key', async () => {
  let body
  await sendWebhook(
    'https://discord.com/api/webhooks/abc',
    {
      recon_date: '2026-03-01',
      branch_id: 'ALL',
      status: 'OK',
      mismatch_total: 0,
      checks: {
        ap_negative_outstanding: 0,
        ar_negative_outstanding: 0,
        payroll_not_posted: 0,
        unbalanced_posted_journal: 0
      }
    },
    async (_url, options) => {
      body = JSON.parse(options.body)
      return { ok: true, status: 204 }
    }
  )

  assert.equal(typeof body.content, 'string')
  assert.equal(body.text, undefined)
})

test('sendWebhook throws on non-ok response', async () => {
  await assert.rejects(
    () =>
      sendWebhook(
        'https://hooks.example.internal',
        {
          recon_date: '2026-03-01',
          branch_id: 'ALL',
          status: 'OK',
          mismatch_total: 0,
          checks: {
            ap_negative_outstanding: 0,
            ar_negative_outstanding: 0,
            payroll_not_posted: 0,
            unbalanced_posted_journal: 0
          }
        },
        async () => ({ ok: false, status: 500 })
      ),
    /Webhook request failed with status 500/
  )
})
