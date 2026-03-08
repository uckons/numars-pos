<template>
  <UserBar />

  <div class="page">
    <section class="hero card-glass">
      <div>
        <p class="eyebrow">BAR Control Panel</p>
        <h1>Staff Bar Dashboard.</h1>
        <p class="muted">Live stock FNB, order inbox realtime, dan approval stock workflow.</p>
      </div>
      <button class="btn-primary" @click="loadAll({ silent: true })">Refresh Data</button>
    </section>

    <section class="kpi-grid">
      <article class="kpi card-glass">
        <p>Total Item FNB</p>
        <h3>{{ fnbItems.length }}</h3>
      </article>
      <article class="kpi card-glass">
        <p>Low Stock</p>
        <h3>{{ lowStockCount }}</h3>
      </article>
      <article class="kpi card-glass">
        <p>Inbox Pending</p>
        <h3>{{ pendingInboxCount }}</h3>
      </article>
      <article class="kpi card-glass">
        <p>Total Nilai Stok</p>
        <h3>Rp {{ formatCurrency(totalStockValue) }}</h3>
      </article>
    </section>

    <section class="card-glass">
      <div class="section-head">
        <h3>Live Stock Overview</h3>
        <small class="muted">Top 12 item untuk visual cepat.</small>
      </div>
      <ApexChart type="bar" :height="280" :series="stockSeries" :options="stockChartOptions" />
    </section>

    <section class="card-glass">
      <div class="section-head">
        <h3>Inbox order dari kasir</h3>
        <span class="badge">{{ inboxPagination.total }} order</span>
      </div>

      <div v-if="!barInbox.length" class="empty">Belum ada inbox order.</div>

      <div v-for="order in barInbox" :key="order.id" class="inbox-item">
        <button class="inbox-main" @click="openInboxDetail(order)">
          <div class="order-title">
            Order #{{ order.order_id }}
            <span class="status" :class="order.status.toLowerCase()">{{ order.status }}</span>
          </div>
          <small class="muted item-line">{{ formatItems(order.items_snapshot) }}</small>
          <small class="muted audit-line">{{ formatAuditDate(order.created_at) }}</small>
          <small v-if="order.note" class="note-line">📝 {{ order.note }}</small>
        </button>

        <div class="actions" v-if="!['DELIVERED','CANCELLED'].includes(order.status)">
          <button v-if="order.status === 'PENDING'" class="btn-accept" @click="accept(order.id)">Accept</button>
          <button v-if="order.status === 'ACCEPTED'" class="btn-success" @click="deliver(order.id)">Deliver</button>
          <button v-if="order.status === 'ACCEPTED'" class="btn-danger" @click="cancel(order.id)">Cancel</button>
        </div>
      </div>

      <div class="pagination inbox-pagination">
        <button class="btn-light" :disabled="inboxPage===1" @click="changeInboxPage(inboxPage - 1)">Prev</button>
        <span>Page {{ inboxPage }} / {{ inboxPagination.total_pages }}</span>
        <button class="btn-light" :disabled="inboxPage>=inboxPagination.total_pages" @click="changeInboxPage(inboxPage + 1)">Next</button>
      </div>
    </section>

    <section class="card-glass">
      <div class="section-head">
        <h3>Manajemen Stock</h3>
      </div>

      <div class="toolbar">
        <input v-model.trim="stockSearch" class="input" placeholder="Cari item stock..." />
        <select v-model="sortMode" class="input">
          <option value="low-first">Stock paling sedikit</option>
          <option value="high-first">Stock paling banyak</option>
          <option value="name-asc">Nama A-Z</option>
          <option value="name-desc">Nama Z-A</option>
        </select>
        <select v-model.number="stockPageSize" class="input">
          <option :value="5">5 / halaman</option>
          <option :value="10">10 / halaman</option>
          <option :value="20">20 / halaman</option>
        </select>
      </div>

      <div class="stock-cards">
        <article v-for="item in paginatedStocks" :key="item.id" class="stock-item-card">
          <div class="stock-card-head">
            <div>
              <div class="order-title">{{ item.name }}</div>
              <small class="muted">Group: {{ item.item_group || 'NORMAL' }}</small>
            </div>
            <span class="badge" :class="barStockLevelClass(item)">{{ barStockLevelLabel(item) }}</span>
          </div>

          <div class="stock-metrics">
            <div>
              <p class="muted">Stock Saat Ini</p>
              <strong>{{ item.stock }}</strong>
            </div>
            <div>
              <p class="muted">Batas Alert</p>
              <strong>{{ item.alert_stock }}</strong>
            </div>
            <div>
              <p class="muted">Estimasi Nilai</p>
              <strong>Rp {{ formatCurrency(Number(item.stock || 0) * Number(item.sell_price || item.price || 0)) }}</strong>
            </div>
          </div>

          <small class="muted">Harga jual: Rp {{ formatCurrency(item.sell_price || item.price) }}</small>
        </article>
      </div>

      <div v-if="!paginatedStocks.length" class="empty">Data stock tidak ditemukan.</div>

      <div class="pagination">
        <button class="btn-light" :disabled="stockPage===1" @click="stockPage -= 1">Prev</button>
        <span>Page {{ stockPage }} / {{ stockTotalPages }}</span>
        <button class="btn-light" :disabled="stockPage>=stockTotalPages" @click="stockPage += 1">Next</button>
      </div>
    </section>

    <div v-if="selectedInboxOrder" class="modal-backdrop" @click.self="closeInboxDetail">
      <div class="modal card-glass">
        <h3>Order #{{ selectedInboxOrder.order_id }}</h3>
        <p class="muted">Status: {{ selectedInboxOrder.status }}</p>
        <p class="muted">Audit: {{ formatAuditDate(selectedInboxOrder.created_at) }}</p>
        <p v-if="selectedInboxOrder.note" class="note-box">Catatan kasir: {{ selectedInboxOrder.note }}</p>

        <ul class="order-items">
          <li v-for="item in selectedInboxOrder.items_snapshot || []" :key="`${item.service_id}-${item.service_name}`">
            {{ item.service_name }} x{{ item.qty }}
          </li>
        </ul>

        <div class="modal-actions" v-if="!['DELIVERED','CANCELLED'].includes(selectedInboxOrder.status)">
          <button v-if="selectedInboxOrder.status === 'PENDING'" class="btn-accept" @click="accept(selectedInboxOrder.id, true)">Accept</button>
          <button v-if="selectedInboxOrder.status === 'ACCEPTED'" class="btn-success" @click="deliver(selectedInboxOrder.id, true)">Deliver</button>
          <button v-if="selectedInboxOrder.status === 'ACCEPTED'" class="btn-danger" @click="cancel(selectedInboxOrder.id, true)">Cancel</button>
        </div>

        <div class="modal-actions">
          <button class="btn-light" @click="closeInboxDetail">Tutup</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import Swal from "sweetalert2"
import UserBar from "../../components/UserBar.vue"
import ApexChart from "../../components/ApexChart.vue"
import api from "../../services/api"
import socket from "../../services/socket"
import { useAuthStore } from "../../store/auth.store"

const auth = useAuthStore()
const fnbItems = ref([])
const barInbox = ref([])
const inboxPage = ref(1)
const inboxPageSize = 20
const inboxPagination = ref({ page: 1, page_size: 20, total: 0, total_pages: 1 })
const knownPendingInboxKeys = ref(new Set())
const selectedInboxOrder = ref(null)
let autoRefreshTimer = null
const AUTO_REFRESH_MS = 5000

const stockSearch = ref("")
const sortMode = ref("low-first")
const stockPage = ref(1)
const stockPageSize = ref(10)

const lowStockCount = computed(() => fnbItems.value.filter(i => Number(i.stock || 0) <= Number(i.alert_stock || 0)).length)
const pendingInboxCount = computed(() => barInbox.value.filter(i => i.status === "PENDING").length)
const totalStockValue = computed(() => fnbItems.value.reduce((acc, i) => acc + (Number(i.stock || 0) * Number(i.sell_price || i.price || 0)), 0))

const filteredStocks = computed(() => {
  const key = stockSearch.value.toLowerCase()
  let rows = [...fnbItems.value].filter(i => !key || String(i.name || "").toLowerCase().includes(key))

  if (sortMode.value === "low-first") rows.sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))
  else if (sortMode.value === "high-first") rows.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0))
  else if (sortMode.value === "name-desc") rows.sort((a, b) => String(b.name || "").localeCompare(String(a.name || "")))
  else rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))

  return rows
})

const stockTotalPages = computed(() => Math.max(1, Math.ceil(filteredStocks.value.length / stockPageSize.value)))
const paginatedStocks = computed(() => {
  const start = (stockPage.value - 1) * stockPageSize.value
  return filteredStocks.value.slice(start, start + stockPageSize.value)
})

watch([stockSearch, sortMode, stockPageSize], () => {
  stockPage.value = 1
})

watch(stockTotalPages, (total) => {
  if (stockPage.value > total) stockPage.value = total
})

const stockSeries = computed(() => {
  const rows = [...fnbItems.value]
    .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))
    .slice(0, 12)
  return [{ name: "Stock", data: rows.map(i => Number(i.stock || 0)) }]
})

const stockChartOptions = computed(() => {
  const rows = [...fnbItems.value]
    .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))
    .slice(0, 12)

  return {
    xaxis: { categories: rows.map(i => i.name) },
    theme: { mode: "dark" },
    plotOptions: { bar: { borderRadius: 6, columnWidth: "50%" } },
    dataLabels: { enabled: false },
    colors: ["#f5c518"],
    grid: { borderColor: "#2e2e2e" }
  }
})

const loadAll = async (options = {}) => {
  const { silent = false } = options

  const [fnbRes, inboxRes] = await Promise.all([
    api.get("/fnb"),
    api.get("/orders/bar/inbox", { params: { page: inboxPage.value, page_size: inboxPageSize } })
  ])

  const nextInbox = Array.isArray(inboxRes.data?.data) ? inboxRes.data.data : (Array.isArray(inboxRes.data) ? inboxRes.data : [])
  const nextPagination = inboxRes.data?.pagination || { page: inboxPage.value, page_size: inboxPageSize, total: nextInbox.length, total_pages: 1 }
  const nextPendingKeys = new Set(
    nextInbox
      .filter(item => item.status === "PENDING")
      .map(item => `${item.id}-${item.order_id}`)
  )

  if (!silent) {
    for (const item of nextInbox) {
      const key = `${item.id}-${item.order_id}`
      if (item.status === "PENDING" && !knownPendingInboxKeys.value.has(key)) {
        await Swal.fire({
          icon: "info",
          title: `Order #${item.order_id} masuk dari kasir`,
          text: "Silakan diproses di inbox Staff Bar"
        })
      }
    }
  }

  knownPendingInboxKeys.value = nextPendingKeys
  fnbItems.value = fnbRes.data || []
  barInbox.value = nextInbox
  inboxPagination.value = nextPagination
  inboxPage.value = Number(nextPagination.page || inboxPage.value)

  if (selectedInboxOrder.value) {
    const latestSelected = nextInbox.find(item => item.id === selectedInboxOrder.value.id)
    selectedInboxOrder.value = latestSelected || null
  }
}



const changeInboxPage = async (nextPage) => {
  const target = Math.min(Math.max(1, Number(nextPage) || 1), inboxPagination.value.total_pages || 1)
  if (target === inboxPage.value) return
  inboxPage.value = target
  await loadAll({ silent: true })
}

const openInboxDetail = (order) => {
  selectedInboxOrder.value = order
}

const closeInboxDetail = () => {
  selectedInboxOrder.value = null
}

const accept = async (id, fromModal = false) => {
  const previousOrder = barInbox.value.find(item => item.id === id) || selectedInboxOrder.value

  await api.post(`/orders/bar/${id}/accept`)
  await loadAll({ silent: true })

  const latest = barInbox.value.find(item => item.id === id) || previousOrder
  const items = Array.isArray(latest?.items_snapshot) ? latest.items_snapshot : []
  const normalizeText = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const pickHighestStock = (rows = []) => rows.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0))[0]
  const stockRows = items.map((item) => {
    const byFnbItemId = fnbItems.value.find((f) => Number(f.id || 0) > 0 && Number(f.id) === Number(item.fnb_item_id || 0))
    const byVariantService = fnbItems.value.filter((f) => Number(f.service_id || 0) > 0 && Number(f.service_id) === Number(item.variant_service_id || 0))
    const byServiceId = fnbItems.value.filter((f) => Number(f.service_id || 0) > 0 && Number(f.service_id) === Number(item.service_id || 0))
    const byName = fnbItems.value.filter((f) => normalizeText(f.name) && normalizeText(f.name) === normalizeText(item.service_name))

    const stockItem = byFnbItemId || pickHighestStock(byVariantService) || pickHighestStock(byServiceId) || pickHighestStock(byName)

    return {
      name: item.service_name,
      qty: Number(item.qty || 0),
      stock: Number(stockItem?.stock || 0)
    }
  })

  const detailHtml = stockRows.length
    ? `<div style="text-align:left">${stockRows.map((row) => `<div style="margin-bottom:6px"><strong>${row.name}</strong><br/>Qty order: ${row.qty} • Stock tersedia: ${row.stock}</div>`).join('')}</div>`
    : '<div>Tidak ada item pada order ini.</div>'

  await Swal.fire({
    icon: 'info',
    title: 'Order diterima',
    html: detailHtml,
    confirmButtonText: 'OK'
  })

  if (fromModal && selectedInboxOrder.value?.id === id) {
    selectedInboxOrder.value = latest || selectedInboxOrder.value
  }
}

const deliver = async (id, fromModal = false) => {
  const confirm = await Swal.fire({
    icon: "question",
    title: "Deliver order sekarang?",
    text: "Stock akan berkurang setelah order delivered.",
    showCancelButton: true,
    confirmButtonText: "Deliver",
    cancelButtonText: "Batal"
  })
  if (!confirm.isConfirmed) return

  await api.post(`/orders/bar/${id}/deliver`)
  await loadAll({ silent: true })

  await Swal.fire({
    icon: "success",
    title: "Items delivered",
    text: "Klik OK untuk kembali ke inbox"
  })

  if (fromModal) closeInboxDetail()
}

const cancel = async (id, fromModal = false) => {
  const confirm = await Swal.fire({
    icon: "warning",
    title: "Batalkan item tambahan?",
    input: "textarea",
    inputLabel: "Alasan cancel",
    inputPlaceholder: "Contoh: stok habis / item tidak tersedia",
    inputValue: "",
    inputAttributes: { maxlength: 300 },
    text: "Yang dibatalkan hanya item tambahan dari inbox ini.",
    showCancelButton: true,
    confirmButtonText: "Ya, batalkan",
    cancelButtonText: "Kembali",
    inputValidator: (value) => {
      if (!String(value || "").trim()) return "Alasan cancel wajib diisi"
      return null
    }
  })
  if (!confirm.isConfirmed) return

  const note = String(confirm.value || "").trim()
  await api.post(`/orders/bar/${id}/cancel`, { note })
  await loadAll({ silent: true })
  await Swal.fire({ icon: "success", title: "Item tambahan dibatalkan" })

  if (fromModal) closeInboxDetail()
}

const barStockLevelLabel = (item) => {
  const stock = Number(item?.stock || 0)
  const alert = Number(item?.alert_stock || 0)
  if (stock <= 0) return 'Out of Stock'
  if (stock <= alert) return 'Low Stock'
  return 'Aman'
}
const barStockLevelClass = (item) => {
  const status = barStockLevelLabel(item)
  if (status === 'Out of Stock') return 'closed'
  if (status === 'Low Stock') return 'warn'
  return 'ok'
}

const formatItems = (items) => Array.isArray(items) ? items.map(i => `${i.service_name} x${i.qty}`).join(", ") : "-"
const formatCurrency = (v) => Number(v || 0).toLocaleString("id-ID")
const formatAuditDate = (v) => v ? new Date(v).toLocaleString("id-ID", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"

onMounted(async () => {
  socket.emit("join-branch", {
    branch_id: auth.user?.branch_id,
    role: auth.user?.role,
    user_id: auth.user?.id
  })

  socket.on("bar:order:new", async (payload) => {
    await Swal.fire({ icon: "info", title: `Order #${payload.order_id} masuk inbox bar` })
    await loadAll({ silent: true })
  })

  await loadAll({ silent: true })

  autoRefreshTimer = setInterval(() => {
    loadAll({ silent: false }).catch(err => {
      console.error("Auto refresh bar dashboard gagal", err)
    })
  }, AUTO_REFRESH_MS)
})

onBeforeUnmount(() => {
  socket.off("bar:order:new")
  if (autoRefreshTimer) clearInterval(autoRefreshTimer)
})
</script>

<style scoped>
.page { padding: 20px; color: #fff; background: radial-gradient(circle at top right, rgba(245,197,24,.08), transparent 38%); }
.card-glass { background: linear-gradient(145deg, rgba(21,21,21,.95), rgba(12,12,12,.95)); border: 1px solid #2d2d2d; border-radius: 16px; padding: 16px; margin-bottom: 14px; box-shadow: 0 16px 38px rgba(0,0,0,.35); }
.hero { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; }
.eyebrow { color:#f5c518; font-size:12px; letter-spacing:.12em; text-transform:uppercase; margin-bottom:6px; }
.muted { color:#9aa0ae; }
.kpi-grid { display:grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap:12px; }
.kpi h3 { margin-top:8px; font-size:34px; color:#f5c518; }
.section-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.badge { padding:4px 8px; border-radius:999px; background:#222; color:#ddd; font-size:12px; }
.badge.warn { background: rgba(231,76,60,.2); color:#ff7b7b; }
.badge.ok { background: rgba(46,204,113,.2); color:#2ecc71; }
.badge.closed { background: rgba(192,57,43,.24); color:#ff9f9f; }
.stock-cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px; }
.stock-item-card { border:1px solid #2f2f2f; border-radius:14px; padding:12px; background: linear-gradient(180deg, rgba(35,35,35,.82), rgba(18,18,18,.86)); box-shadow: inset 0 1px 0 rgba(245,197,24,.08); }
.stock-card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:10px; }
.stock-metrics { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; margin-bottom:10px; }
.stock-metrics p { margin:0; font-size:12px; }
.stock-metrics strong { font-size:15px; color:#f3f5f9; }
.inbox-item { display:flex; justify-content:space-between; gap:12px; border-top:1px solid #262626; padding:12px 0; }
.inbox-main { background: transparent; border: none; text-align: left; cursor: pointer; color: #fff; padding: 0; flex: 1; }
.order-title { font-weight:700; display:flex; align-items:center; gap:8px; }
.status { border-radius:999px; padding:2px 8px; font-size:11px; font-weight:600; }
.status.pending { background:#5f4b19; color:#f5c518; }
.status.accepted { background:#19465f; color:#7fd0ff; }
.status.delivered { background:#1f4f34; color:#87f4b9; }
.status.cancelled { background:#5a2323; color:#ff9f9f; }
.actions, .toolbar, .pagination { display:flex; gap:8px; align-items:center; }
.toolbar { margin-bottom:10px; flex-wrap: wrap; }
.input { background:#171717; border:1px solid #333; color:#fff; border-radius:10px; padding:9px 10px; }
.btn-primary,.btn-success,.btn-danger,.btn-light,.btn-accept { border:none; border-radius:10px; padding:9px 12px; cursor:pointer; font-weight:600; }
.btn-primary { background:#f5c518; color:#111; }
.btn-success { background:#2ecc71; color:#081b10; }
.btn-danger { background:#c0392b; color:#fff; }
.btn-light { background:#282828; color:#fff; }
.btn-accept { background:#f5c518; color:#111; }
.btn-light:disabled { opacity: .5; cursor: not-allowed; }
.empty { color:#8e95a6; padding:10px 0; }
.pagination { justify-content:flex-end; margin-top:10px; }
.inbox-pagination { justify-content: space-between; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal { width: min(560px, 92vw); }
.order-items { margin: 10px 0 0; padding-left: 18px; }
.order-items li { margin-bottom: 6px; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }

.item-line { display:block; margin-top:4px; }
.audit-line { display:block; margin-top:4px; letter-spacing:.2px; }
.note-line { display:block; margin-top:6px; color:#f5c518; font-size:12px; }
.note-box { margin-top:10px; margin-bottom:10px; padding:8px 10px; border-radius:10px; border:1px solid rgba(245, 197, 24, 0.35); background:rgba(245, 197, 24, 0.08); color:#f5d86a; font-size:13px; }

@media (max-width: 1100px) {
  .kpi-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
}
@media (max-width: 760px) {
  .hero { flex-direction:column; }
  .kpi-grid { grid-template-columns: 1fr; }
  .inbox-item, .stock-card-head { flex-direction:column; }
  .stock-metrics { grid-template-columns:1fr; }
}
</style>
