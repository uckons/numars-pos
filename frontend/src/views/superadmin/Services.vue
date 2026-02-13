<template>
  <div class="page">
    <!-- HEADER -->
    <div class="header">
      <div>
        <h2>Services</h2>
        <p class="subtitle">Manage SPA / LC / FNB / Karaoke services</p>
      </div>

      <button class="btn-primary" @click="openAdd">
        + Add Service
      </button>
    </div>

    <!-- STATS (AMAN, TIDAK RUSAK LAYOUT) -->
    <!--<div class="service-stats">
      <div class="stat-box">
        <div class="val">{{ total }}</div>
        <div class="lbl">Total</div>
      </div>
      <div class="stat-box active">
        <div class="val">{{ active }}</div>
        <div class="lbl">Active</div>
      </div>
      <div class="stat-box disabled">
        <div class="val">{{ disabled }}</div>
        <div class="lbl">Disabled</div>
      </div>
    </div> -->
<!-- STATS (COPY DARI USERS) -->
<div class="stats">
  <div class="stat-card">
    <p>Total Service</p>
    <h3>{{ total }}</h3>
  </div>

  <div class="stat-card active">
    <p>Active</p>
    <h3>{{ active }}</h3>
  </div>

  <div class="stat-card disabled">
    <p>Disabled</p>
    <h3>{{ disabled }}</h3>
  </div>

  <!-- <div class="stat-card new">
    <p>New This Month</p>
    <h3>+{{ stats.new_month }}</h3>
  </div> -->
</div>
<!-- STATS (COPY DARI USERS) -->

    <!-- FILTER -->
    <div class="filters">
      <input v-model="keyword" placeholder="Search service..." class="input" />

      <select v-model="selectedBranch" class="select">
        <option value="">All Branches</option>
        <option v-for="b in branches" :key="b.id" :value="b.id">
          {{ b.name }}
        </option>
      </select>

      <select v-model="selectedType" class="select">
        <option value="">All Types</option>
        <option value="SPA">SPA</option>
        <option value="LC">LC</option>
        <option value="FNB">FNB</option>
        <option value="LOUNGE">LOUNGE</option>
        <option value="KARAOKE">KARAOKE</option>
      </select>

      <button class="btn-search" @click="loadServices(1)">
        Search
      </button>
    </div>
    <!-- BULK BAR COPY DARI USERS-->
    <transition name="fade">
      <div v-if="selectedIds.length" class="bulk-bar">
        <span>{{ selectedIds.length }} selected</span>
        <div>
          <button class="warn" @click="bulkToggle">Toggle Active</button>
          <button class="danger" @click="bulkDelete">Delete</button>
        </div>
      </div>
    </transition>

    <!-- TABLE -->
    <div class="card table-card">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Branch</th>
            <th>Type</th>
            <th>Duration</th>
            <th>Price</th>
            <th>Status</th>
            <th width="220">Actions</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="empty">Loading...</td>
          </tr>

          <tr v-else-if="!services.length">
            <td colspan="7" class="empty">No services found</td>
          </tr>

          <tr
            v-for="s in services"
            :key="s.id"
            class="row-hover"
          >
            <td class="name">{{ s.name }}</td>

            <!-- BRANCH BADGE (FIXED) -->
            <td>
              <span class="badge branch">
                {{ s.branch_name || s.branch || s.branch?.name || '—' }}
              </span>
            </td>

            <td>
              <span class="badge type">{{ s.type }}</span>
            </td>

            <td>
              {{ s.duration_minutes ? s.duration_minutes + " min" : "-" }}
            </td>

            <td class="price">
              Rp {{ format(s.base_price) }}
            </td>

            <td>
              <span
                class="badge"
                :class="s.is_active ? 'success' : 'danger'"
              >
                {{ s.is_active ? "ACTIVE" : "DISABLED" }}
              </span>
            </td>

            <td class="actions">
              <button @click="edit(s)">Edit</button>
              <button
                :class="s.is_active ? 'danger' : 'success'"
                @click="toggle(s)"
              >
                {{ s.is_active ? "Disable" : "Enable" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- PAGINATION -->
      <div class="pagination-bar">
        <div>
          Show
          <select v-model="perPage" @change="loadServices(1)">
            <option :value="30">30</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>

        <div>
          <button @click="loadServices(page-1)" :disabled="page===1">Prev</button>
          Page {{ page }}
          <button @click="loadServices(page+1)" :disabled="services.length < perPage">Next</button>
        </div>
      </div>
    </div>

    <!-- MODAL -->
    <ServiceForm
      v-if="showForm"
      :edit="!!selected"
      :data="selected"
      @saved="reload"
      @close="close"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue"
import Swal from "sweetalert2"
import api from "@/services/api"
import ServiceForm from "./ServiceForm.vue"

const services = ref([])
const branches = ref([])
const loading = ref(false)

const selected = ref(null)
const showForm = ref(false)

const keyword = ref("")
const selectedBranch = ref("")
const selectedType = ref("")

const page = ref(1)
const perPage = ref(30)
const selectedIds = ref([])

/* LOAD BRANCHES */
const loadBranches = async () => {
  const res = await api.get("/superadmin/branches")
  branches.value = Array.isArray(res.data) ? res.data : (res.data.data || [])
}

/* LOAD SERVICES */
const loadServices = async () => {
  loading.value = true
  try {
    const res = await api.get("/services", {
      params: {
        q: keyword.value || undefined,
        branch_id: selectedBranch.value || undefined,
        type: selectedType.value || undefined
      }
    })

    // ?? KUNCI AGAR SELALU ARRAY
    if (Array.isArray(res.data)) {
      services.value = res.data
    } else if (Array.isArray(res.data.data)) {
      services.value = res.data.data
    } else {
      services.value = []
    }

  } catch (err) {
    console.error("Load services error:", err)
    services.value = []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadBranches()
  await loadServices(1)
})

/* ACTIONS */
const openAdd = () => {
  selected.value = null
  showForm.value = true
}

const edit = (s) => {
  selected.value = { ...s }
  showForm.value = true
}
const close = () => {
  showForm.value = false   // ?? INI YANG SERING HILANG
  selected.value = null
}

const reload = async () => {
  showForm.value = false   // ?? WAJIB
  selected.value = null
  await loadServices()
}

const bulkToggle = async () => {
  // Placeholder: avoid runtime error when bulk bar is visible.
}

const bulkDelete = async () => {
  // Placeholder: avoid runtime error when bulk bar is visible.
}
const toggle = async (s) => {
  // optimistic UI (langsung berubah)
  const previous = s.is_active
  s.is_active = !s.is_active
  try {
    await api.put(`/services/${s.id}/toggle`)
    //s.is_active = !s.is_active
  } catch (err) {
    s.is_active = !s.is_active
    console.error("Toggle failed", err)
    await Swal.fire({ icon: "error", title: "Gagal", text: "Gagal mengubah status service" })
  }
}

/* STATS */
const total = computed(() => services.value.length)
const active = computed(() => services.value.filter(s => s.is_active).length)
const disabled = computed(() => total.value - active.value)

const format = (v) =>
  Number(v || 0).toLocaleString("id-ID")
</script>

<style scoped>
.page {
  padding: 24px;
}

/* HEADER */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.subtitle {
  color: var(--text-muted);
  font-size: 13px;
}

/* STATS */
.service-stats {
  display: flex;
  gap: 12px;
  margin: 14px 0;
}
.stat-box {
  background: var(--bg-card);
  padding: 12px 16px;
  border-radius: var(--radius);
}
.stat-box .val {
  font-size: 20px;
  font-weight: 700;
}
.stat-box .lbl {
  font-size: 12px;
  color: var(--text-muted);
}
.stat-box.active { border-left: 3px solid #2ecc71 }
.stat-box.disabled { border-left: 3px solid #e74c3c }

/* CARD */
.card {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 16px;
  margin-top: 16px;
  box-shadow: var(--shadow-soft);
}

/* FILTER */
.filters {
  display: flex;
  gap: 12px;
}

/* TABLE */
/* table {
  width: 100%;
  border-collapse: collapse;
}
th {
  color: var(--text-muted);
  text-align: left;
  padding: 12px;
  font-size: 13px;
}
td {
  padding: 12px;
  border-top: 1px solid var(--border-soft);
}
.row-hover:hover {
  background: rgba(201,162,77,.05) !important;
} */
/* TABLE DARI USERS */
/* TABLE */
table { width:100%; border-collapse:collapse }
th {
  color:#888;
  font-size:12px;
  padding:12px;
  text-align:left;
}
td {
  padding:12px;
  border-top:1px solid #222;
}
.row {
  transition:background .25s ease, transform .15s ease;
}
.row:hover {
  background:rgba(255,255,255,.04);
  transform:translateY(-1px);
}

.name { font-weight: 600 }
.price { font-weight: 600 }

/* BADGE */
.badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
}
.branch {
  background: rgba(255,255,255,.08);
}
.success {
  background: rgba(39,174,96,.2);
  color: #2ecc71;
}
.danger {
  background: rgba(192,57,43,.2);
  color: #e74c3c;
}
.type {
  background: rgba(201,162,77,.2);
  color: var(--gold);
}

/* BUTTON */
button {
  border: none;
  padding: 8px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: .15s;
}
button:hover {
  transform: translateY(-1px);
}
.btn-primary {
  background: var(--gold);
  color: black;
}
.actions button {
  margin-right: 6px;
}

.btn-search {
  background: transparent;
  border: 1px solid #c9a24d;
  color: #c9a24d;
  padding: 8px 14px;
  border-radius: 10px;
}
.btn-search:hover {
  background: #c9a24d;
  color: #000;
}

/* PAGINATION */
/* .pagination-bar {
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
} */

/* PAGINATION DARI USERS*/
.pagination-bar {
  display:flex;
  justify-content:center;
  gap:12px;
  margin-top:16px;
}


.empty {
  text-align: center;
  padding: 30px;
  color: var(--text-muted);
}
/* TEMPLATE DARI USERS.VUE */
/* TRANSITION */
.fade-enter-active,
.fade-leave-active {
  transition:opacity .2s ease, transform .2s ease;
}
.fade-enter-from {
  opacity:0;
  transform:translateY(6px);
}
.fade-leave-to {
  opacity:0;
  transform:translateY(-6px);
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 16px;
}

.stat-card {
  background: linear-gradient(145deg, #0e0e0e, #151515);
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 12px 40px rgba(0,0,0,.45);
  transition: all .25s ease;
  cursor: default;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 60px rgba(0,0,0,.6);
}

.stat-card p {
  font-size: 13px;
  color: #999;
}

.stat-card h3 {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 700;
}

.stat-card.active h3 {
  color: #2ecc71;
}

.stat-card.disabled h3 {
  color: #e74c3c;
}

.stat-card.new h3 {
  color: #c9a24d;
}
/* ROW HOVER */
tbody tr {
  transition: 
    background 0.25s ease,
    transform 0.25s ease,
    box-shadow 0.25s ease;
}

tbody tr:hover {
  background: linear-gradient(
    90deg,
    rgba(201,162,77,0.08),
    rgba(201,162,77,0.02)
  );
  transform: translateX(4px);
  box-shadow: inset 4px 0 0 var(--gold);
}

</style>
