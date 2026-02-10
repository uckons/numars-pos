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
