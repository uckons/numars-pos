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
</div>

    <div class="table-wrapper">
      <table class="orders-table">
<thead>
  <tr>
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
    <td>#{{ o.id }}</td>

    <td>{{ formatDate(o.created_at) }}</td>

    <!-- SERVICE -->
    <td>
      <div
        v-for="(i, idx) in o.items || []"
        :key="idx"
        class="service-item"
      >
        {{ i.service_name }}
        <small>×{{ i.qty }}</small>
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
        <div class="receipt">
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
            <div v-for="item in printOrder?.items" :key="item.service_id" class="item-row">
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
      </div>

      <!-- Action Buttons -->
      <div class="modal-actions">
        <button class="btn btn-print" @click="printReceipt">
          🖨️ Print Sekarang
        </button>
        <button class="btn btn-cancel" @click="closePrintModal">
          Batal
        </button>
      </div>
    </div>
  </div>

</template>
<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from "vue"
import { useRouter } from "vue-router"
import Swal from "sweetalert2"
import api from "@/services/api"

const router = useRouter()
const orders = ref([])
const loading = ref(false)

// 🔍 FILTER STATE
const filters = ref({
  status: 'ALL',
  dateRange: 'all',
  dateFrom: '',
  dateTo: '',
  therapistId: '',
  roomId: ''
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
    
    if (filters.value.dateRange === 'today') {
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

// 🔄 WATCH FILTERS - RESET PAGE
watch(filters, () => {
  pagination.value.page = 1
  loadOrders()
}, { deep: true })

// 💳 CONFIRM PAY
const confirmPay = async (order) => {
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
    await api.post(`/orders/${order.id}/undo-void`)
    await loadOrders()
    await Swal.fire({
      icon: 'success',
      title: 'Undo berhasil',
      timer: 1200,
      showConfirmButton: false,
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
    roomId: ''
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
const printLoading = ref(false)
// 🖨️ REPRINT RECEIPT
const reprintReceipt = async (orderId) => {
  try {
    printLoading.value = true
    const res = await api.get(`/orders/${orderId}/detail`)
    printOrder.value = res.data
    showPrintModal.value = true
  } catch (err) {
    console.error("Failed to load order detail:", err)
    alert("Gagal memuat detail order")
  } finally {
    printLoading.value = false
  }
}

const closePrintModal = () => {
  showPrintModal.value = false
  printOrder.value = null
}

const printReceipt = () => {
  window.print()
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
  font-size: 13px;
}

th {
  background: #0e0e0e;
  color: #c9a24d;
  font-weight: 700;
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
  font-size: 13px;
  color: #888;
  font-weight: 600;
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
  font-size: 13px;
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
  font-size: 13px;
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
  font-size: 13px;
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
  font-size: 13px;
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
  font-size: 13px;
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
  font-size: 13px;
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
  font-size: 13px;
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
  .modal-close {
    display: none !important;
  }
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
</style>
