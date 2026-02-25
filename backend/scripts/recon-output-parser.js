#!/usr/bin/env node
const fs = require('fs')

const filePath = process.argv[2]
const raw = filePath ? fs.readFileSync(filePath, 'utf8') : fs.readFileSync(0, 'utf8')

const counts = {
  OK: 0,
  MISSING_JOURNAL: 0,
  UNBALANCED_JOURNAL: 0,
  AMOUNT_MISMATCH: 0,
  ZERO_TOTAL_WITH_ITEMS: 0,
  NO_JOURNAL_EXPECTED_ZERO_TOTAL: 0
}

const lineRegex = /^\s*([A-Z_]+)\s*\|\s*([0-9]+)\s*\|\s*([0-9.,]+)\s*$/
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(lineRegex)
  if (!m) continue
  const status = String(m[1] || '').trim()
  const totalRows = Number(String(m[2] || '0').trim())
  if (Object.prototype.hasOwnProperty.call(counts, status)) {
    counts[status] = totalRows
  }
}

const mismatchTotal =
  counts.MISSING_JOURNAL +
  counts.UNBALANCED_JOURNAL +
  counts.AMOUNT_MISMATCH +
  counts.ZERO_TOTAL_WITH_ITEMS

const result = {
  recon_date: process.env.RECON_DATE || null,
  branch_id: process.env.BRANCH_ID || null,
  counts,
  mismatch_total: mismatchTotal,
  status: mismatchTotal > 0 ? 'ALERT' : 'OK'
}

process.stdout.write(`${JSON.stringify(result)}\n`)
process.exit(mismatchTotal > 0 ? 2 : 0)
