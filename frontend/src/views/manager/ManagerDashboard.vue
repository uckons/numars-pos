<template>
  <div class="layout">
    <aside class="sidebar">
      <h2>MANAGER</h2>
      <nav>
        <button class="nav-btn" :class="{active:tab==='report'}" @click="openFinanceReport()"><ChartNoAxesColumn size="18" /> Finance Report</button>
        <button class="nav-btn" :class="{active:tab==='profile'}" @click="tab='profile'"><User size="18" /> Profile</button>
        <button class="nav-btn" @click="openAccountingUAT()"><ScrollText size="18" /> Accounting UAT (Full Page)</button>
                <button class="nav-btn" :class="{active:tab==='audit'}" @click="tab='audit'"><ShieldCheck size="18" /> Audit Logs</button>
        <button class="nav-btn" :class="{active:tab==='printer-agent'}" @click="tab='printer-agent'"><Printer size="18" /> Printer Agent</button>
        <button class="nav-btn" :class="{active:tab==='orders'}" @click="tab='orders'"><ReceiptText size="18" /> Orders</button>
        <button class="nav-btn" :class="{active:tab==='timers'}" @click="tab='timers'"><Timer size="18" /> Timers</button>
        <button class="nav-btn" :class="{active:tab==='branches'}" @click="tab='branches'"><Building2 size="18" /> Branches</button>
        <button class="nav-btn" :class="{active:tab==='services'}" @click="tab='services'"><BellRing size="18" /> Services</button>
        <button class="nav-btn" :class="{active:tab==='therapists'}" @click="tab='therapists'"><UsersIcon size="18" /> Therapists</button>
        <button class="nav-btn" :class="{active:tab==='agent-profiles'}" @click="tab='agent-profiles'"><Calculator size="18" /> Agent Profiles</button>
        <button class="nav-btn" :class="{active:tab==='therapist-finance'}" @click="openTherapistFinanceReport()"><FileSpreadsheet size="18" /> Laporan Terapis & Agent</button>
        <button class="nav-btn" :class="{active:tab==='rooms'}" @click="tab='rooms'"><DoorOpen size="18" /> Rooms</button>
        <button class="nav-btn" :class="{active:tab==='stock'}" @click="tab='stock'"><Package size="18" /> FNB Stock</button>
        <button class="nav-btn" :class="{active:tab==='grades'}" @click="tab='grades'"><Trophy size="18" /> Grades</button>
      </nav>
      <button class="logout nav-btn" @click="logout"><LogOut size="18" /> Logout</button>
    </aside>

    <main class="content">
      <section v-if="tab==='profile'" class="page">
        <ProfilePasswordCard />
      </section>

      <section v-else-if="tab==='report'" class="page">
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
          <article class="card kpi"><p>Beban Terapis (Komisi+Kerja+Agent+Salon)</p><h3>Rp {{ formatCurrency(therapistSalaryCost) }}</h3></article>
          <article class="card kpi"><p>Beban FNB Paid (QTY × Modal)</p><h3>Rp {{ formatCurrency(fnbPaidModalCost) }}</h3></article>
          <article class="card kpi"><p>Total Beban</p><h3>Rp {{ formatCurrency(totalExpense) }}</h3></article>
          <article class="card kpi"><p>Net Profit/Loss</p><h3 :class="netProfit>=0?'good':'bad'">Rp {{ formatCurrency(netProfit) }}</h3></article>
        </section>


        <section class="card chart-grid">
          <div>
            <h4>Revenue Trend</h4>
            <ApexChart type="area" :height="180" :series="trendSeries" :options="trendOptions" />
          </div>
          <div>
            <h4>Breakdown Service</h4>
            <ApexChart type="donut" :height="240" :series="breakdownSeries" :options="breakdownOptions" />
          </div>
        </section>

        <section class="card">
          <h4>Trend Pendapatan per Kategori (FNB, SPA, LC, KTV)</h4>
          <ApexChart type="area" :height="170" :series="categoryTrendSeries" :options="categoryTrendOptions" />
        </section>

        <section class="card">
          <div class="table-head">
            <h4>Cashflow Simulation</h4>
            <button class="btn" @click="addExpense">Tambah Beban Manual</button>
          </div>
          <table class="table">
            <tbody>
              <tr><td>Cash In (Revenue)</td><td class="num">Rp {{ formatCurrency(totalRevenue) }}</td></tr>
              <tr><td>Cash Out (Beban Terapis + Agent + Salon)</td><td class="num">Rp {{ formatCurrency(therapistSalaryCost) }}</td></tr>
              <tr><td>Cash Out (Beban FNB Paid: QTY × Modal)</td><td class="num">Rp {{ formatCurrency(fnbPaidModalCost) }}</td></tr>
              <tr><td class="muted">↳ Pendapatan Terapis</td><td class="num muted">Rp {{ formatCurrency(totalTherapistIncome) }}</td></tr>
              <tr><td class="muted">↳ Pendapatan Agent</td><td class="num muted">Rp {{ formatCurrency(totalAgentIncome) }}</td></tr>
              <tr><td class="muted">↳ Pendapatan Salon</td><td class="num muted">Rp {{ formatCurrency(totalSalonIncome) }}</td></tr>
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


      <section v-else-if="tab==='therapist-finance'" class="page">
        <section class="card hero">
          <div>
            <h2>Laporan Pendapatan Terapis & Agent</h2>
            <p class="muted">Rumus SPA dan LC terpisah, lalu dijumlahkan per terapis.</p>
          </div>
          <div class="hero-actions">
            <button class="btn" @click="printTherapistFinanceReport('all')">Print Semua Laporan</button>
            <button class="btn" @click="printTherapistFinanceReport('therapist')">Print Laporan Terapis</button>
            <button class="btn" @click="printTherapistFinanceReport('agent')">Print Laporan Agent</button>
            <button class="btn" @click="saveFinanceConfig">Simpan Potongan</button>
            <button class="btn" @click="loadReport">Refresh</button>
          </div>
        </section>

        <section class="card filters">
          <div class="field"><label>Outlet</label><select v-model="selectedBranch"><option value="ALL">Semua Outlet</option><option v-for="b in branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option></select></div>
          <div class="field"><label>Dari</label><input type="date" v-model="dateFrom" /></div>
          <div class="field"><label>Sampai</label><input type="date" v-model="dateTo" /></div>
          <button class="btn" @click="loadReport">Terapkan</button>
        </section>

        <section class="card">
          <h4>Master Potongan Global (Kecuali Denda)</h4>
          <div class="deduction-grid">
            <div class="field" v-for="field in financeConfigFields" :key="field.key">
              <label>{{ field.label }}</label>
              <input type="number" min="0" :value="financeConfig[field.key]" @input="setFinanceConfigField(field.key, $event.target.value)" />
            </div>
          </div>
        </section>

        <section class="card">
          <div class="table-head">
            <h4>Ringkasan Pendapatan Terapis</h4>
            <div style="display:flex; align-items:center; gap:10px;">
              <small class="muted">Denda & hutang diinput per terapis. Klik baris untuk breakdown.</small>
              <button class="btn" @click="printTherapistFinanceReport('therapist')">Print</button>
            </div>
          </div>
          <table class="table">
            <thead><tr><th></th><th>Terapis</th><th>Grade</th><th>Total Kerja SPA (QTY)</th><th>Total Kerja LC (QTY)</th><th>Denda</th><th>Hutang</th><th>Pendapatan Terapis</th></tr></thead>
            <tbody>
              <tr v-if="!therapistFinanceRows.length"><td colspan="8" class="muted">Belum ada data terapis untuk periode ini.</td></tr>
              <template v-for="row in therapistFinanceRows" :key="row.key">
                <tr @click="toggleFinanceBreakdown(row.key)" class="clickable-row">
                  <td>{{ expandedFinanceRows[row.key] ? '▾' : '▸' }}</td>
                  <td>{{ row.therapist_name }}</td>
                  <td>{{ row.grade_name }}</td>
                  <td class="num">{{ row.spa_qty }}</td>
                  <td class="num">{{ row.lc_qty }}</td>
                  <td><input class="mini-select" type="number" min="0" :value="row.spa_denda" @input.stop="setTherapistPenalty(row.therapist_name, 'spa_denda', $event.target.value)" /></td>
                  <td><input class="mini-select" type="number" min="0" :value="row.lc_denda" @input.stop="setTherapistPenalty(row.therapist_name, 'lc_denda', $event.target.value)" /></td>
                  <td class="num" :class="row.therapist_income>=0 ? 'good' : 'bad'">Rp {{ formatCurrency(row.therapist_income) }} <button class="btn mini-print" @click.stop="printSingleTherapistSlip(row)">Slip</button></td>
                </tr>
                <tr v-if="expandedFinanceRows[row.key]">
                  <td></td>
                  <td colspan="7">
                    <div class="breakdown-grid">
                      <div><strong>SPA:</strong> ({{ formatCurrency(row.service_price) }} - {{ formatCurrency(row.agent_fee) }} - {{ formatCurrency(row.room) }} - {{ formatCurrency(row.salon) }} - {{ formatCurrency(row.safety) }}) × {{ row.spa_qty }} = <strong>Rp {{ formatCurrency(row.spa_income_raw) }}</strong></div>
                      <div><strong>LC:</strong> ({{ formatCurrency(row.service_price) }} - {{ formatCurrency(row.agent_fee) }} - {{ formatCurrency(row.room) }} - {{ formatCurrency(row.salon) }}) × {{ row.lc_qty }} = <strong>Rp {{ formatCurrency(row.lc_income_raw) }}</strong></div>
                      <div><strong>Total:</strong> (SPA + LC) - (Denda + Hutang + (Salon × Qty Pakai) + Lain-lain) = ({{ formatCurrency(row.spa_income_raw) }} + {{ formatCurrency(row.lc_income_raw) }}) - ({{ formatCurrency(row.spa_denda) }} + {{ formatCurrency(row.lc_denda) }} + ({{ formatCurrency(row.salon) }} × {{ row.salon_usage_qty }}) + {{ formatCurrency(row.lain_lain) }}) = <strong>Rp {{ formatCurrency(row.therapist_income) }}</strong></div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
            <tfoot><tr><td colspan="7"><strong>Total</strong></td><td class="num"><strong>Rp {{ formatCurrency(totalTherapistIncome) }}</strong></td></tr></tfoot>
          </table>
        </section>

        <section class="card">
          <div class="table-head">
            <h4>Laporan Pendapatan Salon</h4>
            <div style="display:flex; align-items:center; gap:10px;">
              <small class="muted">Berdasarkan absensi harian (SALON ON saat status bukan OFF).</small>
              <button class="btn" @click="printSalonReport">Print</button>
            </div>
          </div>
          <table class="table">
            <thead><tr><th>Terapis</th><th>Qty Pemakaian Salon</th><th>Rate Salon</th><th>Pendapatan Salon</th></tr></thead>
            <tbody>
              <tr v-if="!salonIncomeRows.length"><td colspan="4" class="muted">Belum ada data pendapatan salon.</td></tr>
              <tr v-for="row in salonIncomeRows" :key="`salon-${row.key}`">
                <td>{{ row.therapist_name }}</td>
                <td class="num">{{ row.salon_usage_qty }}</td>
                <td class="num">Rp {{ formatCurrency(row.salon_rate) }}</td>
                <td class="num">Rp {{ formatCurrency(row.salon_income) }} <button class="btn mini-print" @click.stop="printSingleSalonSlip(row)">Slip</button></td>
              </tr>
            </tbody>
            <tfoot><tr><td colspan="3"><strong>Total Pendapatan Salon</strong></td><td class="num"><strong>Rp {{ formatCurrency(totalSalonIncome) }}</strong></td></tr></tfoot>
          </table>
        </section>

        <section class="card">
          <div class="table-head">
            <h4>Laporan Pendapatan Agent</h4>
            <div style="display:flex; align-items:center; gap:10px;">
              <small class="muted">Klik baris agent untuk lihat breakdown per terapis.</small>
              <button class="btn" @click="printTherapistFinanceReport('agent')">Print</button>
            </div>
          </div>
          <table class="table">
            <thead><tr><th>Agent</th><th>Total Terapis</th><th>Total Kerja (SPA+LC)</th><th>Total Pendapatan Agent</th></tr></thead>
            <tbody>
              <tr v-if="!therapistFinanceRows.length"><td colspan="4" class="muted">Belum ada data agent untuk periode ini.</td></tr>
              <template v-for="row in agentFinanceRows" :key="`agent-${row.key}`">
                <tr @click="toggleAgentBreakdown(row.key)" class="clickable-row">
                  <td>{{ expandedAgentRows[row.key] ? '▾' : '▸' }} {{ row.agent_name }}</td>
                  <td class="num">{{ row.therapist_count }}</td>
                  <td class="num">{{ row.total_kerja }}</td>
                  <td class="num">Rp {{ formatCurrency(row.agent_income) }} <button class="btn mini-print" @click.stop="printSingleAgentSlip(row)">Slip</button></td>
                </tr>
                <tr v-if="expandedAgentRows[row.key]">
                  <td colspan="4">
                    <div class="breakdown-grid">
                      <div v-for="detail in row.details" :key="`${row.key}-${detail.therapist_key}`">
                        {{ detail.therapist_name }}: ({{ detail.total_kerja }} × Rp {{ formatCurrency(detail.agent_fee) }}) = <strong>Rp {{ formatCurrency(detail.agent_income) }}</strong>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
            <tfoot><tr><td colspan="3"><strong>Total Pendapatan Agent</strong></td><td class="num"><strong>Rp {{ formatCurrency(totalAgentIncome) }}</strong></td></tr></tfoot>
          </table>
        </section>
      </section>

      <Orders v-else-if="tab==='orders'" />
      <Timers v-else-if="tab==='timers'" />
      <Branches v-else-if="tab==='branches'" />
      <Services v-else-if="tab==='services'" :branch-id="Number(selectedBranch) || 1" />
      <Therapists v-else-if="tab==='therapists'" />
      <AgentProfiles v-else-if="tab==='agent-profiles'" />
      <Rooms v-else-if="tab==='rooms'" />
      <StockDashboard v-else-if="tab==='stock'" />
      <Grades v-else-if="tab==='grades'" />
      <AuditLogs v-else-if="tab==='audit'" />
      <PrinterAgentTools v-else-if="tab==='printer-agent'" />
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
import ProfilePasswordCard from "../../components/ProfilePasswordCard.vue"
import AuditLogs from "../superadmin/AuditLogs.vue"
import PrinterAgentTools from "../superadmin/PrinterAgentTools.vue"
import AgentProfiles from "../superadmin/AgentProfiles.vue"
import { useAuthStore } from "../../store/auth.store"
// Keep Users icon aliased to avoid SFC identifier collisions with local/component names.
import { ChartNoAxesColumn, ReceiptText, Timer, Building2, BellRing, Users as UsersIcon, DoorOpen, Package, Trophy, LogOut, User, ScrollText, ShieldCheck, Printer, Calculator, FileSpreadsheet } from "lucide-vue-next"

const tab = ref("accounting-uat")
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
const therapistAnalytics = ref([])
const therapistMaster = ref([])
const financeConfig = ref({ salon: 0, room: 0, safety: 0, lain_lain: 0 })
const expandedFinanceRows = ref({})
const expandedAgentRows = ref({})
const therapistPenalties = ref({})
const salonUsageMap = ref({})

const auth = useAuthStore()
const router = useRouter()



const openFinanceReport = async () => {
  tab.value = 'report'
  await loadReport()
}

const openTherapistFinanceReport = async () => {
  tab.value = 'therapist-finance'
  await loadReport()
}

const openAccountingUAT = () => {
  localStorage.setItem('accountingUAT.activeModule', 'manual-journal')
  router.push('/manager/accounting-uat?module=manual-journal')
}


const logout = () => {
  auth.logout()
  router.push("/")
}

const loadReport = async () => {
  loading.value = true
  loadError.value = ""
  try {
    const [ordersRes, branchRes, analyticsRes, therapistRes, financeCfgRes, salonUsageRes] = await Promise.all([
      api.get("/superadmin/orders"),
      api.get("/superadmin/branches"),
      api.get('/dashboard/kasir/analytics', { params: { preset: 'daily', date_from: dateFrom.value || undefined, date_to: dateTo.value || undefined } }),
      api.get('/therapists', { params: { page: 1, limit: 500, active: 'true', ...(selectedBranch.value !== 'ALL' ? { branch_id: selectedBranch.value } : {}) } }),
      api.get('/dashboard/therapist-finance-config', { params: { ...(selectedBranch.value !== 'ALL' ? { branch_id: selectedBranch.value } : {}) } }),
      api.get('/therapists/attendance/salon-usage/summary', { params: { date_from: dateFrom.value || undefined, date_to: dateTo.value || undefined, ...(selectedBranch.value !== 'ALL' ? { branch_id: selectedBranch.value } : {}) } })
    ])
    orders.value = Array.isArray(ordersRes.data) ? ordersRes.data : []
    branches.value = Array.isArray(branchRes.data) ? branchRes.data : []
    therapistAnalytics.value = Array.isArray(analyticsRes.data?.therapist_pnl) ? analyticsRes.data.therapist_pnl : []
    therapistMaster.value = Array.isArray(therapistRes.data?.data) ? therapistRes.data.data : []
    const cfg = financeCfgRes.data || {}
    financeConfig.value = {
      ...financeConfig.value,
      salon: Number(cfg.salon ?? cfg.spa_salon ?? cfg.lc_salon ?? 0),
      room: Number(cfg.room ?? cfg.spa_room ?? cfg.lc_room ?? cfg.lc_sofa ?? 0),
      safety: Number(cfg.safety ?? cfg.spa_safety ?? cfg.lc_safety ?? 0),
      lain_lain: Number(cfg.lain_lain ?? cfg.spa_lain_lain ?? cfg.lc_lain_lain ?? 0)
    }

    const usageRows = Array.isArray(salonUsageRes.data?.data) ? salonUsageRes.data.data : []
    const usageMap = {}
    for (const row of usageRows) {
      const key = normalizeTherapistName(row.therapist_name)
      if (!key) continue
      usageMap[key] = Number(row.salon_usage_qty || 0)
    }
    salonUsageMap.value = usageMap

  } catch (err) {
    orders.value = []
    branches.value = []
    therapistAnalytics.value = []
    therapistMaster.value = []
    salonUsageMap.value = {}
    loadError.value = err?.response?.data?.message || "Gagal memuat data manager"
    await Swal.fire({ icon: "error", title: "Load report gagal", text: loadError.value })
  } finally {
    loading.value = false
  }
}


onMounted(async () => {
  const today = new Date()
  const first = new Date(today.getFullYear(), today.getMonth(), 1)
  const firstISO = first.toISOString().slice(0, 10)
  dateFrom.value = firstISO
  dateTo.value = today.toISOString().slice(0, 10)
  tab.value = 'report'
  await loadReport()
})

watch([selectedBranch, dateFrom, dateTo, ordersPageSize], () => {
  ordersPage.value = 1
})

watch(tab, async (value) => {
  if (value !== 'report') return
  if (loading.value) return
  await loadReport()
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
const fnbPaidModalCost = computed(() => paidOrdersList.value.reduce((sum, o) => sum + Number(o.fnb_modal_cost || 0), 0))
const normalizeTherapistName = (name) => String(name || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '')

const therapistMasterMap = computed(() => {
  const map = new Map()
  for (const item of therapistMaster.value) {
    const key = normalizeTherapistName(item.name)
    if (!key) continue
    if (!map.has(key)) map.set(key, item)
  }
  return map
})

const getTherapistPenalty = (name) => {
  const key = normalizeTherapistName(name)
  return therapistPenalties.value[key] || { spa_denda: 0, lc_denda: 0 }
}

const setTherapistPenalty = (name, field, value) => {
  const key = normalizeTherapistName(name)
  if (!key) return
  const current = getTherapistPenalty(name)
  therapistPenalties.value = {
    ...therapistPenalties.value,
    [key]: {
      ...current,
      [field]: Math.max(0, Number(value || 0))
    }
  }
}

const therapistFinanceRows = computed(() => {
  const grouped = new Map()
  for (const row of therapistAnalytics.value) {
    const name = String(row.therapist_name || '').trim()
    if (!name) continue
    const key = normalizeTherapistName(name)
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        therapist_name: name,
        spa_qty: 0,
        lc_qty: 0,
        spa_non_hh_total: 0,
        lc_non_hh_total: 0
      })
    }
    const acc = grouped.get(key)
    const category = String(row.category || '').toUpperCase()
    const qty = Number(row.qty || 0)
    const nonHh = Number(row.non_happy_hour_revenue || 0)
    if (category.includes('SPA')) {
      acc.spa_qty += qty
      acc.spa_non_hh_total += nonHh
    }
    if (category.includes('LC') || category.includes('LOUNGE')) {
      acc.lc_qty += qty
      acc.lc_non_hh_total += nonHh
    }
  }

  if (!grouped.size) {
    for (const t of therapistMaster.value) {
      const key = normalizeTherapistName(t.name)
      if (!key || grouped.has(key)) continue
      grouped.set(key, { key, therapist_name: t.name, spa_qty: 0, lc_qty: 0, spa_non_hh_total: 0, lc_non_hh_total: 0 })
    }
  }

  return [...grouped.values()].map((item) => {
    const master = therapistMasterMap.value.get(item.key)
    const agentFee = Number(master?.agent_cut_amount || master?.agent_cut_override || 0)
    const spaQty = Number(item.spa_qty || 0)
    const lcQty = Number(item.lc_qty || 0)
    const servicePrice = Number(master?.commission_amount || 0)
    const penalty = getTherapistPenalty(item.therapist_name)
    const spaDenda = Number(penalty.spa_denda || 0)
    const lcDenda = Number(penalty.lc_denda || 0)

    const room = Number(financeConfig.value.room || 0)
    const salon = Number(financeConfig.value.salon || 0)
    const safety = Number(financeConfig.value.safety || 0)
    const lainLain = Number(financeConfig.value.lain_lain || 0)

    const spaNetRate = servicePrice - agentFee - room - salon - safety
    const lcNetRate = servicePrice - agentFee - room - salon

    const spaIncomeRaw = spaNetRate * spaQty
    const lcIncomeRaw = lcNetRate * lcQty
    const salonUsageQty = Number(salonUsageMap.value[item.key] || 0)
    const salonDeduction = salon * salonUsageQty
    const therapistIncome = (spaIncomeRaw + lcIncomeRaw) - (spaDenda + lcDenda + salonDeduction + lainLain)
    const agentIncome = (spaQty + lcQty) * agentFee

    return {
      ...item,
      grade_name: master?.grade_name || '-',
      agent_profile_name: master?.agent_profile_name || '-',
      service_price: servicePrice,
      agent_fee: agentFee,
      room,
      salon,
      safety,
      salon_usage_qty: salonUsageQty,
      salon_deduction: salonDeduction,
      spa_denda: spaDenda,
      lc_denda: lcDenda,
      lain_lain: lainLain,
      spa_income_raw: spaIncomeRaw,
      lc_income_raw: lcIncomeRaw,
      total_kerja: spaQty + lcQty,
      therapist_income: therapistIncome,
      agent_income: agentIncome
    }
  }).sort((a, b) => a.therapist_name.localeCompare(b.therapist_name))
})

const agentFinanceRows = computed(() => {
  const grouped = new Map()
  for (const row of therapistFinanceRows.value) {
    const agentName = String(row.agent_profile_name || '-').trim() || '-'
    const key = normalizeTherapistName(agentName) || 'no-agent'
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        agent_name: agentName,
        therapist_keys: new Set(),
        therapist_count: 0,
        total_kerja: 0,
        agent_income: 0,
        details: []
      })
    }
    const acc = grouped.get(key)
    acc.therapist_keys.add(row.key)
    acc.total_kerja += Number(row.total_kerja || 0)
    acc.agent_income += Number(row.agent_income || 0)
    acc.therapist_count = acc.therapist_keys.size
    acc.details.push({
      therapist_key: row.key,
      therapist_name: row.therapist_name,
      total_kerja: Number(row.total_kerja || 0),
      agent_fee: Number(row.agent_fee || 0),
      agent_income: Number(row.agent_income || 0)
    })
  }

  return [...grouped.values()]
    .map((row) => ({
      key: row.key,
      agent_name: row.agent_name,
      therapist_count: row.therapist_count,
      total_kerja: row.total_kerja,
      agent_income: row.agent_income,
      details: row.details
    }))
    .sort((a, b) => a.agent_name.localeCompare(b.agent_name))
})

const totalTherapistIncome = computed(() => therapistFinanceRows.value.reduce((sum, row) => sum + Number(row.therapist_income || 0), 0))
const totalAgentIncome = computed(() => agentFinanceRows.value.reduce((sum, row) => sum + Number(row.agent_income || 0), 0))

const salonIncomeRows = computed(() => therapistFinanceRows.value
  .map((row) => ({
    key: row.key,
    therapist_name: row.therapist_name,
    salon_usage_qty: Number(row.salon_usage_qty || 0),
    salon_rate: Number(row.salon || 0),
    salon_income: Number(row.salon_deduction || 0)
  }))
  .filter((row) => row.salon_usage_qty > 0 || row.salon_income > 0)
  .sort((a, b) => a.therapist_name.localeCompare(b.therapist_name)))

const totalSalonIncome = computed(() => salonIncomeRows.value.reduce((sum, row) => sum + Number(row.salon_income || 0), 0))

const therapistBaseCost = computed(() => therapistFinanceRows.value.reduce((sum, row) => sum + Math.max(0, Number(row.therapist_income || 0)), 0))
const therapistSalaryCost = computed(() => therapistBaseCost.value + Number(totalAgentIncome.value || 0) + Number(totalSalonIncome.value || 0))
const manualExpenseTotal = computed(() => manualExpenses.value.reduce((a, e) => a + Number(e.amount || 0), 0))
const totalExpense = computed(() => therapistSalaryCost.value + fnbPaidModalCost.value + Number(fixedSalaryCost.value || 0) + manualExpenseTotal.value)
const netProfit = computed(() => totalRevenue.value - totalExpense.value)

const formatDateKey = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("id-ID")
}

const buildSortedDailyRevenue = (list, allocator) => {
  const map = new Map()
  for (const order of list) {
    const key = formatDateKey(order.created_at)
    if (!key) continue
    if (!map.has(key)) {
      map.set(key, { x: new Date(order.created_at).setHours(0, 0, 0, 0), y: 0 })
    }
    const row = map.get(key)
    row.y += Number(allocator(order) || 0)
  }
  return [...map.values()].sort((a, b) => a.x - b.x)
}

const trendPoints = computed(() => buildSortedDailyRevenue(paidOrdersList.value, (order) => order.total))

const formatAccountingNumber = (v) => Number(v || 0).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatAxisNumber = (v) => Number(v || 0).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const normalizeChartMax = (value) => {
  const safe = Math.max(0, Number(value || 0))
  if (!safe) return 1000
  const magnitude = 10 ** Math.floor(Math.log10(safe))
  return Math.ceil((safe * 1.1) / magnitude) * magnitude
}

const roundUpToStep = (value, step) => {
  const safe = Math.max(0, Number(value || 0))
  if (!safe) return step
  return Math.ceil(safe / step) * step
}

const trendSeries = computed(() => ([{ name: "Revenue", data: trendPoints.value.length ? trendPoints.value : [{ x: new Date().setHours(0, 0, 0, 0), y: 0 }] }]))
const trendPeak = computed(() => Math.max(...trendSeries.value[0].data.map((item) => Number(item?.y || 0)), 0))
const trendOptions = computed(() => ({
  chart: {
    background: "transparent",
    zoom: { enabled: true, type: "x", autoScaleYaxis: true },
    toolbar: { show: true, tools: { download: false } },
    dropShadow: { enabled: true, top: 0, left: 0, blur: 2, color: "#4e73df", opacity: 0.2 }
  },
  theme: { mode: "dark" },
  xaxis: {
    type: "datetime",
    labels: { datetimeUTC: false, style: { colors: "#ced8ff" } },
    axisBorder: { color: "rgba(255,255,255,0.18)" }
  },
  yaxis: {
    min: 0,
    max: normalizeChartMax(trendPeak.value),
    tickAmount: 10,
    forceNiceScale: true,
    labels: { formatter: formatAxisNumber, style: { colors: "#d7def7" } }
  },
  grid: {
    borderColor: "rgba(132, 160, 230, 0.24)",
    strokeDashArray: 2,
    padding: { top: 2, bottom: -6 }
  },
  fill: {
    type: "gradient",
    gradient: {
      shadeIntensity: 0.35,
      opacityFrom: 0.0,
      opacityTo: 0.0,
      stops: [0, 85, 100]
    }
  },
  stroke: { curve: "straight", width: 6, lineCap: "round" },
  markers: { size: 3, colors: ["#5f85ff"], strokeColors: "#0b1020", strokeWidth: 1, hover: { size: 5 } },
  dataLabels: { enabled: false },
  tooltip: { theme: "dark", shared: true, intersect: false, y: { formatter: formatAccountingNumber } },
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
  fill: {
    type: "gradient",
    gradient: {
      shade: "dark",
      type: "horizontal",
      shadeIntensity: 0.3,
      opacityFrom: 0.95,
      opacityTo: 0.7,
      stops: [0, 70, 100]
    }
  },
  stroke: { width: 1, colors: ["rgba(255,255,255,0.12)"] },
  plotOptions: {
    pie: {
      donut: { size: "68%" }
    }
  },
  tooltip: { y: { formatter: formatAccountingNumber } },
  legend: { position: "bottom" },
  colors: ["#5f85ff", "#38d996", "#ff9f43", "#e056fd", "#00d2ff", "#ff6b81"]
}))

const categoryTrendData = computed(() => {
  const keys = ["FNB", "SPA", "LC", "KTV"]
  const dayMap = new Map()
  for (const o of paidOrdersList.value) {
    const dayKey = formatDateKey(o.created_at)
    if (!dayKey) continue
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { x: new Date(o.created_at).setHours(0, 0, 0, 0), FNB: 0, SPA: 0, LC: 0, KTV: 0 })
    }
    const categories = String(o.category || "").toUpperCase().split(",").map((v) => v.trim()).filter(Boolean)
    const matched = keys.filter((k) => categories.some((cat) => cat.includes(k)))
    const divisor = matched.length || 1
    const allocated = Number(o.total || 0) / divisor
    for (const cat of matched) dayMap.get(dayKey)[cat] += allocated
  }
  return [...dayMap.values()].sort((a, b) => a.x - b.x)
})

const categoryTrendSeries = computed(() => {
  if (!categoryTrendData.value.length) {
    const fallbackX = new Date().setHours(0, 0, 0, 0)
    return ["FNB", "SPA", "LC", "KTV"].map((name) => ({ name, data: [{ x: fallbackX, y: 0 }] }))
  }
  return ["FNB", "SPA", "LC", "KTV"].map((name) => ({
    name,
    data: categoryTrendData.value.map((row) => ({ x: row.x, y: Number(row[name] || 0) }))
  }))
})

const categoryTrendPeak = computed(() => Math.max(
  ...categoryTrendSeries.value.flatMap((series) => series.data.map((item) => Number(item?.y || 0))),
  0
))

const categoryAxisStep = 1000000
const categoryTrendYAxisMax = computed(() => roundUpToStep(categoryTrendPeak.value, categoryAxisStep))
const categoryTrendTickAmount = computed(() => {
  const ticks = Math.floor(categoryTrendYAxisMax.value / categoryAxisStep)
  return Math.max(1, ticks)
})

const categoryTrendOptions = computed(() => ({
  chart: {
    toolbar: { show: false },
    background: "transparent",
    dropShadow: { enabled: true, top: 0, left: 0, blur: 2, color: "#5f85ff", opacity: 0.16 }
  },
  theme: { mode: "dark" },
  xaxis: {
    type: "datetime",
    labels: { datetimeUTC: false, style: { colors: "#ced8ff" } },
    axisBorder: { color: "rgba(255,255,255,0.18)" }
  },
  yaxis: {
    min: 0,
    max: categoryTrendYAxisMax.value,
    tickAmount: categoryTrendTickAmount.value,
    forceNiceScale: false,
    labels: { formatter: formatAxisNumber, style: { colors: "#d7def7" } }
  },
  grid: { borderColor: "rgba(132, 160, 230, 0.24)", strokeDashArray: 2, padding: { top: 2, bottom: -6 } },
  tooltip: { theme: "dark", shared: true, intersect: false, y: { formatter: formatAccountingNumber } },
  dataLabels: { enabled: false },
  markers: { size: 3, colors: ["#5f85ff"], strokeColors: "#0b1020", strokeWidth: 1, hover: { size: 5 } },
  fill: {
    type: "gradient",
    gradient: {
      shadeIntensity: 0.35,
      opacityFrom: 0.03,
      opacityTo: 0.0,
      stops: [0, 85, 100]
    }
  },
  stroke: { curve: "smooth", width: 4.6, lineCap: "round" },
  legend: { position: "top", labels: { colors: "#eef2ff" } },
  colors: ["#ff9f43", "#5f85ff", "#20c997", "#e056fd"]
}))

const financeConfigFields = [
  { key: 'salon', label: 'SALON' },
  { key: 'room', label: 'ROOM' },
  { key: 'safety', label: 'SAFETY' },
  { key: 'lain_lain', label: 'LAIN-LAIN' }
]

const setFinanceConfigField = (key, value) => {
  financeConfig.value = { ...financeConfig.value, [key]: Math.max(0, Number(value || 0)) }
}

const saveFinanceConfig = async () => {
  try {
    await api.post('/dashboard/therapist-finance-config', {
      ...(selectedBranch.value !== 'ALL' ? { branch_id: selectedBranch.value } : {}),
      spa_salon: Number(financeConfig.value.salon || 0),
      lc_salon: Number(financeConfig.value.salon || 0),
      spa_room: Number(financeConfig.value.room || 0),
      lc_room: Number(financeConfig.value.room || 0),
      spa_safety: Number(financeConfig.value.safety || 0),
      lc_safety: Number(financeConfig.value.safety || 0),
      spa_lain_lain: Number(financeConfig.value.lain_lain || 0),
      lc_lain_lain: Number(financeConfig.value.lain_lain || 0)
    })
    await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Master potongan disimpan' })
  } catch (err) {
    await Swal.fire({ icon: 'error', title: 'Gagal', text: err?.response?.data?.message || 'Gagal menyimpan konfigurasi' })
  }
}

const toggleFinanceBreakdown = (key) => {
  expandedFinanceRows.value = { ...expandedFinanceRows.value, [key]: !expandedFinanceRows.value[key] }
}

const toggleAgentBreakdown = (key) => {
  expandedAgentRows.value = { ...expandedAgentRows.value, [key]: !expandedAgentRows.value[key] }
}

const printCurrency = (v) => `Rp ${formatCurrency(v)}`

const openPrintWindow = (title, subtitle, bodyHtml) => {
  const win = window.open('', '_blank', 'width=1200,height=900')
  if (!win) return
  const printedAt = new Date().toLocaleString('id-ID')
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; color:#111; margin:0; background:#fff; }
          .page { padding:28px 32px; }
          .header { border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 16px; }
          .brand { font-size: 20px; font-weight: 700; letter-spacing: .3px; }
          .subtitle { color:#555; margin-top:4px; font-size:12px; }
          .meta { font-size: 12px; color:#555; margin-top: 8px; }
          .section-title { font-size:15px; margin:14px 0 8px; font-weight:700; }
          table { width:100%; border-collapse:collapse; font-size:12px; }
          th, td { border:1px solid #ddd; padding:8px 10px; text-align:left; }
          th { background:#f4f4f4; }
          .num { text-align:right; }
          .footer { margin-top:20px; font-size:12px; color:#666; }
          .pill { display:inline-block; border:1px solid #999; border-radius:999px; padding:2px 8px; font-size:11px; color:#333; }
          @media print { .page { padding: 12mm; } }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="brand">NUMARS POS — Enterprise Financial Report</div>
            <div class="subtitle">${subtitle}</div>
            <div class="meta">Outlet: ${selectedBranch.value === 'ALL' ? 'Semua Outlet' : (branches.value.find((b) => String(b.id) === String(selectedBranch.value))?.name || '-')} | Periode: ${dateFrom.value || '-'} s/d ${dateTo.value || '-'} | Dicetak: ${printedAt}</div>
          </div>
          ${bodyHtml}
          <div class="footer">Dokumen ini digenerate otomatis dari sistem dan dapat digunakan sebagai lampiran slip pendapatan.</div>
        </div>
      </body>
    </html>
  `)
  win.document.close()
  win.focus()
  win.print()
}

const buildTherapistTableHtml = (rows) => {
  const body = rows.map((row) => `
    <tr>
      <td>${row.therapist_name}</td>
      <td>${row.grade_name}</td>
      <td class="num">${row.spa_qty}</td>
      <td class="num">${row.lc_qty}</td>
      <td class="num">${printCurrency(row.spa_denda)}</td>
      <td class="num">${printCurrency(row.lc_denda)}</td>
      <td class="num">${printCurrency(row.therapist_income)}</td>
    </tr>
  `).join('')
  return `
    <div class="section-title">Laporan Pendapatan Terapis</div>
    <table>
      <thead><tr><th>Terapis</th><th>Grade</th><th>Total Kerja SPA</th><th>Total Kerja LC</th><th>Denda</th><th>Hutang</th><th>Pendapatan</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="6"><strong>Total Pendapatan Terapis</strong></td><td class="num"><strong>${printCurrency(totalTherapistIncome.value)}</strong></td></tr></tfoot>
    </table>
  `
}

const buildAgentTableHtml = (rows) => {
  const body = rows.map((row) => `
    <tr>
      <td>${row.agent_name}</td>
      <td class="num">${row.therapist_count}</td>
      <td class="num">${row.total_kerja}</td>
      <td class="num">${printCurrency(row.agent_income)}</td>
    </tr>
  `).join('')
  return `
    <div class="section-title">Laporan Pendapatan Agent</div>
    <table>
      <thead><tr><th>Agent</th><th>Total Terapis</th><th>Total Kerja</th><th>Pendapatan</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="3"><strong>Total Pendapatan Agent</strong></td><td class="num"><strong>${printCurrency(totalAgentIncome.value)}</strong></td></tr></tfoot>
    </table>
  `
}

const printSingleTherapistSlip = (row) => {
  const html = `
    <div class="section-title">Slip Pendapatan Terapis <span class="pill">${row.therapist_name}</span></div>
    <table>
      <tbody>
        <tr><td>Nama Terapis</td><td>${row.therapist_name}</td></tr>
        <tr><td>Grade</td><td>${row.grade_name}</td></tr>
        <tr><td>Rumus SPA</td><td>(${printCurrency(row.service_price)} - ${printCurrency(row.agent_fee)} - ${printCurrency(row.room)} - ${printCurrency(row.salon)} - ${printCurrency(row.safety)}) × ${row.spa_qty} = ${printCurrency(row.spa_income_raw)}</td></tr>
        <tr><td>Rumus LC</td><td>(${printCurrency(row.service_price)} - ${printCurrency(row.agent_fee)} - ${printCurrency(row.room)} - ${printCurrency(row.salon)}) × ${row.lc_qty} = ${printCurrency(row.lc_income_raw)}</td></tr>
        <tr><td>Potongan</td><td>Denda ${printCurrency(row.spa_denda)} + Hutang ${printCurrency(row.lc_denda)} + (Salon ${printCurrency(row.salon)} × Qty ${row.salon_usage_qty}) = ${printCurrency(row.salon_deduction)} + Lain-lain ${printCurrency(row.lain_lain)}</td></tr>
        <tr><td><strong>Total Pendapatan</strong></td><td><strong>${printCurrency(row.therapist_income)}</strong></td></tr>
      </tbody>
    </table>
  `
  openPrintWindow('Slip Pendapatan Terapis', 'Dokumen slip pendapatan terapis', html)
}

const printSingleAgentSlip = (row) => {
  const details = (row.details || []).map((d) => `<tr><td>${d.therapist_name}</td><td class="num">${d.total_kerja}</td><td class="num">${printCurrency(d.agent_fee)}</td><td class="num">${printCurrency(d.agent_income)}</td></tr>`).join('')
  const html = `
    <div class="section-title">Slip Pendapatan Agent <span class="pill">${row.agent_name}</span></div>
    <table>
      <tbody>
        <tr><td>Agent</td><td>${row.agent_name}</td></tr>
        <tr><td>Total Terapis</td><td>${row.therapist_count}</td></tr>
        <tr><td>Total Kerja</td><td>${row.total_kerja}</td></tr>
        <tr><td><strong>Total Pendapatan Agent</strong></td><td><strong>${printCurrency(row.agent_income)}</strong></td></tr>
      </tbody>
    </table>
    <div class="section-title">Breakdown Terapis</div>
    <table>
      <thead><tr><th>Terapis</th><th>Total Kerja</th><th>Agent Fee</th><th>Pendapatan Agent</th></tr></thead>
      <tbody>${details}</tbody>
    </table>
  `
  openPrintWindow('Slip Pendapatan Agent', 'Dokumen slip pendapatan agent', html)
}

const printTherapistFinanceReport = (mode = 'all') => {
  const therapistHtml = buildTherapistTableHtml(therapistFinanceRows.value)
  const agentHtml = buildAgentTableHtml(agentFinanceRows.value)
  const salonHtml = `
    <div class="section-title">Laporan Pendapatan Salon</div>
    <table>
      <thead><tr><th>Terapis</th><th>Qty Pemakaian</th><th>Rate Salon</th><th>Pendapatan Salon</th></tr></thead>
      <tbody>${salonIncomeRows.value.map((row) => `<tr><td>${row.therapist_name}</td><td class="num">${row.salon_usage_qty}</td><td class="num">${printCurrency(row.salon_rate)}</td><td class="num">${printCurrency(row.salon_income)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3"><strong>Total Pendapatan Salon</strong></td><td class="num"><strong>${printCurrency(totalSalonIncome.value)}</strong></td></tr></tfoot>
    </table>
  `

  if (mode === 'therapist') {
    openPrintWindow('Laporan Pendapatan Terapis', 'Laporan enterprise pendapatan terapis', therapistHtml)
    return
  }
  if (mode === 'agent') {
    openPrintWindow('Laporan Pendapatan Agent', 'Laporan enterprise pendapatan agent', agentHtml)
    return
  }
  openPrintWindow('Laporan Pendapatan Terapis, Agent & Salon', 'Laporan enterprise gabungan terapis, agent, dan salon', therapistHtml + agentHtml + salonHtml)
}

const printSalonReport = () => {
  const body = salonIncomeRows.value.map((row) => `
    <tr><td>${row.therapist_name}</td><td class="num">${row.salon_usage_qty}</td><td class="num">${printCurrency(row.salon_rate)}</td><td class="num">${printCurrency(row.salon_income)}</td></tr>
  `).join('')
  const html = `
    <div class="section-title">Laporan Pendapatan Salon</div>
    <table>
      <thead><tr><th>Terapis</th><th>Qty Pemakaian</th><th>Rate Salon</th><th>Pendapatan Salon</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="3"><strong>Total Pendapatan Salon</strong></td><td class="num"><strong>${printCurrency(totalSalonIncome.value)}</strong></td></tr></tfoot>
    </table>
  `
  openPrintWindow('Laporan Pendapatan Salon', 'Laporan enterprise pendapatan salon', html)
}

const printSingleSalonSlip = (row) => {
  const html = `
    <div class="section-title">Slip Pendapatan Salon <span class="pill">${row.therapist_name}</span></div>
    <table>
      <tbody>
        <tr><td>Nama Terapis</td><td>${row.therapist_name}</td></tr>
        <tr><td>Qty Pemakaian Salon</td><td>${row.salon_usage_qty}</td></tr>
        <tr><td>Rate Salon</td><td>${printCurrency(row.salon_rate)}</td></tr>
        <tr><td><strong>Total Pendapatan Salon</strong></td><td><strong>${printCurrency(row.salon_income)}</strong></td></tr>
      </tbody>
    </table>
  `
  openPrintWindow('Slip Pendapatan Salon', 'Dokumen slip pendapatan salon', html)
}

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
const formatDate = (v) => v ? new Date(v).toLocaleString("id-ID", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"
</script>

<style scoped>
.layout { display:flex; min-height:100vh; background:#0e0e0e; color:#fff; }
.sidebar { width:240px; background:#111; border-right:1px solid #c9a24d; padding:16px; display:flex; flex-direction:column; }
.sidebar h2 { color:#c9a24d; margin-bottom:12px; }
nav { display:grid; gap:8px; }
nav button { text-align:left; background:transparent; border:none; color:#fff; padding:10px 12px; border-radius:10px; cursor:pointer; }
.nav-btn { display:flex; align-items:center; gap:10px; min-height:40px; width:100%; font-size:14px; }
nav button.active { background:#c9a24d; color:#000; }
.logout { margin-top:auto; background:#c9a24d; color:#000; border:none; border-radius:10px; padding:10px 12px; cursor:pointer; font-weight:700; }
.content { flex:1; padding:20px; }
.page { display:grid; gap:14px; }
.card { background:linear-gradient(120deg, rgba(255,255,255,.02), rgba(255,255,255,.01)); border:1px solid rgba(255,255,255,.09); border-radius:14px; padding:14px; }
.hero { display:flex; justify-content:space-between; align-items:center; }
.muted { color:#a5adba; }
.small { font-size: 12px; }
.btn { background:transparent; border:1px solid #c9a24d; color:#c9a24d; border-radius:10px; padding:8px 14px; cursor:pointer; }
.btn:disabled { opacity:.45; cursor:not-allowed; }
.filters { display:flex; gap:10px; flex-wrap:wrap; align-items:end; }
.field { display:grid; gap:6px; min-width:150px; }
.field label { font-size:12px; color:#a5adba; }
.field input, .field select { background:#090909; border:1px solid #2f3440; color:#fff; border-radius:10px; padding:8px 10px; width:150px; height:42px; box-sizing:border-box; }
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
.mini-print { margin-left: 8px; padding: 2px 8px; font-size: 11px; border-radius: 6px; }
.deduction-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
.breakdown-grid { display:grid; gap:6px; }
.clickable-row { cursor:pointer; }
</style>
