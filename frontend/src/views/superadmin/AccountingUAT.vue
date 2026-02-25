<template>
  <div class="page">
    <header class="header">
      <div>
        <h2>Accounting Sprint 3 — UAT Console</h2>
        <p class="subtitle">Manual Journal, Approval Queue, Recurring Generator, dan filter reporting untuk UAT user.</p>
      </div>
      <button class="btn" @click="loadJournals" :disabled="loadingJournals">
        {{ loadingJournals ? 'Refreshing...' : 'Refresh Data' }}
      </button>
    </header>

    <section class="card stats">
      <div class="stat"><small>Total Rows</small><strong>{{ meta.total }}</strong></div>
      <div class="stat"><small>Draft</small><strong>{{ statusCount.DRAFT }}</strong></div>
      <div class="stat"><small>Pending</small><strong>{{ statusCount.PENDING_APPROVAL }}</strong></div>
      <div class="stat"><small>Posted</small><strong>{{ statusCount.POSTED }}</strong></div>
      <div class="stat"><small>Rejected</small><strong>{{ statusCount.REJECTED }}</strong></div>
    </section>

    <section class="card">
      <h3>Create Manual Journal Draft</h3>
      <div class="grid two">
        <label>
          Journal Date
          <input v-model="draft.journal_date" type="date" />
        </label>
        <label>
          Branch ID
          <input v-model.number="draft.branch_id" type="number" min="1" />
        </label>
      </div>
      <label>
        Description
        <input v-model="draft.description" type="text" placeholder="Contoh: Penyesuaian UAT" />
      </label>

      <div class="lines-head">
        <h4>Journal Lines</h4>
        <button class="btn secondary" @click="addLine">+ Add Line</button>
      </div>

      <div class="line-row" v-for="(line, idx) in draft.lines" :key="idx">
        <input v-model="line.account_code" placeholder="Account Code (contoh 5111)" />
        <input v-model.number="line.debit" type="number" min="0" step="0.01" placeholder="Debit" />
        <input v-model.number="line.credit" type="number" min="0" step="0.01" placeholder="Credit" />
        <input v-model="line.memo" placeholder="Memo" />
        <button class="danger" @click="removeLine(idx)" :disabled="draft.lines.length <= 2">x</button>
      </div>

      <div class="actions">
        <button class="btn" @click="createDraft" :disabled="submitting">Create Draft</button>
      </div>
    </section>

    <section class="card">
      <div class="lines-head">
        <h3>Manual Journal Queue & Reporting Filter</h3>
      </div>

      <div class="grid filter-grid">
        <label>
          Status
          <select v-model="filters.status" @change="applyFilters">
            <option value="">All Status</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
            <option value="POSTED">POSTED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </label>
        <label>
          Branch ID
          <input v-model.number="filters.branch_id" type="number" min="1" />
        </label>
        <label>
          From Date
          <input v-model="filters.from" type="date" />
        </label>
        <label>
          To Date
          <input v-model="filters.to" type="date" />
        </label>
        <label>
          Page Size
          <select v-model.number="filters.page_size" @change="applyFilters">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
        </label>
      </div>

      <div class="actions compact">
        <button class="btn secondary" @click="applyFilters" :disabled="loadingJournals">Apply Filter</button>
        <button class="btn ghost" @click="resetFilters" :disabled="loadingJournals">Reset Filter</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Description</th>
              <th>Status</th>
              <th>Total Debit</th>
              <th>Total Credit</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingJournals">
              <td colspan="7">Loading...</td>
            </tr>
            <tr v-else-if="!journals.length">
              <td colspan="7">Belum ada data untuk filter ini.</td>
            </tr>
            <tr v-for="j in journals" :key="j.id">
              <td>{{ j.id }}</td>
              <td>{{ formatDate(j.journal_date) }}</td>
              <td>{{ j.description || '-' }}</td>
              <td><span class="badge">{{ j.status }}</span></td>
              <td>{{ j.total_debit }}</td>
              <td>{{ j.total_credit }}</td>
              <td class="row-actions">
                <button class="btn tiny secondary" @click="viewDetail(j.id)">Detail</button>
                <button class="btn tiny" @click="submitJournal(j.id)" :disabled="j.status !== 'DRAFT' && j.status !== 'REJECTED'">Submit</button>
                <button class="btn tiny success" @click="approveJournal(j.id)" :disabled="j.status !== 'PENDING_APPROVAL'">Approve</button>
                <button class="btn tiny danger" @click="rejectJournal(j.id)" :disabled="j.status !== 'PENDING_APPROVAL'">Reject</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pager">
        <button class="btn ghost" :disabled="filters.page <= 1 || loadingJournals" @click="prevPage">Prev</button>
        <span>Page {{ filters.page }} / {{ totalPage }}</span>
        <button class="btn ghost" :disabled="filters.page >= totalPage || loadingJournals" @click="nextPage">Next</button>
      </div>

      <div v-if="selectedDetail" class="detail-box">
        <h4>Detail Journal #{{ selectedDetail.id }}</h4>
        <pre>{{ selectedDetail }}</pre>
      </div>
    </section>

    <section class="card">
      <h3>Recurring Template & Generator</h3>
      <div class="grid two">
        <label>
          Template Name
          <input v-model="recurring.name" />
        </label>
        <label>
          Branch ID
          <input v-model.number="recurring.branch_id" type="number" min="1" />
        </label>
      </div>
      <div class="grid two">
        <label>
          Schedule Type
          <select v-model="recurring.schedule_type">
            <option value="MONTHLY">MONTHLY</option>
            <option value="WEEKLY">WEEKLY</option>
          </select>
        </label>
        <label>
          Schedule Day
          <input v-model.number="recurring.schedule_day" type="number" min="1" max="31" />
        </label>
      </div>
      <label>
        Start Date
        <input v-model="recurring.start_date" type="date" />
      </label>

      <div class="line-row" v-for="(line, idx) in recurring.lines" :key="`r-${idx}`">
        <input v-model="line.account_code" placeholder="Account Code" />
        <input v-model.number="line.debit" type="number" min="0" step="0.01" placeholder="Debit" />
        <input v-model.number="line.credit" type="number" min="0" step="0.01" placeholder="Credit" />
        <input v-model="line.memo" placeholder="Memo" />
      </div>

      <div class="actions">
        <button class="btn" @click="createRecurring" :disabled="submitting">Create Template</button>
      </div>

      <hr />

      <div class="grid two">
        <label>
          Generate Date
          <input v-model="generatorDate" type="date" />
        </label>
        <label class="checkbox-row">
          <input v-model="dryRun" type="checkbox" />
          Dry Run
        </label>
      </div>
      <div class="actions">
        <button class="btn secondary" @click="generateRecurring" :disabled="submitting">Run Generator</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import Swal from 'sweetalert2'
import api from '@/services/api'

const today = new Date().toISOString().slice(0, 10)

const loadingJournals = ref(false)
const submitting = ref(false)
const journals = ref([])
const selectedDetail = ref(null)
const meta = ref({ page: 1, page_size: 20, total: 0 })

const filters = ref({
  status: '',
  branch_id: 1,
  from: '',
  to: '',
  page: 1,
  page_size: 20
})

const statusCount = computed(() => {
  const init = { DRAFT: 0, PENDING_APPROVAL: 0, POSTED: 0, REJECTED: 0 }
  journals.value.forEach((j) => {
    const key = String(j.status || '').toUpperCase()
    if (Object.prototype.hasOwnProperty.call(init, key)) init[key] += 1
  })
  return init
})

const totalPage = computed(() => {
  const size = Number(meta.value.page_size || 20)
  const total = Number(meta.value.total || 0)
  return Math.max(1, Math.ceil(total / size))
})

const draft = ref({
  branch_id: 1,
  journal_date: today,
  description: 'UAT Manual Journal',
  lines: [
    { account_code: '5111', debit: 100000, credit: 0, memo: 'beban test' },
    { account_code: '1111', debit: 0, credit: 100000, memo: 'kas test' }
  ]
})

const recurring = ref({
  branch_id: 1,
  name: 'UAT Recurring Template',
  schedule_type: 'MONTHLY',
  schedule_day: 1,
  start_date: today,
  lines: [
    { account_code: '5311', debit: 500000, credit: 0, memo: 'beban payroll' },
    { account_code: '2111', debit: 0, credit: 500000, memo: 'hutang payroll' }
  ]
})

const generatorDate = ref(today)
const dryRun = ref(true)

const addLine = () => draft.value.lines.push({ account_code: '', debit: 0, credit: 0, memo: '' })
const removeLine = (idx) => draft.value.lines.splice(idx, 1)

const formatDate = (v) => {
  if (!v) return '-'
  return String(v).slice(0, 10)
}

const buildFilterParams = () => ({
  page: filters.value.page,
  page_size: filters.value.page_size,
  ...(filters.value.status ? { status: filters.value.status } : {}),
  ...(filters.value.branch_id ? { branch_id: filters.value.branch_id } : {}),
  ...(filters.value.from ? { from: filters.value.from } : {}),
  ...(filters.value.to ? { to: filters.value.to } : {})
})

const loadJournals = async () => {
  loadingJournals.value = true
  try {
    const res = await api.get('/accounting/manual-journals', { params: buildFilterParams() })
    journals.value = res.data?.data || []
    meta.value = res.data?.meta || { page: 1, page_size: filters.value.page_size, total: 0 }
  } catch (err) {
    Swal.fire('Error', err?.response?.data?.error?.message || err.message, 'error')
  } finally {
    loadingJournals.value = false
  }
}

const applyFilters = async () => {
  filters.value.page = 1
  await loadJournals()
}

const resetFilters = async () => {
  filters.value = { status: '', branch_id: 1, from: '', to: '', page: 1, page_size: 20 }
  await loadJournals()
}

const prevPage = async () => {
  if (filters.value.page <= 1) return
  filters.value.page -= 1
  await loadJournals()
}

const nextPage = async () => {
  if (filters.value.page >= totalPage.value) return
  filters.value.page += 1
  await loadJournals()
}

const createDraft = async () => {
  const cleanedLines = draft.value.lines.filter((line) => {
    const hasCode = String(line.account_code || '').trim() !== ''
    const hasValue = Number(line.debit || 0) > 0 || Number(line.credit || 0) > 0
    return hasCode || hasValue
  })

  if (cleanedLines.length < 2) {
    Swal.fire('Validation', 'Minimal 2 line valid untuk membuat draft journal.', 'warning')
    return
  }

  submitting.value = true
  try {
    const payload = {
      ...draft.value,
      lines: cleanedLines
    }
    const res = await api.post('/accounting/manual-journals', payload)
    await Swal.fire('Success', `Draft journal #${res.data.id} berhasil dibuat`, 'success')
    draft.value.lines = cleanedLines
    await loadJournals()
  } catch (err) {
    Swal.fire('Error', err?.response?.data?.error?.message || err.message, 'error')
  } finally {
    submitting.value = false
  }
}

const submitJournal = async (id) => {
  try {
    await api.post(`/accounting/manual-journals/${id}/submit`, { note: 'Submit via UAT UI' })
    await loadJournals()
  } catch (err) {
    Swal.fire('Error', err?.response?.data?.error?.message || err.message, 'error')
  }
}

const approveJournal = async (id) => {
  try {
    await api.post(`/accounting/manual-journals/${id}/approve`, { note: 'Approve via UAT UI' })
    await loadJournals()
  } catch (err) {
    Swal.fire('Error', err?.response?.data?.error?.message || err.message, 'error')
  }
}

const rejectJournal = async (id) => {
  try {
    await api.post(`/accounting/manual-journals/${id}/reject`, { note: 'Reject via UAT UI' })
    await loadJournals()
  } catch (err) {
    Swal.fire('Error', err?.response?.data?.error?.message || err.message, 'error')
  }
}

const viewDetail = async (id) => {
  try {
    const res = await api.get(`/accounting/manual-journals/${id}`)
    selectedDetail.value = res.data
  } catch (err) {
    Swal.fire('Error', err?.response?.data?.error?.message || err.message, 'error')
  }
}

const createRecurring = async () => {
  submitting.value = true
  try {
    const payload = JSON.parse(JSON.stringify(recurring.value))
    const res = await api.post('/accounting/recurring-journals/templates', payload)
    await Swal.fire('Success', `Template recurring #${res.data.id} berhasil dibuat`, 'success')
  } catch (err) {
    Swal.fire('Error', err?.response?.data?.error?.message || err.message, 'error')
  } finally {
    submitting.value = false
  }
}

const generateRecurring = async () => {
  submitting.value = true
  try {
    const res = await api.post('/accounting/internal/recurring-journals/generate', null, {
      params: { date: generatorDate.value, dry_run: dryRun.value }
    })
    await Swal.fire('Generator Result', JSON.stringify(res.data, null, 2), 'info')
  } catch (err) {
    Swal.fire('Error', err?.response?.data?.error?.message || err.message, 'error')
  } finally {
    submitting.value = false
  }
}

onMounted(loadJournals)
</script>

<style scoped>
.page { display: grid; gap: 16px; color: #fff; }
.header { display: flex; justify-content: space-between; align-items: center; }
.subtitle { color: #d0d0d0; margin-top: 4px; }
.card { background: #121212; border: 1px solid #2c2c2c; border-radius: 12px; padding: 16px; }
.stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.stat { background: #191919; border: 1px solid #2e2e2e; border-radius: 10px; padding: 10px; display: grid; gap: 4px; }
.stat small { color: #b5b5b5; }
.stat strong { font-size: 18px; }
.grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.grid.filter-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
label { display: grid; gap: 6px; font-size: 13px; color: #d9d9d9; }
input, select { background: #1e1e1e; border: 1px solid #333; color: #fff; border-radius: 8px; padding: 8px 10px; }
.lines-head { display: flex; justify-content: space-between; align-items: center; margin: 12px 0; }
.line-row { display: grid; grid-template-columns: 1.2fr 1fr 1fr 1.3fr auto; gap: 8px; margin-bottom: 8px; }
.actions { margin-top: 12px; display: flex; gap: 8px; }
.actions.compact { margin-top: 8px; }
.btn { background: #c9a24d; color: #111; border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-weight: 600; }
.btn.secondary { background: #2f3a4a; color: #fff; }
.btn.ghost { background: transparent; color: #fff; border: 1px solid #3a3a3a; }
.btn.success { background: #2b9348; color: #fff; }
.btn.tiny { padding: 4px 8px; font-size: 12px; }
.danger { background: #8d2b2b; color: #fff; border: none; border-radius: 8px; padding: 8px 10px; cursor: pointer; }
.table-wrap { overflow: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { border-bottom: 1px solid #2c2c2c; padding: 8px; text-align: left; }
.badge { background: #2f3a4a; color: #fff; border-radius: 999px; padding: 2px 8px; font-size: 11px; }
.row-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.detail-box { margin-top: 12px; background: #0f0f0f; border: 1px solid #2c2c2c; border-radius: 8px; padding: 10px; }
pre { white-space: pre-wrap; word-break: break-word; max-height: 280px; overflow: auto; font-size: 11px; }
.checkbox-row { display: flex; align-items: center; gap: 8px; margin-top: 20px; }
.pager { margin-top: 10px; display: flex; gap: 10px; justify-content: flex-end; align-items: center; }
hr { border: none; border-top: 1px solid #333; margin: 14px 0; }
@media (max-width: 1200px) {
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid.filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .grid.two { grid-template-columns: 1fr; }
  .line-row { grid-template-columns: 1fr; }
}
</style>
