const MAX_TARGET_LENGTH = 2000

const normalizeAuditTarget = (payload = {}) => {
  if (payload === null || payload === undefined) return null

  let text = ""
  if (typeof payload === "string") {
    text = payload
  } else {
    try {
      text = JSON.stringify(payload)
    } catch (err) {
      text = String(payload)
    }
  }

  if (text.length > MAX_TARGET_LENGTH) {
    return JSON.stringify({
      truncated: true,
      max_length: MAX_TARGET_LENGTH,
      preview: text.slice(0, MAX_TARGET_LENGTH)
    })
  }

  return text
}

const writeAuditLog = async (db, userId, action, payload = {}) => {
  if (!db || !userId || !action) return
  const target = normalizeAuditTarget(payload)

  await db.query(
    `INSERT INTO audit_logs (user_id, action, target)
     VALUES ($1, $2, $3)`,
    [userId, action, target]
  )
}

module.exports = {
  writeAuditLog,
  normalizeAuditTarget,
  MAX_TARGET_LENGTH
}
