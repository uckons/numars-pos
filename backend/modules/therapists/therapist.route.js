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

// 📋 GET SINGLE THERAPIST
router.get("/:id", auth, controller.getTherapist)

// ✅ CREATE THERAPIST
router.post("/", auth, controller.createTherapist)

// ✏️ UPDATE THERAPIST
router.put("/:id", auth, controller.updateTherapist)

// ❌ DELETE THERAPIST (soft delete)
router.delete("/:id", auth, controller.deleteTherapist)

module.exports = router