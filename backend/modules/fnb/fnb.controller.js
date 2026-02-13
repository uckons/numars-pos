const service = require("./fnb.service")

exports.getAll = async (req, res) => {
  const db = req.app.get("db")
  const items = await service.getAll(db, req.user, req.query)
  res.json(items)
}

exports.create = async (req, res) => {
  try {
    const db = req.app.get("db")
    const item = await service.create(db, req.user, req.body)
    res.json(item)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.update = async (req, res) => {
  try {
    const db = req.app.get("db")
    const item = await service.update(db, req.params.id, req.body)
    res.json(item)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}


exports.requestStockAdjustment = async (req, res) => {
  try {
    const db = req.app.get("db")
    const request = await service.requestStockAdjustment(db, req.user, req.params.id, req.body)

    const io = req.app.get("io")
    if (io) {
      const room = (role) => `branch:${req.user.branch_id}:role:${String(role).toLowerCase().replace(/\s+/g, "-")}`
      io.to(room("Supervisor")).emit("fnb:stock:approval:new", request)
      io.to(room("Manager")).emit("fnb:stock:approval:new", request)
    }

    res.json(request)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.getStockAdjustmentRequests = async (req, res) => {
  try {
    const db = req.app.get("db")
    const items = await service.getStockAdjustmentRequests(db, req.user, req.query)
    res.json(items)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.approveStockAdjustment = async (req, res) => {
  try {
    const db = req.app.get("db")
    const item = await service.approveStockAdjustment(db, req.user, req.params.requestId)
    res.json(item)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

exports.rejectStockAdjustment = async (req, res) => {
  try {
    const db = req.app.get("db")
    const item = await service.rejectStockAdjustment(db, req.user, req.params.requestId, req.body)
    res.json(item)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}
