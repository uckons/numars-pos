const db = require("../config/db")
const { writeAuditLog: writeAuditEntry } = require("../utils/audit")

module.exports = (action) => {
  return async (req, res, next) => {
    try {
      await writeAuditEntry(db, req.user?.id, action, {
        method: req.method,
        path: req.originalUrl
      })
    } catch (e) {
      console.error("Audit log error:", e.message)
    }
    next()
  }
}
