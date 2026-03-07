package com.numars.printagent

import java.io.ByteArrayOutputStream

object ReceiptEscPosMapper {
    fun toEscPos(request: PrintReceiptRequest): ByteArray {
        val out = ByteArrayOutputStream()
        fun line(text: String) {
            out.write(text.toByteArray(Charsets.UTF_8))
            out.write("\n".toByteArray())
        }

        // ESC @ initialize
        out.write(byteArrayOf(0x1B, 0x40))

        line(request.receipt.title ?: "NUMARS POS")
        line(request.receipt.divider ?: "------------------------")

        request.receipt.items.forEach { item ->
            line("${item.service_name ?: "Item"} x${item.qty}")
            if (!item.therapist_name.isNullOrBlank()) line("  Terapis: ${item.therapist_name}")
            line("Rp ${item.subtotal.toLong()}")
        }

        line(request.receipt.divider ?: "------------------------")
        line("TOTAL : Rp ${request.receipt.total.toLong()}")
        line("")
        line(request.receipt.printed_at ?: "")

        // full cut GS V 0
        out.write(byteArrayOf(0x1D, 0x56, 0x00))
        out.write(0x0A)
        return out.toByteArray()
    }
}
