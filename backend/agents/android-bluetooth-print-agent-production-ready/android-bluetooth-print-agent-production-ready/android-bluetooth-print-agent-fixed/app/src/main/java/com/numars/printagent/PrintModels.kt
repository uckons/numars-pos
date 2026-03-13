package com.numars.printagent

data class PrintReceiptRequest(
    val printer_name: String? = null,
    val profile: ThermalProfile = ThermalProfile(),
    val receipt: ReceiptData = ReceiptData()
)

data class ThermalProfile(
    val maxDots: Int = 128,
    val heatTimeUs: Int = 550,
    val heatIntervalUs: Int = 20,
    val codePage: Int = 0
)

data class ReceiptData(
    val title: String? = "NUMARS POS",
    val divider: String? = "------------------------",
    val order_id: Int = 0,
    val created_at: String? = null,
    val branch_name: String? = null,
    val branch_address: String? = null,
    val branch_phone: String? = null,
    val cashier_name: String? = null,
    val room_name: String? = null,
    val therapist_name: String? = null,
    val payment_method: String? = null,
    val note: String? = null,
    val items: List<ReceiptItem> = emptyList(),
    val total: Double = 0.0,
    val printed_at: String? = null
)

data class ReceiptItem(
    val service_name: String? = null,
    val qty: Int = 0,
    val subtotal: Double = 0.0,
    val therapist_name: String? = null
)
