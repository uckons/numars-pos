const db = require("../../config/db")
const wa = require("../whatsapp/whatsapp.service")

exports.deductStockByOrder = async (order_id) => {
  const items = await db.query(
    `SELECT oi.product_id, oi.qty, s.qty AS stock, s.min_qty, p.name
     FROM order_items oi
     JOIN stocks s ON s.product_id=oi.product_id
     JOIN products p ON p.id=oi.product_id
     WHERE oi.order_id=$1`,
    [order_id]
  )

  for (const i of items.rows) {
    const newQty = i.stock - i.qty

    await db.query(
      `UPDATE stocks SET qty=$1 WHERE product_id=$2`,
      [newQty, i.product_id]
    )

    // 🚨 ALERT
    if (newQty <= i.min_qty) {
      await wa.sendStockAlert({
        product: i.name,
        qty: newQty
      })
    }
  }
}

exports.reduceFnbStock = async (db, fnbItemId, qty) => {
  const { rows } = await db.query(
    `UPDATE fnb_items
     SET stock = stock - $1
     WHERE id=$2
     RETURNING *`,
    [qty, fnbItemId]
  )

  await db.query(
    `INSERT INTO stock_logs (fnb_item_id, qty_change)
     VALUES ($1,$2)`,
    [fnbItemId, -qty]
  )

  return rows[0]
}

exports.increaseFnbStock = async (db, fnbItemId, qty) => {
  const { rows } = await db.query(
    `UPDATE fnb_items
     SET stock = stock + $1
     WHERE id=$2
     RETURNING *`,
    [qty, fnbItemId]
  )

  await db.query(
    `INSERT INTO stock_logs (fnb_item_id, qty_change)
     VALUES ($1,$2)`,
    [fnbItemId, qty]
  )

  return rows[0]
}
