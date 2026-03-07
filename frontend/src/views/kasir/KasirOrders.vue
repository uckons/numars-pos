<template>
  <div class="orders-page">
<header class="page-header">
  <div class="header-left">
    <button class="back-btn" @click="goBack">
      ← Kembali ke Kasir
    </button>

    <div>
      <h1>Daftar Order</h1>
      <span class="subtitle">Semua transaksi kasir</span>
    </div>
  </div>
</header>
<!-- 🔍 FILTER SECTION -->
<div class="filter-section">
  <div class="filter-row">
    <!-- Status Filter -->
    <div class="filter-item">
      <label>Status</label>
      <select v-model="filters.status">
        <option value="ALL">Semua Status</option>
        <option value="PAID">PAID</option>
        <option value="DRAFT">DRAFT</option>
        <option value="CANCELLED">CANCELLED</option>
      </select>
    </div>

    <!-- Date Range Filter -->
    <div class="filter-item">
      <label>Periode</label>
      <select v-model="filters.dateRange">
        <option value="today">Hari Ini</option>
        <option value="7days">7 Hari Terakhir</option>
        <option value="30days">30 Hari Terakhir</option>
        <option value="month">Bulan Ini</option>
        <option value="all">Semua</option>
        <option value="custom">Custom</option>
      </select>
    </div>

    <div class="filter-item">
      <label>Tanggal (Kalender)</label>
      <input type="date" v-model="filters.specificDate" />
    </div>

    <!-- Custom Date Range -->
    <div v-if="filters.dateRange === 'custom'" class="filter-item">
      <label>Dari</label>
      <input type="date" v-model="filters.dateFrom" />
    </div>

    <div v-if="filters.dateRange === 'custom'" class="filter-item">
      <label>Sampai</label>
      <input type="date" v-model="filters.dateTo" />
    </div>

    <!-- Therapist Filter -->
    <div class="filter-item">
      <label>Terapis</label>
      <select v-model="filters.therapistId">
        <option value="">Semua Terapis</option>
        <option v-for="t in therapists" :key="t.id" :value="t.id">
          {{ t.name }}
        </option>
      </select>
    </div>

    <!-- Room Filter -->
    <div class="filter-item">
      <label>Room</label>
      <select v-model="filters.roomId">
        <option value="">Semua Room</option>
        <option v-for="r in rooms" :key="r.id" :value="r.id">
          {{ r.name }}
        </option>
      </select>
    </div>

    <!-- Reset Button -->
    <div class="filter-item">
      <label>&nbsp;</label>
      <button class="btn-reset" @click="resetFilters">
        Reset
      </button>
    </div>
  </div>

  <!-- Loading indicator -->
  <div v-if="loading" class="loading">
    🔄 Loading...
  </div>

  <!-- Result count -->
  <div class="result-count">
    Menampilkan {{ orders.length }} dari {{ pagination.totalRecords }} transaksi
  (Halaman {{ pagination.page }} dari {{ pagination.totalPages }})
  </div>

  <div class="bulk-actions">
    <span>{{ selectedOrderIds.length }} order dipilih</span>
    <button
      class="btn-bulk-pay"
      :disabled="selectedOrderIds.length === 0 || loading"
      @click="paySelectedOrders"
    >
      Bayar Gabungan
    </button>
    <button
      v-if="lastBulkReceiptForReprint"
      class="btn-bulk-reprint"
      :disabled="loading || printLoading"
      @click="reprintLastBulkPayment"
    >
      Reprint Copy Kasir
    </button>
    <button
      v-if="bulkReceiptHistory.length > 1"
      class="btn-bulk-reprint"
      :disabled="loading || printLoading"
      @click="openBulkReprintHistory"
    >
      Riwayat Reprint
    </button>
  </div>
</div>

    <div class="table-wrapper">
      <table class="orders-table">
<thead>
  <tr>
    <th class="select-col">
      <input
        type="checkbox"
        :checked="isAllDraftOnPageSelected"
        :disabled="draftOrderIdsOnPage.length === 0"
        @change="toggleSelectAllDraft($event.target.checked)"
      />
    </th>
    <th>#</th>
    <th>Tanggal</th>
    <th>Service</th>
    <th>Terapis</th>
    <th>Room / Sofa</th>
    <th>Total</th>
    <th>Status</th>
    <th>Aksi</th>
  </tr>
</thead>


<tbody>
  <tr v-for="o in orders" :key="o.id">
    <td class="select-col">
      <input
        v-if="o.status === 'DRAFT'"
        type="checkbox"
        :checked="selectedOrderIds.includes(o.id)"
        @change="toggleOrderSelection(o.id, $event.target.checked)"
      />
    </td>
    <td>#{{ o.id }}</td>

    <td>{{ formatDate(o.created_at) }}</td>

    <!-- SERVICE -->
    <td>
      <div
        v-for="(i, idx) in o.items || []"
        :key="idx"
        class="service-item"
      >
        <div class="service-line">
          <span>{{ i.service_name }}</span>
          <small>×{{ i.qty }} <span v-if="i.is_fnb && i.is_delivered" class="delivered-check">✅</span></small>
        </div>
        <small v-if="i.therapist_name" class="service-meta">Terapis: {{ i.therapist_name }}</small>
      </div>
    </td>

    <!-- TERAPIS -->
        <!-- TERAPIS -->
    <td>
      <span v-if="o.therapist_name">
        {{ o.therapist_name }}
      </span>
      <span v-else class="muted">-</span>
    </td>

    <!-- ROOM / SOFA -->
    <td>
      <span v-if="o.room_name">
        {{ o.room_name }}
      </span>
      <span v-else class="muted">-</span>
    </td>

    <!-- TOTAL -->
    <td class="price">
      Rp {{ format(o.total) }}
    </td>

    <!-- STATUS -->
    <td>
      <span
        class="badge"
        :class="o.status === 'PAID' ? 'paid' : 'draft'"
      >
        {{ o.status }}
      </span>
    </td>

    <!-- AKSI -->
    <td>
      <template v-if="o.status === 'DRAFT'">
        <button
          class="btn add-item"
          @click="addItemToDraft(o)"
        >
          + Item
        </button>
        <button
          class="btn void"
          @click="voidDraft(o)"
        >
          VOID
        </button>
        <button
          class="btn pay"
          @click="confirmPay(o)"
        >
          PAY
        </button>
      </template>
      <button
        v-else-if="o.status === 'PAID'"
        class="btn print"
        @click="reprintReceipt(o.id)"
        :disabled="printLoading"
      >
        🖨️ Print
      </button>
      <template v-else-if="o.status === 'CANCELLED'">
        <button
          class="btn undo"
          @click="undoVoid(o)"
        >
          Undo Void
        </button>
      </template>
      <span v-else>✓</span>
    </td>
  </tr>
</tbody>

      </table>
<!-- 📄 PAGINATION CONTROLS -->
      <div v-if="orders.length > 0" class="pagination-section">
        <!-- Per Page Selector -->
        <div class="per-page">
          <label>Tampilkan:</label>
          <select v-model.number="pagination.limit" @change="changeLimit(pagination.limit)">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
          <span>per halaman</span>
        </div>

        <!-- Page Navigation -->
        <div class="page-navigation">
          <!-- Prev Button -->
          <button 
            class="page-btn" 
            :disabled="pagination.page === 1"
            @click="prevPage"
          >
            ← Prev
          </button>

          <!-- Page Numbers -->
          <div class="page-numbers">
            <!-- First Page -->
            <button
              v-if="pagination.page > 3"
              class="page-num"
              @click="changePage(1)"
            >
              1
            </button>
            <span v-if="pagination.page > 3" class="dots">...</span>

            <!-- Pages around current -->
            <button
              v-for="p in getPageRange()"
              :key="p"
              class="page-num"
              :class="{ active: p === pagination.page }"
              @click="changePage(p)"
            >
              {{ p }}
            </button>

            <!-- Last Page -->
            <span v-if="pagination.page < pagination.totalPages - 2" class="dots">...</span>
            <button
              v-if="pagination.page < pagination.totalPages - 2"
              class="page-num"
              @click="changePage(pagination.totalPages)"
            >
              {{ pagination.totalPages }}
            </button>
          </div>

          <!-- Next Button -->
          <button 
            class="page-btn" 
            :disabled="pagination.page === pagination.totalPages"
            @click="nextPage"
          >
            Next →
          </button>
        </div>

        <!-- Jump to Page -->
        <div class="jump-to-page">
          <label>Ke halaman:</label>
          <input 
            type="number" 
            min="1" 
            :max="pagination.totalPages"
            v-model.number="pagination.page"
            @keyup.enter="changePage(pagination.page)"
          />
          <button @click="changePage(pagination.page)">Go</button>
        </div>
      </div>

      <div v-if="orders.length === 0" class="empty">
        Tidak ada order
      </div>
    </div>
  </div>

  <!-- 🖨️ PRINT RECEIPT MODAL -->
  <div v-if="showPrintModal" class="modal-overlay" @click="closePrintModal">
    <div class="modal-content print-modal" @click.stop>
      <!-- Close Button -->
      <button class="modal-close" @click="closePrintModal">✕</button>

      <!-- Print Preview -->
      <div class="receipt-preview" id="receipt-print">
        <div v-if="!bulkReceipt" class="receipt" :class="{ 'receipt--compact': isCompactReceipt }">
          <!-- Header -->
          <div class="receipt-header">
            <h2>{{ printOrder?.branch_name || 'NUMARS SPA' }}</h2>
            <p>{{ printOrder?.branch_address }}</p>
            <p>Tel: {{ printOrder?.branch_phone }}</p>
          </div>

          <div class="receipt-divider">================================</div>

          <!-- Order Info -->
          <div class="receipt-info">
            <div class="info-row">
              <span>No Order:</span>
              <span>#{{ printOrder?.id }}</span>
            </div>
            <div class="info-row">
              <span>Tanggal:</span>
              <span>{{ formatDateTime(printOrder?.created_at) }}</span>
            </div>
            <div class="info-row">
              <span>Kasir:</span>
              <span>{{ printOrder?.cashier_name }}</span>
            </div>
            <div class="info-row">
              <span>Terapis:</span>
              <span>{{ printOrder?.therapist_name || '-' }}</span>
            </div>
            <div class="info-row">
              <span>Room:</span>
              <span>{{ printOrder?.room_name || '-' }}</span>
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
            <div v-for="(item, idx) in printOrder?.items" :key="`${item.service_id}-${idx}`" class="item-row">
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
              <span>TOTAL:</span>
              <span class="total-amount">{{ formatRupiah(printOrder?.total) }}</span>
            </div>
            <div class="total-row">
              <span>Bayar:</span>
              <span>{{ formatRupiah(printOrder?.payment_amount) }}</span>
            </div>
            <div class="total-row">
              <span>Kembali:</span>
              <span>{{ formatRupiah(printOrder?.change_amount) }}</span>
            </div>
            <div class="total-row payment-method">
              <span>Metode:</span>
              <span>{{ printOrder?.payment_method || 'CASH' }}</span>
            </div>
          </div>

          <div class="receipt-divider">================================</div>

          <!-- Footer -->
          <div class="receipt-footer">
            <p>Terima kasih atas kunjungan Anda</p>
            <p>Semoga sehat selalu!</p>
            <p class="reprint-note">*** REPRINT ***</p>
          </div>
        </div>

        <div v-else class="receipt" :class="{ 'receipt--compact': isCompactReceipt }">
          <div class="receipt-header">
            <h2>{{ bulkReceipt.branch_name || 'NUMARS SPA' }}</h2>
            <p>{{ bulkReceipt.branch_address }}</p>
            <p>Tel: {{ bulkReceipt.branch_phone }}</p>
          </div>

          <div class="receipt-divider">================================</div>

          <div class="receipt-info">
            <div class="info-row">
              <span>Tipe:</span>
              <span>PEMBAYARAN GABUNGAN</span>
            </div>
            <div class="info-row">
              <span>Order:</span>
              <span>{{ bulkReceipt.order_ids.map((id) => `#${id}`).join(', ') }}</span>
            </div>
            <div class="info-row">
              <span>Tanggal:</span>
              <span>{{ formatDateTime(bulkReceipt.paid_at) }}</span>
            </div>
            <div class="info-row">
              <span>Kasir:</span>
              <span>{{ bulkReceipt.cashier_name }}</span>
            </div>
          </div>

          <div class="receipt-divider">================================</div>

          <div class="receipt-items">
            <div class="item-header">
              <span>Item</span>
              <span>Qty</span>
              <span>Subtotal</span>
            </div>
            <div v-for="item in bulkReceipt.items" :key="item._key" class="item-row">
              <div class="item-name">
                <div>[#{{ item.order_id }}] {{ item.service_name }}</div>
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

          <div class="receipt-total">
            <div class="total-row">
              <span>TOTAL GABUNGAN:</span>
              <span class="total-amount">{{ formatRupiah(bulkReceipt.total) }}</span>
            </div>
            <div class="total-row">
              <span>HARUS DIBAYAR:</span>
              <span>{{ formatRupiah(bulkReceipt.payment_amount) }}</span>
            </div>
            <div class="total-row payment-method">
              <span>Metode:</span>
              <span>{{ bulkReceipt.payment_method || 'CASH' }}</span>
            </div>
          </div>

          <div class="receipt-divider">================================</div>

          <div class="receipt-footer">
            <p>Terima kasih atas kunjungan Anda</p>
            <p>Semoga sehat selalu!</p>
            <p class="reprint-note">*** BULK PAYMENT ***</p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="modal-actions">
        <button class="btn btn-print" @click="sendToThermalPrinter" :disabled="printLoading">
          🖨️ Print Sekarang
        </button>
        <button class="btn btn-cancel" @click="printReceipt" :disabled="printLoading">
          Preview Browser
        </button>
        <button class="btn btn-cancel" @click="closePrintModal">
          Batal
        </button>
      </div>
    </div>
  </div>

</template>
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue"
import { useRouter } from "vue-router"
import Swal from "sweetalert2"
import api from "@/services/api"
import { getPrinterAgentConfig } from "@/utils/printerAgentConfig"

const router = useRouter()
const orders = ref([])
const loading = ref(false)
const selectedOrderIds = ref([])
const draftOrderIdsOnPage = computed(() =>
  orders.value.filter((order) => order.status === "DRAFT").map((order) => Number(order.id))
)
const isAllDraftOnPageSelected = computed(() =>
  draftOrderIdsOnPage.value.length > 0
  && draftOrderIdsOnPage.value.every((id) => selectedOrderIds.value.includes(id))
)

// 🔍 FILTER STATE
const filters = ref({
  status: 'ALL',
  dateRange: 'all',
  dateFrom: '',
  dateTo: '',
  therapistId: '',
  roomId: '',
  specificDate: ''
})
// 📄 PAGINATION STATE
const pagination = ref({
  page: 1,
  limit: 25,
  totalRecords: 0,
  totalPages: 0
})
// 📋 MASTER DATA
const therapists = ref([])
const rooms = ref([])

// 🔄 LOAD ORDERS WITH FILTERS
// 🔄 LOAD ORDERS WITH FILTERS
const loadOrders = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit
    }
    
    // Status filter
    if (filters.value.status !== 'ALL') {
      params.status = filters.value.status
    }
    
    // Date range filter
    const today = new Date().toISOString().split('T')[0]

    if (filters.value.specificDate) {
      params.date_from = filters.value.specificDate
      params.date_to = filters.value.specificDate
    } else if (filters.value.dateRange === 'today') {
      params.date_from = today
      params.date_to = today
    } else if (filters.value.dateRange === '7days') {
      const from = new Date()
      from.setDate(from.getDate() - 6)
      params.date_from = from.toISOString().split('T')[0]
      params.date_to = today
    } else if (filters.value.dateRange === '30days') {
      const from = new Date()
      from.setDate(from.getDate() - 29)
      params.date_from = from.toISOString().split('T')[0]
      params.date_to = today
    } else if (filters.value.dateRange === 'month') {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      params.date_from = firstDay.toISOString().split('T')[0]
      params.date_to = today
    } else if (filters.value.dateRange === 'custom') {
      if (filters.value.dateFrom) params.date_from = filters.value.dateFrom
      if (filters.value.dateTo) params.date_to = filters.value.dateTo
    } else if (filters.value.dateRange === 'all') {
      // No date filter
    }
    
    // Therapist filter
    if (filters.value.therapistId) {
      params.therapist_id = filters.value.therapistId
    }
    
    // Room filter
    if (filters.value.roomId) {
      params.room_id = filters.value.roomId
    }
    
    const res = await api.get("/orders/kasir", { params })
    
    // 📄 UPDATE DATA & PAGINATION
    orders.value = res.data.data
    selectedOrderIds.value = selectedOrderIds.value.filter((id) =>
      orders.value.some((order) => Number(order.id) === Number(id) && order.status === "DRAFT")
    )
    pagination.value = {
      page: res.data.pagination.page,
      limit: res.data.pagination.limit,
      totalRecords: res.data.pagination.totalRecords,
      totalPages: res.data.pagination.totalPages
    }
  } catch (err) {
    console.error("Failed to load orders:", err)
  } finally {
    loading.value = false
  }
}

// 📋 LOAD THERAPISTS
const loadTherapists = async () => {
  try {
    const res = await api.get("/therapists")
    therapists.value = Array.isArray(res.data)
      ? res.data
      : (res.data?.data || [])
  } catch (err) {
    console.error("Failed to load therapists:", err)
    therapists.value = []
  }
}

// 📋 LOAD ROOMS
const loadRooms = async () => {
  try {
    const res = await api.get("/rooms")
    rooms.value = res.data
  } catch (err) {
    console.error("Failed to load rooms:", err)
  }
}

const getUndeliveredFnbItems = (order) => {
  const items = Array.isArray(order?.items) ? order.items : []
  return items.filter((item) => Boolean(item?.is_fnb) && Number(item?.qty || 0) > 0 && !Boolean(item?.is_delivered))
}

const showFnbDeliveryGuardAlert = async () => {
  await Swal.fire({
    icon: 'error',
    title: 'Pembayaran Gagal',
    text: 'Pembayaran Gagal, masih ada item FNB yang belum dideliver oleh BAR, Check ke BAR terlebih dahulu untuk deliver Item!',
    confirmButtonColor: '#c9a24d',
    background: '#111',
    color: '#fff'
  })
}

// 🔄 WATCH FILTERS - RESET PAGE
watch(filters, () => {
  pagination.value.page = 1
  loadOrders()
}, { deep: true })

// 💳 CONFIRM PAY
const confirmPay = async (order) => {
  if (getUndeliveredFnbItems(order).length > 0) {
    await showFnbDeliveryGuardAlert()
    return
  }

  const res = await Swal.fire({
    title: "Checkout Order?",
    text: `Order #${order.id} akan dibayar`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Ya, Bayar",
    cancelButtonText: "Batal",
    confirmButtonColor: "#c9a24d",
    background: "#111",
    color: "#fff"
  })

  if (!res.isConfirmed) return

  router.push({
    path: "/kasir/pos",
    query: { order_id: order.id }
  })
}

const toggleSelectAllDraft = (checked) => {
  if (checked) {
    selectedOrderIds.value = [...new Set([...selectedOrderIds.value, ...draftOrderIdsOnPage.value])]
    return
  }
  selectedOrderIds.value = selectedOrderIds.value.filter((id) => !draftOrderIdsOnPage.value.includes(id))
}

const toggleOrderSelection = (orderId, checked) => {
  const id = Number(orderId)
  if (checked) {
    if (!selectedOrderIds.value.includes(id)) {
      selectedOrderIds.value.push(id)
    }
    return
  }
  selectedOrderIds.value = selectedOrderIds.value.filter((selectedId) => selectedId !== id)
}

const askPrintAfterBulkPayment = async (paidOrderIds, totalAmount, paymentMethod = 'CASH') => {
  if (!paidOrderIds.length) return

  const decision = await Swal.fire({
    icon: 'success',
    title: 'Pembayaran gabungan berhasil',
    html: `${paidOrderIds.length} order dibayar. Total tagihan Rp <b>${format(totalAmount || 0)}</b><br/>Cetak 1 struk gabungan sekarang?`,
    showCancelButton: true,
    confirmButtonText: 'Ya, Cetak 1 Struk',
    cancelButtonText: 'Nanti',
    confirmButtonColor: '#c9a24d',
    background: '#111',
    color: '#fff'
  })

  if (!decision.isConfirmed) return

  await openBulkReceipt(paidOrderIds, totalAmount, paymentMethod)
}

const paySelectedOrders = async () => {
  if (selectedOrderIds.value.length === 0) return

  const selectedDraftOrders = orders.value.filter((order) =>
    order.status === 'DRAFT' && selectedOrderIds.value.includes(Number(order.id))
  )
  const hasUndeliveredFnb = selectedDraftOrders.some((order) => getUndeliveredFnbItems(order).length > 0)

  if (hasUndeliveredFnb) {
    await showFnbDeliveryGuardAlert()
    return
  }

  const confirm = await Swal.fire({
    title: 'Bayar gabungan?',
    html: `Akan membayar <b>${selectedOrderIds.value.length}</b> order DRAFT sekaligus.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Lanjut',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#c9a24d',
    background: '#111',
    color: '#fff'
  })

  if (!confirm.isConfirmed) return

  const methodPick = await Swal.fire({
    title: 'Pilih metode pembayaran',
    input: 'select',
    inputOptions: {
      CASH: 'CASH',
      QRIS: 'QRIS',
      DEBIT: 'DEBIT',
      CC: 'CC',
      'TRANSFER BANK': 'TRANSFER BANK'
    },
    inputValue: 'CASH',
    showCancelButton: true,
    confirmButtonText: 'Bayar Sekarang',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#c9a24d',
    background: '#111',
    color: '#fff',
    didOpen: () => {
      const selectEl = document.querySelector('.swal2-select')
      if (selectEl) {
        selectEl.style.background = '#111'
        selectEl.style.color = '#fff'
        selectEl.style.border = '1px solid #c9a24d'
        for (const opt of selectEl.options) {
          opt.style.color = '#111'
          opt.style.background = '#fff'
        }
      }
    }
  })

  if (!methodPick.isConfirmed || !methodPick.value) return

  try {
    loading.value = true
    const requestedIds = [...selectedOrderIds.value]
    const selectedMethod = String(methodPick.value || 'CASH').toUpperCase()
    const { data } = await api.post('/orders/pay-bulk', {
      order_ids: requestedIds,
      payment_method: selectedMethod
    })

    const paidOrderIds = Array.isArray(data?.paid_order_ids) && data.paid_order_ids.length
      ? data.paid_order_ids.map((id) => Number(id))
      : requestedIds

    selectedOrderIds.value = []
    await loadOrders()
    await askPrintAfterBulkPayment(paidOrderIds, Number(data?.total || 0), String(data?.payment_method || 'CASH'))
  } catch (err) {
    await Swal.fire({
      icon: 'error',
      title: 'Gagal bayar gabungan',
      text: err.response?.data?.message || 'Terjadi kesalahan',
      background: '#111',
      color: '#fff'
    })
  } finally {
    loading.value = false
  }
}
const addItemToDraft = (order) => {
  router.push({
    path: "/kasir/pos",
    query: { order_id: order.id }
  })
}


const voidDraft = async (order) => {
  const res = await Swal.fire({
    title: 'Void draft ini?',
    text: `Order #${order.id} akan dibatalkan. Stock FNB dikembalikan dan kerja terapis pada order ini dihapus.`,
    icon: 'warning',
    input: 'textarea',
    inputLabel: 'Void Reason (wajib)',
    inputPlaceholder: 'Masukkan alasan void...',
    inputAttributes: {
      'aria-label': 'Void Reason'
    },
    inputValidator: (value) => {
      if (!String(value || '').trim()) {
        return 'Void Reason wajib diisi'
      }
      return null
    },
    showCancelButton: true,
    confirmButtonText: 'Ya, Void',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#d33',
    background: '#111',
    color: '#fff'
  })

  if (!res.isConfirmed) return

  try {
    await api.delete(`/orders/${order.id}`, {
      data: { reason: String(res.value || '').trim() }
    })
    await loadOrders()
    await Swal.fire({
      icon: 'success',
      title: 'Draft berhasil di-void',
      timer: 1200,
      showConfirmButton: false,
      background: '#111',
      color: '#fff'
    })
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal void draft',
      text: err.response?.data?.message || 'Terjadi kesalahan',
      background: '#111',
      color: '#fff'
    })
  }
}

const undoVoid = async (order) => {
  const confirm = await Swal.fire({
    title: `Undo void order #${order.id}?`,
    text: 'Undo terbatas hanya beberapa menit setelah void. Jika lewat batas waktu, sistem akan menolak.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Ya, Undo',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#c9a24d',
    background: '#111',
    color: '#fff'
  })

  if (!confirm.isConfirmed) return

  try {
    const { data } = await api.post(`/orders/${order.id}/undo-void/request`, { reason: 'Kasir meminta undo void' })
    await loadOrders()
    await Swal.fire({
      icon: 'success',
      title: 'Request undo terkirim',
      text: `Request #${data?.request?.id || '-'} menunggu approval supervisor / manager`,
      background: '#111',
      color: '#fff'
    })
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal undo void',
      text: err.response?.data?.message || 'Terjadi kesalahan',
      background: '#111',
      color: '#fff'
    })
  }
}

let poller = null

// 🔙 GO BACK
const goBack = () => {
  router.push("/kasir")
}

// 🔄 RESET FILTERS
const resetFilters = () => {
  filters.value = {
    status: 'ALL',
    dateRange: 'all',
    dateFrom: '',
    dateTo: '',
    therapistId: '',
    roomId: '',
    specificDate: ''
  }
}

// 💰 FORMAT
const format = (n) =>
  new Intl.NumberFormat("id-ID").format(n || 0)

const formatDate = (d) =>
  new Date(d).toLocaleString("id-ID")
// 📄 PAGINATION FUNCTIONS
const changePage = (newPage) => {
  if (newPage < 1 || newPage > pagination.value.totalPages) return
  pagination.value.page = newPage
  loadOrders()
}

const changeLimit = (newLimit) => {
  pagination.value.limit = newLimit
  pagination.value.page = 1 // Reset to first page
  loadOrders()
}

const nextPage = () => {
  if (pagination.value.page < pagination.value.totalPages) {
    changePage(pagination.value.page + 1)
  }
}

const prevPage = () => {
  if (pagination.value.page > 1) {
    changePage(pagination.value.page - 1)
  }
}
// 📄 GET PAGE RANGE (show max 5 pages)
const getPageRange = () => {
  const range = []
  const maxPages = 5
  let start = Math.max(1, pagination.value.page - 2)
  let end = Math.min(pagination.value.totalPages, start + maxPages - 1)
  
  // Adjust start if end is at max
  if (end - start < maxPages - 1) {
    start = Math.max(1, end - maxPages + 1)
  }
  
  for (let i = start; i <= end; i++) {
    range.push(i)
  }
  
  return range
}
// 🖨️ PRINT RECEIPT STATE
const showPrintModal = ref(false)
const printOrder = ref(null)
const bulkReceipt = ref(null)
const BULK_REPRINT_STORAGE_KEY = 'kasir:last-bulk-receipt'
const BULK_REPRINT_HISTORY_KEY = 'kasir:bulk-receipt-history'
const lastBulkReceiptForReprint = ref(null)
const bulkReceiptHistory = ref([])
const printLoading = ref(false)
const isCompactReceipt = computed(() => {
  const itemCount = bulkReceipt.value?.items?.length ?? printOrder.value?.items?.length ?? 0
  return itemCount > 0 && itemCount <= 3
})

const openBulkReceipt = async (orderIds, totalAmount, paymentMethod = 'CASH') => {
  const ids = Array.isArray(orderIds)
    ? orderIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : []

  if (!ids.length) return

  try {
    printLoading.value = true
    const responses = await Promise.all(ids.map((id) => api.get(`/orders/${id}/detail`)))
    const details = responses.map((res) => res.data)
    const firstOrder = details[0] || {}

    const mergedItems = details.flatMap((order) =>
      (order.items || []).map((item, idx) => ({
        ...item,
        order_id: order.id,
        _key: `${order.id}-${item.service_id || item.id || idx}`
      }))
    )

    const computedTotal = details.reduce((sum, order) => sum + Number(order.total || 0), 0)

    bulkReceipt.value = {
      branch_name: firstOrder.branch_name || 'NUMARS SPA',
      branch_address: firstOrder.branch_address || '-',
      branch_phone: firstOrder.branch_phone || '-',
      cashier_name: firstOrder.cashier_name || '-',
      order_ids: ids,
      paid_at: new Date().toISOString(),
      items: mergedItems,
      total: Number(totalAmount || computedTotal || 0),
      payment_amount: Number(totalAmount || computedTotal || 0),
      change_amount: 0,
      payment_method: paymentMethod || 'CASH'
    }
    lastBulkReceiptForReprint.value = bulkReceipt.value
    localStorage.setItem(BULK_REPRINT_STORAGE_KEY, JSON.stringify(bulkReceipt.value))

    const nextHistory = [bulkReceipt.value, ...(Array.isArray(bulkReceiptHistory.value) ? bulkReceiptHistory.value : [])]
      .filter((row, idx, arr) => idx === arr.findIndex((x) => String(x?.paid_at) === String(row?.paid_at) && String(x?.order_ids?.join(',')) === String(row?.order_ids?.join(','))))
      .slice(0, 20)
    bulkReceiptHistory.value = nextHistory
    localStorage.setItem(BULK_REPRINT_HISTORY_KEY, JSON.stringify(nextHistory))

    printOrder.value = null
    showPrintModal.value = true
  } catch (err) {
    console.error('Failed to load bulk receipt detail:', err)
    await Swal.fire({
      icon: 'error',
      title: 'Gagal memuat struk gabungan',
      text: err.response?.data?.message || 'Terjadi kesalahan',
      background: '#111',
      color: '#fff'
    })
  } finally {
    printLoading.value = false
  }
}


const openBulkReprintHistory = async () => {
  const list = Array.isArray(bulkReceiptHistory.value) ? bulkReceiptHistory.value : []
  if (!list.length) {
    await Swal.fire({ icon: 'info', title: 'Riwayat kosong', text: 'Belum ada riwayat print bayar gabungan.', background: '#111', color: '#fff' })
    return
  }

  const options = list.reduce((acc, row, idx) => {
    const label = `${formatDateTime(row.paid_at)} • ${Array.isArray(row.order_ids) ? row.order_ids.length : 0} order • Rp ${format(row.total || 0)}`
    acc[String(idx)] = label
    return acc
  }, {})

  const picked = await Swal.fire({
    title: 'Pilih Riwayat Bayar Gabungan',
    input: 'select',
    inputOptions: options,
    inputValue: '0',
    showCancelButton: true,
    confirmButtonText: 'Reprint',
    background: '#111',
    color: '#fff'
  })

  if (!picked.isConfirmed) return
  const idx = Number(picked.value || 0)
  const receipt = list[idx]
  if (!receipt) return
  bulkReceipt.value = receipt
  printOrder.value = null
  showPrintModal.value = true
}

const reprintLastBulkPayment = async () => {
  const receipt = lastBulkReceiptForReprint.value
  if (!receipt?.order_ids?.length) {
    await Swal.fire({
      icon: 'info',
      title: 'Belum ada struk gabungan',
      text: 'Belum ada data pembayaran gabungan untuk direprint.',
      background: '#111',
      color: '#fff'
    })
    return
  }

  bulkReceipt.value = receipt
  printOrder.value = null
  showPrintModal.value = true
}

// 🖨️ REPRINT RECEIPT
const reprintReceipt = async (orderId) => {
  try {
    printLoading.value = true
    const res = await api.get(`/orders/${orderId}/detail`)
    bulkReceipt.value = null
    printOrder.value = res.data
    showPrintModal.value = true
  } catch (err) {
    console.error("Failed to load order detail:", err)
    alert("Gagal memuat detail order")
    await openNextQueuedPrint()
  } finally {
    printLoading.value = false
  }
}

const closePrintModal = async () => {
  showPrintModal.value = false
  printOrder.value = null
  bulkReceipt.value = null
}

const receiptPrintStyles = `
  /* TM-58V profile: CMD ESC, Font 12x24, LF, Max dots 128, CP437 */
  @page {
    size: 58mm auto;
    margin: 0;
  }
  html, body {
    margin: 0;
    padding: 0;
    width: 58mm;
    background: #fff;
    font-family: 'Courier New', monospace;
    font-weight: 400;
    letter-spacing: 0;
    text-rendering: auto;
    -webkit-text-size-adjust: 100%;
    print-color-adjust: exact;
  }
  * { box-sizing: border-box; }
  .receipt-preview {
    color: #000;
    width: 58mm;
    margin: 0;
    padding: 0;
    font-size: 10px;
    line-height: 1.2;
  }
  .receipt {
    width: 46mm;
    max-width: 46mm;
    margin: 0;
    padding: 1.2mm 0 2mm;
  }
  .receipt-header {
    text-align: center;
    margin-bottom: 10px;
  }
  .receipt-header h2 {
    font-size: 12px;
    font-weight: 700;
    margin: 0 0 5px;
    text-transform: uppercase;
  }
  .receipt-header p { font-size: 10px; margin: 2px 0; }
  .receipt-divider { text-align: center; margin: 8px 0; font-size: 9px; color: #333; }
  .receipt-info, .receipt-items, .receipt-total { margin: 10px 0; }
  .info-row, .total-row {
    display: flex;
    justify-content: space-between;
    margin: 4px 0;
    font-size: 10px;
  }
  .info-row span:first-child { font-weight: 600; }
  .item-header {
    display: grid;
    grid-template-columns: 2fr 1fr 1.5fr;
    font-weight: 700;
    font-size: 10px;
    margin-bottom: 8px;
    padding-bottom: 5px;
    border-bottom: 1px dashed #666;
  }
  .item-row { margin: 6px 0; }
  .item-name { font-size: 10px; font-weight: 700; margin-bottom: 3px; }
  .item-detail {
    display: grid;
    grid-template-columns: 2fr 1fr 1.5fr;
    font-size: 10px;
    color: #333;
  }
  .item-subtotal { font-weight: 600; text-align: right; }
  .total-row:first-child { font-size: 11px; font-weight: 700; margin-top: 8px; }
  .total-amount { font-weight: 700; font-size: 11px; }
  .payment-method { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #666; font-style: normal; }
  .receipt-footer { text-align: center; margin-top: 12px; font-size: 10px; }
  .receipt-footer p { margin: 3px 0; }
  .reprint-note { margin-top: 10px; font-weight: 700; font-size: 10px; color: #666; }
  .item-meta { display: block; font-size: 9px; color: #666; }
  .receipt--compact .receipt-divider { margin: 6px 0; }
  .receipt--compact .item-row,
  .receipt--compact .info-row,
  .receipt--compact .total-row { margin: 3px 0; }
  .receipt--compact .receipt-footer { margin-top: 10px; }
  .info-row span,
  .total-row span,
  .item-name,
  .item-detail span { page-break-inside: avoid; }
`

const printReceipt = () => {
  const receiptNode = document.getElementById('receipt-print')
  if (!receiptNode) return

  const printWindow = window.open('', '_blank', 'width=420,height=900')
  if (!printWindow) {
    window.print()
    return
  }

  printWindow.document.open()
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt Print</title>
        <style>${receiptPrintStyles}</style>
      </head>
      <body>
        ${receiptNode.outerHTML}
      </body>
    </html>
  `)
  printWindow.document.close()

  const triggerPrint = () => {
    printWindow.focus()
    printWindow.print()
  }

  printWindow.onafterprint = () => {
    printWindow.close()
  }

  setTimeout(triggerPrint, 450)
}

const sendToThermalPrinter = async () => {
  const orderIds = bulkReceipt.value?.order_ids?.length
    ? bulkReceipt.value.order_ids
    : (printOrder.value?.id ? [printOrder.value.id] : [])

  if (!orderIds.length) {
    await Swal.fire({
      icon: 'warning',
      title: 'Order tidak ditemukan',
      text: 'Tidak ada order_id untuk dikirim ke printer thermal.',
      background: '#111',
      color: '#fff'
    })
    return
  }

  try {
    printLoading.value = true
    const isBulkPrint = Boolean(bulkReceipt.value?.order_ids?.length)

    if (isBulkPrint) {
      await api.post('/printers/print-bulk', {
        order_ids: bulkReceipt.value.order_ids,
        payment_method: bulkReceipt.value.payment_method || 'CASH',
        printer: getPrinterAgentConfig()
      })
    } else {
      for (const orderId of orderIds) {
        await api.post('/printers/print-order', {
          order_id: Number(orderId),
          printer: getPrinterAgentConfig()
        })
      }
    }

    await closePrintModal()
    await Swal.fire({
      icon: 'success',
      title: 'Print berhasil',
      text: isBulkPrint
        ? 'Struk gabungan berhasil dikirim ke printer.'
        : 'Struk order berhasil dikirim ke printer.',
      background: '#111',
      color: '#fff'
    })
  } catch (err) {
    await closePrintModal()
    await Swal.fire({
      icon: 'error',
      title: 'Gagal kirim ke printer',
      text: err.response?.data?.message || err.message || 'Terjadi kesalahan',
      background: '#111',
      color: '#fff'
    })
  } finally {
    printLoading.value = false
  }
}

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
// 🎬 INIT
onMounted(() => {
  try {
    const stored = localStorage.getItem(BULK_REPRINT_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed?.order_ids) && parsed.order_ids.length) {
        lastBulkReceiptForReprint.value = parsed
      }
    }

    const historyStored = localStorage.getItem(BULK_REPRINT_HISTORY_KEY)
    if (historyStored) {
      const parsedHistory = JSON.parse(historyStored)
      if (Array.isArray(parsedHistory)) {
        bulkReceiptHistory.value = parsedHistory.filter((row) => Array.isArray(row?.order_ids) && row.order_ids.length)
      }
    }
  } catch (err) {
    console.warn('Failed to load bulk reprint cache:', err)
  }

  loadOrders()
  loadTherapists()
  loadRooms()

  poller = setInterval(() => {
    loadOrders()
  }, 10000)
})

onBeforeUnmount(() => {
  if (poller) clearInterval(poller)
})
</script>
<style scoped>
.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  background: #c0392b;
  border: 1px solid #333;
  color: white;
  cursor: pointer;
}

.back-btn:hover {
  background: #1a1a1a;
}

.muted {
  color: #666;
  font-size: 12px;
}

.orders-page {
  padding: 20px;
  color: #fff;
}

.page-header h1 {
  margin: 0;
  font-size: 22px;
}

.subtitle {
  font-size: 12px;
  color: #aaa;
}

.table-wrapper {
  margin-top: 20px;
  overflow-x: auto;
}

.orders-table {
  width: 100%;
  border-collapse: collapse;
  background: #111;
  border-radius: 12px;
  overflow: hidden;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #222;
  font-size: 12px;
}

th {
  background: #0e0e0e;
  color: #c9a24d;
  font-weight: 700;
}

.select-col {
  width: 42px;
  text-align: center;
}

.select-col input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #c9a24d;
  cursor: pointer;
}
/* 🎨 TABLE ROW HOVER EFFECT */
.orders-table tbody tr {
  transition: all 0.3s ease-out;
  cursor: pointer;
}

.orders-table tbody tr:hover {
  background: #1a1a1a;
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(201, 162, 77, 0.2);
}

.orders-table tbody tr:hover td {
  border-color: #333;
}

/* Smooth transition untuk semua elemen di row */
.orders-table tbody tr td {
  transition: all 0.3s ease-out;
}

/* Hover effect untuk badge */
.badge {
  transition: all 0.3s ease-out;
}

.orders-table tbody tr:hover .badge.paid {
  background: #2dd46e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
}

.orders-table tbody tr:hover .badge.draft {
  background: #ffd93d;
  box-shadow: 0 0 8px rgba(250, 204, 21, 0.4);
}

.orders-table tbody tr:hover .badge {
  transform: scale(1.05);
}

/* Hover effect untuk tombol aksi */
.btn.add-item {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #3a2e12;
  background: #1c1c1c;
  color: #c9a24d;
  font-weight: 700;
  cursor: pointer;
  margin-right: 6px;
  transition: all 0.3s ease-out;
}
.btn.pay {
  transition: all 0.3s ease-out;
}
.btn.void {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #5a1f1f;
  background: #2a1111;
  color: #ff7b7b;
  font-weight: 700;
  cursor: pointer;
  margin-right: 6px;
  transition: all 0.3s ease-out;
}

.btn.undo {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #2b4c66;
  background: #132434;
  color: #8bd3ff;
  font-weight: 700;
  cursor: pointer;
}

.orders-table tbody tr:hover .btn.add-item,
.orders-table tbody tr:hover .btn.void,
.orders-table tbody tr:hover .btn.pay {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(201, 162, 77, 0.4);
}
.service-item small {
  color: #888;
  margin-left: 4px;
}

.meta {
  font-size: 11px;
  color: #aaa;
}

.price {
  font-weight: 700;
}

.badge {
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
}

.badge.draft {
  background: #facc15;
  color: #000;
}

.badge.paid {
  background: #22c55e;
  color: #000;
}

.btn.add-item {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #3a2e12;
  background: #1c1c1c;
  color: #c9a24d;
  font-weight: 700;
  cursor: pointer;
  margin-right: 6px;
}

.btn.pay {
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  background: #c9a24d;
  font-weight: 700;
  cursor: pointer;
}

.empty {
  padding: 40px;
  text-align: center;
  color: #777;
}

/* MOBILE */
@media (max-width: 768px) {
  th:nth-child(2),
  td:nth-child(2),
  th:nth-child(4),
  td:nth-child(4) {
    display: none;
  }
}
/* 🔍 FILTER SECTION */
.filter-section {
  background: #111;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  border: 1px solid #222;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 150px;
}

.filter-item label {
  font-size: 12px;
  font-weight: 600;
  color: #c9a24d;
  text-transform: uppercase;
}

.filter-item select,
.filter-item input[type="date"] {
  background: #1a1a1a;
  border: 1px solid #333;
  color: #fff;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}

.filter-item select:hover,
.filter-item input[type="date"]:hover {
  border-color: #c9a24d;
}

.filter-item select:focus,
.filter-item input[type="date"]:focus {
  border-color: #c9a24d;
  box-shadow: 0 0 0 3px rgba(201, 162, 77, 0.1);
}

.filter-item select option {
  background: #1a1a1a;
  color: #fff;
}

.btn-reset {
  background: #333;
  border: 1px solid #444;
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: #444;
  border-color: #c9a24d;
  color: #c9a24d;
}

.loading {
  margin-top: 16px;
  padding: 12px;
  background: #1a1a1a;
  border-radius: 8px;
  text-align: center;
  color: #c9a24d;
  font-weight: 600;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.result-count {
  margin-top: 16px;
  font-size: 12px;
  color: #888;
  font-weight: 600;
}

.bulk-actions {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.btn-bulk-pay {
  background: linear-gradient(90deg, #c9a24d, #e3c670);
  color: #111;
  border: 0;
  border-radius: 8px;
  padding: 10px 16px;
  font-weight: 700;
  cursor: pointer;
}

.btn-bulk-pay:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-bulk-reprint {
  background: transparent;
  color: #f0c46a;
  border: 1px solid #6e5b2a;
  border-radius: 8px;
  padding: 10px 16px;
  font-weight: 700;
  cursor: pointer;
}

.btn-bulk-reprint:hover {
  background: rgba(240, 196, 106, 0.12);
}

.btn-bulk-reprint:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* MOBILE RESPONSIVE */
@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
  }
  
  .filter-item {
    width: 100%;
    min-width: unset;
  }
  
  .btn-reset {
    width: 100%;
  }

  .bulk-actions {
    flex-direction: column;
    align-items: flex-start;
  }
}
/* 📄 PAGINATION SECTION */
.pagination-section {
  background: #111;
  padding: 20px;
  border-radius: 12px;
  margin-top: 20px;
  border: 1px solid #222;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: space-between;
  align-items: center;
}

/* Per Page Selector */
.per-page {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.per-page label {
  color: #888;
  font-weight: 600;
}

.per-page select {
  background: #1a1a1a;
  border: 1px solid #333;
  color: #fff;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: all 0.2s;
}

.per-page select:hover {
  border-color: #c9a24d;
}

.per-page span {
  color: #888;
}

/* Page Navigation */
.page-navigation {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-btn {
  background: #1a1a1a;
  border: 1px solid #333;
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #c9a24d;
  border-color: #c9a24d;
  color: #000;
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-num {
  background: #1a1a1a;
  border: 1px solid #333;
  color: #fff;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  min-width: 40px;
  transition: all 0.2s;
}

.page-num:hover {
  background: #c9a24d;
  border-color: #c9a24d;
  color: #000;
}

.page-num.active {
  background: #c9a24d;
  border-color: #c9a24d;
  color: #000;
  font-weight: 700;
}

.dots {
  color: #666;
  padding: 0 4px;
  font-weight: 700;
}

/* Jump to Page */
.jump-to-page {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.jump-to-page label {
  color: #888;
  font-weight: 600;
}

.jump-to-page input {
  background: #1a1a1a;
  border: 1px solid #333;
  color: #fff;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  width: 60px;
  text-align: center;
  outline: none;
  transition: all 0.2s;
}

.jump-to-page input:focus {
  border-color: #c9a24d;
  box-shadow: 0 0 0 3px rgba(201, 162, 77, 0.1);
}

.jump-to-page button {
  background: #c9a24d;
  border: 1px solid #c9a24d;
  color: #000;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.jump-to-page button:hover {
  background: #d4b560;
  border-color: #d4b560;
}

/* MOBILE RESPONSIVE PAGINATION */
@media (max-width: 768px) {
  .pagination-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .per-page,
  .page-navigation,
  .jump-to-page {
    justify-content: center;
  }
  
  .page-numbers {
    flex-wrap: wrap;
    justify-content: center;
  }
}
/* Enhance pagination button transitions */
.page-btn,
.page-num,
.jump-to-page button {
  transition: all 0.3s ease-out;
}

.page-num:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(201, 162, 77, 0.3);
}

.page-num.active {
  transform: scale(1.1);
}
/* 🖨️ PRINT BUTTON */
.btn.print {
  background: #4a9eff;
  border: 1px solid #4a9eff;
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease-out;
  white-space: nowrap;
}

.btn.print:hover {
  background: #3d8ae5;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(74, 158, 255, 0.4);
}

.btn.print:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 🖨️ MODAL OVERLAY */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
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

/* 🖨️ MODAL CONTENT */
.modal-content.print-modal {
  background: #1a1a1a;
  border: 2px solid #c9a24d;
  border-radius: 16px;
  padding: 30px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
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

/* 🖨️ PRINT BUTTON */
.btn.print {
  background: #4a9eff;
  border: 1px solid #4a9eff;
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease-out;
  white-space: nowrap;
}

.btn.print:hover {
  background: #3d8ae5;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(74, 158, 255, 0.4);
}

.btn.print:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 🖨️ MODAL OVERLAY */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
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

/* 🖨️ MODAL CONTENT */
.modal-content.print-modal {
  background: #1a1a1a;
  border: 2px solid #c9a24d;
  border-radius: 16px;
  padding: 30px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
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

/* 🖨️ CLOSE BUTTON */
.modal-close {
  position: absolute;
  top: 15px;
  right: 15px;
  background: #333;
  border: none;
  color: #fff;
  width: 35px;
  height: 35px;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: #c9a24d;
  color: #000;
  transform: rotate(90deg);
}

/* 🖨️ RECEIPT PREVIEW */
.receipt-preview {
  background: #fff;
  color: #000;
  padding: 20px;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  margin-bottom: 20px;
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
}

.receipt-header p {
  font-size: 11px;
  margin: 2px 0;
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
}

.reprint-note {
  margin-top: 10px;
  font-weight: 700;
  font-size: 10px;
  color: #666;
}

/* 🖨️ MODAL ACTIONS */
.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn-print {
  background: #c9a24d;
  border: 1px solid #c9a24d;
  color: #000;
  padding: 12px 32px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease-out;
}

.btn-print:hover {
  background: #d4b560;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(201, 162, 77, 0.4);
}

.btn-cancel {
  background: #333;
  border: 1px solid #444;
  color: #fff;
  padding: 12px 32px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease-out;
}

.btn-cancel:hover {
  background: #444;
  border-color: #666;
}

/* 🖨️ PRINT MEDIA QUERY */
@media print {
  @page {
    size: 58mm auto;
    margin: 0;
  }

  :global(html),
  :global(body) {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  :global(body *) {
    visibility: hidden !important;
  }

  :global(#receipt-print),
  :global(#receipt-print *) {
    visibility: visible !important;
  }

  :global(#receipt-print) {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 58mm !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  :global(#receipt-print .receipt) {
    max-width: 58mm !important;
    margin: 0 !important;
    padding: 1mm 2mm 2mm !important;
  }

  :global(.modal-overlay),
  :global(.modal-content.print-modal),
  :global(.receipt-preview) {
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
    animation: none !important;
  }

  .modal-actions,
  .modal-close {
    display: none !important;
  }
}


.receipt--compact .receipt-divider {
  margin: 6px 0;
}

.receipt--compact .item-row,
.receipt--compact .info-row,
.receipt--compact .total-row {
  margin: 3px 0;
}

.receipt--compact .receipt-footer {
  margin-top: 10px;
}

/* MOBILE RESPONSIVE PRINT MODAL */
@media (max-width: 768px) {
  .modal-content.print-modal {
    max-width: 95%;
    padding: 20px;
  }
  
  .modal-actions {
    flex-direction: column;
  }
  
  .btn-print,
  .btn-cancel {
    width: 100%;
  }
}

.delivered-check { margin-left: 4px; }

.service-line { display:flex; justify-content:space-between; gap:8px; width:100%; }
.service-meta { display:block; font-size:11px; color:#b9b9b9; }
.item-meta { display:block; font-size:10px; color:#666; }
</style>
