<template>
  <div class="layout">
    <aside class="sidebar">
      <h2>MANAGER</h2>
      <nav>
        <button :class="{active:tab==='report'}" @click="tab='report'">📊 Finance Report</button>
        <button :class="{active:tab==='payroll'}" @click="openPayrollTab">💸 Payroll Terapis</button>
        <button :class="{active:tab==='orders'}" @click="tab='orders'">🧾 Orders</button>
        <button :class="{active:tab==='timers'}" @click="tab='timers'">⏱ Timers</button>
        <button :class="{active:tab==='branches'}" @click="tab='branches'">🏢 Branches</button>
        <button :class="{active:tab==='services'}" @click="tab='services'">🛎 Services</button>
        <button :class="{active:tab==='therapists'}" @click="tab='therapists'">💆 Therapists</button>
        <button :class="{active:tab==='rooms'}" @click="tab='rooms'">🚪 Rooms</button>
        <button :class="{active:tab==='stock'}" @click="tab='stock'">📦 FNB Stock</button>
        <button :class="{active:tab==='grades'}" @click="tab='grades'">🏆 Grades</button>
      </nav>
      <button class="logout" @click="logout">Logout</button>
    </aside>

    <main class="content">
      <section v-if="tab==='report'" class="page">
        <section class="card hero">
          <div>
            <h2>Manager Financial Dashboard</h2>
            <p class="muted">P&L, cashflow, trend chart, dan drill-down accounting.</p>
          </div>
          <div class="hero-actions">
            <span v-if="loading" class="muted">Loading...</span>
            <span v-else-if="loadError" class="bad">{{ loadError }}</span>
            <button class="btn" @click="loadReport">Refresh</button>
          </div>
        </section>

        <section class="card filters">
          <div class="field">
            <label>Outlet</label>
            <select v-model="selectedBranch">
              <option value="ALL">Semua Outlet</option>
              <option v-for="b in branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
            </select>
          </div>
          <div class="field"><label>Dari</label><input type="date" v-model="dateFrom" /></div>
          <div class="field"><label>Sampai</label><input type="date" v-model="dateTo" /></div>
          <div class="field">
            <label>Gaji Karyawan Tetap</label>
            <input type="number" min="0" v-model.number="fixedSalaryCost" />
          </div>
          <button class="btn" @click="loadReport">Terapkan</button>
        </section>

        <section class="kpi-grid">
          <article class="card kpi"><p>Revenue</p><h3>Rp {{ formatCurrency(totalRevenue) }}</h3></article>
          <article class="card kpi"><p>Paid Orders</p><h3>{{ paidOrders }}</h3></article>
          <article class="card kpi"><p>Beban Terapis (Kerja × Komisi)</p><h3>Rp {{ formatCurrency(therapistSalaryCost) }}</h3></article>
          <article class="card kpi"><p>Total Beban</p><h3>Rp {{ formatCurrency(totalExpense) }}</h3></article>
          <article class="card kpi"><p>Net Profit/Loss</p><h3 :class="netProfit>=0?'good':'bad'">Rp {{ formatCurrency(netProfit) }}</h3></article>
        </section>

        <section class="card chart-grid">
          <div>
            <h4>Revenue Trend</h4>
            <ApexChart type="area" :height="240" :series="trendSeries" :options="trendOptions" />
          </div>
          <div>
            <h4>Breakdown Service</h4>
            <ApexChart type="donut" :height="240" :series="breakdownSeries" :options="breakdownOptions" />
          </div>
        </section>

        <section class="card">
          <h4>Trend Pendapatan per Kategori (FNB, SPA, LC, KTV)</h4>
          <ApexChart type="line" :height="250" :series="categoryTrendSeries" :options="categoryTrendOptions" />
        </section>

        <section class="card">
          <div class="table-head">
            <h4>Cashflow Simulation</h4>
            <button class="btn" @click="addExpense">Tambah Beban Manual</button>
          </div>
          <table class="table">
            <tbody>
              <tr><td>Cash In (Revenue)</td><td class="num">Rp {{ formatCurrency(totalRevenue) }}</td></tr>
              <tr><td>Cash Out (Beban Terapis)</td><td class="num">Rp {{ formatCurrency(therapistSalaryCost) }}</td></tr>
              <tr><td>Cash Out (Gaji Karyawan)</td><td class="num">Rp {{ formatCurrency(fixedSalaryCost) }}</td></tr>
              <tr v-for="(e, idx) in manualExpenses" :key="idx"><td>{{ e.label }}</td><td class="num">Rp {{ formatCurrency(e.amount) }}</td></tr>
              <tr><td><strong>Net Cashflow</strong></td><td class="num"><strong>Rp {{ formatCurrency(netProfit) }}</strong></td></tr>
            </tbody>
          </table>
        </section>

        <section class="card">
          <div class="table-head">
            <h4>Detail Orders (Accounting Drill-down)</h4>
            <div class="pagination-inline">
              <label class="muted small">Per Halaman</label>
              <select v-model.number="ordersPageSize" class="mini-select">
                <option :value="10">10</option>
                <option :value="25">25</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
              </select>
            </div>
          </div>
          <table class="table">
            <thead><tr><th>Order</th><th>Outlet</th><th>Status</th><th>Kategori</th><th>Total</th><th>Waktu</th></tr></thead>
            <tbody>
              <tr v-if="!filteredOrders.length"><td colspan="6" class="muted">Belum ada data order pada filter ini.</td></tr>
              <tr v-for="o in pagedFilteredOrders" :key="o.id">
                <td>#{{ o.id }}</td>
                <td>{{ o.branch_name || '-' }}</td>
                <td>{{ o.status }}</td>
                <td>{{ o.category || '-' }}</td>
                <td class="num">Rp {{ formatCurrency(o.total) }}</td>
                <td>{{ formatDate(o.created_at) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="pagination" v-if="filteredOrders.length">
            <button class="btn" @click="ordersPage = Math.max(1, ordersPage - 1)" :disabled="ordersPage===1">Prev</button>
            <span>Halaman {{ ordersPage }} / {{ ordersTotalPages }}</span>
            <button class="btn" @click="ordersPage = Math.min(ordersTotalPages, ordersPage + 1)" :disabled="ordersPage===ordersTotalPages">Next</button>
          </div>
        </section>
      </section>

      <section v-else-if="tab==='payroll'" class="page">
        <section class="card hero">
          <div>
            <h2>Pembayaran Terapis</h2>
            <p class="muted">Perhitungan jumlah kerja × komisi grade fix, lalu settlement agar tidak double hitung.</p>
          </div>
        </section>

        <section class="card filters">
          <div class="field"><label>Dari</label><input type="date" v-model="payrollFrom" /></div>
          <div class="field"><label>Sampai</label><input type="date" v-model="payrollTo" /></div>
          <button class="btn" @click="loadPayroll">Hitung Payroll</button>
          <button class="btn" @click="settlePayroll">Settle Paid</button>
          <button class="btn" @click="printPayroll">Print</button>
          <button class="btn" @click="exportPayrollPdf">Cetak PDF</button>
        </section>

        <section class="card" v-if="payrollWarning">
          <p class="bad">⚠️ {{ payrollWarning }}</p>
        </section>

        <section class="card" id="payroll-print-area">
          <h4>Detail Payroll Terapis</h4>
          <table class="table">
            <thead>
              <tr>
                <th>Terapis</th><th>Grade</th><th>SPA</th><th>LC</th><th>Total Kerja</th><th>Komisi Fix</th><th>Gross</th><th>Sudah Paid</th><th>Unsettled</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!payrollRows.length"><td colspan="9" class="muted">Belum ada data payroll di range ini.</td></tr>
              <tr v-for="row in payrollRows" :key="row.therapist_id">
                <td>{{ row.therapist_name }}</td>
                <td>{{ row.grade_name }}</td>
                <td>{{ row.spa_work_count }}</td>
                <td>{{ row.lc_work_count }}</td>
                <td>{{ row.work_count }}</td>
                <td class="num">Rp {{ formatCurrency(row.commission_amount) }}</td>
                <td class="num">Rp {{ formatCurrency(row.gross_amount) }}</td>
                <td class="num">Rp {{ formatCurrency(row.paid_amount) }}</td>
                <td class="num">Rp {{ formatCurrency(row.unsettled_amount) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </section>

      <Orders v-else-if="tab==='orders'" />
      <Timers v-else-if="tab==='timers'" />
      <Branches v-else-if="tab==='branches'" />
      <Services v-else-if="tab==='services'" :branch-id="Number(selectedBranch) || 1" />
      <Therapists v-else-if="tab==='therapists'" />
      <Rooms v-else-if="tab==='rooms'" />
      <StockDashboard v-else-if="tab==='stock'" />
      <Grades v-else-if="tab==='grades'" />
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue"
import { useRouter } from "vue-router"
import Swal from "sweetalert2"
import api from "../../services/api"
import ApexChart from "../../components/ApexChart.vue"
import Orders from "../superadmin/Orders.vue"
import Timers from "../superadmin/Timers.vue"
import Branches from "../superadmin/Branches.vue"
import Services from "../superadmin/Services.vue"
import Therapists from "../superadmin/Therapists.vue"
import Rooms from "../superadmin/Rooms.vue"
import Grades from "../superadmin/Grades.vue"
import StockDashboard from "../stock/StockDashboard.vue"
import { useAuthStore } from "../../store/auth.store"

const tab = ref("report")
const branches = ref([])
const orders = ref([])
const loading = ref(false)
const loadError = ref("")
const selectedBranch = ref("ALL")
const dateFrom = ref("")
const dateTo = ref("")
const fixedSalaryCost = ref(0)
const manualExpenses = ref([])
const ordersPage = ref(1)
const ordersPageSize = ref(25)

const payrollFrom = ref("")
const payrollTo = ref("")
const payrollRows = ref([])
const payrollWarning = ref("")

const auth = useAuthStore()
const router = useRouter()

const logout = () => {
  auth.logout()
  router.push("/")
}

const loadReport = async () => {
  loading.value = true
  loadError.value = ""
  try {
    const [ordersRes, branchRes] = await Promise.all([
      api.get("/superadmin/orders"),
      api.get("/superadmin/branches")
    ])
    orders.value = Array.isArray(ordersRes.data) ? ordersRes.data : []
    branches.value = Array.isArray(branchRes.data) ? branchRes.data : []
  } catch (err) {
    orders.value = []
    branches.value = []
    loadError.value = err?.response?.data?.message || "Gagal memuat data manager"
    await Swal.fire({ icon: "error", title: "Load report gagal", text: loadError.value })
  } finally {
    loading.value = false
  }
}

const loadPayroll = async () => {
  try {
    payrollWarning.value = ""
    const { data } = await api.get("/superadmin/therapist-payroll", {
      params: {
        branch_id: selectedBranch.value,
        date_from: payrollFrom.value,
        date_to: payrollTo.value
      }
    })
    payrollRows.value = data.rows || []
    if (data.has_settlement_in_range) {
      payrollWarning.value = "Range salah: sudah ada pembayaran terapis pada rentang ini."
      await Swal.fire({ icon: "warning", title: "Range sudah dibayar", text: payrollWarning.value })
    }
  } catch (err) {
    payrollRows.value = []
    await Swal.fire({ icon: "error", title: "Gagal hitung payroll", text: err?.response?.data?.message || "Gagal memuat payroll" })
  }
}

const settlePayroll = async () => {
  if (!payrollRows.value.length) {
    await Swal.fire({ icon: "info", title: "Belum ada data", text: "Silakan hitung payroll dahulu." })
    return
  }

  if (payrollWarning.value) {
    await Swal.fire({ icon: "warning", title: "Range salah", text: payrollWarning.value })
    return
  }

  const { isConfirmed } = await Swal.fire({
    icon: "question",
    title: "Konfirmasi Settlement",
    text: "Payroll pada range ini akan ditandai paid dan masuk accounting settle.",
    showCancelButton: true,
    confirmButtonText: "Settle"
  })

  if (!isConfirmed) return

  try {
    const { data } = await api.post("/superadmin/therapist-payroll/settle", {
      branch_id: selectedBranch.value,
      date_from: payrollFrom.value,
      date_to: payrollTo.value
    })
    await Swal.fire({ icon: "success", title: "Settlement berhasil", text: `Baris: ${data.settled_count}, total: Rp ${formatCurrency(data.settled_amount)}` })
    await loadPayroll()
  } catch (err) {
    await Swal.fire({ icon: "error", title: "Settlement gagal", text: err?.response?.data?.message || "Gagal settle payroll" })
  }
}

const openPayrollTab = async () => {
  tab.value = "payroll"
  await loadPayroll()
}

const printPayroll = () => window.print()
const exportPayrollPdf = () => window.print()

onMounted(() => {
  const today = new Date()
  const first = new Date(today.getFullYear(), today.getMonth(), 1)
  const firstISO = first.toISOString().slice(0, 10)
  const todayISO = today.toISOString().slice(0, 10)
  dateFrom.value = firstISO
  dateTo.value = todayISO
  payrollFrom.value = firstISO
  payrollTo.value = todayISO
  loadReport()
  loadPayroll()
})

watch([selectedBranch, dateFrom, dateTo, ordersPageSize], () => {
  ordersPage.value = 1
})

const filteredOrders = computed(() => orders.value.filter((o) => {
  if (selectedBranch.value !== "ALL" && String(o.branch_id) !== String(selectedBranch.value)) return false
  const dt = new Date(o.created_at)
  if (dateFrom.value && dt < new Date(dateFrom.value)) return false
  if (dateTo.value && dt > new Date(`${dateTo.value}T23:59:59`)) return false
  return true
}))

const ordersTotalPages = computed(() => Math.max(1, Math.ceil(filteredOrders.value.length / Number(ordersPageSize.value || 25))))
const pagedFilteredOrders = computed(() => {
  const start = (ordersPage.value - 1) * Number(ordersPageSize.value || 25)
  return filteredOrders.value.slice(start, start + Number(ordersPageSize.value || 25))
})

const paidOrdersList = computed(() => filteredOrders.value.filter((o) => String(o.status || "").toUpperCase() === "PAID"))
const totalRevenue = computed(() => paidOrdersList.value.reduce((a, o) => a + Number(o.total || 0), 0))
const paidOrders = computed(() => paidOrdersList.value.length)
const therapistSalaryCost = computed(() => payrollRows.value.reduce((a, r) => a + Number(r.gross_amount || 0), 0))
const manualExpenseTotal = computed(() => manualExpenses.value.reduce((a, e) => a + Number(e.amount || 0), 0))
const totalExpense = computed(() => therapistSalaryCost.value + Number(fixedSalaryCost.value || 0) + manualExpenseTotal.value)
const netProfit = computed(() => totalRevenue.value - totalExpense.value)

const trendBuckets = computed(() => {
  const map = new Map()
  for (const o of paidOrdersList.value) {
    const key = new Date(o.created_at).toLocaleDateString("id-ID")
    map.set(key, (map.get(key) || 0) + Number(o.total || 0))
  }
  return map
})

const formatAccountingNumber = (v) => Number(v || 0).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const trendSeries = computed(() => ([{ name: "Revenue", data: [...trendBuckets.value.values()].length ? [...trendBuckets.value.values()] : [0] }]))
const trendOptions = computed(() => ({
  chart: { toolbar: { show: false }, background: "transparent" },
  theme: { mode: "dark" },
  xaxis: { categories: [...trendBuckets.value.keys()].length ? [...trendBuckets.value.keys()] : ["No Data"] },
  yaxis: { labels: { formatter: formatAccountingNumber } },
  dataLabels: { enabled: false },
  tooltip: { y: { formatter: formatAccountingNumber } },
  colors: ["#5f85ff"]
}))

const breakdownMap = computed(() => {
  const map = new Map()
  for (const o of paidOrdersList.value) {
    for (const cat of String(o.category || "-").split(",").map((x) => x.trim()).filter(Boolean)) {
      map.set(cat, (map.get(cat) || 0) + Number(o.total || 0))
    }
  }
  return map
})

const breakdownSeries = computed(() => [...breakdownMap.value.values()].length ? [...breakdownMap.value.values()] : [1])
const breakdownOptions = computed(() => ({
  labels: [...breakdownMap.value.keys()].length ? [...breakdownMap.value.keys()] : ["No Data"],
  theme: { mode: "dark" },
  tooltip: { y: { formatter: formatAccountingNumber } },
  legend: { position: "bottom" }
}))

const categoryTrendData = computed(() => {
  const keys = ["FNB", "SPA", "LC", "KTV"]
  const dayMap = new Map()
  for (const o of paidOrdersList.value) {
    const day = new Date(o.created_at).toLocaleDateString("id-ID")
    if (!dayMap.has(day)) dayMap.set(day, { FNB: 0, SPA: 0, LC: 0, KTV: 0 })
    const categories = String(o.category || "").toUpperCase().split(",").map((v) => v.trim()).filter(Boolean)
    const matched = keys.filter((k) => categories.some((cat) => cat.includes(k)))
    const divisor = matched.length || 1
    const allocated = Number(o.total || 0) / divisor
    for (const cat of matched) dayMap.get(day)[cat] += allocated
  }
  return dayMap
})

const categoryTrendSeries = computed(() => {
  const days = [...categoryTrendData.value.keys()]
  if (!days.length) return ["FNB", "SPA", "LC", "KTV"].map((name) => ({ name, data: [0] }))
  return ["FNB", "SPA", "LC", "KTV"].map((name) => ({ name, data: days.map((d) => Number(categoryTrendData.value.get(d)?.[name] || 0)) }))
})

const categoryTrendOptions = computed(() => ({
  chart: { toolbar: { show: false }, background: "transparent" },
  theme: { mode: "dark" },
  xaxis: { categories: [...categoryTrendData.value.keys()].length ? [...categoryTrendData.value.keys()] : ["No Data"] },
  yaxis: { labels: { formatter: formatAccountingNumber } },
  tooltip: { y: { formatter: formatAccountingNumber } },
  dataLabels: { enabled: false },
  stroke: { curve: "smooth", width: 2 },
  legend: { position: "top" },
  colors: ["#ff9f43", "#5f85ff", "#38d996", "#e056fd"]
}))

const addExpense = async () => {
  const { value: formValues } = await Swal.fire({
    title: "Tambah Beban Manual",
    html:
      '<input id="exp-label" class="swal2-input" placeholder="Nama beban">' +
      '<input id="exp-amount" class="swal2-input" type="number" placeholder="Nominal">',
    focusConfirm: false,
    preConfirm: () => ({
      label: document.getElementById("exp-label").value,
      amount: Number(document.getElementById("exp-amount").value || 0)
    })
  })

  if (!formValues?.label || !formValues?.amount) return
  manualExpenses.value.push(formValues)
}

const formatCurrency = (v) => Number(v || 0).toLocaleString("id-ID")
const formatDate = (v) => new Date(v).toLocaleString("id-ID")
</script>

<style scoped>
.layout { display:flex; min-height:100vh; background:#0e0e0e; color:#fff; }
.sidebar { width:240px; background:#111; border-right:1px solid #c9a24d; padding:16px; display:flex; flex-direction:column; }
.sidebar h2 { color:#c9a24d; margin-bottom:12px; }
nav { display:grid; gap:8px; }
nav button { text-align:left; background:transparent; border:none; color:#fff; padding:10px; border-radius:10px; cursor:pointer; }
nav button.active { background:#c9a24d; color:#000; }
.logout { margin-top:auto; background:#c9a24d; color:#000; border:none; border-radius:10px; padding:10px; cursor:pointer; font-weight:700; }
.content { flex:1; padding:20px; }
.page { display:grid; gap:14px; }
.card { background:linear-gradient(120deg, rgba(255,255,255,.02), rgba(255,255,255,.01)); border:1px solid rgba(255,255,255,.09); border-radius:14px; padding:14px; }
.hero { display:flex; justify-content:space-between; align-items:center; }
.muted { color:#a5adba; }
.small { font-size: 12px; }
.btn { background:transparent; border:1px solid #c9a24d; color:#c9a24d; border-radius:10px; padding:8px 14px; cursor:pointer; }
.btn:disabled { opacity:.45; cursor:not-allowed; }
.filters { display:flex; gap:10px; flex-wrap:wrap; align-items:end; }
.field { display:grid; gap:6px; }
.field label { font-size:12px; color:#a5adba; }
.field input, .field select { background:#090909; border:1px solid #2f3440; color:#fff; border-radius:10px; padding:8px 10px; min-width:150px; }
.kpi-grid { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:10px; }
.kpi h3 { margin-top:6px; }
.good { color:#38d996; }
.bad { color:#ff6b6b; }
.chart-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.table { width:100%; border-collapse:collapse; }
.table th,.table td { padding:10px; border-bottom:1px solid rgba(255,255,255,.08); text-align:left; }
.num { text-align:right; }
.table-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap: 10px; }
.pagination { display:flex; justify-content:flex-end; align-items:center; gap:10px; margin-top:10px; }
.pagination-inline { display:flex; align-items:center; gap:8px; }
.mini-select { background:#090909; border:1px solid #2f3440; color:#fff; border-radius:8px; padding:6px 8px; }
</style>
