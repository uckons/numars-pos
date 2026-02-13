<template>
  <div class="page">
    <div class="header">
      <div>
        <h2>Branches</h2>
        <p class="subtitle">Manage company branches</p>
      </div>
      <button class="btn-primary" @click="openAdd">+ Add Branch</button>
    </div>

    <div class="card table-card">
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Address</th><th>Operating Hours</th><th>Users</th><th>Status</th><th width="260">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="6" class="empty">Loading...</td></tr>
          <tr v-else-if="!branches.length"><td colspan="6" class="empty">No branches found</td></tr>
          <tr v-else v-for="b in branches" :key="b.id" class="row">
            <td class="bold">{{ b.name }}</td>
            <td>{{ b.address || '-' }}</td>
            <td>{{ b.open_time }} - {{ b.close_time }}</td>
            <td>{{ b.user_count || 0 }}</td>
            <td><span class="badge" :class="b.is_active ? 'success' : 'danger'">{{ b.is_active ? 'ACTIVE' : 'DISABLED' }}</span></td>
            <td class="actions">
              <button @click="edit(b)">Edit</button>
              <button :class="b.is_active ? 'danger' : 'success'" @click="toggle(b)">{{ b.is_active ? 'Disable' : 'Enable' }}</button>
              <button class="btn-gold" v-if="b.id !== 1" @click="cloneServices(b.id)">Clone Services</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BranchForm v-if="showForm" :edit="!!selected" :data="selected" @saved="reload" @close="close" />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import api from "@/services/api"
import BranchForm from "./BranchForm.vue"
import Swal from "sweetalert2"

const branches = ref([])
const loading = ref(false)
const showForm = ref(false)
const selected = ref(null)

const load = async () => {
  loading.value = true
  try {
    const res = await api.get("/superadmin/branches")
    branches.value = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : []
  } catch (e) {
    console.error("Failed load branches", e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

const openAdd = () => { selected.value = null; showForm.value = true }
const edit = (b) => { selected.value = { ...b }; showForm.value = true }
const toggle = async (b) => { await api.put(`/branches/${b.id}/toggle`); b.is_active = !b.is_active }
const reload = async () => { showForm.value = false; await load() }
const close = () => { showForm.value = false; selected.value = null }

const cloneServices = async (branchId) => {
  const result = await Swal.fire({
    title: "Clone Services?",
    text: "Clone all services from Pondok Indah? Services will be INACTIVE by default.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, Clone",
    cancelButtonText: "Cancel",
    background: "#111",
    color: "#fff",
    confirmButtonColor: "#c9a24d",
    cancelButtonColor: "#666"
  })
  if (!result.isConfirmed) return
  try {
    Swal.fire({ title: "Cloning Services...", text: "Please wait", allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: "#111", color: "#fff" })
    await api.post("/services/clone-from-template", { target_branch_id: branchId })
    await load()
    await Swal.fire({ icon: "success", title: "Success!", text: "Services cloned successfully (DRAFT)", timer: 2000, showConfirmButton: false, background: "#111", color: "#fff" })
  } catch (err) {
    await Swal.fire({ icon: "error", title: "Clone Failed", text: err.response?.data?.message || "Failed to clone services", background: "#111", color: "#fff", confirmButtonColor: "#c9a24d" })
  }
}
</script>

<style scoped>
.page { padding: 20px; }
.header { display: flex; justify-content: space-between; align-items: center; }
.subtitle { color: #aaa; font-size: 13px; }
.card { background: #111; border-radius: 10px; padding: 16px; margin-top: 16px; }
table { width: 100%; border-collapse: collapse; }
th { color: #aaa; text-align: left; padding: 10px; }
td { padding: 10px; border-top: 1px solid #222; }
.row:hover { background: rgba(201,162,77,0.08); }
.bold { font-weight: 600; }
.badge { padding: 4px 10px; border-radius: 12px; font-size: 12px; }
.success { background: rgba(39,174,96,.2); color: #2ecc71; }
.danger { background: rgba(192,57,43,.2); color: #e74c3c; }
.actions { display: flex; gap: 8px; }
.actions button { background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
.actions .btn-gold { border-color: #c9a24d; color: #c9a24d; }
.btn-primary { background: #c9a24d; color: #000; border: none; border-radius: 8px; padding: 10px 16px; cursor: pointer; }
.empty { text-align: center; color: #888; }
</style>
