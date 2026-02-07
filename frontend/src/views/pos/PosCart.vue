<template>
  <div class="cart">
    <h3>🛒 Cart</h3>

    <div v-if="items.length === 0" class="empty">
      Belum ada item
    </div>

    <div
      v-for="i in items"
      :key="i.cart_key || `${i.id}-${i.base_price}-${i.price_label || ''}`"
      class="cart-item"
    >
      <div class="info">
        <strong>{{ i.name }}</strong>
        <small>Rp {{ format(i.base_price) }}</small>
        <small v-if="i.price_label" class="item-label">{{ i.price_label }}</small>
      </div>

      <div class="qty">
        <button @click="dec(i)">−</button>
        <span>{{ i.qty }}</span>
        <button @click="inc(i)">+</button>
      </div>

      <div class="total">
        Rp {{ format(i.base_price * i.qty) }}
      </div>

      <button class="remove" @click="remove(i)">✕</button>
    </div>

    <div v-if="items.length" class="summary">
      <div class="row">
        <span>Total</span>
        <strong>Rp {{ format(grandTotal) }}</strong>
      </div>

      <button class="checkout" @click="checkout" :disabled="loading">
        {{ loading ? "Processing..." : "Bayar" }}
      </button>
       <button
        class="draft"
        @click="saveDraft"
        :disabled="loading"
      >
        Simpan Draft
      </button>
      <button class="cancel" @click="clear">
        Batalkan Order
      </button>
    </div>
  </div>

  <!-- 🖨️ RECEIPT PREVIEW MODAL -->
  <div v-if="showReceiptModal" class="modal-overlay" @click="closeReceiptModal">
    <div class="modal-content receipt-modal" @click.stop>
      <!-- Header -->
      <div class="modal-header">
        <h2>✓ Transaksi Berhasil</h2>
        <button class="modal-close" @click="closeReceiptModal">✕</button>
      </div>

      <!-- Receipt Preview -->
      <div class="receipt-preview" id="receipt-print">
        <div class="receipt">
          <!-- Header -->
          <div class="receipt-header">
            <h2>{{ receiptData?.branch_name || 'NUMARS SPA' }}</h2>
            <p>{{ receiptData?.branch_address || 'Jakarta, Indonesia' }}</p>
            <p>Tel: {{ receiptData?.branch_phone || '021-xxx-xxxx' }}</p>
          </div>

          <div class="receipt-divider">================================</div>

          <!-- Order Info -->
          <div class="receipt-info">
            <div class="info-row">
              <span>No Order:</span>
              <span>#{{ receiptData?.id }}</span>
            </div>
            <div class="info-row">
              <span>Tanggal:</span>
              <span>{{ formatDateTime(receiptData?.created_at) }}</span>
            </div>
            <div class="info-row">
              <span>Kasir:</span>
              <span>{{ receiptData?.cashier_name }}</span>
            </div>
            <div class="info-row" v-if="receiptData?.therapist_name">
              <span>Terapis:</span>
              <span>{{ receiptData?.therapist_name }}</span>
            </div>
            <div class="info-row" v-if="receiptData?.room_name">
              <span>Room:</span>
              <span>{{ receiptData?.room_name }}</span>
            </div>
          </div>

          <div class="receipt-divider">================================</div>

          <!-- Items -->
          <div class="receipt-items">
            <div class="item-header">
              <span>Item</span>
              <span>Qty</span>
              <span>Subtotal</span>
            </div>
            <div v-for="item in receiptData?.items" :key="item.service_id" class="item-row">
              <div class="item-name">{{ item.service_name }}</div>
              <div class="item-detail">
                <span>{{ item.qty }}x</span>
                <span>{{ formatRupiah(item.price) }}</span>
                <span class="item-subtotal">{{ formatRupiah(item.subtotal) }}</span>
              </div>
            </div>
          </div>

          <div class="receipt-divider">================================</div>

          <!-- Total -->
          <div class="receipt-total">
            <div class="total-row">
              <span>TOTAL:</span>
              <span class="total-amount">{{ formatRupiah(receiptData?.total) }}</span>
            </div>
            <div class="total-row">
              <span>Bayar:</span>
              <span>{{ formatRupiah(receiptData?.payment_amount) }}</span>
            </div>
            <div class="total-row">
              <span>Kembali:</span>
              <span>{{ formatRupiah(receiptData?.change_amount) }}</span>
            </div>
            <div class="total-row payment-method">
              <span>Metode:</span>
              <span>{{ receiptData?.payment_method || 'CASH' }}</span>
            </div>
          </div>

          <div class="receipt-divider">================================</div>

          <!-- Footer -->
          <div class="receipt-footer">
            <p>Terima kasih atas kunjungan Anda</p>
            <p>Semoga sehat selalu!</p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="modal-actions">
        <button class="btn btn-print" @click="printReceipt">
          🖨️ Print Sekarang
        </button>
        <button class="btn btn-close" @click="closeReceiptModal">
          Tutup
        </button>
      </div>
    </div>
  </div>

</template>

<script setup>
import { ref, computed } from "vue"
import { usePosStore } from "@/store/pos.store"
import api from "@/services/api"
import { useRouter } from "vue-router"
import Swal from "sweetalert2"
import "sweetalert2/dist/sweetalert2.min.css"

const router = useRouter()
const pos = usePosStore()

const items = computed(() => pos.items || [])
const maybeOfferPackage = async (cartItem) => {
  if (!cartItem || cartItem.is_package) return

  const packageQty = Number(cartItem.package_qty || 0)
  if (!packageQty || cartItem.qty % packageQty !== 0) return

  const res = await SwalTheme.fire({
    icon: "question",
    title: "Jadikan paket?",
    text: `Qty ${cartItem.name} sudah ${cartItem.qty}. Gunakan harga paket?`,
    showCancelButton: true,
    confirmButtonText: "Ya, jadikan paket",
    cancelButtonText: "Tidak"
  })

  if (!res.isConfirmed) return

  const packageService = {
    id: cartItem.package_service_id,
    name: cartItem.name,
    base_price: Number(cartItem.package_price || 0),
    price_label: "PAKET",
    is_package: true,
    package_group: cartItem.package_group,
    package_qty: cartItem.package_qty
  }

  pos.convertToPackage(cartItem.cart_key, packageService)
}

const inc = async (i) => {
  pos.inc(i.id, i.cart_key)
  const updated = pos.findByCartKey(i.cart_key)
  await maybeOfferPackage(updated)
}
const dec = (i) => pos.dec(i.id, i.cart_key)
const remove = (item) => pos.remove(item.id, item.cart_key)

const SwalTheme = Swal.mixin({
  customClass: {
    popup: "swal-theme-popup",
    title: "swal-theme-title",
    content: "swal-theme-content",
    confirmButton: "swal-theme-confirm",
    cancelButton: "swal-theme-cancel",
    denyButton: "swal-theme-deny"
  },
  buttonsStyling: false
})

const grandTotal = computed(() =>
  items.value.reduce((sum, i) => sum + Number(i.base_price) * i.qty, 0)
)

const loading = ref(false)
const lastOrder = ref({
  order_id: null,
  total: 0,
  items: []
})

// 🖨️ RECEIPT PREVIEW STATE
const showReceiptModal = ref(false)
const receiptData = ref(null)
const receiptLoading = ref(false)

const format = n =>
  Number(n || 0).toLocaleString("id-ID")

// 🖨️ FORMAT CURRENCY
const formatRupiah = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

// 🖨️ FORMAT DATE TIME
const formatDateTime = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const clear = async () => {
  const res = await SwalTheme.fire({
    icon: "warning",
    title: "Batalkan order ini?",
    text: "Semua item di cart akan dihapus.",
    showCancelButton: true,
    confirmButtonText: "Ya, batalkan",
    cancelButtonText: "Tidak"
  })

  if (!res.isConfirmed) return
  pos.clear()
  await SwalTheme.fire({
    icon: "success",
    title: "Dibatalkan",
    text: "Order telah dibatalkan",
    confirmButtonText: "OK"
  })
}

const checkout = async () => {
  if (items.value.length === 0) {
    await SwalTheme.fire({
      icon: "info",
      title: "Kosong",
      text: "Tidak ada item untuk dibayar",
      confirmButtonText: "OK"
    })
    return
  }

  loading.value = true
  try {
    const payload = {
      items: items.value.map(i => ({
        id: i.id,
        qty: i.qty,
        base_price: i.base_price,
        name: i.name,
        price_label: i.price_label,
        is_package: Boolean(i.is_package)
      })),
      payment_method: "CASH"
    }
    
    let res
    
    // 🆕 Kalau ada currentOrderId, UPDATE order existing
    if (pos.currentOrderId) {
      console.log('Updating existing order:', pos.currentOrderId)
      res = await api.post(`/orders/${pos.currentOrderId}/close`, payload)
    } else {
      console.log('Creating new order')
      res = await api.post("/orders/pos", payload)
    }

     lastOrder.value = {
      order_id: res.data.order_id,
      total: res.data.total,
      items: JSON.parse(JSON.stringify(items.value))
    }

    console.log('✅ Checkout success, order_id:', lastOrder.value.order_id)

    // Clear local cart
    pos.clear()

    console.log('🖨️ Calling showReceiptPreview...')
    
    // 🖨️ SHOW RECEIPT PREVIEW MODAL (WAIT for modal to close)
    await showReceiptPreview(lastOrder.value.order_id)

    console.log('Modal closed, creating timers...')

    // After closing receipt modal, create timers and navigate
    try {
      await api.post(`/timers/from-order/${lastOrder.value.order_id}`)
    } catch (e) {
      console.warn("Timer tidak dibuat:", e?.message || e)
    }

    console.log('Navigating to /kasir...')
    router.push("/kasir")
  } catch (err) {
    await SwalTheme.fire({
      icon: "error",
      title: "Gagal",
      text: err.response?.data?.message || err.message || "Failed to checkout",
      confirmButtonText: "OK"
    })
  } finally {
    loading.value = false
  }
}

// 🖨️ SHOW RECEIPT PREVIEW
const showReceiptPreview = async (orderId) => {
  console.log('🖨️ showReceiptPreview called, orderId:', orderId)
  
  return new Promise(async (resolve) => {
    try {
      receiptLoading.value = true
      console.log('Fetching order detail...')
      const res = await api.get(`/orders/${orderId}/detail`)
      console.log('Order detail received:', res.data)
      receiptData.value = res.data
      showReceiptModal.value = true
      console.log('Modal should show now, showReceiptModal:', showReceiptModal.value)
      
      // Wait for modal to close
      const checkModalClosed = setInterval(() => {
        if (!showReceiptModal.value) {
          clearInterval(checkModalClosed)
          console.log('Modal closed by user')
          resolve()
        }
      }, 100)
      
    } catch (err) {
      console.error("Failed to load receipt:", err)
      await SwalTheme.fire({
        icon: "error",
        title: "Gagal",
        text: "Gagal memuat struk",
        confirmButtonText: "OK"
      })
      resolve()
    } finally {
      receiptLoading.value = false
    }
  })
}

// 🖨️ CLOSE RECEIPT MODAL
const closeReceiptModal = () => {
  showReceiptModal.value = false
  receiptData.value = null
}

// 🖨️ PRINT RECEIPT
const printReceipt = () => {
  window.print()
}

// 🖨️ PRINT TO THERMAL PRINTER (existing function - optional)
const printOrder = async (order_id = lastOrder.value.order_id) => {
  try {
    await api.post(`/printers/print-order`, { order_id })
    await SwalTheme.fire({
      icon: "success",
      title: "Struk dikirim",
      text: "🖨 Struk dikirim ke printer",
      confirmButtonText: "OK"
    })
  } catch (err) {
    await SwalTheme.fire({
      icon: "error",
      title: "Gagal cetak",
      text: err.response?.data?.message || err.message || "Gagal cetak",
      confirmButtonText: "OK"
    })
  }
}
const saveDraft = async () => {
  if (items.value.length === 0) {
    await SwalTheme.fire({
      icon: "info",
      title: "Kosong",
      text: "Tidak ada item untuk disimpan",
      confirmButtonText: "OK"
    })
    return
  }

  const res = await SwalTheme.fire({
    icon: "question",
    title: "Simpan draft?",
    text: "Order akan masuk ke daftar order sebagai draft.",
    showCancelButton: true,
    confirmButtonText: "Simpan",
    cancelButtonText: "Batal"
  })

  if (!res.isConfirmed) return

  loading.value = true
  try {
    const payload = {
      items: items.value.map(i => ({
        id: i.id,
        qty: i.qty,
        base_price: i.base_price,
        name: i.name,
        price_label: i.price_label,
        is_package: Boolean(i.is_package)
      }))
    }

    if (pos.currentOrderId) {
      await api.post(`/orders/${pos.currentOrderId}/draft`, payload)
    } else {
      await api.post("/orders/pos/draft", payload)
    }

    pos.clear()

    await SwalTheme.fire({
      icon: "success",
      title: "Draft tersimpan",
      text: "Order masuk ke daftar order.",
      confirmButtonText: "OK"
    })

    router.push("/kasir/orders")
  } catch (err) {
    await SwalTheme.fire({
      icon: "error",
      title: "Gagal",
      text: err.response?.data?.message || err.message || "Gagal menyimpan draft",
      confirmButtonText: "OK"
    })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.cart {
  padding: 16px;
  height: 100%;
  background: #0e0e0e;
  color: #fff;
  display: flex;
  flex-direction: column;
}

/* ======================
   HEADER
====================== */
.cart h3 {
  margin-bottom: 16px;
  font-size: 18px;
  font-weight: 700;
  color: #c9a24d;
  letter-spacing: .3px;
}

/* ======================
   EMPTY STATE
====================== */
.empty {
  margin-top: 40px;
  text-align: center;
  font-size: 14px;
  color: #777;
}

/* ======================
   ITEM ROW
====================== */
.cart-item {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #222;
  align-items: center;
}

/* ITEM INFO */
.info strong {
  display: block;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.info small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: #888;
}


.item-label {
  display: inline-block;
  margin-top: 4px;
  font-size: 11px;
  color: #111;
  background: #f5c518;
  padding: 2px 8px;
  border-radius: 999px;
  width: fit-content;
}

/* ======================
   QTY
====================== */
.qty {
  display: flex;
  align-items: center;
  gap: 6px;
}

.qty span {
  min-width: 20px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
}

.qty button {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: #1c1c1c;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
}

/* ======================
   ITEM TOTAL
====================== */
.total {
  font-size: 14px;
  font-weight: 600;
  color: #c9a24d;
  text-align: right;
}

/* REMOVE */
.remove {
  background: none;
  border: none;
  color: #e74c3c;
  font-size: 16px;
  cursor: pointer;
}

/* ======================
   SUMMARY
====================== */
.summary {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid #222;
}

.summary .row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.summary .row span {
  font-size: 14px;
  color: #aaa;
}

.summary .row strong {
  font-size: 20px;
  font-weight: 700;
  color: #c9a24d;
}

/* ======================
   BUTTONS
====================== */
.checkout {
  width: 100%;
  padding: 14px;
  font-size: 15px;
  font-weight: 700;
  background: #c9a24d;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}

.cancel {
  margin-top: 8px;
  width: 100%;
  padding: 12px;
  font-size: 13px;
  background: #1c1c1c;
  color: #bbb;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}
.draft {
  margin-top: 8px;
  width: 100%;
  padding: 12px;
  font-size: 13px;
  background: #1b1b1b;
  color: #c9a24d;
  border: 1px solid #3a2e12;
  border-radius: 10px;
  cursor: pointer;
}

.draft:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
/* ===== SweetAlert2 Black & Gold theme (scoped using :deep) ===== */
:deep(.swal-theme-popup) {
  background: linear-gradient(145deg, #0e0e0e, #151515) !important;
  color: #fff !important;
  border-radius: 12px !important;
  border: 1px solid rgba(255, 215, 0, 0.08) !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6) !important;
}

:deep(.swal-theme-title) {
  color: var(--gold, #f5c518) !important;
  font-weight: 600;
}

:deep(.swal-theme-content) {
  color: #cfcfcf !important;
  font-size: 14px;
}

/* Buttons */
:deep(.swal-theme-confirm) {
  background: var(--gold, #f5c518) !important;
  color: #000 !important;
  border: none !important;
  padding: 8px 16px !important;
  border-radius: 8px !important;
}

:deep(.swal-theme-cancel) {
  background: transparent !important;
  color: var(--gold, #f5c518) !important;
  border: 1px solid var(--gold, #f5c518) !important;
  padding: 7px 14px !important;
  border-radius: 8px !important;
}

:deep(.swal-theme-deny) {
  background: transparent !important;
  color: var(--gold, #f5c518) !important;
  border: 1px solid rgba(255, 215, 0, 0.12) !important;
  padding: 7px 14px !important;
  border-radius: 8px !important;
}

/* success icon overrides */
:deep(.swal2-success-ring),
:deep(.swal2-success-fix) {
  border-color: var(--gold, #f5c518) !important;
}
:deep(.swal2-success-line-tip),
:deep(.swal2-success-line-long) {
  background-color: var(--gold, #f5c518) !important;
}
/* 🖨️ RECEIPT MODAL */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content.receipt-modal {
  background: #1a1a1a;
  border: 2px solid #c9a24d;
  border-radius: 16px;
  padding: 0;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Modal Header */
.modal-header {
  background: linear-gradient(145deg, #c9a24d, #d4b560);
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #c9a24d;
}

.modal-header h2 {
  color: #000;
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.modal-close {
  background: rgba(0, 0, 0, 0.2);
  border: none;
  color: #000;
  width: 35px;
  height: 35px;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.modal-close:hover {
  background: rgba(0, 0, 0, 0.4);
  transform: rotate(90deg);
}

/* Receipt Preview */
.receipt-preview {
  background: #fff;
  color: #000;
  padding: 20px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  overflow-y: auto;
  flex: 1;
}

.receipt {
  max-width: 300px;
  margin: 0 auto;
}

/* Receipt Header */
.receipt-header {
  text-align: center;
  margin-bottom: 10px;
}

.receipt-header h2 {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 5px 0;
  text-transform: uppercase;
  color: #000;
}

.receipt-header p {
  font-size: 11px;
  margin: 2px 0;
  color: #333;
}

/* Receipt Divider */
.receipt-divider {
  text-align: center;
  margin: 10px 0;
  font-size: 10px;
  color: #333;
}

/* Receipt Info */
.receipt-info {
  margin: 10px 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin: 5px 0;
  font-size: 11px;
}

.info-row span:first-child {
  font-weight: 600;
}

/* Receipt Items */
.receipt-items {
  margin: 10px 0;
}

.item-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1.5fr;
  font-weight: 700;
  font-size: 11px;
  margin-bottom: 8px;
  padding-bottom: 5px;
  border-bottom: 1px dashed #666;
}

.item-row {
  margin: 8px 0;
}

.item-name {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 3px;
}

.item-detail {
  display: grid;
  grid-template-columns: 2fr 1fr 1.5fr;
  font-size: 11px;
  color: #333;
}

.item-subtotal {
  font-weight: 700;
  text-align: right;
}

/* Receipt Total */
.receipt-total {
  margin: 10px 0;
}

.total-row {
  display: flex;
  justify-content: space-between;
  margin: 5px 0;
  font-size: 12px;
}

.total-row:first-child {
  font-size: 14px;
  font-weight: 700;
  margin-top: 10px;
}

.total-amount {
  font-weight: 700;
  font-size: 14px;
}

.payment-method {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #666;
  font-style: italic;
}

/* Receipt Footer */
.receipt-footer {
  text-align: center;
  margin-top: 15px;
  font-size: 11px;
}

.receipt-footer p {
  margin: 3px 0;
  color: #333;
}

/* Modal Actions */
.modal-actions {
  background: #0e0e0e;
  padding: 20px;
  display: flex;
  gap: 12px;
  justify-content: center;
  border-top: 2px solid #c9a24d;
}

.btn-print {
  background: #c9a24d;
  border: 1px solid #c9a24d;
  color: #000;
  padding: 14px 32px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease-out;
  flex: 1;
}

.btn-print:hover {
  background: #d4b560;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(201, 162, 77, 0.4);
}

.btn-close {
  background: #333;
  border: 1px solid #444;
  color: #fff;
  padding: 14px 32px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease-out;
  flex: 1;
}

.btn-close:hover {
  background: #444;
  border-color: #666;
}

/* Print Media Query */
@media print {
  body * {
    visibility: hidden;
  }
  
  .receipt-preview,
  .receipt-preview * {
    visibility: visible;
  }
  
  .receipt-preview {
    position: fixed;
    left: 0;
    top: 0;
    width: 58mm;
    background: white;
    padding: 0;
  }
  
  .modal-actions,
  .modal-header,
  .modal-close {
    display: none !important;
  }
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .modal-content.receipt-modal {
    max-width: 95%;
    width: 95%;
  }
  
  .modal-actions {
    flex-direction: column;
  }
  
  .btn-print,
  .btn-close {
    width: 100%;
  }
}
</style>