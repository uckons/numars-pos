const printerService = require("./printer.service")
const printerTargetService = require("./printer-target.service")


const ensureOrderPaymentColumns = async (db) => {
  await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0`)
  await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12,2) DEFAULT 0`)
  await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS change_amount NUMERIC(12,2) DEFAULT 0`)
}

exports.printOrder = async (req, res) => {
  try {
    const db = req.app.get("db")
    await ensureOrderPaymentColumns(db)
    const { order_id, printer } = req.body

    if (!order_id) {
      return res.status(400).json({ message: "order_id required" })
    }

    // 🔹 ambil order (detail lengkap untuk layout receipt enterprise)
    const orderRes = await db.query(
      `
      SELECT
        o.id,
        o.total,
        o.payment_method,
        o.discount_amount,
        o.payment_amount,
        o.change_amount,
        o.created_at,
        b.name AS branch_name,
        b.address AS branch_address,
        b.phone AS branch_phone,
        b.logo_url AS branch_logo_url,
        u.name AS cashier_name,
        r.name AS room_name,
        ot.therapist_name
      FROM orders o
      LEFT JOIN branches b ON b.id = o.branch_id
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN rooms r ON r.id = o.room_id
      LEFT JOIN LATERAL (
        SELECT string_agg(DISTINCT oi2.therapist_name, ', ' ORDER BY oi2.therapist_name) AS therapist_name
        FROM order_items oi2
        WHERE oi2.order_id = o.id
          AND oi2.therapist_name IS NOT NULL
          AND oi2.therapist_name <> ''
      ) ot ON true
      WHERE o.id = $1
      `,
      [order_id]
    )

    if (!orderRes.rows.length) {
      return res.status(404).json({ message: "Order not found" })
    }

    const order = orderRes.rows[0]

    // 🔹 ambil items
    const itemsRes = await db.query(
      `
      SELECT service_name, qty, subtotal, therapist_name
      FROM order_items
      WHERE order_id = $1
      `,
      [order_id]
    )

    order.items = itemsRes.rows
    order.discount_amount = Number(order.discount_amount || 0)
    order.payment_amount = Number(order.payment_amount || order.total || 0)
    order.change_amount = Number(order.change_amount || 0)
    order.subtotal = Math.max(0, Number(order.total || 0) + Number(order.discount_amount || 0))

    const target = await printerTargetService.getResolvedPrinterTarget({
      db,
      branchId: req.user?.branch_id,
      channel: printerTargetService.CHANNELS.POS_RECEIPT
    })

    const effectivePrinter = target
      ? {
          ...(printer || {}),
          agent_url: target.agent_url,
          agent_token: target.agent_token || (printer || {}).agent_token,
          agent_printer_name: target.agent_printer_name || (printer || {}).agent_printer_name
        }
      : (printer || {})

    // 🔹 PRINT
    await printerService.printOrder({ order, printer: effectivePrinter })

    res.json({ success: true })
  } catch (err) {
    console.error("PRINT ERROR:", err)
    res.status(500).json({
      message: err.message,
      hint: "Cek koneksi VPS -> print agent. Gunakan endpoint /api/printers/test-agent untuk diagnosa cepat."
    })
  }
}


exports.testAgent = async (req, res) => {
  try {
    const printer = req.body?.printer || {}
    const agentUrl = printer.agent_url || process.env.PRINT_AGENT_URL
    const token = printer.agent_token || process.env.PRINT_AGENT_TOKEN

    const result = await printerService.testAgentConnection({
      agentUrl,
      token
    })

    res.json(result)
  } catch (err) {
    console.error("AGENT TEST ERROR:", err)
    res.status(500).json({
      message: err.message,
      hint: "Pastikan PRINT_AGENT_URL mengarah ke IP WireGuard kasir dan endpoint /health bisa diakses dari VPS."
    })
  }
}


exports.testAgentPrint = async (req, res) => {
  try {
    const printer = req.body?.printer || {}
    const agentUrl = printer.agent_url || process.env.PRINT_AGENT_URL
    const token = printer.agent_token || process.env.PRINT_AGENT_TOKEN
    const printerName = printer.agent_printer_name || process.env.PRINT_AGENT_PRINTER

    const result = await printerService.testAgentPrint({
      agentUrl,
      token,
      printerName
    })

    res.json(result)
  } catch (err) {
    console.error("AGENT TEST PRINT ERROR:", err)
    res.status(500).json({
      message: err.message,
      hint: "Gunakan /api/printers/test-agent untuk cek konektivitas dan /printers endpoint di agent untuk cek nama printer."
    })
  }
}

exports.agentDiagnostics = async (req, res) => {
  try {
    const printer = req.body?.printer || {}
    const agentUrl = printer.agent_url || process.env.PRINT_AGENT_URL
    const token = printer.agent_token || process.env.PRINT_AGENT_TOKEN

    const result = await printerService.getAgentDiagnostics({
      agentUrl,
      token
    })

    res.json(result)
  } catch (err) {
    console.error("AGENT DIAGNOSTICS ERROR:", err)
    res.status(500).json({
      message: err.message,
      hint: "Pastikan endpoint /health dan /printers di print agent bisa diakses dari VPS."
    })
  }
}



exports.printBulk = async (req, res) => {
  try {
    const db = req.app.get("db")
    await ensureOrderPaymentColumns(db)
    const { order_ids, payment_method, printer } = req.body || {}

    const ids = Array.isArray(order_ids)
      ? [...new Set(order_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
      : []

    if (!ids.length) {
      return res.status(400).json({ message: "order_ids required" })
    }

    const ordersRes = await db.query(
      `SELECT
         o.id,
         o.total,
         o.discount_amount,
         o.payment_amount,
         o.change_amount,
         o.created_at,
         b.name AS branch_name,
         b.address AS branch_address,
         b.phone AS branch_phone,
         b.logo_url AS branch_logo_url,
         u.name AS cashier_name
       FROM orders o
       LEFT JOIN branches b ON b.id = o.branch_id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = ANY($1::int[])
         AND o.branch_id = $2
       ORDER BY o.id`,
      [ids, req.user.branch_id]
    )

    if (!ordersRes.rows.length) {
      return res.status(404).json({ message: "Order tidak ditemukan" })
    }

    if (ordersRes.rows.length !== ids.length) {
      return res.status(400).json({ message: "Sebagian order tidak ditemukan atau bukan milik branch ini" })
    }

    const itemsRes = await db.query(
      `SELECT order_id, service_name, qty, subtotal, therapist_name
       FROM order_items
       WHERE order_id = ANY($1::int[])
       ORDER BY order_id, id`,
      [ids]
    )

    const items = itemsRes.rows.map((item) => ({
      service_name: `[#${item.order_id}] ${item.service_name}`,
      qty: Number(item.qty || 0),
      subtotal: Number(item.subtotal || 0),
      therapist_name: item.therapist_name || null
    }))

    const firstOrder = ordersRes.rows[0]
    const total = ordersRes.rows.reduce((sum, row) => sum + Number(row.total || 0), 0)
    const discountAmount = ordersRes.rows.reduce((sum, row) => sum + Number(row.discount_amount || 0), 0)
    const paymentAmount = Number(total)

    const target = await printerTargetService.getResolvedPrinterTarget({
      db,
      branchId: req.user?.branch_id,
      channel: printerTargetService.CHANNELS.POS_RECEIPT
    })

    const effectivePrinter = target
      ? {
          ...(printer || {}),
          agent_url: target.agent_url,
          agent_token: target.agent_token || (printer || {}).agent_token,
          agent_printer_name: target.agent_printer_name || (printer || {}).agent_printer_name
        }
      : (printer || {})

    await printerService.printBulkPayment({
      bulk: {
        branch_name: firstOrder?.branch_name || null,
        branch_address: firstOrder?.branch_address || null,
        branch_phone: firstOrder?.branch_phone || null,
        branch_logo_url: firstOrder?.branch_logo_url || null,
        cashier_name: firstOrder?.cashier_name || null,
        created_at: new Date(),
        order_ids: ids,
        payment_method: String(payment_method || 'CASH').toUpperCase(),
        subtotal: total + discountAmount,
        discount_amount: discountAmount,
        payment_amount: paymentAmount,
        change_amount: Math.max(0, paymentAmount - total),
        total,
        items
      },
      printer: effectivePrinter
    })

    res.json({ success: true })
  } catch (err) {
    console.error("PRINT BULK ERROR:", err)
    res.status(500).json({
      message: err.message,
      hint: "Pastikan PRINT_AGENT_URL aktif dan bisa diakses dari backend."
    })
  }
}

exports.printRecap = async (req, res) => {
  try {
    const db = req.app.get("db")
    const { report, printer } = req.body || {}

    if (!report || !Array.isArray(report.service_details)) {
      return res.status(400).json({ message: "report.service_details required" })
    }

    const target = await printerTargetService.getResolvedPrinterTarget({
      db,
      branchId: req.user?.branch_id,
      channel: printerTargetService.CHANNELS.POS_RECAP
    })

    const effectivePrinter = target
      ? {
          ...(printer || {}),
          agent_url: target.agent_url,
          agent_token: target.agent_token || (printer || {}).agent_token,
          agent_printer_name: target.agent_printer_name || (printer || {}).agent_printer_name
        }
      : (printer || {})

    await printerService.printRecap({ report, printer: effectivePrinter })

    res.json({ success: true })
  } catch (err) {
    console.error("PRINT RECAP ERROR:", err)
    res.status(500).json({
      message: err.message,
      hint: "Pastikan PRINT_AGENT_URL aktif dan bisa diakses dari backend."
    })
  }
}
