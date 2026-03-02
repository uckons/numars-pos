const service = require("./dashboard.service")

exports.kasir = async (req, res) => {
  const data = await service.kasir(req.user)
  res.json(data)
}

exports.kasirAnalytics = async (req, res) => {
  try {
    const data = await service.kasirAnalytics(req.user, req.query)
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.getTherapistFinanceConfig = async (req, res) => {
  try {
    const data = await service.getTherapistFinanceConfig(req.user, req.query)
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.saveTherapistFinanceConfig = async (req, res) => {
  try {
    const data = await service.saveTherapistFinanceConfig(req.user, req.body)
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}


exports.getOutletSessionStatus = async (req, res) => {
  try {
    const data = await service.getOutletSessionStatus(req.user)
    res.json(data || {})
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.openOutletSession = async (req, res) => {
  try {
    const data = await service.openOutletSession(req.user, req.body)
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.closeOutletSession = async (req, res) => {
  try {
    const data = await service.closeOutletSession(req.user, req.body)
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}
