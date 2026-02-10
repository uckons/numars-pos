const express = require("express")
const router = express.Router()

const auth = require("../../middlewares/auth.middleware")
const controller = require("./order.controller")

router.get("/", auth, controller.getAll)
router.get("/kasir", auth, controller.getKasirOrders)
// CREATE FROM POS (static routes MUST be before "/:id" routes)
router.post(
  "/pos",
  auth,
  (req, res, next) => {
    if (req.user.role !== "Kasir") {
      return res.status(403).json({ message: "Only cashier can create POS order" })
    }
    next()
  },
  controller.createFromPos
)

router.post(
  "/pos/draft",
  auth,
  (req, res, next) => {
    if (req.user.role !== "Kasir") {
      return res.status(403).json({ message: "Only cashier can create POS order" })
    }
    next()
  },
  controller.createDraftFromPos
)

// CREATE EMPTY ORDER (kasir buka order)
router.post("/", auth, controller.create)

// 🖨️ GET ORDER DETAIL FOR REPRINT
router.get("/:id/detail", auth, controller.getOrderDetail)
// GET ORDER BY ID
router.get("/:id", auth, controller.getById)

// ADD ITEM TO ORDER
router.post("/:id/items", auth, controller.addItem)

// CLOSE / DRAFT / CANCEL ORDER
router.post("/:id/close", auth, controller.close)
router.post("/:id/draft", auth, controller.saveDraft)
router.post("/:id/undo-void", auth, controller.undoVoid)
router.delete("/:id", auth, controller.cancel)

module.exports = router
