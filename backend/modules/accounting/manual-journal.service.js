const db = require('../../config/db')

class HttpError extends Error {
  constructor(status, code, message, details = null) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

const toNumber = (val, fallback = 0) => {
  const num = Number(val)
  return Number.isFinite(num) ? num : fallback
}

const normalizeAmount = (val) => Math.round(toNumber(val, 0) * 100) / 100

const resolveUserBranch = (user, payloadBranchId) => {
  const role = String(user?.role || '').toLowerCase()
  const isPrivileged = ['superadmin', 'owner', 'manager'].includes(role)

  if (isPrivileged && payloadBranchId) return Number(payloadBranchId)
  return Number(user?.branch_id || payloadBranchId || 0)
}

const ensureJournalEditable = (status) => {
  if (!['DRAFT', 'REJECTED'].includes(String(status || '').toUpperCase())) {
    throw new HttpError(409, 'INVALID_STATUS_TRANSITION', `Journal status ${status} tidak dapat diubah`)
  }
}

const validateLines = async (client, lines = []) => {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Minimal 2 line journal diperlukan')
  }

  const normalized = []
  let totalDebit = 0
  let totalCredit = 0

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] || {}
    const rawAccountId = raw.account_id
    const rawAccountCode = raw.account_code
    const accountId = Number(rawAccountId)
    const accountCode = String(rawAccountCode || '').trim()
    const debit = normalizeAmount(raw.debit)
    const credit = normalizeAmount(raw.credit)

    const hasValidAccountId = Number.isInteger(accountId) && accountId > 0
    const hasAccountCode = Boolean(accountCode)

    if (!hasValidAccountId && !hasAccountCode) {
      throw new HttpError(400, 'VALIDATION_ERROR', `account_id/account_code wajib valid di line ${i + 1}`)
    }

    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      throw new HttpError(400, 'VALIDATION_ERROR', `Line ${i + 1} harus debit atau credit saja`, {
        line_no: i + 1,
        debit,
        credit
      })
    }

    let accountCheck
    if (hasValidAccountId) {
      accountCheck = await client.query(
        'SELECT id, code, is_active FROM chart_of_accounts WHERE id=$1 LIMIT 1',
        [accountId]
      )

      // Backward compatibility: some payloads pass account code numeric in account_id (e.g. 5101)
      if (!accountCheck.rows.length && !hasAccountCode) {
        accountCheck = await client.query(
          'SELECT id, code, is_active FROM chart_of_accounts WHERE code=$1 LIMIT 1',
          [String(rawAccountId)]
        )
      }
    } else {
      accountCheck = await client.query(
        'SELECT id, code, is_active FROM chart_of_accounts WHERE code=$1 LIMIT 1',
        [accountCode]
      )
    }

    if (!accountCheck.rows.length) {
      const identifier = hasAccountCode ? `code ${accountCode}` : `id/code ${rawAccountId}`
      throw new HttpError(400, 'VALIDATION_ERROR', `Account ${identifier} tidak ditemukan`)
    }

    if (!accountCheck.rows[0].is_active) {
      throw new HttpError(400, 'VALIDATION_ERROR', `Account ${accountCheck.rows[0].code || accountCheck.rows[0].id} tidak aktif`)
    }

    totalDebit += debit
    totalCredit += credit

    normalized.push({
      line_no: i + 1,
      account_id: Number(accountCheck.rows[0].id),
      debit,
      credit,
      memo: raw.memo || null
    })
  }

  totalDebit = normalizeAmount(totalDebit)
  totalCredit = normalizeAmount(totalCredit)

  return {
    lines: normalized,
    totalDebit,
    totalCredit,
    isBalanced: totalDebit === totalCredit
  }
}

const createManualJournal = async (payload, user) => {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const branchId = resolveUserBranch(user, payload.branch_id)
    if (!branchId) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'branch_id wajib diisi')
    }

    if (!payload.journal_date) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'journal_date wajib diisi')
    }

    const lineResult = await validateLines(client, payload.lines)

    const headerRes = await client.query(
      `INSERT INTO manual_journal_headers
        (branch_id, journal_date, description, status, total_debit, total_credit, created_by)
       VALUES ($1,$2,$3,'DRAFT',$4,$5,$6)
       RETURNING id, branch_id, journal_date, description, status, total_debit, total_credit, created_by, created_at, updated_at`,
      [
        branchId,
        payload.journal_date,
        payload.description || null,
        lineResult.totalDebit,
        lineResult.totalCredit,
        Number(user.id)
      ]
    )

    const header = headerRes.rows[0]

    for (const line of lineResult.lines) {
      await client.query(
        `INSERT INTO manual_journal_lines
          (header_id, line_no, account_id, debit, credit, memo)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [header.id, line.line_no, line.account_id, line.debit, line.credit, line.memo]
      )
    }

    await client.query('COMMIT')

    return {
      ...header,
      is_balanced: lineResult.isBalanced
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

const listManualJournals = async (query, user) => {
  const page = Math.max(Number(query.page || 1), 1)
  const pageSize = Math.min(Math.max(Number(query.page_size || 20), 1), 100)
  const offset = (page - 1) * pageSize

  const where = []
  const params = []

  const role = String(user?.role || '').toLowerCase()
  const isPrivileged = ['superadmin', 'owner', 'manager'].includes(role)
  const targetBranch = query.branch_id ? Number(query.branch_id) : Number(user.branch_id)

  if (!isPrivileged || targetBranch) {
    params.push(targetBranch)
    where.push(`h.branch_id=$${params.length}`)
  }

  if (query.status) {
    params.push(String(query.status).toUpperCase())
    where.push(`h.status=$${params.length}`)
  }

  if (query.from) {
    params.push(query.from)
    where.push(`h.journal_date >= $${params.length}`)
  }

  if (query.to) {
    params.push(query.to)
    where.push(`h.journal_date <= $${params.length}`)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM manual_journal_headers h ${whereSql}`,
    params
  )

  params.push(pageSize)
  params.push(offset)
  const dataRes = await db.query(
    `SELECT h.id, h.branch_id, h.journal_date, h.description, h.status, h.total_debit, h.total_credit,
            h.created_by, h.submitted_by, h.approved_by, h.rejected_by, h.created_at, h.updated_at
     FROM manual_journal_headers h
     ${whereSql}
     ORDER BY h.journal_date DESC, h.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  return {
    data: dataRes.rows,
    meta: {
      page,
      page_size: pageSize,
      total: countRes.rows[0]?.total || 0
    }
  }
}

const getManualJournalDetail = async (id, user) => {
  const role = String(user?.role || '').toLowerCase()
  const isPrivileged = ['superadmin', 'owner', 'manager'].includes(role)

  const headerRes = await db.query(
    `SELECT * FROM manual_journal_headers WHERE id=$1`,
    [id]
  )

  if (!headerRes.rows.length) {
    throw new HttpError(404, 'NOT_FOUND', 'Manual journal tidak ditemukan')
  }

  const header = headerRes.rows[0]
  if (!isPrivileged && Number(header.branch_id) !== Number(user.branch_id)) {
    throw new HttpError(403, 'FORBIDDEN', 'Tidak punya akses ke branch ini')
  }

  const linesRes = await db.query(
    `SELECT id, line_no, account_id, debit, credit, memo
     FROM manual_journal_lines
     WHERE header_id=$1
     ORDER BY line_no ASC`,
    [id]
  )

  const logsRes = await db.query(
    `SELECT id, action, actor_id, note, from_status, to_status, created_at
     FROM manual_journal_approval_logs
     WHERE header_id=$1
     ORDER BY created_at DESC`,
    [id]
  )

  return {
    ...header,
    lines: linesRes.rows,
    approval_logs: logsRes.rows
  }
}

const transitionStatus = async ({ id, user, action, note }) => {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const lockRes = await client.query(
      `SELECT * FROM manual_journal_headers WHERE id=$1 FOR UPDATE`,
      [id]
    )

    if (!lockRes.rows.length) {
      throw new HttpError(404, 'NOT_FOUND', 'Manual journal tidak ditemukan')
    }

    const current = lockRes.rows[0]
    const currentStatus = String(current.status || '').toUpperCase()

    if (action === 'SUBMIT') {
      if (currentStatus !== 'DRAFT' && currentStatus !== 'REJECTED') {
        throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Hanya DRAFT/REJECTED yang bisa submit')
      }

      if (normalizeAmount(current.total_debit) !== normalizeAmount(current.total_credit)) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Journal is not balanced', {
          total_debit: current.total_debit,
          total_credit: current.total_credit
        })
      }

      await client.query(
        `UPDATE manual_journal_headers
         SET status='PENDING_APPROVAL', submitted_by=$2, submitted_at=NOW()
         WHERE id=$1`,
        [id, user.id]
      )

      await client.query(
        `INSERT INTO manual_journal_approval_logs (header_id, action, actor_id, note, from_status, to_status)
         VALUES ($1,'SUBMIT',$2,$3,$4,'PENDING_APPROVAL')`,
        [id, user.id, note || null, currentStatus]
      )

      await client.query('COMMIT')
      return { id: Number(id), status: 'PENDING_APPROVAL' }
    }

    const role = String(user?.role || '').toLowerCase()
    const isApprover = ['superadmin', 'owner', 'manager'].includes(role)
    if (!isApprover) {
      throw new HttpError(403, 'FORBIDDEN', 'Hanya approver yang bisa approve/reject')
    }

    if (currentStatus !== 'PENDING_APPROVAL') {
      throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Status harus PENDING_APPROVAL')
    }

    if (action === 'APPROVE') {
      await client.query(
        `UPDATE manual_journal_headers
         SET status='POSTED', approved_by=$2, approved_at=NOW()
         WHERE id=$1`,
        [id, user.id]
      )

      await client.query(
        `INSERT INTO manual_journal_approval_logs (header_id, action, actor_id, note, from_status, to_status)
         VALUES ($1,'APPROVE',$2,$3,$4,'POSTED')`,
        [id, user.id, note || null, currentStatus]
      )

      await client.query('COMMIT')
      return { id: Number(id), status: 'POSTED' }
    }

    await client.query(
      `UPDATE manual_journal_headers
       SET status='REJECTED', rejected_by=$2, rejected_at=NOW(), rejection_note=$3
       WHERE id=$1`,
      [id, user.id, note || null]
    )

    await client.query(
      `INSERT INTO manual_journal_approval_logs (header_id, action, actor_id, note, from_status, to_status)
       VALUES ($1,'REJECT',$2,$3,$4,'REJECTED')`,
      [id, user.id, note || null, currentStatus]
    )

    await client.query('COMMIT')
    return { id: Number(id), status: 'REJECTED' }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

const createRecurringTemplate = async (payload, user) => {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const branchId = resolveUserBranch(user, payload.branch_id)
    if (!branchId) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'branch_id wajib diisi')
    }

    if (!payload.name || !payload.schedule_type || !payload.start_date) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'name, schedule_type, start_date wajib diisi')
    }

    const lineResult = await validateLines(client, payload.lines)
    if (!lineResult.isBalanced) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Template recurring harus balanced', {
        total_debit: lineResult.totalDebit,
        total_credit: lineResult.totalCredit
      })
    }

    const headerRes = await client.query(
      `INSERT INTO recurring_journal_templates
        (branch_id, name, description, schedule_type, schedule_day, start_date, end_date, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVE',$8)
       RETURNING id, branch_id, name, description, schedule_type, schedule_day, start_date, end_date, status`,
      [
        branchId,
        payload.name,
        payload.description || null,
        String(payload.schedule_type).toUpperCase(),
        payload.schedule_day || null,
        payload.start_date,
        payload.end_date || null,
        user.id
      ]
    )

    const template = headerRes.rows[0]

    for (const line of lineResult.lines) {
      await client.query(
        `INSERT INTO recurring_journal_template_lines
          (template_id, line_no, account_id, debit, credit, memo)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [template.id, line.line_no, line.account_id, line.debit, line.credit, line.memo]
      )
    }

    await client.query('COMMIT')
    return template
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

const updateRecurringTemplateStatus = async (id, status, user) => {
  const role = String(user?.role || '').toLowerCase()
  if (!['superadmin', 'owner', 'manager'].includes(role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Hanya approver yang bisa pause/resume template')
  }

  const res = await db.query(
    `UPDATE recurring_journal_templates
     SET status=$2
     WHERE id=$1
     RETURNING id, status`,
    [id, status]
  )

  if (!res.rows.length) {
    throw new HttpError(404, 'NOT_FOUND', 'Recurring template tidak ditemukan')
  }

  return res.rows[0]
}

const isDueForDate = (template, dateObj) => {
  const scheduleType = String(template.schedule_type || '').toUpperCase()
  const day = Number(template.schedule_day || 1)
  if (scheduleType === 'MONTHLY') return dateObj.getUTCDate() === day
  if (scheduleType === 'WEEKLY') return dateObj.getUTCDay() === day
  return false
}

const generateRecurringRuns = async ({ date, dryRun = false }, user) => {
  const role = String(user?.role || '').toLowerCase()
  if (!['superadmin', 'owner', 'manager'].includes(role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Hanya approver yang bisa generate recurring runs')
  }

  const runDate = date ? new Date(`${date}T00:00:00.000Z`) : new Date()
  if (Number.isNaN(runDate.getTime())) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'date invalid')
  }
  const dateOnly = runDate.toISOString().slice(0, 10)
  const periodKey = dateOnly.slice(0, 7)

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const templateRes = await client.query(
      `SELECT *
       FROM recurring_journal_templates
       WHERE status='ACTIVE'
         AND start_date <= $1
         AND (end_date IS NULL OR end_date >= $1)
       ORDER BY id ASC`,
      [dateOnly]
    )

    let generated = 0
    let skippedExisting = 0

    for (const tpl of templateRes.rows) {
      if (!isDueForDate(tpl, runDate)) continue

      const effectivePeriodKey = String(tpl.schedule_type).toUpperCase() === 'WEEKLY'
        ? `${dateOnly}:W${Math.ceil(Number(dateOnly.slice(8, 10)) / 7)}`
        : periodKey

      const existing = await client.query(
        `SELECT id FROM recurring_journal_runs WHERE template_id=$1 AND period_key=$2 LIMIT 1`,
        [tpl.id, effectivePeriodKey]
      )

      if (existing.rows.length) {
        skippedExisting += 1
        continue
      }

      if (dryRun) {
        generated += 1
        continue
      }

      const lineRes = await client.query(
        `SELECT line_no, account_id, debit, credit, memo
         FROM recurring_journal_template_lines
         WHERE template_id=$1
         ORDER BY line_no ASC`,
        [tpl.id]
      )

      const totalDebit = normalizeAmount(lineRes.rows.reduce((sum, r) => sum + toNumber(r.debit), 0))
      const totalCredit = normalizeAmount(lineRes.rows.reduce((sum, r) => sum + toNumber(r.credit), 0))

      const headerRes = await client.query(
        `INSERT INTO manual_journal_headers
          (branch_id, journal_date, description, status, total_debit, total_credit, created_by)
         VALUES ($1,$2,$3,'DRAFT',$4,$5,$6)
         RETURNING id`,
        [
          tpl.branch_id,
          dateOnly,
          `Recurring: ${tpl.name}`,
          totalDebit,
          totalCredit,
          user.id
        ]
      )

      const generatedHeaderId = headerRes.rows[0].id

      for (const line of lineRes.rows) {
        await client.query(
          `INSERT INTO manual_journal_lines
            (header_id, line_no, account_id, debit, credit, memo)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [generatedHeaderId, line.line_no, line.account_id, line.debit, line.credit, line.memo]
        )
      }

      await client.query(
        `INSERT INTO recurring_journal_runs
          (template_id, period_key, run_date, generated_header_id, status)
         VALUES ($1,$2,$3,$4,'GENERATED')`,
        [tpl.id, effectivePeriodKey, dateOnly, generatedHeaderId]
      )

      generated += 1
    }

    await client.query('COMMIT')

    return {
      generated,
      skipped_existing: skippedExisting,
      errors: []
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

module.exports = {
  HttpError,
  ensureJournalEditable,
  createManualJournal,
  listManualJournals,
  getManualJournalDetail,
  transitionStatus,
  createRecurringTemplate,
  updateRecurringTemplateStatus,
  generateRecurringRuns
}
