const service = require("./branch.service")

exports.list = async (req, res) => {
  try {
    const result = await service.list(req.user)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({
  message: "Failed load branches",
  error: err.message,
  stack: err.stack
})
  }
}

exports.search = async (req, res) => {
  try {
    const result = await service.search(req.user, req.query)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({
  message: "Failed load branches",
  error: err.message,
  stack: err.stack
})
  }
}

exports.stats = async (req, res) => {
  try {
    const result = await service.stats(req.user)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({
  message: "Failed load branches",
  error: err.message,
  stack: err.stack
})

  }
}

exports.create = async (req, res) => {
  try {
    await service.create(req.body)
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

exports.update = async (req, res) => {
  try {
    const userRole = String(req.user?.role || '').toLowerCase().replace(/\s+/g, '')
    const isManager = userRole === 'manager'
    const targetBranchId = Number(req.params.id)
    const userBranchId = Number(req.user?.branch_id || 0)

    if (isManager && (!targetBranchId || targetBranchId !== userBranchId)) {
      return res.status(403).json({ message: "Manager hanya bisa update jam outlet branch sendiri" })
    }

    await service.update(req.params.id, req.body)
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}

exports.toggle = async (req, res) => {
  try {
    await service.toggle(req.params.id)
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(400).json({ message: err.message })
  }
}
