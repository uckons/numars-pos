<template>
  <div class="page">
    <section class="hero card">
      <div>
        <h2>Timer Monitor</h2>
        <p class="subtitle">Real-time monitoring status timer terapis lintas order.</p>
      </div>
      <button class="btn-outline" @click="loadTimers">Refresh</button>
    </section>

    <section class="card toolbar">
      <div class="field search">
        <label>Cari Terapis / Order</label>
        <input v-model.trim="query" placeholder="Contoh: Andi / #123" />
      </div>
      <div class="field">
        <label>Outlet</label>
        <select v-model="selectedBranch">
          <option value="ALL">Semua Outlet</option>
          <option v-for="b in branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
        </select>
      </div>
      <div class="field">
        <label>Status</label>
        <select v-model="statusFilter">
          <option value="ALL">Semua</option>
          <option value="RUNNING">Running</option>
          <option value="PAUSE">Pause</option>
          <option value="STOPPED">Stopped</option>
        </select>
      </div>
      <div class="summary">
        <span class="pill">Total {{ timers.length }}</span>
        <span class="pill running">Running {{ runningCount }}</span>
        <span class="pill paused">Pause {{ pausedCount }}</span>
        <span class="pill stopped">Stopped {{ stoppedCount }}</span>
      </div>
    </section>

    <section class="card table-card">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Outlet</th>
            <th>Terapis</th>
            <th>Mulai</th>
            <th>Selesai</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!pagedTimers.length"><td colspan="6" class="empty">Tidak ada timer.</td></tr>
          <tr v-for="t in pagedTimers" :key="t.id">
            <td>#{{ t.order_id }}</td>
            <td>{{ t.branch_name || '-' }}</td>
            <td>{{ t.therapist || '-' }}</td>
            <td>{{ formatDateTime(t.start_time) }}</td>
            <td>{{ formatDateTime(t.end_time) }}</td>
            <td><span class="status" :class="statusClass(t)">{{ statusLabel(t) }}</span></td>
          </tr>
        </tbody>
      </table>
      <div class="pagination">
        <div class="pager-left">
          <label>Per Halaman</label>
          <select v-model.number="pageSize"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option></select>
        </div>
        <div class="pager-right">
          <button @click="page -= 1" :disabled="page === 1">Prev</button>
          <span>Page {{ page }} / {{ totalPages }}</span>
          <button @click="page += 1" :disabled="page >= totalPages">Next</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue"
import api from "@/services/api"

const timers = ref([])
const branches = ref([])
const query = ref("")
const selectedBranch = ref("ALL")
const statusFilter = ref("ALL")
const page = ref(1)
const pageSize = ref(20)

const loadTimers = async () => {
  const [timerRes, branchRes] = await Promise.all([api.get("/superadmin/timers"), api.get("/superadmin/branches")])
  timers.value = Array.isArray(timerRes.data) ? timerRes.data : []
  branches.value = Array.isArray(branchRes.data) ? branchRes.data : Array.isArray(branchRes.data?.data) ? branchRes.data.data : []
}

onMounted(loadTimers)

const statusLabel = (t) => {
  if (t?.paused) return "PAUSE"
  if (t?.end_time && new Date(t.end_time).getTime() <= Date.now()) return "STOPPED"
  return "RUNNING"
}
const statusClass = (t) => statusLabel(t).toLowerCase()
const runningCount = computed(() => timers.value.filter((t) => statusLabel(t) === "RUNNING").length)
const pausedCount = computed(() => timers.value.filter((t) => statusLabel(t) === "PAUSE").length)
const stoppedCount = computed(() => timers.value.filter((t) => statusLabel(t) === "STOPPED").length)

watch([query, statusFilter, pageSize, selectedBranch], () => { page.value = 1 })

const filteredTimers = computed(() => {
  const key = query.value.toLowerCase()
  return timers.value.filter((t) => {
    if (selectedBranch.value !== "ALL" && String(t.branch_id) !== String(selectedBranch.value)) return false
    const status = statusLabel(t)
    if (statusFilter.value !== "ALL" && statusFilter.value !== status) return false
    if (!key) return true
    const therapist = String(t.therapist || "").toLowerCase()
    const order = String(t.order_id || "").toLowerCase()
    const branch = String(t.branch_name || "").toLowerCase()
    return therapist.includes(key) || order.includes(key) || branch.includes(key)
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredTimers.value.length / pageSize.value)))
const pagedTimers = computed(() => filteredTimers.value.slice((page.value - 1) * pageSize.value, (page.value - 1) * pageSize.value + pageSize.value))
const formatDateTime = (v) => (!v ? "-" : new Date(v).toLocaleString("id-ID"))
</script>

<style scoped>
.page { padding: 24px; display: grid; gap: 16px; }
.card { background: linear-gradient(120deg, rgba(255,255,255,.02), rgba(255,255,255,.01)); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
.hero { display: flex; align-items: center; justify-content: space-between; }
.subtitle { color: var(--text-muted); margin-top: 4px; }
.btn-outline { background: transparent; border: 1px solid var(--gold); color: var(--gold); border-radius: 10px; padding: 8px 14px; cursor: pointer; }
.toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; justify-content: space-between; }
.field { display: grid; gap: 6px; }
label { color: var(--text-muted); font-size: 12px; }
input, select { background: #0a0a0a; border: 1px solid var(--border-soft); color: white; padding: 8px 10px; border-radius: 10px; min-width: 180px; }
.search { flex: 1; min-width: 280px; }
.summary { display: flex; gap: 8px; flex-wrap: wrap; }
.pill { border: 1px solid rgba(255,255,255,.2); border-radius: 999px; padding: 6px 10px; font-size: 12px; }
.pill.running { border-color: rgba(56,217,150,.6); color: #38d996; }
.pill.paused { border-color: rgba(245,161,74,.6); color: #f5a14a; }
.pill.stopped { border-color: rgba(255,255,255,.45); color: #d0d0d0; }
.table-card { overflow: auto; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; color: var(--text-muted); font-size: 12px; padding: 11px 10px; border-bottom: 1px solid var(--border-soft); }
td { padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,.07); }
.status { border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; }
.status.running { background: rgba(56,217,150,.14); color: #38d996; }
.status.paused { background: rgba(245,161,74,.14); color: #f5a14a; }
.status.stopped { background: rgba(255,255,255,.1); color: #e5e7eb; }
.empty { text-align: center; color: var(--text-muted); padding: 26px; }
.pagination { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; gap: 12px; flex-wrap: wrap; }
.pager-left, .pager-right { display: flex; align-items: center; gap: 8px; }
.pager-left label { font-size: 12px; color: var(--text-muted); }
.pager-left select { min-width: 80px; }
.pager-right button { background: transparent; border: 1px solid var(--gold); color: var(--gold); border-radius: 10px; padding: 6px 14px; cursor: pointer; }
.pager-right button:disabled { opacity: .5; cursor: not-allowed; }
</style>
