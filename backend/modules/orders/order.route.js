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

router.get(
  "/bar/inbox",
  auth,
  (req, res, next) => {
    if (!["Staff Bar", "Supervisor", "Manager", "SuperAdmin", "Owner"].includes(req.user.role)) {
      return res.status(403).json({ message: "Role not allowed" })
    }
    next()
  },
  controller.getBarInbox
)

router.post(
  "/bar/:barOrderId/accept",
  auth,
  (req, res, next) => {
    if (!["Staff Bar", "Supervisor", "Manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Role not allowed" })
    }
    next()
  },
  controller.acceptBarOrder
)

router.post(
  "/bar/:barOrderId/deliver",
  auth,
  (req, res, next) => {
    if (!["Staff Bar", "Supervisor", "Manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Role not allowed" })
    }
    next()
  },
  controller.deliverBarOrder
)


router.post(
  "/bar/:barOrderId/reprint",
  auth,
  (req, res, next) => {
    if (!["Staff Bar", "Supervisor", "Manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Role not allowed" })
    }
    next()
  },
  controller.reprintBarOrder
)

router.post(
  "/bar/:barOrderId/cancel",
  auth,
  (req, res, next) => {
    if (!["Staff Bar", "Supervisor", "Manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Role not allowed" })
    }
    next()
  },
  controller.cancelBarOrder
)


router.get(
  "/bar/messages",
  auth,
  (req, res, next) => {
    if (!["Kasir", "Supervisor", "Manager", "SuperAdmin", "Owner"].includes(req.user.role)) {
      return res.status(403).json({ message: "Role not allowed" })
    }
    next()
  },
  controller.getKasirBarMessages
)

router.post(
  "/:id/undo-void/request",
  auth,
  (req, res, next) => {
    if (!["Kasir"].includes(req.user.role)) {
      return res.status(403).json({ message: "Role not allowed" })
    }
    next()
  },
  controller.requestUndoVoid
)

router.get(
  "/undo-void/requests",
  auth,
  (req, res, next) => {
    if (!["Supervisor", "Manager", "Owner", "SuperAdmin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Role not allowed" })
    }
    next()
  },
  controller.getUndoVoidRequests
)

router.post(
  "/undo-void/requests/:requestId/approve",
  auth,
  (req, res, next) => {
    if (!["Supervisor", "Manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Role not allowed" })
    }
    next()
  },
  controller.approveUndoVoidRequest
)

router.post(
  "/undo-void/requests/:requestId/reject",
  auth,
  (req, res, next) => {
    if (!["Supervisor", "Manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Role not allowed" })
    }
    next()
  },
  controller.rejectUndoVoidRequest
)

router.post(
  "/pay-bulk",
  auth,
  (req, res, next) => {
    if (req.user.role !== "Kasir") {
      return res.status(403).json({ message: "Only cashier can pay multiple orders" })
    }
    next()
  },
  controller.payBulk
)

router.post(
  "/bar/messages/:messageId/read",
  auth,
  (req, res, next) => {
    if (!["Kasir", "Supervisor", "Manager", "SuperAdmin", "Owner"].includes(req.user.role)) {
      return res.status(403).json({ message: "Role not allowed" })
    }
    next()
  },
  controller.markKasirBarMessageRead
)


router.get(
  "/bulk-payments/history",
  auth,
  (req, res, next) => {
    if (req.user.role !== "Kasir") {
      return res.status(403).json({ message: "Only cashier can access bulk payment history" })
    }
    next()
  },
  controller.listBulkPaymentHistory
)

router.get(
  "/bulk-payments/:bulkId",
  auth,
  (req, res, next) => {
    if (req.user.role !== "Kasir") {
      return res.status(403).json({ message: "Only cashier can access bulk payment history" })
    }
    next()
  },
  controller.getBulkPaymentReceipt
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
