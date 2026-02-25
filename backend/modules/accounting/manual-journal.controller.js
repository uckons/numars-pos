const service = require('./manual-journal.service')

const errorResponse = (res, err) => {
  if (err instanceof service.HttpError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || undefined
      }
    })
  }

  console.error('[manual-journal] unexpected error', err)
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal server'
    }
  })
}

exports.createManualJournal = async (req, res) => {
  try {
    const result = await service.createManualJournal(req.body || {}, req.user)
    return res.status(201).json({
      id: result.id,
      status: result.status,
      is_balanced: result.is_balanced
    })
  } catch (err) {
    return errorResponse(res, err)
  }
}

exports.listManualJournals = async (req, res) => {
  try {
    const result = await service.listManualJournals(req.query || {}, req.user)
    return res.json(result)
  } catch (err) {
    return errorResponse(res, err)
  }
}

exports.getManualJournalDetail = async (req, res) => {
  try {
    const result = await service.getManualJournalDetail(Number(req.params.id), req.user)
    return res.json(result)
  } catch (err) {
    return errorResponse(res, err)
  }
}

exports.submitManualJournal = async (req, res) => {
  try {
    const result = await service.transitionStatus({
      id: Number(req.params.id),
      user: req.user,
      action: 'SUBMIT',
      note: req.body?.note
    })

    return res.json(result)
  } catch (err) {
    return errorResponse(res, err)
  }
}

exports.approveManualJournal = async (req, res) => {
  try {
    const result = await service.transitionStatus({
      id: Number(req.params.id),
      user: req.user,
      action: 'APPROVE',
      note: req.body?.note
    })

    return res.json(result)
  } catch (err) {
    return errorResponse(res, err)
  }
}

exports.rejectManualJournal = async (req, res) => {
  try {
    const result = await service.transitionStatus({
      id: Number(req.params.id),
      user: req.user,
      action: 'REJECT',
      note: req.body?.note
    })

    return res.json(result)
  } catch (err) {
    return errorResponse(res, err)
  }
}

exports.createRecurringTemplate = async (req, res) => {
  try {
    const result = await service.createRecurringTemplate(req.body || {}, req.user)
    return res.status(201).json({ id: result.id, status: result.status })
  } catch (err) {
    return errorResponse(res, err)
  }
}

exports.pauseRecurringTemplate = async (req, res) => {
  try {
    const result = await service.updateRecurringTemplateStatus(Number(req.params.id), 'PAUSED', req.user)
    return res.json(result)
  } catch (err) {
    return errorResponse(res, err)
  }
}

exports.resumeRecurringTemplate = async (req, res) => {
  try {
    const result = await service.updateRecurringTemplateStatus(Number(req.params.id), 'ACTIVE', req.user)
    return res.json(result)
  } catch (err) {
    return errorResponse(res, err)
  }
}

exports.generateRecurringRuns = async (req, res) => {
  try {
    const dryRun = String(req.query.dry_run || 'false').toLowerCase() === 'true'
    const result = await service.generateRecurringRuns({
      date: req.query.date,
      dryRun
    }, req.user)

    return res.json(result)
  } catch (err) {
    return errorResponse(res, err)
  }
}
