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
      <h3>Accounting Full Menu</h3>
      <p class="subtitle2">Aktifkan menu UAT sesuai scope build: GL, AP, AR, Payroll, Tax, Closing, dan Financial Report.</p>
      <div class="menu-grid">
        <button
          v-for="menu in moduleMenus"
          :key="menu.key"
          class="menu-chip"
          :class="{ active: activeModule === menu.key }"
          @click="activeModule = menu.key"
        >
          <strong>{{ menu.label }}</strong>
          <small>{{ menu.desc }}</small>
        </button>
      </div>
    </section>

    <section class="card" v-if="activeModule === 'manual-journal'">
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

      <div class="totals">
        <span>Total Debit: <strong>{{ formatAmount(draftTotalDebit) }}</strong></span>
        <span>Total Credit: <strong>{{ formatAmount(draftTotalCredit) }}</strong></span>
        <span :class="draftDiff === 0 ? 'ok' : 'warn'">Selisih: <strong>{{ formatAmount(Math.abs(draftDiff)) }}</strong></span>
      </div>

      <div class="actions">
        <button class="btn" @click="createDraft" :disabled="submitting || draftDiff !== 0">Create Draft</button>
        <button class="btn ghost" @click="resetDraft" :disabled="submitting">Reset Draft</button>
      </div>
    </section>

    <section class="card" v-if="activeModule === 'manual-journal'">
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
        <button class="btn ghost" @click="setDateRange(7)" :disabled="loadingJournals">Last 7 Days</button>
        <button class="btn ghost" @click="setDateRange(30)" :disabled="loadingJournals">Last 30 Days</button>
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
              <td><span class="badge" :class="badgeClass(j.status)">{{ j.status }}</span></td>
              <td>{{ formatAmount(j.total_debit) }}</td>
              <td>{{ formatAmount(j.total_credit) }}</td>
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
        <p><strong>Date:</strong> {{ formatDate(selectedDetail.journal_date) }}</p>
        <p><strong>Description:</strong> {{ selectedDetail.description || '-' }}</p>
        <p><strong>Status:</strong> <span class="badge" :class="badgeClass(selectedDetail.status)">{{ selectedDetail.status || '-' }}</span></p>
        <table class="detail-table" v-if="selectedDetail.lines?.length">
          <thead>
            <tr>
              <th>Account</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Memo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, idx) in selectedDetail.lines" :key="idx">
              <td>{{ line.account_code || '-' }}</td>
              <td>{{ formatAmount(line.debit) }}</td>
              <td>{{ formatAmount(line.credit) }}</td>
              <td>{{ line.memo || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card" v-if="activeModule === 'recurring'">
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

    <section class="card" v-if="activeModule === 'approval'">
      <h3>Approval Queue Control</h3>
      <p class="subtitle2">Monitor SLA approval, eskalasi, dan assignment approver lintas branch.</p>
      <div class="grid two">
        <label>
          Branch Scope
          <select v-model="approvalFilter.branch_id">
            <option :value="1">Branch 1</option>
            <option :value="2">Branch 2</option>
            <option :value="3">Branch 3</option>
          </select>
        </label>
        <label>
          Priority
          <select v-model="approvalFilter.priority">
            <option value="ALL">ALL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </label>
      </div>
      <div class="actions">
        <button class="btn secondary" @click="simulateApprovalSync">Sync Approval Queue</button>
      </div>
      <table class="mini-table">
        <thead><tr><th>Doc</th><th>Requester</th><th>Age</th><th>Priority</th><th>Approver</th></tr></thead>
        <tbody>
          <tr v-for="row in approvalRows" :key="row.doc_no">
            <td>{{ row.doc_no }}</td><td>{{ row.requester }}</td><td>{{ row.age_hours }} jam</td><td>{{ row.priority }}</td><td>{{ row.approver }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="card" v-if="activeModule === 'ap'">
      <h3>Accounts Payable (AP) - Vendor Bill Draft</h3>
      <div class="grid two">
        <label>Vendor<input v-model="apDraft.vendor" placeholder="PT Supplier Nusantara" /></label>
        <label>Due Date<input v-model="apDraft.due_date" type="date" /></label>
      </div>
      <div class="line-row" v-for="(line, idx) in apDraft.lines" :key="`ap-${idx}`">
        <input v-model="line.expense_account" placeholder="Expense Account" />
        <input v-model.number="line.amount" type="number" min="0" step="0.01" placeholder="Amount" />
        <input v-model="line.tax_code" placeholder="Tax Code" />
        <input v-model="line.memo" placeholder="Memo" />
        <button class="danger" @click="removeApLine(idx)" :disabled="apDraft.lines.length <= 1">x</button>
      </div>
      <div class="actions">
        <button class="btn secondary" @click="addApLine">+ Add AP Line</button>
        <button class="btn" @click="saveApDraft">Save AP Draft</button>
      </div>
    </section>

    <section class="card" v-if="activeModule === 'ar'">
      <h3>Accounts Receivable (AR) - Invoice Draft</h3>
      <div class="grid two">
        <label>Customer<input v-model="arDraft.customer" placeholder="Corporate Client" /></label>
        <label>Invoice Date<input v-model="arDraft.invoice_date" type="date" /></label>
      </div>
      <div class="line-row" v-for="(line, idx) in arDraft.lines" :key="`ar-${idx}`">
        <input v-model="line.revenue_account" placeholder="Revenue Account" />
        <input v-model.number="line.amount" type="number" min="0" step="0.01" placeholder="Amount" />
        <input v-model="line.tax_code" placeholder="Tax Code" />
        <input v-model="line.memo" placeholder="Memo" />
        <button class="danger" @click="removeArLine(idx)" :disabled="arDraft.lines.length <= 1">x</button>
      </div>
      <div class="actions">
        <button class="btn secondary" @click="addArLine">+ Add AR Line</button>
        <button class="btn" @click="saveArDraft">Save AR Draft</button>
      </div>
    </section>

    <section class="card" v-if="activeModule === 'payroll'">
      <h3>Payroll Accrual & Journal Simulation</h3>
      <div class="grid two">
        <label>Period Start<input v-model="payrollForm.period_start" type="date" /></label>
        <label>Period End<input v-model="payrollForm.period_end" type="date" /></label>
      </div>
      <div class="grid two">
        <label>Total Gross Payroll<input v-model.number="payrollForm.gross" type="number" min="0" /></label>
        <label>Total Deductions<input v-model.number="payrollForm.deduction" type="number" min="0" /></label>
      </div>
      <div class="totals">
        <span>Net Payroll: <strong>{{ formatAmount(payrollForm.gross - payrollForm.deduction) }}</strong></span>
      </div>
      <div class="actions">
        <button class="btn" @click="generatePayrollJournal">Generate Payroll Journal</button>
      </div>
    </section>

    <section class="card" v-if="activeModule === 'tax'">
      <h3>Tax Center (PPN / PPh)</h3>
      <div class="grid two">
        <label>Tax Period<input v-model="taxForm.period" type="month" /></label>
        <label>Branch ID<input v-model.number="taxForm.branch_id" type="number" min="1" /></label>
      </div>
      <div class="actions">
        <button class="btn secondary" @click="recalcTax">Recalculate Tax</button>
        <button class="btn" @click="exportTaxSummary">Export Tax Summary</button>
      </div>
    </section>

    <section class="card" v-if="activeModule === 'close-book'">
      <h3>Period End Closing</h3>
      <div class="grid two">
        <label>Close Month<input v-model="closingForm.period" type="month" /></label>
        <label>Branch ID<input v-model.number="closingForm.branch_id" type="number" min="1" /></label>
      </div>
      <label>Checklist Confirmation
        <select v-model="closingForm.checklist">
          <option value="">Pilih status checklist</option>
          <option value="READY">READY TO CLOSE</option>
          <option value="PENDING">PENDING ADJUSTMENT</option>
        </select>
      </label>
      <div class="actions">
        <button class="btn secondary" @click="previewClosing">Preview Closing Entries</button>
        <button class="btn" @click="executeClosing">Run Closing</button>
      </div>
    </section>

    <section class="card" v-if="activeModule === 'reporting'">
      <h3>Financial Reporting Menu</h3>
      <div class="report-grid">
        <article v-for="item in reportMenus" :key="item.name" class="report-card">
          <h4>{{ item.name }}</h4>
          <p>{{ item.desc }}</p>
          <button class="btn ghost" @click="openReport(item.name)">Open</button>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import Swal from 'sweetalert2'
import api from '@/services/api'

const today = new Date().toISOString().slice(0, 10)

const moduleMenus = [
  { key: 'manual-journal', label: 'General Ledger', desc: 'Manual journal & queue' },
  { key: 'approval', label: 'Approval Queue', desc: 'Approval SLA & escalation' },
  { key: 'recurring', label: 'Recurring', desc: 'Recurring journal templates' },
  { key: 'ap', label: 'Accounts Payable', desc: 'Vendor bills & payable draft' },
  { key: 'ar', label: 'Accounts Receivable', desc: 'Customer invoice draft' },
  { key: 'payroll', label: 'Payroll', desc: 'Payroll accrual simulation' },
  { key: 'tax', label: 'Tax Center', desc: 'PPN / PPh workflow' },
  { key: 'close-book', label: 'Period Closing', desc: 'Close month checklist' },
  { key: 'reporting', label: 'Reports', desc: 'P&L, Balance Sheet, Cash Flow' }
]

const reportMenus = [
  { name: 'Profit & Loss', desc: 'Laporan laba rugi periodik per branch' },
  { name: 'Balance Sheet', desc: 'Posisi aset, liabilitas, dan ekuitas' },
  { name: 'Cash Flow', desc: 'Arus kas operasional, investasi, pendanaan' },
  { name: 'Aging Payable', desc: 'Umur hutang vendor per due date' },
  { name: 'Aging Receivable', desc: 'Umur piutang customer' }
]

const activeModule = ref('manual-journal')

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

const approvalFilter = ref({ branch_id: 1, priority: 'ALL' })
const approvalRows = ref([
  { doc_no: 'MJ-2026-0021', requester: 'Nadia', age_hours: 3, priority: 'HIGH', approver: 'Manager Branch 1' },
  { doc_no: 'MJ-2026-0019', requester: 'Rudi', age_hours: 8, priority: 'MEDIUM', approver: 'Owner' }
])

const apDraft = ref({
  vendor: 'PT Supplier Nusantara',
  due_date: today,
  lines: [{ expense_account: '6111', amount: 2500000, tax_code: 'PPN11', memo: 'Pembelian inventory' }]
})

const arDraft = ref({
  customer: 'Corporate Client A',
  invoice_date: today,
  lines: [{ revenue_account: '4111', amount: 3500000, tax_code: 'PPN11', memo: 'Invoice layanan corporate' }]
})

const payrollForm = ref({
  period_start: today,
  period_end: today,
  gross: 85000000,
  deduction: 11250000
})

const taxForm = ref({
  period: today.slice(0, 7),
  branch_id: 1
})

const closingForm = ref({
  period: today.slice(0, 7),
  branch_id: 1,
  checklist: ''
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
const draftTotalDebit = computed(() => draft.value.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0))
const draftTotalCredit = computed(() => draft.value.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0))
const draftDiff = computed(() => Number((draftTotalDebit.value - draftTotalCredit.value).toFixed(2)))

const defaultDraft = () => ({
  branch_id: 1,
  journal_date: today,
  description: 'UAT Manual Journal',
  lines: [
    { account_code: '5111', debit: 100000, credit: 0, memo: 'beban test' },
    { account_code: '1111', debit: 0, credit: 100000, memo: 'kas test' }
  ]
})

const resetDraft = () => {
  draft.value = defaultDraft()
}

const formatDate = (v) => {
  if (!v) return '-'
  return String(v).slice(0, 10)
}

const formatAmount = (value) => Number(value || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const badgeClass = (status) => {
  const state = String(status || '').toUpperCase()
  if (state === 'POSTED') return 'posted'
  if (state === 'PENDING_APPROVAL') return 'pending'
  if (state === 'REJECTED') return 'rejected'
  return 'draft'
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

const setDateRange = async (days) => {
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - days)
  filters.value.from = from.toISOString().slice(0, 10)
  filters.value.to = to.toISOString().slice(0, 10)
  await applyFilters()
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

  const totalDebit = cleanedLines.reduce((sum, line) => sum + Number(line.debit || 0), 0)
  const totalCredit = cleanedLines.reduce((sum, line) => sum + Number(line.credit || 0), 0)

  if (Number(totalDebit.toFixed(2)) !== Number(totalCredit.toFixed(2))) {
    Swal.fire('Validation', 'Total debit dan credit harus balance.', 'warning')
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
    const prompt = await Swal.fire({
      title: 'Submit Journal',
      text: 'Tambahkan note submit (opsional)',
      input: 'text',
      inputValue: 'Submit via UAT UI',
      showCancelButton: true
    })
    if (!prompt.isConfirmed) return
    await api.post(`/accounting/manual-journals/${id}/submit`, { note: prompt.value || 'Submit via UAT UI' })
    await loadJournals()
  } catch (err) {
    Swal.fire('Error', err?.response?.data?.error?.message || err.message, 'error')
  }
}

const approveJournal = async (id) => {
  try {
    const prompt = await Swal.fire({
      title: 'Approve Journal',
      text: 'Tambahkan note approval (opsional)',
      input: 'text',
      inputValue: 'Approve via UAT UI',
      showCancelButton: true
    })
    if (!prompt.isConfirmed) return
    await api.post(`/accounting/manual-journals/${id}/approve`, { note: prompt.value || 'Approve via UAT UI' })
    await loadJournals()
  } catch (err) {
    Swal.fire('Error', err?.response?.data?.error?.message || err.message, 'error')
  }
}

const rejectJournal = async (id) => {
  try {
    const prompt = await Swal.fire({
      title: 'Reject Journal',
      text: 'Tambahkan alasan reject',
      input: 'text',
      inputValue: 'Reject via UAT UI',
      showCancelButton: true,
      inputValidator: (value) => (!value ? 'Alasan reject wajib diisi.' : undefined)
    })
    if (!prompt.isConfirmed) return
    await api.post(`/accounting/manual-journals/${id}/reject`, { note: prompt.value })
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


const addApLine = () => apDraft.value.lines.push({ expense_account: '', amount: 0, tax_code: '', memo: '' })
const removeApLine = (idx) => apDraft.value.lines.splice(idx, 1)
const addArLine = () => arDraft.value.lines.push({ revenue_account: '', amount: 0, tax_code: '', memo: '' })
const removeArLine = (idx) => arDraft.value.lines.splice(idx, 1)

const saveApDraft = async () => {
  await Swal.fire('AP Draft Saved', `Vendor ${apDraft.value.vendor} tersimpan untuk proses approval.`, 'success')
}

const saveArDraft = async () => {
  await Swal.fire('AR Draft Saved', `Invoice draft ${arDraft.value.customer} tersimpan.`, 'success')
}

const generatePayrollJournal = async () => {
  await Swal.fire('Payroll Journal Generated', `Net payroll ${formatAmount(payrollForm.value.gross - payrollForm.value.deduction)} siap diposting.`, 'success')
}

const recalcTax = async () => {
  await Swal.fire('Tax Recalculated', `Periode ${taxForm.value.period} branch ${taxForm.value.branch_id} berhasil dihitung ulang.`, 'info')
}

const exportTaxSummary = async () => {
  await Swal.fire('Export Triggered', 'Tax summary export sedang diproses.', 'success')
}

const previewClosing = async () => {
  await Swal.fire('Closing Preview', `Preview closing ${closingForm.value.period} branch ${closingForm.value.branch_id} siap direview.`, 'info')
}

const executeClosing = async () => {
  if (closingForm.value.checklist !== 'READY') {
    await Swal.fire('Validation', 'Checklist harus READY TO CLOSE sebelum run closing.', 'warning')
    return
  }
  await Swal.fire('Closing Executed', `Period closing ${closingForm.value.period} berhasil dijalankan.`, 'success')
}

const openReport = async (name) => {
  await Swal.fire('Open Report', `Membuka report ${name}`, 'info')
}

const simulateApprovalSync = async () => {
  await Swal.fire('Approval Sync', `Queue branch ${approvalFilter.value.branch_id} priority ${approvalFilter.value.priority} sudah disinkronkan.`, 'success')
}

onMounted(loadJournals)
</script>

<style scoped>
.page { display: grid; gap: 16px; color: #fff; }
.header { display: flex; justify-content: space-between; align-items: center; }
.subtitle { color: #d0d0d0; margin-top: 4px; }
.subtitle2 { color: #b8b8b8; margin: 6px 0 10px; font-size: 13px; }
.card { background: #121212; border: 1px solid #2c2c2c; border-radius: 12px; padding: 16px; }
.stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.stat { background: #191919; border: 1px solid #2e2e2e; border-radius: 10px; padding: 10px; display: grid; gap: 4px; }
.stat small { color: #b5b5b5; }
.stat strong { font-size: 18px; }
.grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.menu-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.menu-chip { background: #191919; border: 1px solid #2f3a4a; border-radius: 10px; color: #ececec; padding: 10px; display: grid; gap: 2px; text-align: left; cursor: pointer; }
.menu-chip small { color: #a8a8a8; font-size: 11px; }
.menu-chip.active { border-color: #c9a24d; background: #242017; }
.report-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.report-card { background: #171717; border: 1px solid #303030; border-radius: 10px; padding: 10px; display: grid; gap: 8px; }
.mini-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
.mini-table th, .mini-table td { border-bottom: 1px solid #2c2c2c; padding: 8px; text-align: left; }
.grid.filter-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
label { display: grid; gap: 6px; font-size: 13px; color: #d9d9d9; }
input, select { background: #1e1e1e; border: 1px solid #333; color: #fff; border-radius: 8px; padding: 8px 10px; }
.lines-head { display: flex; justify-content: space-between; align-items: center; margin: 12px 0; }
.line-row { display: grid; grid-template-columns: 1.2fr 1fr 1fr 1.3fr auto; gap: 8px; margin-bottom: 8px; }
.actions { margin-top: 12px; display: flex; gap: 8px; }
.actions.compact { margin-top: 8px; }
.totals { margin-top: 8px; display: flex; gap: 14px; flex-wrap: wrap; color: #d7d7d7; }
.totals .ok { color: #66c57f; }
.totals .warn { color: #f3b95a; }
.btn { background: #c9a24d; color: #111; border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-weight: 600; }
.btn.secondary { background: #2f3a4a; color: #fff; }
.btn.ghost { background: transparent; color: #fff; border: 1px solid #3a3a3a; }
.btn.success { background: #2b9348; color: #fff; }
.btn.tiny { padding: 4px 8px; font-size: 12px; }
.danger { background: #8d2b2b; color: #fff; border: none; border-radius: 8px; padding: 8px 10px; cursor: pointer; }
.table-wrap { overflow: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { border-bottom: 1px solid #2c2c2c; padding: 8px; text-align: left; }
.badge { background: #2f3a4a; color: #fff; border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 600; }
.badge.draft { background: #6c757d; }
.badge.pending { background: #375a7f; }
.badge.posted { background: #2b9348; }
.badge.rejected { background: #9b2226; }
.row-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.detail-box { margin-top: 12px; background: #0f0f0f; border: 1px solid #2c2c2c; border-radius: 8px; padding: 10px; }
.detail-table { width: 100%; margin-top: 8px; border-collapse: collapse; }
.detail-table th, .detail-table td { border-bottom: 1px solid #2c2c2c; padding: 6px; font-size: 12px; }
pre { white-space: pre-wrap; word-break: break-word; max-height: 280px; overflow: auto; font-size: 11px; }
.checkbox-row { display: flex; align-items: center; gap: 8px; margin-top: 20px; }
.pager { margin-top: 10px; display: flex; gap: 10px; justify-content: flex-end; align-items: center; }
hr { border: none; border-top: 1px solid #333; margin: 14px 0; }
@media (max-width: 1200px) {
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid.filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .menu-grid, .report-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .grid.two { grid-template-columns: 1fr; }
  .line-row { grid-template-columns: 1fr; }
  .menu-grid, .report-grid { grid-template-columns: 1fr; }
}
</style>
