const db = require("../../config/db")
const { getIO } = require("../../sockets/io")
const journalPostingService = require("../accounting/journal-posting.service")

exports.revertPayment = async (req, res) => {
  const { order_id, reason } = req.body
  const user = req.user
  const io = getIO()

  try {
    await db.query("BEGIN")

    await db.query(
      "UPDATE payments SET status='REVERTED' WHERE order_id=$1",
      [order_id]
    )

    const orderRes = await db.query(
      "UPDATE orders SET status='UNPAID' WHERE id=$1 RETURNING *",
      [order_id]
    )
    const order = orderRes.rows[0]

    const timers = await db.query(
      `UPDATE timers
       SET paused=true, end_time=NOW()
       WHERE order_id=$1
       RETURNING *`,
      [order_id]
    )

    await db.query(
      "DELETE FROM commissions WHERE order_id=$1",
      [order_id]
    )

    await db.query(
      `INSERT INTO payment_reverts
       (order_id, reason, reverted_by)
       VALUES ($1,$2,$3)`,
      [order_id, reason, user.id]
    )

    await journalPostingService.postAutoJournal({
      event_code: "POS_REVERT",
      variant: String(order?.payment_method || "CASH").toUpperCase(),
      amount: Number(order?.total || 0),
      branch_id: order?.branch_id || user?.branch_id || null,
      actor_id: user?.id || null,
      source_ref: `ORDER:${order_id}`,
      description: `Auto jurnal revert order #${order_id}`
    }, { client: db })

    await db.query("COMMIT")

    io.to(`branch-${order.branch_id}`).emit("payment:reverted", {
      order_id
    })

    timers.rows.forEach((t) => {
      io.to(`branch-${order.branch_id}`).emit("timer:stop", {
        id: t.id
      })
    })

    res.json({ message: "Payment reverted successfully" })
  } catch (err) {
    await db.query("ROLLBACK")
    console.error(err)
    res.status(500).json({ message: "Revert failed" })
  }
}
