const express = require("express")
const router = express.Router()
const c = require("./accounting.controller")
const auth = require("../../middlewares/auth.middleware")
const rbac = require("../../middlewares/rbac.middleware")
const manualJournalRoute = require("./manual-journal.route")
const payrollFlexRoute = require('./payroll-flex.route')
const coaRoute = require('./coa.route')

router.get("/cash-flow", auth, rbac(["Owner","Manager","SuperAdmin"]), c.cashFlow)
router.get("/profit-loss", auth, rbac(["Owner","Manager","SuperAdmin"]), c.profitLoss)

router.use(manualJournalRoute)
router.use(payrollFlexRoute)
router.use(coaRoute)

module.exports = router
