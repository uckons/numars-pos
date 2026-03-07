const express = require("express")
const cors = require("cors")

require("dotenv").config()
const db = require("./config/db")   // ✅ TAMBAH INI
const app = express()

app.use(cors())
app.use(express.json())
app.set("db", db)                   // ✅ TAMBAH INI (PENTING)
// 🔹 HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" })
})

// 🔹 ROUTES (PASTIKAN SEMUA EXPORT ROUTER)
app.use("/api/auth", require("./modules/auth/auth.route"))
//app.use("/api/users", require("./modules/users/user.route"))
app.use("/api/orders", require("./modules/orders/order.route"))
//app.use("/api/pos/orders", require("./modules/pos/order.route"))
//app.use("/api/reports", require("./modules/reports/report.route"))
app.use("/api/timers", require("./modules/timers/timer.route"))
app.use("/api/revert-payment", require("./modules/revert-payment/revert.route"))
app.use("/api/printers", require("./modules/printers/printer.route"))
app.use("/api/superadmin", require("./modules/superadmin/superadmin.route"))
app.use("/api/users", require("./modules/users/user.route"))
app.use("/api/roles", require("./modules/roles/role.route"))
app.use("/api/branches", require("./modules/branches/branch.route"))
app.use("/api/audit-logs", require("./modules/audit/audit.route"))
app.use("/api/services", require("./modules/services/service.route"))
// THERAPISTS ROUTES
app.use("/api/therapists", require("./modules/therapists/therapist.route"))
app.use("/api/grades", require("./modules/therapists/grade.route"))
app.use("/api/rooms", require("./modules/rooms/room.route"))
app.use("/api/dashboard", require("./modules/dashboard/dashboard.route"))
app.use("/api/happy-hours", require("./modules/happy-hours/happy-hour.route"))
app.use("/api/accounting", require("./modules/accounting/accounting.route"))
app.use("/api/memberships", require("./modules/memberships/membership.route"))

require("./modules/fnb/fnb.route")(app)
//app.use("/api/fnb",require("./modules/fnb/fnb.route"))

// ❗ JANGAN load module yang belum siap
// app.use("/api/payments", require("./modules/payments/payment.route"))
// app.use("/api/timers", require("./modules/timers/timer.route"))
// app.use("/api/commissions", require("./modules/commissions/commission.route"))

module.exports = app
