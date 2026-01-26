<template>
  <div class="page">
    <div class="header">
      <div>
        <h2>Branches</h2>
        <p class="subtitle">Manage company branches</p>
      </div>

      <button class="btn-primary" @click="openAdd">
        + Add Branch
      </button>
    </div>

    <div class="card table-card">
      <div class="table-wrapper">
        <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Address</th>
            <th>Operating Hours</th>
            <th>Users</th>
            <th>Status</th>
            <th width="200">Actions</th>
          </tr>
        </thead>

        <tbody>
          <!-- LOADING -->
          <tr v-if="loading">
            <td colspan="6" class="empty">Loading...</td>
          </tr>

          <!-- EMPTY -->
          <tr v-else-if="!branches.length">
            <td colspan="6" class="empty">No branches found</td>
          </tr>

          <!-- DATA -->
          <tr v-else v-for="b in branches" :key="b.id" class="row">
            <td class="bold">{{ b.name }}</td>
            <td>{{ b.address || "-" }}</td>
            <td>{{ b.open_time }} - {{ b.close_time }}</td>
            <td>{{ b.user_count }}</td>
            <td>
              <span
                class="badge"
                :class="b.is_active ? 'success' : 'danger'"
              >
                {{ b.is_active ? "ACTIVE" : "DISABLED" }}
              </span>
            </td>
            <td class="actions">
              <button @click="edit(b)">Edit</button>
              <button
                :class="b.is_active ? 'danger' : 'success'"
                @click="toggle(b)"
              >
                {{ b.is_active ? "Disable" : "Enable" }}
              </button>
            </td>
               
            <td class="actions">
  <button class="btn-outline" @click="editBranch(b)">Edit</button>

  <button
    class="btn-gold"
    v-if="b.id !== 1"
    @click="cloneServices(b.id)"
  >
    Clone Services
  </button>
</td> 

          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <BranchForm
      v-if="showForm"
      :edit="!!selected"
      :data="selected"
      @saved="reload"
      @close="close"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import api from "@/services/api"
import BranchForm from "./BranchForm.vue"

const branches = ref([])
const loading = ref(false)
const showForm = ref(false)
const selected = ref(null)

const load = async () => {
  loading.value = true
  try {
    const res = await api.get("/branches")
    branches.value = res.data.data   // ?? INI YANG PENTING
  } catch (e) {
    console.error("Failed load branches", e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

const openAdd = () => {
  selected.value = null
  showForm.value = true
}

const edit = (b) => {
  selected.value = { ...b }
  showForm.value = true
}

const toggle = async (b) => {
  await api.put(`/branches/${b.id}/toggle`)
  b.is_active = !b.is_active
}

const reload = async () => {
  showForm.value = false
  await load()
}

const close = () => {
  showForm.value = false
  selected.value = null
}

const cloneServices = async (branchId) => {
  const ok = confirm(
    "Clone all services from Pondok Indah?\n" +
    "Services will be INACTIVE by default."
  )
  if (!ok) return

  try {
    await api.post("/services/clone-from-template", {
      target_branch_id: branchId
    })

    alert("? Services cloned successfully (DRAFT)")
  } catch (err) {
    console.error(err)
    alert(err.response?.data?.message || "Clone failed")
  }
}

</script>

<style scoped>
.page {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.subtitle {
  color: #aaa;
  font-size: 13px;
}

.card {
  background: #111;
  border-radius: 10px;
  padding: 16px;
  margin-top: 16px;
}

.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
}

th {
  color: #aaa;
  text-align: left;
  padding: 10px;
}

td {
  padding: 10px;
  border-top: 1px solid #222;
}

.row:hover {
  background: rgba(201,162,77,0.08);
}

.bold {
  font-weight: 600;
}

.badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
}

.success {
  background: rgba(39,174,96,.2);
  color: #2ecc71;
}

.danger {
  background: rgba(192,57,43,.2);
  color: #e74c3c;
}

.actions button {
  margin-right: 6px;
}

.empty {
  text-align: center;
  padding: 30px;
  color: #777;
}

.btn-primary {
  background: #C9A24D;
  color: black;
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-gold {
  background: linear-gradient(135deg,#C9A24D,#F5D27A);
  color: black;
  border: none;
  padding: 6px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  transition: all .2s ease;
}

.btn-gold:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(201,162,77,.4);
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

  .actions {
    flex-direction: column;
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

  .card {
    padding: 12px;
  }

  th, td {
    padding: 8px;
    font-size: 12px;
  }
}
</style>
