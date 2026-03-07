<template>
  <div class="cart">
    <h3>🛒 Cart</h3>
    <div class="items-scroll">
      <div v-if="items.length === 0" class="empty">
        Belum ada item
      </div>

      <div
        v-for="i in items"
        :key="i.cart_key || `${i.id}-${i.base_price}-${i.price_label || ''}`"
        class="cart-item"
        :class="{ locked: i.locked_package || i.locked_main }"
      >
        <div class="info">
          <strong>{{ i.name }}</strong>
          <small>Rp {{ format(i.base_price) }}</small>
          <small v-if="i.price_label" class="item-label">{{ i.price_label }}</small>
          <small v-if="i.variant_name" class="item-label">Varian: {{ i.variant_name }}</small>
          <small v-if="i.therapist_name" class="item-label">Terapis: {{ i.therapist_name }}</small>
          <small v-if="i.locked_main" class="item-locked">LOCKED MAIN SERVICE</small>
          <small v-if="i.locked_package" class="item-locked">LOCKED PAKET</small>
        </div>

        <div class="qty">
          <button @click="dec(i)" :disabled="i.locked_package || i.locked_main">−</button>
          <span>{{ i.qty }}</span>
          <button @click="inc(i)" :disabled="i.locked_package || i.locked_main">+</button>
        </div>

        <div class="total">
          Rp {{ format(i.base_price * i.qty) }}
        </div>

        <button class="remove" @click="remove(i)" :disabled="i.locked_package">✕</button>
      </div>
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


  <!-- 💳 PAYMENT CONFIRM MODAL -->
  <div v-if="showPaymentConfirmModal" class="modal-overlay" @click="closePaymentConfirmModal">
    <div class="modal-content receipt-modal" @click.stop>
      <div class="modal-header">
        <h2>Konfirmasi Pembayaran</h2>
        <button class="modal-close" @click="closePaymentConfirmModal">✕</button>
      </div>

      <div class="receipt-preview" style="padding:20px;text-align:center;">
        <p style="margin:0 0 10px 0;">Pastikan pembayaran sudah benar.</p>
        <p style="margin:0 0 4px 0;"><strong>Metode:</strong> {{ receiptData?.payment_method || 'CASH' }}</p>
        <p style="margin:0 0 4px 0;"><strong>Total:</strong> {{ formatRupiah(receiptData?.total || 0) }}</p>
        <p style="margin:0;"><strong>Bayar:</strong> {{ formatRupiah(receiptData?.payment_amount || 0) }}</p>
      </div>

      <div class="modal-actions">
        <button class="btn btn-print" @click="proceedToPrintCartStep">
          🧾 Lanjut Print
        </button>
        <button class="btn btn-close" @click="closePaymentConfirmModal">
          Cancel
        </button>
      </div>
    </div>
  </div>

  <!-- 🖨️ RECEIPT PREVIEW MODAL -->
  <div v-if="showReceiptModal" class="modal-overlay" @click="closeReceiptModal">
    <div class="modal-content receipt-modal" @click.stop>
      <!-- Header -->
      <div class="modal-header">
        <h2>Konfirmasi Pembayaran</h2>
        <button class="modal-close" @click="closeReceiptModal">✕</button>
      </div>

      <!-- Receipt Preview -->
      <div class="receipt-preview" id="receipt-print">
        <div class="receipt">
          <div class="receipt-header" v-if="receiptData?.branch_name || receiptData?.branch_address || receiptData?.branch_phone || receiptData?.branch_logo_url">
            <img v-if="receiptData?.branch_logo_url" :src="receiptData.branch_logo_url" alt="logo outlet" class="receipt-logo" />
            <h2 v-if="receiptData?.branch_name">{{ receiptData?.branch_name }}</h2>
            <p v-if="receiptData?.branch_address">{{ receiptData?.branch_address }}</p>
            <p v-if="receiptData?.branch_phone">Tel: {{ receiptData?.branch_phone }}</p>
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
            <div class="info-row" v-if="receiptData?.guest_name">
              <span>Nama Tamu:</span>
              <span>{{ receiptData?.guest_name }}</span>
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
            <div v-for="(item, idx) in receiptData?.items" :key="`${item.service_id}-${idx}`" class="item-row">
              <div class="item-name">
                <div>{{ item.service_name }}</div>
                <small v-if="item.therapist_name" class="item-meta">Terapis: {{ item.therapist_name }}</small>
              </div>
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
              <span>SubTotal:</span>
              <span>{{ formatRupiah(receiptData?.subtotal ?? ((Number(receiptData?.total || 0) + Number(receiptData?.discount_amount || 0)))) }}</span>
            </div>
            <div class="total-row">
              <span>Discount:</span>
              <span>{{ formatRupiah(receiptData?.discount_amount || 0) }}</span>
            </div>
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
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="modal-actions">
        <button class="btn btn-print" @click="inPrintCartStep ? printReceipt() : proceedToPrintCartStep()">
          {{ inPrintCartStep ? '🖨️ Print POS' : '🧾 Lanjut Print' }}
        </button>
        <button class="btn btn-close" @click="closeReceiptModal">
          Cancel
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
import { getPrinterAgentConfig } from "@/utils/printerAgentConfig"

const router = useRouter()
const pos = usePosStore()

const items = computed(() => pos.items || [])

const loadVariantOptions = async (cartItem) => {
  if (!cartItem?.package_group) return []
  const res = await api.get('/services', { params: { type: 'FNB', is_active: true } })
  const rows = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : [])
  return rows.filter(s =>
    s.package_group === cartItem.package_group &&
    !(Boolean(s.is_package) && String(s.item_group || 'NORMAL').toUpperCase() !== 'VARIAN')
  )
}

const chooseVariantBreakdownInCart = async (cartItem, variants = []) => {
  const targetQty = Number(cartItem.qty || 0)
  const leftIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9a24d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>'
  const rightIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9a24d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>'

  const html = `
    <div class="variant-qty-list" style="text-align:left;display:grid;gap:12px;max-height:380px;overflow:auto;padding-right:2px;">
      ${variants.map(opt => `
        <label style="display:flex;align-items:center;justify-content:center;gap:8px;">
          <span style="width:240px;max-width:240px;text-align:left;">${opt.name}</span>
          <div class="variant-stepper" style="display:flex;align-items:center;justify-content:space-between;border:1px solid #4f596e;border-radius:12px;padding:8px 8px;gap:8px;background:rgba(11,14,20,.55);min-height:62px;">
            <button type="button" class="var-qty-btn" data-dir="dec" data-id="${opt.id}" style="width:42px;height:42px;border:1px solid #3e4658;border-radius:10px;background:#151a22;color:#c9a24d;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 42px;outline:none;box-shadow:none;">${leftIcon}</button>
            <span class="var-qty-value" data-id="${opt.id}" style="min-width:24px;text-align:center;font-weight:800;font-size:26px;color:#f2f2f2;line-height:1;">0</span>
            <input class="var-qty" data-id="${opt.id}" data-name="${String(opt.name || '').replace(/"/g, '&quot;')}" type="hidden" value="0" />
            <button type="button" class="var-qty-btn" data-dir="inc" data-id="${opt.id}" style="width:42px;height:42px;border:1px solid #3e4658;border-radius:10px;background:#151a22;color:#c9a24d;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 42px;outline:none;box-shadow:none;">${rightIcon}</button>
          </div>
        </label>
      `).join('')}
    </div>
    <small style="color:#999">Total qty varian harus = ${targetQty}</small>
  `

  const res = await SwalTheme.fire({
    title: 'Pilih varian paket + qty',
    customClass: { popup: 'swal-theme-popup variant-qty-popup' },
    html,
    showCancelButton: true,
    confirmButtonText: 'Pakai varian',
    cancelButtonText: 'Batal',
    focusConfirm: false,
    didOpen: () => {
      const popup = Swal.getPopup()
      if (!popup) return
      popup.querySelectorAll('.var-qty-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id')
          const dir = btn.getAttribute('data-dir')
          const input = popup.querySelector(`.var-qty[data-id="${id}"]`)
          const valueNode = popup.querySelector(`.var-qty-value[data-id="${id}"]`)
          if (!input || !valueNode) return
          const current = Number(input.value || 0)
          const next = dir === 'inc' ? current + 1 : Math.max(0, current - 1)
          input.value = String(next)
          valueNode.textContent = String(next)
        })
      })
    },
    preConfirm: async () => {
      const popup = Swal.getPopup()
      const inputs = Array.from(popup?.querySelectorAll('.var-qty') || [])
      const rows = inputs.map(el => ({
        variant_service_id: Number(el.getAttribute('data-id') || 0),
        variant_name: el.getAttribute('data-name') || '',
        qty: Number(el.value || 0)
      })).filter(row => row.variant_service_id > 0 && row.qty > 0)

      const sumQty = rows.reduce((acc, row) => acc + row.qty, 0)
      if (sumQty !== targetQty) {
        Swal.showValidationMessage(`Total qty varian harus ${targetQty} (sekarang ${sumQty})`)
        return false
      }
      return rows
    }
  })

  if (!res.isConfirmed) return undefined
  return Array.isArray(res.value) ? res.value : []
}


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
    name: cartItem.package_name || cartItem.name,
    base_price: Number(cartItem.package_price || 0),
    price_label: "PAKET",
    is_package: true,
    package_group: cartItem.package_group,
    package_qty: cartItem.package_qty,
    package_special: Boolean(cartItem.package_special)
  }

  const variants = await loadVariantOptions(cartItem)
  const variantRequired = Boolean(cartItem.package_special)
  let breakdown = []
  if (variantRequired && !variants.length) {
    await SwalTheme.fire({ icon: 'warning', title: 'Varian belum tersedia', text: 'Paket khusus wajib memilih varian.' })
    return
  }
  if (variants.length) {
    const pickedBreakdown = await chooseVariantBreakdownInCart(cartItem, variants)
    if (pickedBreakdown === undefined) return
    breakdown = pickedBreakdown
  } else if (variantRequired) {
    return
  }

  if (breakdown.length) {
    const first = breakdown[0]
    packageService.variant_name = first.variant_name
    packageService.variant_service_id = first.variant_service_id
    packageService.item_group = 'VARIAN'
    pos.convertToPackageWithBreakdown(cartItem.cart_key, packageService, breakdown)
    return
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

const composeServiceName = (baseName, variantName) => {
  const safeBase = String(baseName || "").trim()
  const safeVariant = String(variantName || "").trim()
  if (!safeVariant) return safeBase
  const lowerBase = safeBase.toLowerCase()
  const lowerVariant = safeVariant.toLowerCase()
  if (lowerBase.endsWith(` - ${lowerVariant}`) || lowerBase === lowerVariant) return safeBase
  return `${safeBase} - ${safeVariant}`
}

const toPayloadItems = () => {
  const normalized = []

  for (const i of items.value) {
    const qty = Number(i.qty || 0)
    const packageQty = Number(i.package_qty || 0)
    const packagePrice = Number(i.package_price || 0)
    const canConvert = !i.is_package && i.package_service_id && packageQty > 0 && qty > 0 && qty % packageQty === 0 && packagePrice > 0

    if (canConvert) {
      const packageCount = qty / packageQty
      normalized.push({
        id: i.package_service_id,
        qty: packageCount,
        base_price: packagePrice,
        name: composeServiceName(i.package_name || i.name, i.variant_name),
        price_label: "PAKET",
        is_package: true,
        variant_name: i.variant_name || null,
        variant_service_id: i.variant_service_id || null
      })
      continue
    }

    normalized.push({
      id: i.id,
      qty: i.qty,
      base_price: i.base_price,
      name: composeServiceName(i.name, i.variant_name),
      price_label: i.price_label,
      is_package: Boolean(i.is_package),
      variant_name: i.variant_name || null,
      variant_service_id: i.variant_service_id || null,
      therapist_id: i.therapist_id || null,
      therapist_name: i.therapist_name || null
    })
  }

  return normalized
}

const loading = ref(false)
const lastOrder = ref({
  order_id: null,
  total: 0,
  items: []
})

// 🖨️ RECEIPT PREVIEW STATE
const showReceiptModal = ref(false)
const showPaymentConfirmModal = ref(false)
const receiptData = ref(null)
const receiptLoading = ref(false)
const pendingPayment = ref(null)
const pendingPrinted = ref(false)
const pendingFinalizedOrderId = ref(null)
// backward-compatible state for stale cached templates
const inPrintCartStep = ref(false)

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


const askPaymentDetails = async () => {
  const total = Math.round(Number(grandTotal.value || 0))

  const res = await SwalTheme.fire({
    icon: "question",
    title: "Metode Pembayaran",
    html: `
      <div style="text-align:left;margin-top:8px;">
        <label style="display:block;margin-bottom:6px;font-size:13px;">Metode</label>
        <select id="pay-method" class="swal2-input" style="margin:0 0 12px 0;max-width:100%;">
          <option value="CASH">CASH</option>
          <option value="QRIS">QRIS</option>
          <option value="DEBIT">DEBIT</option>
          <option value="CC">CC</option>
          <option value="TRANSFER BANK">TRANSFER BANK</option>
        </select>

        <label style="display:block;margin-bottom:6px;font-size:13px;">No Kartu Member (opsional)</label>
        <input id="pay-member-card" type="text" class="swal2-input" style="margin:0 0 6px 0;max-width:100%;" placeholder="contoh: MBR-000001" />
        <button id="btn-register-member" type="button" class="swal2-styled" style="background:#2d6cdf;margin:0 0 12px 0;">Daftar Member Baru</button>

        <label style="display:block;margin-bottom:6px;font-size:13px;">Discount Manual (Rp)</label>
        <input id="pay-discount" type="number" min="0" class="swal2-input" style="margin:0 0 12px 0;max-width:100%;" value="0" />

        <label id="pay-amount-label" style="display:block;margin-bottom:6px;font-size:13px;">Jumlah Bayar Cash (Rp)</label>
        <input id="pay-amount" type="number" min="0" class="swal2-input" style="margin:0;max-width:100%;" value="${total}" />
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Bayar",
    cancelButtonText: "Batal",
    didOpen: () => {
      const methodEl = document.getElementById("pay-method")
      const amountEl = document.getElementById("pay-amount")
      const amountLabelEl = document.getElementById("pay-amount-label")

      const toggleAmountInput = () => {
        const isCash = methodEl?.value === "CASH"
        if (amountEl) {
          amountEl.disabled = !isCash
          if (!isCash) amountEl.value = String(total)
        }
        if (amountLabelEl) {
          amountLabelEl.style.opacity = isCash ? "1" : "0.6"
        }
      }

      methodEl?.addEventListener("change", toggleAmountInput)
      toggleAmountInput()

      const registerBtn = document.getElementById('btn-register-member')
      registerBtn?.addEventListener('click', async () => {
        const reg = await SwalTheme.fire({
          title: 'Daftar Member Baru',
          html: `
            <input id="member-name" class="swal2-input" placeholder="Nama member" />
            <input id="member-phone" class="swal2-input" placeholder="No HP" />
            <select id="member-level" class="swal2-input"><option value="SILVER">SILVER</option><option value="GOLD">GOLD</option><option value="VIP">VIP</option></select>
            <select id="member-duration" class="swal2-input"><option value="MONTHLY">Bulanan</option><option value="6_MONTHS">6 Bulan</option><option value="YEARLY">Tahunan</option></select>
          `,
          showCancelButton: true,
          confirmButtonText: 'Simpan',
          preConfirm: async () => {
            const full_name = String(document.getElementById('member-name')?.value || '').trim()
            if (!full_name) { Swal.showValidationMessage('Nama wajib diisi'); return false }
            try {
              const res = await api.post('/memberships/members', {
                full_name,
                phone: String(document.getElementById('member-phone')?.value || '').trim() || null,
                level: String(document.getElementById('member-level')?.value || 'SILVER'),
                duration_type: String(document.getElementById('member-duration')?.value || 'MONTHLY')
              })
              return res.data
            } catch (err) {
              Swal.showValidationMessage(err?.response?.data?.message || 'Gagal daftar member')
              return false
            }
          }
        })
        if (reg.isConfirmed && reg.value?.card_no) {
          const cardInput = document.getElementById('pay-member-card')
          if (cardInput) cardInput.value = String(reg.value.card_no)
          await SwalTheme.fire({ icon: 'success', title: 'Member terdaftar', text: `No kartu: ${reg.value.card_no}` })
        }
      })

    },
    preConfirm: async () => {
      const method = String(document.getElementById("pay-method")?.value || "CASH").toUpperCase()
      const discountAmount = Math.max(0, Math.round(Number(document.getElementById("pay-discount")?.value || 0)))
      const membershipCardNo = String(document.getElementById('pay-member-card')?.value || '').trim()
      let membershipDiscountAmount = 0
      let membershipMemberName = null
      const subtotal = total

      if (membershipCardNo) {
        try {
          const calcRes = await api.post('/memberships/discount/validate', {
            card_no: membershipCardNo,
            items: toPayloadItems(),
            as_of: new Date().toISOString()
          })
          membershipDiscountAmount = Math.max(0, Math.round(Number(calcRes.data?.discount_amount || 0)))
          membershipMemberName = calcRes.data?.member?.full_name || null
        } catch (err) {
          Swal.showValidationMessage(err?.response?.data?.message || 'No kartu member tidak valid')
          return false
        }
      }

      const totalDiscount = discountAmount + membershipDiscountAmount
      if (subtotal > 0 && totalDiscount >= subtotal) {
        Swal.showValidationMessage("Total discount (manual + membership) harus lebih kecil dari subtotal")
        return false
      }
      const finalTotal = Math.max(0, subtotal - totalDiscount)

      let paymentAmount = Math.round(Number(document.getElementById("pay-amount")?.value || 0))
      if (method !== "CASH") paymentAmount = finalTotal
      if (method === "CASH" && paymentAmount < finalTotal) {
        Swal.showValidationMessage("Jumlah bayar cash kurang dari total setelah discount")
        return false
      }

      return {
        payment_method: method,
        discount_amount: discountAmount,
        membership_card_no: membershipCardNo || null,
        membership_discount_amount: membershipDiscountAmount,
        membership_member_name: membershipMemberName,
        payment_amount: paymentAmount
      }
    }
  })

  if (!res.isConfirmed) return null
  return res.value
}


const showFnbDeliveryGuardAlert = async () => {
  await SwalTheme.fire({
    icon: 'error',
    title: 'Pembayaran Gagal',
    text: 'Pembayaran Gagal, masih ada item FNB yang belum dideliver oleh BAR, Check ke BAR terlebih dahulu untuk deliver Item!',
    confirmButtonText: 'OK'
  })
}


const showSaveDraftFirstAlert = async () => {
  await SwalTheme.fire({
    icon: 'warning',
    title: 'Verifikasi Order',
    text: 'masukan ke draft dulu untuk verifikasi order',
    confirmButtonText: 'OK'
  })
}

const getResolvedCartServiceId = (item) => Number(item?.variant_service_id || item?.id || 0)
const getResolvedOrderServiceId = (item) => Number(item?.resolved_service_id || item?.variant_service_id || item?.service_id || 0)

const mapQtyByResolvedService = (rows = [], resolver = () => 0) => {
  const qtyMap = new Map()
  for (const row of rows) {
    const resolvedId = Number(resolver(row) || 0)
    const qty = Number(row?.qty || 0)
    if (!(resolvedId > 0) || !(qty > 0)) continue
    qtyMap.set(resolvedId, (qtyMap.get(resolvedId) || 0) + qty)
  }
  return qtyMap
}

const hasUnsyncedCartChanges = (orderItems = []) => {
  const orderQtyMap = mapQtyByResolvedService(Array.isArray(orderItems) ? orderItems : [], getResolvedOrderServiceId)
  const cartQtyMap = mapQtyByResolvedService(items.value || [], getResolvedCartServiceId)

  if (orderQtyMap.size !== cartQtyMap.size) return true
  for (const [serviceId, qty] of cartQtyMap.entries()) {
    if (Number(orderQtyMap.get(serviceId) || 0) !== Number(qty || 0)) return true
  }

  return false
}

const guardCheckoutByBarDelivery = async () => {
  if (!pos.currentOrderId) {
    if ((items.value || []).length > 0) {
      await showSaveDraftFirstAlert()
      return false
    }
    return true
  }

  try {
    const { data } = await api.get(`/orders/${pos.currentOrderId}`)
    const orderItems = Array.isArray(data?.items) ? data.items : []

    if (hasUnsyncedCartChanges(orderItems)) {
      await showSaveDraftFirstAlert()
      return false
    }

    const hasUndeliveredFnb = orderItems.some((item) => Boolean(item?.is_fnb) && Number(item?.qty || 0) > 0 && !Boolean(item?.is_delivered))

    if (hasUndeliveredFnb) {
      await showFnbDeliveryGuardAlert()
      return false
    }

    return true
  } catch (err) {
    await SwalTheme.fire({
      icon: 'error',
      title: 'Gagal',
      text: err.response?.data?.message || err.message || 'Gagal validasi status delivery BAR',
      confirmButtonText: 'OK'
    })
    return false
  }
}

const buildDraftReceiptPreview = (payment) => {
  const subtotal = Math.round(Number(grandTotal.value || 0))
  const manualDiscount = Math.max(0, Math.round(Number(payment?.discount_amount || 0)))
  const membershipDiscount = Math.max(0, Math.round(Number(payment?.membership_discount_amount || 0)))
  const discount = manualDiscount + membershipDiscount
  const total = Math.max(0, subtotal - discount)
  const method = String(payment?.payment_method || 'CASH').toUpperCase()
  const paymentAmount = method === 'CASH'
    ? Math.max(total, Math.round(Number(payment?.payment_amount || 0)))
    : total

  return {
    id: '-',
    created_at: new Date().toISOString(),
    payment_method: method,
    subtotal,
    discount_amount: discount,
    membership_discount_amount: membershipDiscount,
    membership_card_no: payment?.membership_card_no || null,
    total,
    payment_amount: paymentAmount,
    change_amount: Math.max(0, paymentAmount - total),
    cashier_name: '-',
    items: (items.value || []).map((it, idx) => ({
      service_id: it.id || idx,
      service_name: composeServiceName(it.name, it.variant_name),
      qty: Number(it.qty || 0),
      price: Number(it.base_price || 0),
      subtotal: Number(it.base_price || 0) * Number(it.qty || 0),
      therapist_name: it.therapist_name || null
    }))
  }
}

const finalizeOrderForPrint = async () => {
  if (pendingFinalizedOrderId.value) return pendingFinalizedOrderId.value
  if (!pendingPayment.value) throw new Error('Data pembayaran belum tersedia')

  const payload = {
    items: toPayloadItems(),
    payment_method: pendingPayment.value.payment_method,
    discount_amount: pendingPayment.value.discount_amount,
    payment_amount: pendingPayment.value.payment_amount,
    membership_card_no: pendingPayment.value.membership_card_no || null
  }

  let res
  if (pos.currentOrderId) {
    res = await api.post(`/orders/${pos.currentOrderId}/close`, payload)
  } else {
    res = await api.post('/orders/pos', payload)
  }

  pendingFinalizedOrderId.value = Number(res.data?.order_id)
  return pendingFinalizedOrderId.value
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

  const canCheckout = await guardCheckoutByBarDelivery()
  if (!canCheckout) return

  const payment = await askPaymentDetails()
  if (!payment) return

  pendingPayment.value = payment
  pendingPrinted.value = false
  pendingFinalizedOrderId.value = null
  inPrintCartStep.value = false
  receiptData.value = buildDraftReceiptPreview(payment)
  showPaymentConfirmModal.value = true
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


const finalizeCompletedOrder = async (orderId) => {
  pendingPrinted.value = false
  pendingPayment.value = null
  pendingFinalizedOrderId.value = null
  pos.clear()

  try {
    await api.post(`/timers/from-order/${orderId}`)
  } catch (e) {
    console.warn("Timer tidak dibuat:", e?.message || e)
  }

  router.push("/kasir")
}


// lanjut ke modal print utama (tanpa modal perantara draft)

const askCashAmountCorrection = async (minimumAmount) => {
  const { value, isConfirmed } = await SwalTheme.fire({
    title: 'Masukkan Jumlah Uang',
    html: `
      <div style="text-align:left;margin-top:8px;">
        <label style="display:block;margin-bottom:6px;font-size:13px;">Jumlah Bayar Cash (Rp)</label>
        <input id="pay-amount-correction" type="number" min="${Math.max(0, Number(minimumAmount || 0))}" class="swal2-input" style="margin:0;max-width:100%;" value="${Math.max(0, Number(minimumAmount || 0))}" />
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Simpan',
    cancelButtonText: 'Batal',
    focusConfirm: false,
    preConfirm: async () => {
      const raw = document.getElementById('pay-amount-correction')?.value
      const amount = Math.round(Number(raw || 0))
      if (amount < Number(minimumAmount || 0)) {
        Swal.showValidationMessage(`Jumlah bayar cash minimal Rp ${format(minimumAmount)}`)
        return false
      }
      return amount
    }
  })

  if (!isConfirmed) return null
  return Number(value || 0)
}

const proceedToPrintCartStep = async () => {
  try {
    receiptLoading.value = true
    const orderId = await finalizeOrderForPrint()
    const detailRes = await api.get(`/orders/${orderId}/detail`)
    receiptData.value = detailRes.data

    showPaymentConfirmModal.value = false
    showReceiptModal.value = true
    inPrintCartStep.value = true
  } catch (err) {
    const message = err.response?.data?.message || err.message || "Gagal menyiapkan print cart"

    if (pendingPayment.value?.payment_method === 'CASH' && /Jumlah bayar cash kurang/i.test(String(message || ''))) {
      const subtotal = Math.round(Number(grandTotal.value || 0))
      const discountAmount = Math.max(0, Math.round(Number(pendingPayment.value?.discount_amount || 0)))
      const minimumAmount = Math.max(0, subtotal - discountAmount)
      const correctedAmount = await askCashAmountCorrection(minimumAmount)
      if (correctedAmount !== null) {
        pendingPayment.value = {
          ...pendingPayment.value,
          payment_amount: correctedAmount
        }
        receiptData.value = buildDraftReceiptPreview(pendingPayment.value)
      }
      return
    }

    await SwalTheme.fire({
      icon: "error",
      title: "Gagal",
      text: message,
      confirmButtonText: "OK"
    })
  } finally {
    receiptLoading.value = false
  }
}

const closePaymentConfirmModal = async () => {
  showPaymentConfirmModal.value = false
  receiptData.value = null
  pendingPayment.value = null
  pendingPrinted.value = false
  pendingFinalizedOrderId.value = null
  inPrintCartStep.value = false
}

// 🖨️ CLOSE RECEIPT MODAL
const closeReceiptModal = async () => {
  showReceiptModal.value = false
  showPaymentConfirmModal.value = false
  receiptData.value = null
  inPrintCartStep.value = false

  if (pendingPrinted.value && pendingFinalizedOrderId.value) {
    await finalizeCompletedOrder(pendingFinalizedOrderId.value)
  }
}

const openBrowserPrintPreview = () => {
  const receiptNode = document.getElementById('receipt-print')
  if (!receiptNode) {
    window.print()
    return
  }

  const printWindow = window.open('', '_blank', 'width=420,height=900')
  if (!printWindow) {
    window.print()
    return
  }

  const styleContent = `
    <style>
      @page { size: 80mm auto; margin: 0; }
      body { margin:0; background:#fff; color:#111; font-family:'Courier New', monospace; }
      .print-shell { width:80mm; margin:0 auto; padding:4mm 3mm; box-sizing:border-box; }
      .print-shell * { color:#111 !important; }
      .print-shell .receipt-preview { max-height:none !important; overflow:visible !important; border:none !important; }
      .print-shell .receipt { box-shadow:none !important; border:none !important; }
    </style>
  `

  printWindow.document.open()
  printWindow.document.write(`<!doctype html><html><head><title>Print POS</title>${styleContent}</head><body><div class="print-shell">${receiptNode.outerHTML}</div></body></html>`)
  printWindow.document.close()

  setTimeout(() => {
    printWindow.focus()
    printWindow.print()
  }, 250)

  printWindow.onafterprint = () => {
    printWindow.close()
  }
}

// 🖨️ PRINT RECEIPT
const printReceipt = async () => {
  try {
    let orderId = pendingFinalizedOrderId.value
    if (!orderId) {
      orderId = await finalizeOrderForPrint()
    }

    // Thermal print best-effort, order tetap bisa difinalisasi
    let thermalPrinted = true
    try {
      await api.post(`/printers/print-order`, {
        order_id: orderId,
        printer: getPrinterAgentConfig()
      })
    } catch (err) {
      thermalPrinted = false
      console.warn('Thermal print failed, order will still be finalized:', err?.message || err)
    }

    pendingPrinted.value = true
    showReceiptModal.value = false
    receiptData.value = null

    await SwalTheme.fire({
      icon: thermalPrinted ? 'success' : 'warning',
      title: thermalPrinted ? 'Print POS dikirim' : 'Printer tidak terkoneksi',
      text: thermalPrinted
        ? '🖨 Struk berhasil dikirim ke printer POS.'
        : 'Printer tidak terkoneksi, silahkan lakukan print ulang jika printer sudah terkoneksi.',
      confirmButtonText: 'OK'
    })

    await finalizeCompletedOrder(orderId)
  } catch (err) {
    await SwalTheme.fire({
      icon: 'error',
      title: 'Gagal print POS',
      text: err.response?.data?.message || err.message || 'Gagal cetak',
      confirmButtonText: 'OK'
    })
  }
}

// 🖨️ PRINT TO THERMAL PRINTER (existing function - optional)
const printOrder = async (order_id = lastOrder.value.order_id) => {
  try {
    await api.post(`/printers/print-order`, {
      order_id,
      printer: getPrinterAgentConfig()
    })
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
    html: `
      <p style="margin-bottom:12px;">Order akan masuk ke daftar order sebagai draft.</p>
      <textarea id="bar-note-input" class="swal2-textarea" placeholder="Catatan untuk bar (opsional), contoh: less sugar / tanpa es"></textarea>
    `,
    showCancelButton: true,
    confirmButtonText: "Simpan",
    cancelButtonText: "Batal",
    focusConfirm: false,
    preConfirm: async () => {
      const noteInput = document.getElementById("bar-note-input")
      return noteInput ? String(noteInput.value || "").trim() : ""
    }
  })

  if (!res.isConfirmed) return

  loading.value = true
  try {
    const payload = {
      items: toPayloadItems(),
      bar_note: res.value || null
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
  min-height: 0;
}

.items-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
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

.item-locked {
  display: inline-block;
  margin-top: 4px;
  font-size: 10px;
  color: #888;
}

.cart-item.locked {
  opacity: .92;
}

.cart-item.locked .qty button,
.cart-item.locked .remove {
  opacity: .45;
  cursor: not-allowed;
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
  margin-top: 10px;
  padding-top: 14px;
  border-top: 1px solid #222;
  background: #0e0e0e;
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
:deep(.swal2-container) { z-index: 20000 !important; }

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

.receipt-logo {
  max-width: 110px;
  max-height: 60px;
  object-fit: contain;
  margin-bottom: 6px;
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

.item-meta { display:block; font-size:10px; color:#666; }
</style>
