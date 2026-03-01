const service = require('./coa.service')

const handleError = (res, err) => {
  if (err instanceof service.HttpError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || undefined
      }
    })
  }

  console.error('[coa] unexpected error', err)
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal server'
    }
  })
}

exports.listCoa = async (req, res) => {
  try {
    const result = await service.listCoa(req.query || {})
    return res.json({ data: result })
  } catch (err) {
    return handleError(res, err)
  }
}

exports.createCoa = async (req, res) => {
  try {
    const result = await service.createCoa(req.body || {})
    return res.status(201).json(result)
  } catch (err) {
    return handleError(res, err)
  }
}

exports.updateCoa = async (req, res) => {
  try {
    const result = await service.updateCoa(req.params.id, req.body || {})
    return res.json(result)
  } catch (err) {
    return handleError(res, err)
  }
}
