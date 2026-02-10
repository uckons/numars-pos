const express = require("express")
const router = express.Router()
const auth = require("../../middlewares/auth.middleware")
const controller = require("./dashboard.controller")

router.get("/kasir", auth, controller.kasir)
router.get("/kasir/analytics", auth, controller.kasirAnalytics)

module.exports = router
