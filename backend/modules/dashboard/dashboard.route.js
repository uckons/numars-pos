const express = require("express")
const router = express.Router()
const auth = require("../../middlewares/auth.middleware")
const controller = require("./dashboard.controller")

router.get("/kasir", auth, controller.kasir)
router.get("/kasir/analytics", auth, controller.kasirAnalytics)
router.get('/therapist-finance-config', auth, controller.getTherapistFinanceConfig)
router.post('/therapist-finance-config', auth, controller.saveTherapistFinanceConfig)
router.get("/outlet-session/status", auth, controller.getOutletSessionStatus)
router.post("/outlet-session/open", auth, controller.openOutletSession)
router.post("/outlet-session/close", auth, controller.closeOutletSession)

module.exports = router
