const service = require('./payroll-flex.service')

const fail = (res, err) => {
  const message = err?.message || 'Internal server error'
  res.status(400).json({ error: { message } })
}

exports.getModels = async (_req, res) => {
  try {
    const formulas = await service.getActiveFormulas()
    res.json({ data: formulas })
  } catch (err) {
    fail(res, err)
  }
}

exports.updateFormula = async (req, res) => {
  try {
    const { model_key } = req.params
    const { expression } = req.body || {}
    const actorId = req.user?.id || null
    const updated = await service.updateFormula(actorId, model_key, expression)
    res.json({ message: 'Formula berhasil diperbarui', data: updated })
  } catch (err) {
    fail(res, err)
  }
}

exports.previewPayroll = async (req, res) => {
  try {
    const result = await service.previewPayroll(req.body || {})
    res.json({ data: result })
  } catch (err) {
    fail(res, err)
  }
}
