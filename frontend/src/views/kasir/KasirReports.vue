<template>
  <div class="reports-page">
    <header class="page-header">
      <div>
        <h1>Laporan Pendapatan</h1>
        <p>Analytics harian, mingguan, bulanan + custom range</p>
      </div>
      <div class="header-actions">
        <button class="print-btn" @click="printPosReport" :disabled="loading">Cetak POS</button>
        <button class="print-btn" @click="printReport" :disabled="loading">Cetak A4</button>
        <button class="back-btn floating-back" @click="router.push('/kasir')">Kembali</button>
      </div>
    </header>

    <section class="filters">
      <label>Periode</label>
      <select v-model="filters.preset" @change="onPresetChange" :disabled="loading">
        <option value="daily">Harian</option>
        <option value="weekly">Mingguan</option>
        <option value="monthly">Bulanan</option>
      </select>

      <label>Dari</label>
      <input
        ref="dateFromEl"
        class="date-input"
        type="date"
        v-model="filters.date_from"
        :disabled="loading"
        @click="openDatePicker('from')"
      />

      <label>Sampai</label>
      <input
        ref="dateToEl"
        class="date-input"
        type="date"
        v-model="filters.date_to"
        :disabled="loading"
        @click="openDatePicker('to')"
      />

      <button class="apply-btn" @click="loadAnalytics" :disabled="loading">
        {{ loading ? 'Memuat...' : 'Terapkan' }}
      </button>
      <button class="ghost-btn" @click="resetRange" :disabled="loading">Reset</button>
    </section>

    <section class="summary-grid">
      <article class="summary-card">
        <span>Total Pendapatan</span>
        <strong>Rp {{ format(displayRevenueTotal) }}</strong>
      </article>
      <article class="summary-card">
        <span>Order PAID</span>
        <strong>{{ analytics.summary.paid_orders }}</strong>
      </article>
      <article class="summary-card">
        <span>Item Terjual</span>
        <strong>{{ analytics.summary.items_sold }}</strong>
      </article>
      <article class="summary-card">
        <span>Range</span>
        <strong>{{ analytics.range.from }} — {{ analytics.range.to }}</strong>
      </article>
      <article class="summary-card">
        <span>Total SPA</span>
        <strong>Rp {{ format(spaTotalRevenue) }}</strong>
      </article>
      <article class="summary-card">
        <span>Total LC</span>
        <strong>Rp {{ format(lcTotalRevenue) }}</strong>
      </article>
      <article class="summary-card">
        <span>Total FNB</span>
        <strong>Rp {{ format(fnbTotalRevenue) }}</strong>
      </article>
      <article class="summary-card">
        <span>Total KTV</span>
        <strong>Rp {{ format(ktvTotalRevenue) }}</strong>
      </article>
    </section>

    <section class="chart-panel compact-panel">
      <h3>Grafik Pendapatan</h3>
      <div class="chart-wrap">
        <ApexChart
          type="area"
          :height="240"
          :options="trendChartOptions"
          :series="trendChartSeries"
        />
      </div>
    </section>

    <section class="chart-panel compact-panel">
      <h3>Pergerakan Harian Kategori (SPA / LC / FNB / KTV)</h3>
      <div class="chart-wrap small">
        <ApexChart
          type="line"
          :height="220"
          :options="categoryTrendOptions"
          :series="categoryTrendSeries"
        />
      </div>
    </section>

    <section class="two-col">
      <article class="table-card">
        <h3>Breakdown Service</h3>
        <table>
          <thead>
            <tr><th>Kategori</th><th>Qty</th><th>Pendapatan</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in normalizedBreakdown" :key="row.category">
              <td>{{ row.category }}</td>
              <td>{{ row.qty }}</td>
              <td>Rp {{ format(row.revenue) }}</td>
            </tr>
          </tbody>
        </table>
      </article>

      <article class="table-card">
        <h3>FNB Terlaris</h3>
        <table>
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Pendapatan</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in analytics.top_fnb" :key="row.service_id">
              <td>{{ row.service_name }}</td>
              <td>{{ row.qty }}</td>
              <td>Rp {{ format(row.revenue) }}</td>
            </tr>
            <tr v-if="!analytics.top_fnb.length"><td colspan="3" class="muted">Belum ada data FNB</td></tr>
          </tbody>
        </table>
      </article>
    </section>

    <section class="table-card">
      <h3>Terapis Terlaris</h3>
      <table>
        <thead>
          <tr><th>Nama Terapis</th><th>Grade</th><th>Order</th><th>Pendapatan</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in analytics.top_therapists" :key="`${row.therapist_name}-${row.grade_name}`">
            <td>{{ row.therapist_name }}</td>
            <td>{{ row.grade_name || '-' }}</td>
            <td>{{ row.orders }}</td>
            <td>Rp {{ format(row.revenue) }}</td>
          </tr>
          <tr v-if="!analytics.top_therapists.length"><td colspan="4" class="muted">Belum ada data terapis</td></tr>
        </tbody>
      </table>
    </section>

    <section class="table-card">
      <h3>Recap Pendapatan per Kategori</h3>
      <table>
        <thead>
          <tr><th>Kategori</th><th>Item Terjual</th><th>Total Pendapatan</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in normalizedBreakdown" :key="`recap-${row.category}`">
            <td>{{ row.category }}</td>
            <td>{{ row.qty }}</td>
            <td>Rp {{ format(row.revenue) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="two-col">
      <article class="table-card">
        <h3>Recap Pendapatan FNB (Semua Item)</h3>
        <table>
          <thead>
            <tr><th>Item FNB</th><th>Qty</th><th>Pendapatan</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in fnbServiceRows" :key="`fnb-recap-${row.service_id}`">
              <td>{{ row.service_name }}</td>
              <td>{{ row.qty }}</td>
              <td>Rp {{ format(row.revenue) }}</td>
            </tr>
            <tr v-if="!fnbServiceRows.length"><td colspan="3" class="muted">Belum ada data FNB</td></tr>
          </tbody>
          <tfoot>
            <tr>
              <th>Total FNB</th>
              <th>{{ fnbTotalQty }}</th>
              <th>Rp {{ format(fnbTotalRevenue) }}</th>
            </tr>
          </tfoot>
        </table>
      </article>

      <article class="table-card">
        <h3>Recap SPA</h3>
        <table>
          <thead><tr><th>Layanan</th><th>Qty</th><th>Pendapatan</th></tr></thead>
          <tbody>
            <tr v-for="row in spaServiceRows" :key="`spa-${row.service_id}`"><td>{{ row.service_name }}</td><td>{{ row.qty }}</td><td>Rp {{ format(row.revenue) }}</td></tr>
            <tr v-if="!spaServiceRows.length"><td colspan="3" class="muted">Belum ada data SPA</td></tr>
          </tbody>
        </table>
      </article>
      <article class="table-card">
        <h3>Recap LC</h3>
        <table>
          <thead><tr><th>Layanan</th><th>Qty</th><th>Pendapatan</th></tr></thead>
          <tbody>
            <tr v-for="row in lcServiceRows" :key="`lc-${row.service_id}`"><td>{{ row.service_name }}</td><td>{{ row.qty }}</td><td>Rp {{ format(row.revenue) }}</td></tr>
            <tr v-if="!lcServiceRows.length"><td colspan="3" class="muted">Belum ada data LC</td></tr>
          </tbody>
        </table>
      </article>
      <article class="table-card">
        <h3>Recap KTV</h3>
        <table>
          <thead><tr><th>Layanan</th><th>Qty</th><th>Pendapatan</th></tr></thead>
          <tbody>
            <tr v-for="row in ktvServiceRows" :key="`ktv-${row.service_id}`"><td>{{ row.service_name }}</td><td>{{ row.qty }}</td><td>Rp {{ format(row.revenue) }}</td></tr>
            <tr v-if="!ktvServiceRows.length"><td colspan="3" class="muted">Belum ada data KTV</td></tr>
          </tbody>
        </table>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import { useAuthStore } from '@/store/auth.store'
import Swal from 'sweetalert2'
import ApexChart from '@/components/ApexChart.vue'
import { getPrinterAgentConfig } from '@/utils/printerAgentConfig'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const dateFromEl = ref(null)
const dateToEl = ref(null)

const filters = ref({
  preset: 'daily',
  date_from: '',
  date_to: ''
})

const analytics = ref({
  range: { from: '-', to: '-' },
  summary: { revenue: 0, paid_orders: 0, items_sold: 0 },
  breakdown: [],
  top_fnb: [],
  top_therapists: [],
  trend: [],
  category_trend: []
})

const format = (n) => new Intl.NumberFormat('id-ID').format(Number(n || 0))

const openDatePicker = (field) => {
  const target = field === 'from' ? dateFromEl.value : dateToEl.value
  if (target?.showPicker) {
    try {
      target.showPicker()
    } catch (_) {
      // Ignore NotAllowedError when browser requires explicit user gesture.
    }
  }
}

const onPresetChange = () => {
  filters.value.date_from = ''
  filters.value.date_to = ''
}

const resetRange = async () => {
  filters.value.date_from = ''
  filters.value.date_to = ''
  await loadAnalytics()
}

const loadAnalytics = async () => {
  loading.value = true
  try {
    const { data } = await api.get('/dashboard/kasir/analytics', {
      params: {
        preset: filters.value.preset,
        date_from: filters.value.date_from || undefined,
        date_to: filters.value.date_to || undefined
      }
    })
    analytics.value = data
  } catch (err) {
    await Swal.fire({
      icon: 'error',
      title: 'Gagal memuat laporan',
      text: err.response?.data?.message || 'Terjadi kesalahan saat mengambil data analytics.',
      background: '#111',
      color: '#fff'
    })
  } finally {
    loading.value = false
  }
}

const normalizedBreakdown = computed(() => {
  const base = { SPA: 0, LC: 0, FNB: 0, KTV: 0 }
  const qty = { SPA: 0, LC: 0, FNB: 0, KTV: 0 }
  for (const row of analytics.value.breakdown || []) {
    const key = row.category === 'KARAOKE' ? 'KTV' : row.category
    if (base[key] !== undefined) {
      base[key] += Number(row.revenue || 0)
      qty[key] += Number(row.qty || 0)
    }
  }
  return Object.keys(base).map((category) => ({
    category,
    qty: qty[category],
    revenue: base[category]
  }))
})

const displayRevenueTotal = computed(() => {
  return normalizedBreakdown.value.reduce((sum, row) => sum + Number(row.revenue || 0), 0)
})

const fnbServiceRows = computed(() => {
  return (analytics.value.service_details || [])
    .filter((row) => row.category === 'FNB')
    .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
})


const spaServiceRows = computed(() => {
  return (analytics.value.service_details || [])
    .filter((row) => row.category === 'SPA')
    .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
})

const lcServiceRows = computed(() => {
  return (analytics.value.service_details || [])
    .filter((row) => row.category === 'LC')
    .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
})

const ktvServiceRows = computed(() => {
  return (analytics.value.service_details || [])
    .filter((row) => row.category === 'KTV')
    .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
})

const nonFnbServiceRows = computed(() => {
  return (analytics.value.service_details || [])
    .filter((row) => ['SPA', 'LC', 'KTV'].includes(row.category))
    .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
})

const fnbTotalRevenue = computed(() => {
  return fnbServiceRows.value.reduce((sum, row) => sum + Number(row.revenue || 0), 0)
})

const spaTotalRevenue = computed(() => {
  return spaServiceRows.value.reduce((sum, row) => sum + Number(row.revenue || 0), 0)
})

const lcTotalRevenue = computed(() => {
  return lcServiceRows.value.reduce((sum, row) => sum + Number(row.revenue || 0), 0)
})

const ktvTotalRevenue = computed(() => {
  return ktvServiceRows.value.reduce((sum, row) => sum + Number(row.revenue || 0), 0)
})

const fnbTotalQty = computed(() => {
  return fnbServiceRows.value.reduce((sum, row) => sum + Number(row.qty || 0), 0)
})


const printPosReport = async () => {
  try {
    const outletName = auth.user?.branch_name
      || auth.user?.branch
      || auth.user?.branch?.name
      || 'Outlet'

    await api.post('/printers/print-recap', {
      printer: getPrinterAgentConfig(),
      report: {
        branch_name: outletName,
        range: analytics.value.range,
        summary: analytics.value.summary,
        service_details: analytics.value.service_details || []
      }
    })

    await Swal.fire({
      icon: 'success',
      title: 'Recap dikirim',
      text: '🖨 Cetak POS langsung dikirim ke printer',
      background: '#111',
      color: '#fff'
    })
  } catch (err) {
    await Swal.fire({
      icon: 'error',
      title: 'Gagal cetak POS',
      text: err.response?.data?.message || 'Gagal kirim recap ke printer agent.',
      background: '#111',
      color: '#fff'
    })
  }
}

const printReport = () => {
  const reportWindow = window.open('', '_blank', 'width=1024,height=768')
  if (!reportWindow) return

  const rangeLabel = `${analytics.value.range.from} s/d ${analytics.value.range.to}`
  const categoryRowsHtml = normalizedBreakdown.value
    .map((row) => `<tr><td>${row.category}</td><td>${row.qty}</td><td>Rp ${format(row.revenue)}</td></tr>`)
    .join('')

  const fnbRowsHtml = fnbServiceRows.value
    .map((row) => `<tr><td>${row.service_name}</td><td>${row.qty}</td><td>Rp ${format(row.revenue)}</td></tr>`)
    .join('')

  const spaRowsHtml = spaServiceRows.value
    .map((row) => `<tr><td>${row.service_name}</td><td>${row.qty}</td><td>Rp ${format(row.revenue)}</td></tr>`)
    .join('')

  const lcRowsHtml = lcServiceRows.value
    .map((row) => `<tr><td>${row.service_name}</td><td>${row.qty}</td><td>Rp ${format(row.revenue)}</td></tr>`)
    .join('')

  const ktvRowsHtml = ktvServiceRows.value
    .map((row) => `<tr><td>${row.service_name}</td><td>${row.qty}</td><td>Rp ${format(row.revenue)}</td></tr>`)
    .join('')

  reportWindow.document.write(`
    <html>
      <head>
        <title>Report Pendapatan Kasir</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
          h1, h2 { margin: 0 0 8px; }
          .meta { margin-bottom: 16px; color: #444; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; }
          .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px; }
          .summary div { border: 1px solid #ddd; padding: 10px; border-radius: 6px; }
        </style>
      </head>
      <body>
        <h1>Report Pendapatan Kasir</h1>
        <p class="meta">Periode: ${rangeLabel}</p>
        <div class="summary">
          <div><strong>Total Pendapatan:</strong> Rp ${format(displayRevenueTotal.value)}</div>
          <div><strong>Total Order PAID:</strong> ${analytics.value.summary.paid_orders}</div>
          <div><strong>Total Item Terjual:</strong> ${analytics.value.summary.items_sold}</div>
          <div><strong>Total SPA:</strong> Rp ${format(spaTotalRevenue.value)}</div>
          <div><strong>Total LC:</strong> Rp ${format(lcTotalRevenue.value)}</div>
          <div><strong>Total FNB:</strong> Rp ${format(fnbTotalRevenue.value)}</div>
          <div><strong>Total KTV:</strong> Rp ${format(ktvTotalRevenue.value)}</div>
        </div>

        <h2>Recap Kategori (SPA / LC / FNB / KTV)</h2>
        <table>
          <thead><tr><th>Kategori</th><th>Qty</th><th>Pendapatan</th></tr></thead>
          <tbody>${categoryRowsHtml || '<tr><td colspan="3">Belum ada data</td></tr>'}</tbody>
        </table>

        <h2>Recap Pendapatan FNB (Semua Item)</h2>
        <table>
          <thead><tr><th>Item FNB</th><th>Qty</th><th>Pendapatan</th></tr></thead>
          <tbody>${fnbRowsHtml || '<tr><td colspan="3">Belum ada data FNB</td></tr>'}</tbody>
          <tfoot><tr><th>Total FNB</th><th>${fnbTotalQty.value}</th><th>Rp ${format(fnbTotalRevenue.value)}</th></tr></tfoot>
        </table>

        <h2>Recap SPA</h2><table><thead><tr><th>Layanan</th><th>Qty</th><th>Pendapatan</th></tr></thead><tbody>${spaRowsHtml || '<tr><td colspan="3">Belum ada data SPA</td></tr>'}</tbody></table>
        <h2>Recap LC</h2><table><thead><tr><th>Layanan</th><th>Qty</th><th>Pendapatan</th></tr></thead><tbody>${lcRowsHtml || '<tr><td colspan="3">Belum ada data LC</td></tr>'}</tbody></table>
        <h2>Recap KTV</h2><table><thead><tr><th>Layanan</th><th>Qty</th><th>Pendapatan</th></tr></thead><tbody>${ktvRowsHtml || '<tr><td colspan="3">Belum ada data KTV</td></tr>'}</tbody></table>
      </body>
    </html>
  `)
  reportWindow.document.close()
  reportWindow.focus()
  reportWindow.print()
}

const trendChartOptions = computed(() => ({
  theme: { mode: 'dark' },
  colors: ['#f0c46a'],
  dataLabels: { enabled: false },
  stroke: {
    curve: 'smooth',
    width: 3
  },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.35,
      opacityTo: 0.05,
      stops: [0, 100]
    }
  },
  xaxis: {
    categories: (analytics.value.trend || []).map((row) => row.label),
    labels: { style: { colors: '#94a2b8' } },
    axisBorder: { color: '#273043' },
    axisTicks: { color: '#273043' }
  },
  yaxis: {
    labels: {
      style: { colors: '#94a2b8' },
      formatter: (value) => `Rp ${format(value)}`
    }
  },
  grid: {
    borderColor: '#273043',
    strokeDashArray: 4
  },
  tooltip: {
    theme: 'dark',
    y: {
      formatter: (value) => `Rp ${format(value)}`
    }
  },
  noData: {
    text: 'Belum ada data pendapatan',
    style: { color: '#94a2b8' }
  }
}))

const trendChartSeries = computed(() => ([
  {
    name: 'Pendapatan',
    data: (analytics.value.trend || []).map((row) => Number(row.revenue || 0))
  }
]))

const categoryTrendOptions = computed(() => ({
  theme: { mode: 'dark' },
  colors: ['#f0c46a', '#8b5cf6', '#22c55e', '#3b82f6'],
  stroke: {
    curve: 'smooth',
    width: 2.5
  },
  markers: {
    size: 3,
    strokeWidth: 0
  },
  dataLabels: { enabled: false },
  xaxis: {
    categories: (analytics.value.category_trend || []).map((row) => row.label),
    labels: { style: { colors: '#94a2b8' } },
    axisBorder: { color: '#273043' },
    axisTicks: { color: '#273043' }
  },
  yaxis: {
    labels: {
      style: { colors: '#94a2b8' },
      formatter: (value) => `Rp ${format(value)}`
    }
  },
  grid: {
    borderColor: '#273043',
    strokeDashArray: 4
  },
  tooltip: {
    theme: 'dark',
    y: {
      formatter: (value) => `Rp ${format(value)}`
    }
  },
  legend: {
    show: true,
    labels: { colors: '#94a2b8' }
  },
  noData: {
    text: 'Belum ada data pergerakan kategori',
    style: { color: '#94a2b8' }
  }
}))

const categoryTrendSeries = computed(() => ([
  {
    name: 'SPA',
    data: (analytics.value.category_trend || []).map((row) => Number(row.spa || 0))
  },
  {
    name: 'LC',
    data: (analytics.value.category_trend || []).map((row) => Number(row.lc || 0))
  },
  {
    name: 'FNB',
    data: (analytics.value.category_trend || []).map((row) => Number(row.fnb || 0))
  },
  {
    name: 'KTV',
    data: (analytics.value.category_trend || []).map((row) => Number(row.ktv || 0))
  }
]))

onMounted(loadAnalytics)
</script>

<style scoped>
.reports-page { padding: 20px; color: #fff; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.header-actions { display: flex; gap: 10px; align-items: center; }
.page-header h1 { margin: 0 0 4px; color: #f0c46a; }
.page-header p { margin: 0; color: #9aa0ae; }
.print-btn {
  min-width: 110px;
  min-height: 36px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 8px;
  background: #f0c46a;
  border: 1px solid #333;
  color: #111;
  cursor: pointer;
}
.back-btn {
  min-width: 110px;
  min-height: 36px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  background: #c0392b;
  border: 1px solid #333;
  color: white;
  cursor: pointer;
}

.filters { display: grid; grid-template-columns: auto 160px auto 160px auto 160px 110px 90px; gap: 10px; align-items: center; background:#121212; border:1px solid #242424; border-radius:12px; padding: 12px; margin-bottom: 14px; }
.filters select, .filters input { background:#1a1a1a; border:1px solid #2f2f2f; color:#fff; border-radius:8px; padding:8px 10px; }
.date-input { max-width: 160px; }
.apply-btn { background:#c9a24d; border:none; color:#111; font-weight:700; border-radius:8px; padding:9px; cursor:pointer; }
.ghost-btn { background:transparent; border:1px solid #474747; color:#fff; border-radius:8px; padding:9px; cursor:pointer; }
.apply-btn:disabled, .ghost-btn:disabled { opacity: .6; cursor: not-allowed; }
.print-btn:disabled { opacity: .6; cursor: not-allowed; }

.summary-grid { display:grid; gap:12px; grid-template-columns: repeat(4, minmax(0,1fr)); margin-bottom:14px; }
.summary-card { background:#111; border:1px solid #232323; border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:6px; }
.summary-card span { color:#9aa0ae; font-size:12px; }
.summary-card strong { font-size:22px; color:#f0c46a; }

.chart-panel, .table-card { background:#111; border:1px solid #232323; border-radius:12px; padding:14px; margin-bottom:14px; }
.chart-panel h3, .table-card h3 { margin:0 0 12px; }
.chart-wrap { height: 240px; }
.chart-wrap.small { height: 220px; }
:deep(canvas) { max-height: 240px !important; }

.two-col { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:12px; }
.floating-back { position: fixed; right: 16px; bottom: 16px; z-index: 30; box-shadow: 0 8px 18px rgba(0,0,0,.35); }
table { width:100%; border-collapse: collapse; }
th, td { padding:10px; border-bottom:1px solid #212121; text-align:left; }
th { color:#f0c46a; font-size:12px; }
tfoot th { color:#fff; }
.muted { text-align:center; color:#8a8a8a; }

@media (max-width: 1200px) { .two-col { grid-template-columns: 1fr 1fr; } }
@media (max-width: 1024px) {
  .filters { grid-template-columns: 1fr 1fr; }
  .summary-grid { grid-template-columns: 1fr 1fr; }
  .two-col { grid-template-columns: 1fr; }
}
</style>
