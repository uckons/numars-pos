const express = require("express")
const router = express.Router()
const controller = require("./therapist.controller")
const auth = require("../../middlewares/auth.middleware")

// ===== THERAPISTS ROUTES =====
// 📋 GET ALL THERAPISTS
router.get("/", auth, controller.getTherapists)

// 🕒 THERAPIST ATTENDANCE (Kasir)
router.get("/attendance", auth, controller.getTherapistAttendance)
router.post("/attendance/:id", auth, controller.setTherapistAttendance)
router.post('/attendance/:id/salon-usage', auth, controller.setTherapistSalonUsage)
router.get('/attendance/salon-usage/summary', auth, controller.getTherapistSalonUsageSummary)


// 👥 AGENT PROFILES
router.get('/agent-profiles', auth, controller.getAgentProfiles)
router.post('/agent-profiles', auth, controller.createAgentProfile)
router.put('/agent-profiles/:id', auth, controller.updateAgentProfile)

// 📋 GET SINGLE THERAPIST
router.get("/:id", auth, controller.getTherapist)

// ✅ CREATE THERAPIST
router.post("/", auth, controller.createTherapist)

// ✏️ UPDATE THERAPIST
router.put("/:id", auth, controller.updateTherapist)

// ❌ DELETE THERAPIST (soft delete)
router.delete("/:id", auth, controller.deleteTherapist)

module.exports = router
