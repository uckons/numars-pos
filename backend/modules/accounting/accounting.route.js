const express = require("express")
const router = express.Router()
const c = require("./accounting.controller")
const auth = require("../../middlewares/auth.middleware")
const rbac = require("../../middlewares/rbac.middleware")
const manualJournalRoute = require("./manual-journal.route")

router.get("/cash-flow", auth, rbac(["Owner","Manager"]), c.cashFlow)
router.get("/profit-loss", auth, rbac(["Owner","Manager"]), c.profitLoss)

router.use(manualJournalRoute)

module.exports = router
