<template>
  <div class="page">

    <!-- HEADER -->
    <div class="header">
      <div>
        <h2>User Management</h2>
        <p class="subtitle">Manage system users & access</p>
      </div>
      <button class="btn-primary" @click="openAdd">+ Add User</button>
    </div>
    <!-- STATS -->
<div class="stats">
  <div class="stat-card">
    <p>Total Users</p>
    <h3>{{ stats.total }}</h3>
  </div>

  <div class="stat-card active">
    <p>Active</p>
    <h3>{{ stats.active }}</h3>
  </div>

  <div class="stat-card disabled">
    <p>Disabled</p>
    <h3>{{ stats.disabled }}</h3>
  </div>

  <div class="stat-card new">
    <p>New This Month</p>
    <h3>+{{ stats.new_month }}</h3>
  </div>
</div>

    <!-- FILTER -->
    <div class="card filter">
      <input v-model="q" placeholder="Search username..." />
      <select v-model="role">
        <option value="">All Roles</option>
        <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
      </select>
      <button class="btn-outline" @click="load" :disabled="loading">
        {{ loading ? "Loading..." : "Search" }}
      </button>
    </div>

    <!-- BULK BAR -->
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
      <div class="table-wrapper">
        <table>
          <thead>
    <tr>
      <th width="40">
        <input
          type="checkbox"
          v-model="selectAll"
          @change="toggleAll"
        />
      </th>
      <th>Full Name</th>
      <th>Username</th>
      <th>Phone</th>
      <th>Role</th>
      <th>Branch</th>
      <th>Status</th>
      <th width="260">Actions</th>
    </tr>
  </thead>


        <transition-group name="fade" tag="tbody">
          <!-- LOADING -->
          <tr v-if="loading" v-for="i in limit" :key="'sk'+i">
            <td colspan="6"><div class="skeleton"></div></td>
          </tr>

          <!-- EMPTY -->
          <tr v-else-if="!users.length" key="empty">
            <td colspan="6" class="empty">No users found</td>
          </tr>

          <!-- DATA -->
          <tr
  v-for="u in users"
  :key="u.id"
  class="fade-row"
>
  <!-- CHECKBOX -->
  <td>
    <input
      type="checkbox"
      :value="u.id"
      v-model="selectedIds"
    />
  </td>

  <!-- FULL NAME -->
  <td class="name">
    {{ u.name }}
  </td>

  <!-- USERNAME -->
  <td class="username">
    {{ u.username }}
  </td>

  <!-- PHONE -->
  <td class="phone">
    {{ u.phone }}
  </td>

  <!-- ROLE -->
  <td>
    <span class="badge role">{{ u.role }}</span>
  </td>

  <!-- BRANCH -->
  <td>
    {{ u.branch || "-" }}
  </td>

  <!-- STATUS -->
  <td>
    <span
      class="badge"
      :class="u.is_active ? 'success' : 'danger'"
    >
      {{ u.is_active ? "ACTIVE" : "DISABLED" }}
    </span>
  </td>

  <!-- ACTIONS -->
  <td class="actions">
    <button @click="edit(u)">Edit</button>
    <button class="warn" @click="reset(u)">Reset PW</button>
    <button
      :class="u.is_active ? 'danger' : 'success'"
      @click="toggle(u)"
    >
      {{ u.is_active ? "Disable" : "Enable" }}
    </button>
  </td>
</tr>

        </transition-group>
      </table>
      </div>

      <!-- PAGINATION -->
      <div class="pagination">
        <button :disabled="page===1" @click="prev">Prev</button>
        <span>Page {{ page }}</span>
        <button :disabled="page*limit>=total" @click="next">Next</button>
      </div>
    </div>

    <!-- MODAL -->
    <transition name="fade">
      <UserForm
        v-if="showForm"
        :edit="!!selected"
        :data="selected"
        @saved="reload"
        @close="close"
      />
    </transition>

  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import api from "../../services/api"
import UserForm from "./UserForm.vue"

/* STATE */
const users = ref([])
const showForm = ref(false)
const selected = ref(null)

const selectedIds = ref([])
const selectAll = ref(false)

const q = ref("")
const role = ref("")
const page = ref(1)
const limit = 10
const total = ref(0)
const loading = ref(false)

const roles = ["SuperAdmin","Owner","Manager","Kasir","Terapis"]
const stats = ref({
  total: 0,
  active: 0,
  disabled: 0,
  new_month: 0
})

/* LOAD */
const load = async () => {
  loading.value = true
  try {
    const [usersRes, statsRes] = await Promise.all([
      api.get("/users/search", {
        params: {
          q: q.value,
          role: role.value,
          page: page.value,
          limit
        }
      }),
      api.get("/users/stats")
    ])

    users.value = usersRes.data.data
    total.value = usersRes.data.total
    stats.value = statsRes.data

    selectedIds.value = []
    selectAll.value = false
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* PAGINATION */
const next = () => { page.value++; load() }
const prev = () => { if (page.value>1) { page.value--; load() } }

/* ACTION */
const openAdd = () => { selected.value=null; showForm.value=true }
const edit = u => { selected.value={...u}; showForm.value=true }

const reset = async u => {
  if (!confirm(`Reset password ${u.username}?`)) return
  await api.put(`/users/${u.id}/reset-password`)
  alert("Password reset to 123456")
}

const toggle = async u => {
  await api.put(`/users/${u.id}/toggle`)
  u.is_active = !u.is_active
}

const reload = async () => {
  showForm.value=false
  await load()
}

const close = () => {
  showForm.value=false
  selected.value=null
}

/* BULK */
const toggleAll = () => {
  selectedIds.value = selectAll.value ? users.value.map(u=>u.id) : []
}

const bulkToggle = async () => {
  if (!confirm("Toggle active selected users?")) return
  for (const id of selectedIds.value) {
    await api.put(`/users/${id}/toggle`)
  }
  load()
}

const bulkDelete = async () => {
  if (!confirm("Delete selected users?")) return
  for (const id of selectedIds.value) {
    await api.delete(`/users/${id}`)
  }
  load()
}
</script>

<style scoped>
.page { padding:24px }

/* HEADER */
.header {
  display:flex;
  justify-content:space-between;
  align-items:center;
}
.subtitle { color:#888; font-size:13px }

/* CARD */
.card {
  background:#111;
  border-radius:14px;
  padding:16px;
  margin-top:16px;
  box-shadow:0 10px 30px rgba(0,0,0,.4);
}

/* FILTER */
.filter { display:flex; gap:12px; flex-wrap: wrap; }
.filter input,
.filter select {
  background:#000;
  border:1px solid #333;
  color:#fff;
  padding:8px;
  border-radius:10px;
  flex: 1;
  min-width: 150px;
}

/* BULK */
.bulk-bar {
  margin-top:12px;
  padding:12px;
  background:rgba(201,162,77,.1);
  border:1px solid #c9a24d;
  border-radius:12px;
  display:flex;
  justify-content:space-between;
  flex-wrap: wrap;
  gap: 12px;
}

/* TABLE */
.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

table { width:100%; border-collapse:collapse; min-width: 800px; }
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
.username { font-weight:600 }

/* BADGE */
.badge {
  padding:4px 10px;
  border-radius:12px;
  font-size:12px;
}
.success {
  background:rgba(39,174,96,.2);
  color:#2ecc71;
}
.danger {
  background:rgba(192,57,43,.2);
  color:#e74c3c;
}
.role {
  background:rgba(201,162,77,.2);
  color:#c9a24d;
}

/* BUTTON */
button {
  border:none;
  padding:8px 12px;
  border-radius:10px;
  cursor:pointer;
  transition:all .15s ease;
}
button:hover { filter:brightness(1.1) }
button:active { transform:scale(.96) }

.btn-primary { background:#c9a24d; color:#000 }
.btn-outline { background:none; border:1px solid #c9a24d; color:#c9a24d }
.warn { background:#f39c12 }
.actions button { margin-right:6px }

/* PAGINATION */
.pagination {
  display:flex;
  justify-content:center;
  gap:12px;
  margin-top:16px;
  flex-wrap: wrap;
}

/* SKELETON */
.skeleton {
  height:14px;
  border-radius:8px;
  background:linear-gradient(90deg,#222 25%,#333 37%,#222 63%);
  background-size:400% 100%;
  animation:skeleton 1.4s infinite;
}
@keyframes skeleton {
  0%{background-position:100% 0}
  100%{background-position:0 0}
}

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

.name {
  font-weight: 600;
}
.username {
  font-weight: 500;
}
.phone {
  color: var(--text-muted);
  font-size: 13px;
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

/* BUTTON HOVER */
.actions button {
  transition: 
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.actions button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0,0,0,.4);
  opacity: .95;
}

/* CHECKBOX HOVER */
input[type="checkbox"] {
  cursor: pointer;
  accent-color: var(--gold);
}

/* RESPONSIVE STYLES */
@media (max-width: 768px) {
  .page {
    padding: 16px;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .header .btn-primary {
    width: 100%;
  }

  .stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-card {
    padding: 14px;
  }

  .stat-card h3 {
    font-size: 24px;
  }

  .filter {
    flex-direction: column;
  }

  .filter input,
  .filter select {
    width: 100%;
  }

  .bulk-bar {
    flex-direction: column;
    text-align: center;
  }

  .bulk-bar > div {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .actions button {
    margin-right: 0;
    width: 100%;
  }
}

@media (max-width: 480px) {
  .page {
    padding: 12px;
  }

  .stats {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .stat-card {
    padding: 12px;
  }

  .stat-card h3 {
    font-size: 22px;
  }

  .card {
    padding: 12px;
  }

  th, td {
    padding: 8px;
    font-size: 12px;
  }
}

</style>
