#!/usr/bin/env node

const { Client } = require('pg')

const parseArgs = () => {
  const args = process.argv.slice(2)
  const opts = {
    date: new Date().toISOString().slice(0, 10),
    branchId: null,
    webhook: process.env.ALERT_WEBHOOK_URL || '',
    dryRun: false,
    jsonOnly: false
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--date') opts.date = args[++i]
    else if (arg === '--branch-id') opts.branchId = Number(args[++i])
    else if (arg === '--webhook') opts.webhook = args[++i]
    else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--json') opts.jsonOnly = true
    else if (arg === '--help') {
      // eslint-disable-next-line no-console
      console.log('Usage: node scripts/sprint4-recon-job.js [--date YYYY-MM-DD] [--branch-id N] [--webhook URL] [--dry-run] [--json]')
      process.exit(0)
    }
  }

  return opts
}

const qNum = (value) => Number(value || 0)

const summarize = (rows, key) => rows.reduce((sum, row) => sum + qNum(row[key]), 0)

const runRecon = async (client, opts) => {
  const branchFilter = Number.isInteger(opts.branchId) ? 'AND COALESCE(i.branch_id, p.branch_id) = $2' : ''
  const apQuery = `
    SELECT i.id, i.invoice_no, i.total_amount,
      COALESCE(SUM(p.amount), 0) AS paid_amount,
      (i.total_amount - COALESCE(SUM(p.amount), 0)) AS outstanding
    FROM ap_invoices i
    LEFT JOIN ap_payments p ON p.ap_invoice_id = i.id
    WHERE COALESCE(i.invoice_date::date, i.created_at::date) <= $1
    ${branchFilter}
    GROUP BY i.id, i.invoice_no, i.total_amount
  `

  const arQuery = `
    SELECT i.id, i.invoice_no, i.total_amount,
      COALESCE(SUM(p.amount), 0) AS received_amount,
      (i.total_amount - COALESCE(SUM(p.amount), 0)) AS outstanding
    FROM ar_invoices i
    LEFT JOIN ar_payments p ON p.ar_invoice_id = i.id
    WHERE COALESCE(i.invoice_date::date, i.created_at::date) <= $1
    ${branchFilter}
    GROUP BY i.id, i.invoice_no, i.total_amount
  `

  const payrollQuery = `
    SELECT r.id, r.period_key, r.status, r.total_amount, r.journal_entry_id, je.status AS journal_status
    FROM staff_payroll_runs r
    LEFT JOIN journal_entries je ON je.id = r.journal_entry_id
    WHERE COALESCE(r.created_at::date, NOW()::date) <= $1
    ORDER BY r.id DESC
  `

  const unbalancedQuery = `
    SELECT COUNT(*)::int AS total
    FROM (
      SELECT je.id
      FROM journal_entries je
      JOIN journal_lines jl ON jl.journal_entry_id = je.id
      WHERE je.source_module IN ('AP', 'AR', 'PAYROLL')
      GROUP BY je.id
      HAVING SUM(jl.debit) <> SUM(jl.credit)
    ) t
  `

  const params = Number.isInteger(opts.branchId) ? [opts.date, opts.branchId] : [opts.date]
  const [ap, ar, payroll, unbalanced] = await Promise.all([
    client.query(apQuery, params),
    client.query(arQuery, params),
    client.query(payrollQuery, [opts.date]),
    client.query(unbalancedQuery)
  ])

  const apOutstandingMismatch = ap.rows.filter((r) => qNum(r.outstanding) < 0).length
  const arOutstandingMismatch = ar.rows.filter((r) => qNum(r.outstanding) < 0).length
  const payrollNotPosted = payroll.rows.filter((r) => String(r.status || '').toUpperCase() !== 'POSTED').length
  const unbalancedPostedJournal = qNum(unbalanced.rows[0]?.total)

  return {
    recon_date: opts.date,
    branch_id: Number.isInteger(opts.branchId) ? opts.branchId : 'ALL',
    totals: {
      ap_invoice_count: ap.rowCount,
      ar_invoice_count: ar.rowCount,
      payroll_run_count: payroll.rowCount,
      ap_outstanding_total: summarize(ap.rows, 'outstanding'),
      ar_outstanding_total: summarize(ar.rows, 'outstanding')
    },
    checks: {
      ap_negative_outstanding: apOutstandingMismatch,
      ar_negative_outstanding: arOutstandingMismatch,
      payroll_not_posted: payrollNotPosted,
      unbalanced_posted_journal: unbalancedPostedJournal
    }
  }
}

const toStatus = (summary) => {
  const mismatch = Object.values(summary.checks).reduce((sum, value) => sum + Number(value || 0), 0)
  return {
    ...summary,
    mismatch_total: mismatch,
    status: mismatch > 0 ? 'ALERT' : 'OK'
  }
}

const sendWebhook = async (url, payload) => {
  if (!url) return
  const message = [
    '📒 Sprint 4 Recon Automation',
    `Tanggal: ${payload.recon_date}`,
    `Branch: ${payload.branch_id}`,
    `Status: ${payload.status} (mismatch=${payload.mismatch_total})`,
    `AP negative outstanding: ${payload.checks.ap_negative_outstanding}`,
    `AR negative outstanding: ${payload.checks.ar_negative_outstanding}`,
    `Payroll not posted: ${payload.checks.payroll_not_posted}`,
    `Unbalanced posted journal: ${payload.checks.unbalanced_posted_journal}`
  ].join('\n')

  const key = url.includes('discord.com/api/webhooks') || url.includes('discordapp.com/api/webhooks') ? 'content' : 'text'
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [key]: message })
  })
}

const main = async () => {
  const opts = parseArgs()
  const databaseUrl = process.env.DATABASE_URL

  if (opts.dryRun) {
    const payload = toStatus({
      recon_date: opts.date,
      branch_id: Number.isInteger(opts.branchId) ? opts.branchId : 'ALL',
      totals: {
        ap_invoice_count: 0,
        ar_invoice_count: 0,
        payroll_run_count: 0,
        ap_outstanding_total: 0,
        ar_outstanding_total: 0
      },
      checks: {
        ap_negative_outstanding: 0,
        ar_negative_outstanding: 0,
        payroll_not_posted: 0,
        unbalanced_posted_journal: 0
      }
    })
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload))
    process.exit(0)
  }

  if (!databaseUrl) {
    // eslint-disable-next-line no-console
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    const summary = await runRecon(client, opts)
    const payload = toStatus(summary)
    if (!opts.jsonOnly) {
      // eslint-disable-next-line no-console
      console.log('Sprint4 Recon Summary')
      // eslint-disable-next-line no-console
      console.table(payload.checks)
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload))
    await sendWebhook(opts.webhook, payload)
    process.exit(payload.mismatch_total > 0 ? 2 : 0)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message || err)
  process.exit(1)
})
