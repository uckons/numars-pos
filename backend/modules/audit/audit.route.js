const router = require("express").Router()
const auth = require("../../middlewares/auth.middleware")
const rbac = require("../../middlewares/rbac.middleware")
const db = require("../../config/db")

router.get("/", auth, rbac(["SuperAdmin"]), async (req, res) => {
  const { user_id, from, to, action } = req.query
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(200, Math.max(10, Number(req.query.page_size) || 50))
  const offset = (page - 1) * pageSize

  let where = "1=1"
  const params = []

  if (user_id) {
    params.push(user_id)
    where += ` AND a.user_id = $${params.length}`
  }

  if (action) {
    params.push(`%${String(action).trim()}%`)
    where += ` AND a.action ILIKE $${params.length}`
  }

  if (from) {
    params.push(from)
    where += ` AND a.created_at >= $${params.length}`
  }

  if (to) {
    params.push(to)
    where += ` AND a.created_at <= $${params.length}`
  }

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM audit_logs a
    WHERE ${where}
  `

  const dataSql = `
    SELECT
      a.id,
      a.user_id,
      a.action,
      a.target,
      a.created_at,
      COALESCE(u.username, 'Unknown User') AS username,
      '-'::text AS role
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE ${where}
    ORDER BY a.created_at DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `

  const [countRes, dataRes] = await Promise.all([
    db.query(countSql, params),
    db.query(dataSql, [...params, pageSize, offset])
  ])

  const total = Number(countRes.rows[0]?.total || 0)

  res.json({
    data: dataRes.rows,
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize))
    }
  })
})

module.exports = router
