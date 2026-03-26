const router = require("express").Router()
const c = require("./branch.controller")
const auth = require("../../middlewares/auth.middleware")
const rbac = require("../../middlewares/rbac.middleware")

router.use(auth)

router.get("/", rbac(["SuperAdmin", "Manager"]), c.list)
router.get("/search", rbac(["SuperAdmin", "Manager"]), c.search)
router.get("/stats", rbac(["SuperAdmin", "Manager"]), c.stats)
router.post("/", rbac(["SuperAdmin"]), c.create)
router.put("/:id", rbac(["SuperAdmin", "Manager"]), c.update)
router.put("/:id/toggle", rbac(["SuperAdmin"]), c.toggle)

module.exports = router
