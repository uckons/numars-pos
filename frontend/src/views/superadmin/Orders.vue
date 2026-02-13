<template>
  <div class="page">
    <section class="hero card">
      <div>
        <h2>Orders Command Center</h2>
        <p class="subtitle">Monitoring transaksi harian, ringkasan kategori, dan histori order terbaru.</p>
      </div>
      <div class="hero-meta">
        <span class="meta-pill">{{ filtered.length }} Records</span>
      </div>
    </section>

    <section class="stats">
      <article class="stat-card"><p>Total Orders Today</p><h3>{{ stats.total }}</h3></article>
      <article class="stat-card spa"><p>SPA</p><h3>{{ stats.spa }}</h3></article>
      <article class="stat-card lc"><p>LC</p><h3>{{ stats.lc }}</h3></article>
      <article class="stat-card fnb"><p>FNB</p><h3>{{ stats.fnb }}</h3></article>
      <article class="stat-card karaoke"><p>Karaoke</p><h3>{{ stats.karaoke }}</h3></article>
    </section>

    <section class="card filter-card">
      <div class="filters">
        <div class="field">
          <label>Outlet</label>
          <select v-model="selectedBranch">
            <option value="ALL">All Outlet</option>
            <option v-for="b in branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
          </select>
        </div>
        <div class="field"><label>Dari</label><input type="date" v-model="dateFrom" /></div>
        <div class="field"><label>Sampai</label><input type="date" v-model="dateTo" /></div>
        <div class="field">
          <label>Per Halaman</label>
          <select v-model.number="perPage">
            <option v-for="n in [25, 50, 100, 200]" :key="n" :value="n">{{ n }} / page</option>
          </select>
        </div>
        <button class="btn-outline" @click="applyFilter">Apply</button>
      </div>
    </section>

    <section class="card table-card">
      <div class="table-head">
        <h3 class="table-title">Latest Orders</h3>
        <span class="muted">Showing {{ pagedOrders.length }} of {{ filtered.length }}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Outlet</th>
            <th>Category</th>
            <th>Total</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!pagedOrders.length"><td colspan="5" class="empty">No orders found</td></tr>
          <tr v-for="o in pagedOrders" :key="o.id" class="row-hover">
            <td class="id">#{{ o.id }}</td>
            <td>{{ o.branch_name || '-' }}</td>
            <td><span class="badge">{{ o.category || '-' }}</span></td>
            <td class="price">Rp {{ format(o.total) }}</td>
            <td>{{ formatDateTime(o.created_at) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="pagination">
        <button @click="page--" :disabled="page === 1">Prev</button>
        <span>Page {{ page }} / {{ totalPages }}</span>
        <button @click="page++" :disabled="page >= totalPages">Next</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue"
import api from "@/services/api"

const orders = ref([])
const branches = ref([])
const filtered = ref([])
const page = ref(1)
const perPage = ref(50)
const dateFrom = ref("")
const dateTo = ref("")
const selectedBranch = ref("ALL")
const stats = ref({ total: 0, spa: 0, lc: 0, fnb: 0, karaoke: 0 })

onMounted(async () => {
  const [ordersRes, branchesRes] = await Promise.all([
    api.get("/superadmin/orders"),
    api.get("/superadmin/branches")
  ])
  orders.value = Array.isArray(ordersRes.data) ? ordersRes.data : []
  branches.value = Array.isArray(branchesRes.data)
    ? branchesRes.data
    : Array.isArray(branchesRes.data?.data)
      ? branchesRes.data.data
      : []
  applyFilter()
})

watch([perPage, selectedBranch], () => { page.value = 1 })

const applyFilter = () => {
  page.value = 1
  filtered.value = orders.value.filter((o) => {
    if (selectedBranch.value !== "ALL" && String(o.branch_id) !== String(selectedBranch.value)) return false
    const d = new Date(o.created_at)
    if (dateFrom.value && d < new Date(dateFrom.value)) return false
    if (dateTo.value && d > new Date(`${dateTo.value}T23:59:59`)) return false
    return true
  })
  calculateStats()
}

const calculateStats = () => {
  stats.value = { total: 0, spa: 0, lc: 0, fnb: 0, karaoke: 0 }
  const today = new Date().toDateString()
  filtered.value.forEach((o) => {
    if (new Date(o.created_at).toDateString() !== today) return
    stats.value.total += 1
    String(o.category || "").split(",").map((v) => v.trim().toLowerCase()).forEach((k) => {
      if (stats.value[k] !== undefined) stats.value[k] += 1
    })
  })
}

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / perPage.value)))
const pagedOrders = computed(() => filtered.value.slice((page.value - 1) * perPage.value, (page.value - 1) * perPage.value + perPage.value))
const format = (v) => Number(v || 0).toLocaleString("id-ID")
const formatDateTime = (v) => new Date(v).toLocaleString("id-ID")
</script>

<style scoped>
.page { padding: 24px; display: grid; gap: 16px; }
.card { background: linear-gradient(120deg, rgba(255,255,255,.02), rgba(255,255,255,.01)); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
.hero { display: flex; justify-content: space-between; align-items: center; }
.subtitle { color: var(--text-muted); margin-top: 4px; }
.meta-pill { border: 1px solid rgba(201,162,77,.45); color: var(--gold); border-radius: 999px; padding: 6px 12px; font-size: 12px; }
.stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.stat-card { background: rgba(8,12,24,.75); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 14px; }
.stat-card p { color: var(--text-muted); font-size: 13px; }
.stat-card h3 { margin-top: 6px; font-size: 30px; }
.stat-card.spa h3 { color: #c9a24d }.stat-card.lc h3 { color: #52aaff }.stat-card.fnb h3 { color: #38d996 }.stat-card.karaoke h3 { color: #f5a14a }
.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
.field { display: grid; gap: 6px; }
.field label { font-size: 12px; color: var(--text-muted); }
.filters input, .filters select { background: #0a0a0a; border: 1px solid var(--border-soft); color: white; padding: 8px 10px; border-radius: 10px; min-width: 150px; }
.btn-outline { background: transparent; border: 1px solid var(--gold); color: var(--gold); border-radius: 10px; padding: 9px 14px; cursor: pointer; }
.table-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.muted { color: var(--text-muted); font-size: 12px; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 12px; color: var(--text-muted); padding: 11px 10px; border-bottom: 1px solid var(--border-soft); }
td { padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,.07); }
.id { font-weight: 700; }.badge { background: rgba(201,162,77,.15); color: var(--gold); border: 1px solid rgba(201,162,77,.35); border-radius: 999px; padding: 3px 10px; font-size: 12px; }
.price { font-weight: 700; }.row-hover:hover { background: rgba(201,162,77,.06); }
.empty { text-align: center; color: var(--text-muted); padding: 28px; }
.pagination { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
.pagination button { background: transparent; border: 1px solid var(--gold); color: var(--gold); border-radius: 10px; padding: 6px 14px; cursor: pointer; }
.pagination button:disabled { opacity: .5; cursor: not-allowed; }
</style>
