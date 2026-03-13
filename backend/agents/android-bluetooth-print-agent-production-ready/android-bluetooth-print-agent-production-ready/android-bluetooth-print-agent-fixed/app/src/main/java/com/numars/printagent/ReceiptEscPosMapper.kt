package com.numars.printagent

import java.io.ByteArrayOutputStream

object ReceiptEscPosMapper {
    private const val WIDTH = 32

    fun toEscPos(request: PrintReceiptRequest): ByteArray {
        val receipt = request.receipt
        val out = ByteArrayOutputStream()

        fun write(bytes: ByteArray) = out.write(bytes)
        fun line(text: String = "") {
            write(text.toByteArray(Charsets.UTF_8))
            write("\n".toByteArray())
        }

        fun divider(c: Char = '-') = line(c.toString().repeat(WIDTH))

        // ESC @ initialize
        write(byteArrayOf(0x1B, 0x40))

        val isBarTicket = isBarOrderTicket(receipt)

        if (isBarTicket) {
            // header (closer to Windows agent style)
            write(byteArrayOf(0x1B, 0x61, 0x01)) // center
            write(byteArrayOf(0x1B, 0x45, 0x01)) // bold on
            line(center((receipt.branch_name ?: "BAR").uppercase(), WIDTH))
            write(byteArrayOf(0x1B, 0x45, 0x00)) // bold off
            divider('=')

            // metadata block
            write(byteArrayOf(0x1B, 0x61, 0x00)) // left
            if (receipt.order_id > 0) line("Order# : ${receipt.order_id}")
            if (!receipt.created_at.isNullOrBlank()) line("Tanggal: ${receipt.created_at}")
            if (!receipt.cashier_name.isNullOrBlank()) line("Kasir  : ${receipt.cashier_name}")
            if (!receipt.note.isNullOrBlank()) line("Catatan: ${receipt.note}")
            divider('-')

            write(byteArrayOf(0x1B, 0x45, 0x01))
            line(padRow("Item BAR", "QTY", WIDTH))
            write(byteArrayOf(0x1B, 0x45, 0x00))
            divider('-')

            receipt.items.forEach { item ->
                val name = truncate(item.service_name ?: "Item", WIDTH - 6)
                val qty = "${item.qty}x"
                line(padRow(name, qty, WIDTH))
            }

            divider('-')
            write(byteArrayOf(0x1B, 0x61, 0x01)) // center
            line("Printed by SKY ePOS")
            line()
        } else {
            line(receipt.title ?: "NUMARS POS")
            line(receipt.divider ?: "------------------------")

            receipt.items.forEach { item ->
                line("${item.service_name ?: "Item"} x${item.qty}")
                if (!item.therapist_name.isNullOrBlank()) line("  Terapis: ${item.therapist_name}")
                line("Rp ${item.subtotal.toLong()}")
            }

            line(receipt.divider ?: "------------------------")
            line("TOTAL : Rp ${receipt.total.toLong()}")
            line()
            line(receipt.printed_at ?: "")
        }

        // full cut GS V 0
        write(byteArrayOf(0x1D, 0x56, 0x00))
        write(byteArrayOf(0x0A))
        return out.toByteArray()
    }

    private fun isBarOrderTicket(receipt: ReceiptData): Boolean {
        val title = receipt.title.orEmpty()
        val method = receipt.payment_method.orEmpty()
        return title.contains("BAR ORDER", ignoreCase = true) || method.equals("BAR", ignoreCase = true)
    }

    private fun center(text: String, width: Int): String {
        if (text.length >= width) return text
        val left = (width - text.length) / 2
        val right = width - text.length - left
        return " ".repeat(left) + text + " ".repeat(right)
    }

    private fun padRow(left: String, right: String, width: Int): String {
        val safeLeft = left.trim()
        val safeRight = right.trim()
        val gap = width - safeLeft.length - safeRight.length
        return if (gap <= 1) {
            truncate("$safeLeft $safeRight", width)
        } else {
            safeLeft + " ".repeat(gap) + safeRight
        }
    }

    private fun truncate(text: String, width: Int): String {
        if (text.length <= width) return text
        return text.substring(0, width)
    }
}
