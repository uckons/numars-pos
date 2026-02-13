<template>
  <div class="page">
    <section class="hero card">
      <div>
        <h2>Audit Logs</h2>
        <p class="subtitle">Jejak aktivitas user untuk kebutuhan kontrol, investigasi, dan compliance.</p>
      </div>
      <span class="meta-pill">{{ pagination.total }} Logs</span>
    </section>

    <section class="card filter">
      <div class="field">
        <label>User ID</label>
        <input v-model="filter.user_id" placeholder="Contoh: 12" />
      </div>
      <div class="field">
        <label>Aksi</label>
        <input v-model="filter.action" placeholder="Contoh: TIMER, ORDER" />
      </div>
      <div class="field">
        <label>Dari</label>
        <input type="date" v-model="filter.from" />
      </div>
      <div class="field">
        <label>Sampai</label>
        <input type="date" v-model="filter.to" />
      </div>
      <div class="field">
        <label>Per Halaman</label>
        <select v-model.number="pageSize">
          <option :value="20">20</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </div>
      <button class="btn-outline" @click="load(1)">Terapkan</button>
    </section>

    <section class="card table-card">
      <table>
        <thead>
          <tr>
            <th>Waktu</th>
            <th>User</th>
            <th>Role</th>
            <th>Aksi</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!logs.length">
            <td colspan="5" class="empty">Tidak ada data audit.</td>
          </tr>
          <tr v-for="l in logs" :key="l.id">
            <td>{{ format(l.created_at) }}</td>
            <td>{{ l.username || '-' }} <small class="muted">#{{ l.user_id ?? '-' }}</small></td>
            <td>{{ l.role || '-' }}</td>
            <td><span class="action">{{ l.action || '-' }}</span></td>
            <td class="target">{{ formatTarget(l.target) }}</td>
          </tr>
        </tbody>
      </table>
      <div class="pagination">
        <button @click="load(page - 1)" :disabled="page === 1">Prev</button>
        <span>Page {{ page }} / {{ pagination.total_pages }}</span>
        <button @click="load(page + 1)" :disabled="page >= pagination.total_pages">Next</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue"
import api from "../../services/api"

const logs = ref([])
const filter = ref({ user_id: "", action: "", from: "", to: "" })
const page = ref(1)
const pageSize = ref(50)
const pagination = ref({ page: 1, page_size: 50, total: 0, total_pages: 1 })

const load = async (nextPage = 1) => {
  const params = { page: nextPage, page_size: pageSize.value }
  if (filter.value.user_id) params.user_id = filter.value.user_id
  if (filter.value.action) params.action = filter.value.action
  if (filter.value.from) params.from = filter.value.from
  if (filter.value.to) params.to = `${filter.value.to}T23:59:59`

  const res = await api.get("/audit-logs", { params })
  logs.value = Array.isArray(res.data?.data) ? res.data.data : []
  pagination.value = res.data?.pagination || { page: 1, page_size: pageSize.value, total: logs.value.length, total_pages: 1 }
  page.value = Number(pagination.value.page || nextPage)
}

onMounted(() => load(1))
watch(pageSize, () => load(1))

const format = (v) => new Date(v).toLocaleString("id-ID")
const formatTarget = (v) => {
  if (!v) return '-'
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}
</script>

<style scoped>
.page { padding: 24px; display: grid; gap: 16px; }
.card { background: linear-gradient(120deg, rgba(255,255,255,.02), rgba(255,255,255,.01)); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
.hero { display: flex; justify-content: space-between; align-items: center; }
.subtitle { color: var(--text-muted); margin-top: 4px; }
.meta-pill { border: 1px solid rgba(201,162,77,.45); color: var(--gold); border-radius: 999px; padding: 6px 12px; font-size: 12px; }

.filter { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
.field { display: grid; gap: 6px; }
label { color: var(--text-muted); font-size: 12px; }
input, select { background: #0a0a0a; border: 1px solid var(--border-soft); color: white; padding: 8px 10px; border-radius: 10px; min-width: 150px; }
.btn-outline { background: transparent; border: 1px solid var(--gold); color: var(--gold); border-radius: 10px; padding: 8px 14px; cursor: pointer; }

.table-card { overflow: auto; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; color: var(--text-muted); font-size: 12px; padding: 11px 10px; border-bottom: 1px solid var(--border-soft); }
td { padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,.07); vertical-align: top; }
.action { background: rgba(95,133,255,.14); color: #8eabff; border-radius: 999px; padding: 4px 10px; font-size: 12px; border: 1px solid rgba(95,133,255,.4); }
.target { max-width: 460px; white-space: pre-wrap; word-break: break-word; color: #cdd1d7; }
.muted { color: var(--text-muted); }
.empty { text-align: center; color: var(--text-muted); padding: 24px; }
.pagination { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
.pagination button { background: transparent; border: 1px solid var(--gold); color: var(--gold); border-radius: 10px; padding: 6px 14px; cursor: pointer; }
.pagination button:disabled { opacity: .5; cursor: not-allowed; }
</style>
