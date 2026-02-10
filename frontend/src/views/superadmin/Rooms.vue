<template>
  <div class="rooms-page">
    <div class="header">
      <div>
        <h2>Rooms / Table / KTV</h2>
        <p>Kelola resource ruangan untuk timer POS</p>
      </div>
      <button class="btn-primary" @click="openCreate">+ Room Baru</button>
    </div>

    <div class="filters">
      <select v-model="selectedBranchId" @change="fetchRooms">
        <option value="">Semua Branch</option>
        <option v-for="b in branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
      </select>
      <select v-model="selectedType" @change="fetchRooms">
        <option value="">Semua Tipe</option>
        <option value="SPA">SPA</option>
        <option value="LC">LC/TABLE</option>
        <option value="LOUNGE">LOUNGE/SOFA</option>
        <option value="KTV">KTV</option>
      </select>
      <button class="btn-light" @click="fetchRooms">Refresh</button>
    </div>

    <table class="rooms-table">
      <thead>
        <tr>
          <th>Nama</th>
          <th>Tipe</th>
          <th>Branch</th>
          <th>Status</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading"><td colspan="5">Memuat data...</td></tr>
        <tr v-else-if="filteredRooms.length === 0"><td colspan="5">Belum ada room</td></tr>
        <tr v-else v-for="r in filteredRooms" :key="r.id">
          <td>{{ r.name }}</td>
          <td>{{ r.type }}</td>
          <td>{{ r.branch_name || '-' }}</td>
          <td>
            <span class="badge" :class="r.is_active ? 'active' : 'inactive'">
              {{ r.is_active ? (r.is_occupied ? 'Active • Occupied' : 'Active') : 'Inactive' }}
            </span>
          </td>
          <td class="actions">
            <button class="btn-light" @click="openEdit(r)">Edit</button>
            <button class="btn-light" @click="toggleRoom(r)">
              {{ r.is_active ? 'Disable' : 'Enable' }}
            </button>
            <button class="btn-danger" @click="removeRoom(r)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showForm" class="modal-backdrop" @click.self="closeForm">
      <div class="modal">
        <h3>{{ form.id ? 'Edit Room' : 'Tambah Room' }}</h3>
        <div class="form-grid">
          <label>
            Nama
            <input v-model="form.name" type="text" placeholder="Contoh: ROOM 301" />
          </label>
          <label>
            Tipe
            <select v-model="form.type">
              <option value="SPA">SPA</option>
              <option value="LC">LC/TABLE</option>
              <option value="LOUNGE">LOUNGE/SOFA</option>
        <option value="KTV">KTV</option>
            </select>
          </label>
          <label>
            Branch
            <select v-model="form.branch_id" :disabled="Boolean(form.id)">
              <option value="">Pilih branch</option>
              <option v-for="b in branches" :key="`f-${b.id}`" :value="String(b.id)">{{ b.name }}</option>
            </select>
          </label>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="modal-actions">
          <button class="btn-light" @click="closeForm">Batal</button>
          <button class="btn-primary" @click="saveRoom" :disabled="saving">{{ saving ? 'Menyimpan...' : 'Simpan' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '@/services/api'

const rooms = ref([])
const branches = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const selectedBranchId = ref('')
const selectedType = ref('')

const showForm = ref(false)
const form = ref({ id: null, name: '', type: 'SPA', branch_id: '' })

const filteredRooms = computed(() => {
  return rooms.value.filter(r => {
    if (selectedType.value && r.type !== selectedType.value) return false
    return true
  })
})

const fetchBranches = async () => {
  const res = await api.get('/branches')
  branches.value = res.data?.data || res.data || []
  if (!selectedBranchId.value && branches.value.length) {
    selectedBranchId.value = String(branches.value[0].id)
  }
}

const fetchRooms = async () => {
  try {
    loading.value = true
    const params = { include_inactive: true }
    if (selectedBranchId.value) params.branch_id = Number(selectedBranchId.value)
    const res = await api.get('/rooms', { params })
    rooms.value = Array.isArray(res.data) ? res.data : []
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  error.value = ''
  form.value = {
    id: null,
    name: '',
    type: 'SPA',
    branch_id: selectedBranchId.value || ''
  }
  showForm.value = true
}

const openEdit = (room) => {
  error.value = ''
  form.value = {
    id: room.id,
    name: room.name,
    type: room.type,
    branch_id: String(room.branch_id || '')
  }
  showForm.value = true
}

const closeForm = () => {
  showForm.value = false
}

const saveRoom = async () => {
  error.value = ''
  if (!form.value.name.trim()) {
    error.value = 'Nama room wajib diisi'
    return
  }
  if (!form.value.branch_id) {
    error.value = 'Branch wajib dipilih'
    return
  }

  try {
    saving.value = true
    const payload = {
      name: form.value.name.trim(),
      type: form.value.type,
      branch_id: Number(form.value.branch_id)
    }

    if (form.value.id) {
      await api.put(`/rooms/${form.value.id}`, payload)
    } else {
      await api.post('/rooms', payload)
    }

    showForm.value = false
    await fetchRooms()
  } catch (err) {
    error.value = err.response?.data?.message || 'Gagal menyimpan room'
  } finally {
    saving.value = false
  }
}

const toggleRoom = async (room) => {
  try {
    await api.put(`/rooms/${room.id}/toggle`)
    await fetchRooms()
  } catch (err) {
    alert(err.response?.data?.message || 'Gagal mengubah status room')
  }
}

const removeRoom = async (room) => {
  const ok = window.confirm(`Hapus room ${room.name}?`)
  if (!ok) return

  try {
    await api.delete(`/rooms/${room.id}`)
    await fetchRooms()
  } catch (err) {
    alert(err.response?.data?.message || 'Gagal menghapus room')
  }
}

onMounted(async () => {
  await fetchBranches()
  await fetchRooms()
})
</script>

<style scoped>
.rooms-page { color: #fff; }
.header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
.filters { display:flex; gap:8px; margin-bottom:16px; }
.rooms-table { width:100%; border-collapse: collapse; }
.rooms-table th,.rooms-table td { border-bottom:1px solid #2a2a2a; padding:10px; text-align:left; }
.badge { padding:4px 8px; border-radius:8px; font-size:12px; }
.badge.active { background:#1f7a47; }
.badge.inactive { background:#6b2d2d; }
.actions { display:flex; gap:6px; }
.btn-primary,.btn-light,.btn-danger { border:none; border-radius:8px; padding:8px 12px; cursor:pointer; }
.btn-primary { background:#c9a24d; color:#111; }
.btn-light { background:#2b2b2b; color:#fff; }
.btn-danger { background:#b53b3b; color:#fff; }
.modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:999; }
.modal { width:420px; background:#111; border:1px solid #333; border-radius:12px; padding:16px; }
.form-grid { display:grid; gap:10px; margin-top:10px; }
label { display:grid; gap:6px; font-size:14px; }
input,select { background:#1a1a1a; color:#fff; border:1px solid #333; border-radius:8px; padding:10px; }
.error { color:#ff6b6b; font-size:13px; margin-top:8px; }
.modal-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:14px; }
</style>
