const s = require("./superadmin.service")

exports.dashboard = async (req, res) => {
  res.json(await s.dashboard())
}

exports.users = async (req, res) => {
  res.json(await s.users())
}

exports.createUser = async (req, res) => {
  res.json(await s.createUser(req.body))
}

exports.toggleUser = async (req, res) => {
  await s.toggleUser(req.params.id)
  res.json({ success: true })
}

exports.resetPassword = async (req, res) => {
  await s.resetPassword(req.params.id)
  res.json({ success: true })
}

exports.branches = async (req, res) => {
  res.json(await s.branches())
}

exports.createBranch = async (req, res) => {
  res.json(await s.createBranch(req.body))
}

exports.orders = async (req, res) => {
  try {
    res.json(await s.orders())
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
}

exports.timers = async (req, res) => {
  res.json(await s.timers())
}

exports.revenueChart = async (req, res) => {
  res.json(await s.revenueChart())
}

exports.forceLogout = async (req, res) => {
  await s.forceLogout(req.params.id)
  res.json({ success: true })
}

exports.auditLogs = async (req, res) => {
  res.json(await s.auditLogs(req.query))
}

exports.getTherapistPayrollSummary = async (req, res) => {
  try {
    res.json(await s.getTherapistPayrollSummary(req.query))
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.settleTherapistPayroll = async (req, res) => {
  try {
    res.json(await s.settleTherapistPayroll(req.user, req.body))
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}
