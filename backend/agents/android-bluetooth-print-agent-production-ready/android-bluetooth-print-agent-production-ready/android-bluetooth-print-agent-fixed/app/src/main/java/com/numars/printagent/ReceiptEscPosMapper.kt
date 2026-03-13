package com.numars.printagent

import java.io.ByteArrayOutputStream
import java.nio.charset.Charset
import java.text.DecimalFormat
import java.util.Locale

object ReceiptEscPosMapper {
    private const val WIDTH = 32
    private val ENCODING: Charset = Charset.forName("CP437")
    private val CATEGORY_DISPLAY_ORDER = listOf("FNB", "SPA", "LC", "KTV")

    fun toEscPos(request: PrintReceiptRequest): ByteArray {
        val receipt = request.receipt
        val out = ByteArrayOutputStream()

        fun write(bytes: ByteArray) = out.write(bytes)
        fun writeStr(text: String) = out.write(text.toByteArray(ENCODING))
        fun line(text: String = "") {
            writeStr(text)
            write(byteArrayOf(0x0A))
        }

        fun divider(c: Char = '-') = line(c.toString().repeat(WIDTH))

        write(byteArrayOf(0x1B, 0x40)) // ESC @
        write(byteArrayOf(0x1B, 0x61, 0x01)) // center

        write(byteArrayOf(0x1B, 0x45, 0x01)) // bold on
        write(byteArrayOf(0x1B, 0x21, 0x20)) // double width on
        line(center(receipt.branch_name ?: receipt.title ?: "NUMARS POS", WIDTH / 2))
        write(byteArrayOf(0x1B, 0x21, 0x00)) // normal size
        write(byteArrayOf(0x1B, 0x45, 0x00)) // bold off

        if (!receipt.branch_address.isNullOrBlank()) line(receipt.branch_address)
        if (!receipt.branch_phone.isNullOrBlank()) line("Telp: ${receipt.branch_phone}")

        line()
        divider('=')

        val isRecapPosReport = isRecapPosReport(receipt)
        val isBarOrderTicket = isBarOrderTicket(receipt)

        write(byteArrayOf(0x1B, 0x61, 0x00)) // left

        if (!isRecapPosReport) {
            if (receipt.order_id > 0) {
                write(byteArrayOf(0x1B, 0x45, 0x01))
                line("Order# : ${receipt.order_id}")
                write(byteArrayOf(0x1B, 0x45, 0x00))
            }
            if (!receipt.created_at.isNullOrBlank()) line("Tanggal: ${receipt.created_at}")
            if (!receipt.cashier_name.isNullOrBlank()) line("Kasir  : ${receipt.cashier_name}")
            if (!receipt.therapist_name.isNullOrBlank()) line("Terapis: ${receipt.therapist_name}")
            if (!receipt.room_name.isNullOrBlank()) line("Room   : ${receipt.room_name}")
            if (!receipt.note.isNullOrBlank()) line("Catatan: ${receipt.note}")

            divider('-')
        }

        if (isRecapPosReport) {
            write(byteArrayOf(0x1B, 0x45, 0x01))
            line(center("REKAP LAYANAN POS", WIDTH))
            write(byteArrayOf(0x1B, 0x45, 0x00))
            divider('-')

            write(byteArrayOf(0x1B, 0x45, 0x01))
            line(padRow("Periode", receipt.created_at ?: "-", WIDTH))
            write(byteArrayOf(0x1B, 0x45, 0x00))
            line(padRow("Total Order", maxOf(receipt.order_id, 0).toString(), WIDTH))
            line(padRow("Total Pendapatan", formatRp(receipt.total), WIDTH))

            val grouped = receipt.items.groupBy { getItemCategory(it) }

            CATEGORY_DISPLAY_ORDER.forEach { category ->
                val items = grouped[category].orEmpty()
                if (items.isNotEmpty()) {
                    val categoryRevenue = items.sumOf { it.subtotal }
                    line(padRow("Total $category", formatRp(categoryRevenue), WIDTH))
                }
            }

            divider('-')

            CATEGORY_DISPLAY_ORDER.forEach { category ->
                val items = grouped[category].orEmpty()
                if (items.isEmpty()) return@forEach

                write(byteArrayOf(0x1B, 0x45, 0x01))
                line(category)
                write(byteArrayOf(0x1B, 0x45, 0x00))
                divider('.')

                items.forEach { item ->
                    line(padRow(truncate(item.service_name ?: "-", WIDTH - 6), "${item.qty}x", WIDTH))
                }

                divider('-')
            }

            val otherItems = grouped["LAINNYA"].orEmpty()
            if (otherItems.isNotEmpty()) {
                write(byteArrayOf(0x1B, 0x45, 0x01))
                line("LAINNYA")
                write(byteArrayOf(0x1B, 0x45, 0x00))
                divider('.')
                otherItems.forEach { item ->
                    line(padRow(truncate(item.service_name ?: "-", WIDTH - 6), "${item.qty}x", WIDTH))
                }
                divider('-')
            }
        } else if (isBarOrderTicket) {
            write(byteArrayOf(0x1B, 0x45, 0x01))
            line(padRow("Item BAR", "QTY", WIDTH))
            write(byteArrayOf(0x1B, 0x45, 0x00))
            divider('-')

            receipt.items.forEach { item ->
                val (mainName, variantName) = splitPackageVariant(item.service_name ?: "-")
                if (variantName.isNotBlank()) {
                    line(truncate(mainName, WIDTH))
                    line(padRow("  • ${truncate(variantName, WIDTH - 10)}", "${item.qty}x", WIDTH))
                } else {
                    line(padRow(truncate(mainName, WIDTH - 6), "${item.qty}x", WIDTH))
                }
            }

            divider('-')
        } else {
            write(byteArrayOf(0x1B, 0x45, 0x01))
            line(padRow("Layanan", "Subtotal", WIDTH))
            write(byteArrayOf(0x1B, 0x45, 0x00))
            divider('-')

            receipt.items.forEach { item ->
                val subtotal = formatRp(item.subtotal)
                val unitPrice = if (item.qty > 0) item.subtotal / item.qty else item.subtotal
                val qtyLine = "  ${item.qty}x @ ${formatRp(unitPrice)}"

                line(padRow(truncate(item.service_name ?: "-", WIDTH - subtotal.length - 1), subtotal, WIDTH))
                line(qtyLine)

                if (!item.therapist_name.isNullOrBlank()) {
                    line("  Terapis: ${item.therapist_name}")
                }
            }

            divider('-')
        }

        if (!isRecapPosReport && !isBarOrderTicket) {
            val payAmount = if (receipt.payment_amount > 0) receipt.payment_amount else receipt.total
            val subtotal = if (receipt.subtotal > 0) receipt.subtotal else receipt.total + receipt.discount_amount

            line(padRow("SubTotal", formatRp(subtotal), WIDTH))
            line(padRow("Discount", formatRp(receipt.discount_amount), WIDTH))

            write(byteArrayOf(0x1B, 0x45, 0x01))
            line(padRow("TOTAL", formatRp(receipt.total), WIDTH))
            write(byteArrayOf(0x1B, 0x45, 0x00))

            line(padRow("Bayar", formatRp(payAmount), WIDTH))

            write(byteArrayOf(0x1B, 0x45, 0x01))
            line(padRow("Kembali", formatRp(receipt.change_amount), WIDTH))
            write(byteArrayOf(0x1B, 0x45, 0x00))
        }

        if (!isRecapPosReport && !isBarOrderTicket) {
            line()
            write(byteArrayOf(0x1B, 0x61, 0x00))
            line("Metode : ${receipt.payment_method ?: "CASH"}")
            line("Jam    : ${receipt.printed_at ?: "-"}")
            divider('=')

            write(byteArrayOf(0x1B, 0x61, 0x01))
            write(byteArrayOf(0x1B, 0x45, 0x01))
            line("Terima kasih!")
            write(byteArrayOf(0x1B, 0x45, 0x00))
            line("Semoga sehat selalu :)")
            line()
            line()
            line()
        } else {
            line()
            write(byteArrayOf(0x1B, 0x61, 0x01))
            line("Printed by SKY ePOS")
            line()
        }

        write(byteArrayOf(0x1D, 0x56, 0x00)) // full cut
        return out.toByteArray()
    }

    private fun isRecapPosReport(receipt: ReceiptData): Boolean {
        val title = receipt.title.orEmpty()
        return title.contains("RECAP", ignoreCase = true)
            || title.contains("LAPORAN", ignoreCase = true)
    }

    private fun isBarOrderTicket(receipt: ReceiptData): Boolean {
        val title = receipt.title.orEmpty()
        val method = receipt.payment_method.orEmpty()
        return title.contains("BAR ORDER", ignoreCase = true)
            || method.equals("BAR", ignoreCase = true)
    }

    private fun splitPackageVariant(raw: String): Pair<String, String> {
        val text = raw.trim().ifEmpty { "-" }
        val idx = text.indexOf(" - ")
        return if (idx <= 0 || idx >= text.length - 3) {
            text to ""
        } else {
            text.substring(0, idx).trim() to text.substring(idx + 3).trim()
        }
    }

    private fun getItemCategory(item: ReceiptItem): String {
        val raw = item.category?.takeIf { it.isNotBlank() }
            ?: item.service_name.orEmpty().split(' ').firstOrNull().orEmpty()

        val normalized = raw.trim().uppercase(Locale.getDefault())
        if (normalized == "KARAOKE") return "KTV"
        if (CATEGORY_DISPLAY_ORDER.contains(normalized)) return normalized
        return "LAINNYA"
    }

    private fun formatRp(amount: Double): String {
        val formatter = DecimalFormat("#,##0")
        val formatted = formatter.format(amount)
        return "Rp" + formatted.replace(',', '.')
    }

    private fun center(text: String, width: Int): String {
        if (text.length >= width) return text
        val pad = (width - text.length) / 2
        return text.padStart(text.length + pad).padEnd(width)
    }

    private fun padRow(left: String, right: String, width: Int): String {
        val gap = width - left.length - right.length
        if (gap <= 0) {
            val raw = "$left $right"
            return if (raw.length <= width) raw else raw.substring(0, width)
        }
        return left + " ".repeat(gap) + right
    }

    private fun truncate(text: String, max: Int): String {
        if (text.length <= max) return text
        return if (max > 1) text.substring(0, max - 1) + "~" else text.substring(0, max)
    }
}
