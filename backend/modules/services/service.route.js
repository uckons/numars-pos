const express = require("express")
const router = express.Router()

const auth = require("../../middlewares/auth.middleware")
const controller = require("./service.controller")

router.get("/", auth, controller.list)
router.get("/by-type", auth, controller.getByType)
router.post("/", auth, controller.create)
router.put("/:id", auth, controller.update)
router.delete("/:id", auth, controller.remove)
router.put("/:id/toggle",auth, controller.toggleStatus)
module.exports = router
