const axios = require("axios")
const escpos = require("escpos")
escpos.USB = require("escpos-usb")

const THERMAL_PROFILE = {
  lineFeedMode: "LF",
  maxDots: 128,
  font: "A_12x24",
  codePage: 0, // CP437
  heatTimeUs: 550,
  heatIntervalUs: 20
}

const toHeatTimeUnit = (microseconds) => {
  const units = Math.round(Number(microseconds || 0) / 10)
  return Math.max(3, Math.min(255, units))
}

const toHeatIntervalUnit = (microseconds) => {
  const units = Math.round(Number(microseconds || 0) / 10)
  return Math.max(0, Math.min(255, units))
}


const formatReceiptDateTime = (value) => {
  try {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null

    const datePart = date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })
    const timePart = date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).replace('.', ':')

    return `${datePart}, ${timePart}`
  } catch {
    return null
  }
}

const formatReceiptTime = (value = new Date()) => {
  try {
    const date = new Date(value)
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).replace('.', ':')
  } catch {
    return "00:00"
  }
}

const buildReceiptPayload = (order, options = {}) => ({
  profile: THERMAL_PROFILE,
  printer_name: options.printerName || null,
  receipt: {
    title: order.branch_name || "NUMARS POS",
    divider: "------------------------",
    order_id: Number(order.id || 0),
    created_at: formatReceiptDateTime(order.created_at),
    branch_name: order.branch_name || null,
    branch_address: order.branch_address || null,
    branch_phone: order.branch_phone || null,
    branch_logo_url: order.branch_logo_url || null,
    cashier_name: order.cashier_name || null,
    room_name: order.room_name || null,
    therapist_name: order.therapist_name || null,
    guest_name: order.guest_name || null,
    membership_card_no: order.membership_card_no || null,
    payment_method: order.payment_method || "CASH",
    subtotal: Number(order.subtotal || (Number(order.total || 0) + Number(order.discount_amount || 0))),
    discount_amount: Number(order.discount_amount || 0),
    payment_amount: Number(order.payment_amount || order.total || 0),
    change_amount: Number(order.change_amount || 0),
    items: (order.items || []).map((item) => ({
      service_name: item.service_name,
      qty: Number(item.qty || 0),
      subtotal: Number(item.subtotal || 0),
      therapist_name: item.therapist_name || null
    })),
    total: Number(order.total || 0),
    printed_at: formatReceiptTime()
  }
})

const buildBulkPaymentPayload = (bulk, options = {}) => ({
  profile: THERMAL_PROFILE,
  printer_name: options.printerName || null,
  receipt: {
    title: 'PEMBAYARAN GABUNGAN',
    divider: '------------------------',
    order_id: 0,
    created_at: formatReceiptDateTime(bulk.created_at || new Date()),
    branch_name: bulk.branch_name || null,
    branch_address: bulk.branch_address || null,
    branch_phone: bulk.branch_phone || null,
    branch_logo_url: bulk.branch_logo_url || null,
    cashier_name: bulk.cashier_name || null,
    room_name: null,
    therapist_name: null,
    note: Array.isArray(bulk.order_ids) && bulk.order_ids.length
      ? `Order: ${bulk.order_ids.map((id) => `#${id}`).join(', ')}`
      : null,
    payment_method: bulk.payment_method || 'CASH',
    subtotal: Number(bulk.subtotal || bulk.total || 0),
    discount_amount: Number(bulk.discount_amount || 0),
    payment_amount: Number(bulk.payment_amount || bulk.total || 0),
    change_amount: Number(bulk.change_amount || 0),
    items: (bulk.items || []).map((item) => ({
      service_name: item.service_name,
      qty: Number(item.qty || 0),
      subtotal: Number(item.subtotal || 0),
      therapist_name: item.therapist_name || null
    })),
    total: Number(bulk.total || 0),
    printed_at: formatReceiptTime()
  }
})



const buildBarInboxPayload = (ticket = {}, options = {}) => {
  const createdAt = ticket.created_at ? formatReceiptDateTime(ticket.created_at) : formatReceiptDateTime(new Date())
  const sourceLabel = String(ticket.source || 'BAR INBOX').trim().toUpperCase()

  return {
    profile: THERMAL_PROFILE,
    printer_name: options.printerName || null,
    receipt: {
      title: 'BAR ORDER TICKET',
      divider: '------------------------',
      order_id: Number(ticket.order_id || 0),
      created_at: createdAt,
      branch_name: ticket.branch_name || 'BAR',
      branch_address: null,
      branch_phone: null,
      branch_logo_url: null,
      cashier_name: sourceLabel,
      room_name: null,
      therapist_name: ticket.therapist_name || null,
      note: ticket.note || null,
      payment_method: 'BAR',
      subtotal: 0,
      discount_amount: 0,
      payment_amount: 0,
      change_amount: 0,
      items: (ticket.items || []).map((item) => ({
        service_name: item.service_name,
        qty: Number(item.qty || 0),
        subtotal: 0,
        therapist_name: null
      })),
      total: 0,
      printed_at: formatReceiptTime()
    }
  }
}

const normalizeCategory = (category) => {
  const upper = String(category || '').trim().toUpperCase()
  if (upper === 'KARAOKE') return 'KTV'
  return upper || 'LAINNYA'
}

const buildRecapPayload = (report, options = {}) => {
  const serviceRows = Array.isArray(report.service_details) ? report.service_details : []
  const items = serviceRows
    .map((row) => {
      const category = normalizeCategory(row.category)
      return {
        category,
        service_name: String(row.service_name || '-').trim(),
        qty: Number(row.qty || 0),
        subtotal: Number(row.revenue || 0)
      }
    })
    .filter((row) => row.qty > 0)

  return {
    profile: THERMAL_PROFILE,
    printer_name: options.printerName || null,
    receipt: {
      title: 'RECAP LAPORAN PENDAPATAN',
      divider: '------------------------',
      order_id: Number(report.summary?.paid_orders || 0),
      created_at: report.range ? `${report.range.from || '-'} - ${report.range.to || '-'}` : null,
      branch_name: report.branch_name || report.outlet_name || 'SKY ePOS',
      branch_address: null,
      branch_phone: null,
      branch_logo_url: null,
      cashier_name: null,
      room_name: null,
      therapist_name: null,
      payment_method: 'CASH',
      payment_amount: 0,
      change_amount: 0,
      items,
      total: Number(report.summary?.revenue || 0),
      printed_at: formatReceiptTime()
    }
  }
}

const printViaUsb = async (order) => {
  const device = new escpos.USB()
  const printer = new escpos.Printer(device)

  return new Promise((resolve, reject) => {
    device.open((err) => {
      if (err) return reject(err)

      printer
        .raw(Buffer.from([0x1b, 0x40])) // ESC @ Initialize
        .raw(Buffer.from([
          0x1b,
          0x37,
          Math.max(0, Math.min(255, THERMAL_PROFILE.maxDots - 1)),
          toHeatTimeUnit(THERMAL_PROFILE.heatTimeUs),
          toHeatIntervalUnit(THERMAL_PROFILE.heatIntervalUs)
        ]))
        .raw(Buffer.from([0x1b, 0x74, THERMAL_PROFILE.codePage]))
        .raw(Buffer.from([0x1b, 0x21, 0x00]))
        .raw(Buffer.from([0x1b, 0x20, 0x00]))
        .raw(Buffer.from([0x1b, 0x33, 30]))
        .align("CT")
        .size(1, 1)
        .text("NUMARS POS")
        .text("------------------------")
        .align("LT")

      ;(order.items || []).forEach((item) => {
        printer.text(`${item.service_name} x${item.qty}`)
        if (item.therapist_name) {
          printer.text(`  Terapis: ${item.therapist_name}`)
        }
        printer.text(`Rp ${Number(item.subtotal).toLocaleString("id-ID")}`)
      })

      printer
        .text("------------------------")
        .style("B")
        .text(`TOTAL : Rp ${Number(order.total).toLocaleString("id-ID")}`)
        .text("")
        .text(new Date().toLocaleString("id-ID"))
        .cut()
        .raw(Buffer.from([0x0a]))
        .close()

      resolve({ mode: "usb" })
    })
  })
}

async function sendReceiptToAgent ({ payload, agentUrl, token }) {
  const headers = token ? { "x-print-agent-token": token } : {}
  const timeoutMs = Number(process.env.PRINT_AGENT_TIMEOUT_MS || 45000)
  const endpoint = `${agentUrl.replace(/\/$/, "")}/print/receipt`

  const runPost = async (body) => axios.post(endpoint, body, {
    headers,
    timeout: timeoutMs
  })

  try {
    await runPost(payload)
  } catch (err) {
    const detailText = err.response?.data
      ? JSON.stringify(err.response.data)
      : String(err.code || err.message || '')

    const printerMissing = /cannot\s*find\s*printer|printer\s*not\s*found|no\s*printer/i.test(detailText)
    const configuredPrinterName = String(payload?.printer_name || '').trim()
    if (printerMissing && configuredPrinterName) {
      const retryPayload = { ...payload, printer_name: null }
      try {
        await runPost(retryPayload)
        return { mode: "agent", agent_url: agentUrl, fallback_printer_name: true }
      } catch (retryErr) {
        const retryDetail = retryErr.response?.data
          ? JSON.stringify(retryErr.response.data)
          : (retryErr.code || retryErr.message)
        throw new Error(`Gagal terhubung ke print agent (${endpoint}) setelah fallback default printer: ${retryDetail}`)
      }
    }
    throw new Error(`Gagal terhubung ke print agent (${endpoint}): ${detailText}`)
  }

  return { mode: "agent", agent_url: agentUrl }
}

async function printViaAgent ({ order, agentUrl, token, printerName }) {
  const payload = buildReceiptPayload(order, { printerName })
  return sendReceiptToAgent({ payload, agentUrl, token })
}

async function printRecapViaAgent ({ report, agentUrl, token, printerName }) {
  const payload = buildRecapPayload(report, { printerName })
  return sendReceiptToAgent({ payload, agentUrl, token })
}



const buildReceiptPlainText = (order) => {
  const lines = []
  lines.push("NUMARS POS")
  lines.push("------------------------")

  ;(order.items || []).forEach((item) => {
    lines.push(`${item.service_name} x${item.qty}`)
    if (item.therapist_name) {
      lines.push(`  Terapis: ${item.therapist_name}`)
    }
    lines.push(`Rp ${Number(item.subtotal).toLocaleString("id-ID")}`)
  })

  lines.push("------------------------")
  lines.push(`TOTAL : Rp ${Number(order.total || 0).toLocaleString("id-ID")}`)
  lines.push("")
  lines.push(new Date().toLocaleString("id-ID"))

  // GS V 0 (full cut) at the end
  return `${lines.join("\n")}\n\n\x1dV\x00`
}

async function printViaPrintNode ({ order, apiKey, printerId }) {
  if (!apiKey) {
    throw new Error("PRINTNODE_API_KEY belum di-set")
  }
  if (!printerId) {
    throw new Error("PRINTNODE_PRINTER_ID belum di-set")
  }

  const raw = buildReceiptPlainText(order)
  const content = Buffer.from(raw, "binary").toString("base64")
  const auth = Buffer.from(`${apiKey}:`).toString("base64")

  await axios.post(
    "https://api.printnode.com/printjobs",
    {
      printerId: Number(printerId),
      title: `NUMARS POS ${order.id || ""}`.trim(),
      contentType: "raw_base64",
      content,
      source: "numars-pos"
    },
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      timeout: 15000
    }
  )

  return { mode: "printnode", printer_id: Number(printerId) }
}

exports.printOrder = async ({ order, printer = {} }) => {
  const printMode = printer.mode || process.env.PRINT_PROVIDER || "agent_or_usb"

  if (printMode === "printnode") {
    return printViaPrintNode({
      order,
      apiKey: printer.printnode_api_key || process.env.PRINTNODE_API_KEY,
      printerId: printer.printnode_printer_id || process.env.PRINTNODE_PRINTER_ID
    })
  }

  const envAgentUrl = process.env.PRINT_AGENT_URL
  const agentUrl = printer.agent_url || envAgentUrl

  if (agentUrl) {
    return printViaAgent({
      order,
      agentUrl,
      token: printer.agent_token || process.env.PRINT_AGENT_TOKEN,
      printerName: printer.agent_printer_name || process.env.PRINT_AGENT_PRINTER
    })
  }

  return printViaUsb(order)
}


exports.printRecap = async ({ report, printer = {} }) => {
  const envAgentUrl = process.env.PRINT_AGENT_URL
  const agentUrl = printer.agent_url || envAgentUrl

  if (!agentUrl) {
    throw new Error("PRINT_AGENT_URL belum di-set untuk cetak recap POS")
  }

  return printRecapViaAgent({
    report,
    agentUrl,
    token: printer.agent_token || process.env.PRINT_AGENT_TOKEN,
    printerName: printer.agent_printer_name || process.env.PRINT_AGENT_PRINTER
  })
}


exports.testAgentConnection = async ({ agentUrl, token }) => {
  if (!agentUrl) {
    throw new Error("PRINT_AGENT_URL belum di-set")
  }

  const headers = token ? { "x-print-agent-token": token } : {}
  const timeoutMs = Number(process.env.PRINT_AGENT_TIMEOUT_MS || 45000)
  const base = agentUrl.replace(/\/$/, "")

  try {
    const health = await axios.get(`${base}/health`, {
      headers,
      timeout: timeoutMs
    })
    return {
      ok: true,
      endpoint: `${base}/health`,
      status: health.status,
      data: health.data
    }
  } catch (err) {
    const detail = err.response?.data?.message || err.code || err.message
    throw new Error(`Koneksi agent gagal (${base}/health): ${detail}`)
  }
}


exports.testAgentPrint = async ({ agentUrl, token, printerName }) => {
  if (!agentUrl) {
    throw new Error("PRINT_AGENT_URL belum di-set")
  }

  const headers = token ? { "x-print-agent-token": token } : {}
  const timeoutMs = Number(process.env.PRINT_AGENT_TIMEOUT_MS || 45000)
  const base = agentUrl.replace(/\/$/, "")

  try {
    const res = await axios.post(`${base}/print/test`, {
      printer_name: printerName || null
    }, {
      headers,
      timeout: timeoutMs
    })

    return {
      ok: true,
      endpoint: `${base}/print/test`,
      status: res.status,
      data: res.data
    }
  } catch (err) {
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : (err.code || err.message)
    throw new Error(`Test print agent gagal (${base}/print/test): ${detail}`)
  }
}

exports.getAgentDiagnostics = async ({ agentUrl, token }) => {
  if (!agentUrl) {
    throw new Error("PRINT_AGENT_URL belum di-set")
  }

  const headers = token ? { "x-print-agent-token": token } : {}
  const timeoutMs = Number(process.env.PRINT_AGENT_TIMEOUT_MS || 45000)
  const base = agentUrl.replace(/\/$/, "")

  try {
    const [healthRes, printersRes] = await Promise.all([
      axios.get(`${base}/health`, { headers, timeout: timeoutMs }),
      axios.get(`${base}/printers`, { headers, timeout: timeoutMs })
    ])

    return {
      ok: true,
      base_url: base,
      health: {
        status: healthRes.status,
        data: healthRes.data
      },
      printers: {
        status: printersRes.status,
        data: printersRes.data
      }
    }
  } catch (err) {
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : (err.code || err.message)
    throw new Error(`Diagnosa agent gagal (${base}): ${detail}`)
  }
}


exports.printBarInboxTicket = async ({ ticket, printer = {} }) => {
  const envAgentUrl = process.env.PRINT_AGENT_URL
  const agentUrl = printer.agent_url || envAgentUrl

  if (!agentUrl) {
    throw new Error("PRINT_AGENT_URL belum di-set untuk cetak BAR inbox")
  }

  const payload = buildBarInboxPayload(ticket, {
    printerName: printer.agent_printer_name || process.env.PRINT_AGENT_PRINTER
  })

  return sendReceiptToAgent({
    payload,
    agentUrl,
    token: printer.agent_token || process.env.PRINT_AGENT_TOKEN
  })
}

exports.printBulkPayment = async ({ bulk, printer = {} }) => {
  const envAgentUrl = process.env.PRINT_AGENT_URL
  const agentUrl = printer.agent_url || envAgentUrl

  if (!agentUrl) {
    throw new Error("PRINT_AGENT_URL belum di-set untuk cetak pembayaran gabungan")
  }

  const payload = buildBulkPaymentPayload(bulk, {
    printerName: printer.agent_printer_name || process.env.PRINT_AGENT_PRINTER
  })

  return sendReceiptToAgent({
    payload,
    agentUrl,
    token: printer.agent_token || process.env.PRINT_AGENT_TOKEN
  })
}
