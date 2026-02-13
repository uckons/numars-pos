const router = require("express").Router()
const auth = require("../../middlewares/auth.middleware")
const rbac = require("../../middlewares/rbac.middleware")
const audit = require("../../middlewares/audit.middleware")
const c = require("./superadmin.controller")

const allowAdminManager = rbac(["SuperAdmin", "Manager"])
const allowSuperAdminOnly = rbac(["SuperAdmin"])

router.use(auth)

/* ================= DASHBOARD ================= */
router.get("/dashboard", allowAdminManager, c.dashboard)

/* ================= USERS (SUPERADMIN ONLY) ================= */
router.post(
  "/users",
  allowSuperAdminOnly,
  audit("CREATE_USER"),
  c.createUser
)

router.put(
  "/users/:id/reset",
  allowSuperAdminOnly,
  audit("RESET_PASSWORD"),
  c.resetPassword
)

router.put(
  "/users/:id/toggle",
  allowSuperAdminOnly,
  audit("TOGGLE_USER"),
  c.toggleUser
)

router.post(
  "/users/:id/force-logout",
  allowSuperAdminOnly,
  audit("FORCE_LOGOUT"),
  c.forceLogout
)

/* ================= BRANCH ================= */
router.post(
  "/branches",
  allowAdminManager,
  audit("CREATE_BRANCH"),
  c.createBranch
)

/* ================= VIEW ================= */
router.get("/users", allowSuperAdminOnly, c.users)
router.get("/branches", allowAdminManager, c.branches)
router.get("/orders", allowAdminManager, c.orders)
router.get("/timers", allowAdminManager, c.timers)

router.get("/therapist-payroll", allowAdminManager, c.getTherapistPayrollSummary)
router.post("/therapist-payroll/settle", allowAdminManager, audit("THERAPIST_PAYROLL_SETTLE"), c.settleTherapistPayroll)
router.get("/audit-logs", allowSuperAdminOnly, c.auditLogs)

module.exports = router
