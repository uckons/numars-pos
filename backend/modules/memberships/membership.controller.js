const service = require('./membership.service')

exports.getConfig = async (req, res) => {
  try {
    const db = req.app.get('db')
    const data = await service.getConfig(db, req.user, req.query)
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.saveConfig = async (req, res) => {
  try {
    const db = req.app.get('db')
    const data = await service.saveConfig(db, req.user, req.body)
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.listPlans = async (req, res) => {
  try {
    const db = req.app.get('db')
    const data = await service.listPlans(db, req.user, req.query)
    res.json({ data })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.savePlan = async (req, res) => {
  try {
    const db = req.app.get('db')
    const data = await service.savePlan(db, req.user, req.body)
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.listMembers = async (req, res) => {
  try {
    const db = req.app.get('db')
    const data = await service.listMembers(db, req.user, req.query)
    res.json({ data })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.createMember = async (req, res) => {
  try {
    const db = req.app.get('db')
    const data = await service.createMember(db, req.user, req.body)
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.validateDiscount = async (req, res) => {
  try {
    const db = req.app.get('db')
    const data = await service.computeMembershipDiscount(db, { ...req.body, branch_id: req.body?.branch_id || req.user?.branch_id })
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.reportSummary = async (req, res) => {
  try {
    const db = req.app.get('db')
    const data = await service.getReports(db, req.user, req.query)
    res.json(data)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}
