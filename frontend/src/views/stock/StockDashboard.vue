<template>
  <div class="stock-page">
    <div class="header">
      <div>
        <h2>FNB Stock Dashboard</h2>
        <p class="subtitle">
          Kelola stok, harga modal, dan harga jual FNB terintegrasi dengan services.
        </p>
      </div>
      <button class="btn-primary" @click="openAdd">+ Add Stock</button>
    </div>

    <div class="stats">
      <div class="stat-card">
        <p>Total Items</p>
        <h3>{{ totalItems }}</h3>
      </div>
      <div class="stat-card warning">
        <p>Low Stock</p>
        <h3>{{ lowStockCount }}</h3>
      </div>
      <div class="stat-card danger">
        <p>Out of Stock</p>
        <h3>{{ outOfStockCount }}</h3>
      </div>
    </div>
    <div class="card happy-hour-card">
      <h3>Pengaturan Jam Happy Hour</h3>
      <p class="subtitle">Atur jam aktif happy hour untuk FNB, SPA, dan LC.</p>
      <div class="happy-hour-grid">
        <div
          v-for="entry in happyHours"
          :key="entry.service_type"
          class="happy-hour-item"
        >
          <div class="happy-hour-title">{{ entry.service_type }}</div>
          <label>
            Mulai
            <input type="time" v-model="entry.start_time" class="input" />
          </label>
          <label>
            Selesai
            <input type="time" v-model="entry.end_time" class="input" />
          </label>
          <label class="inline-toggle">
            <span>Aktif</span>
            <input type="checkbox" v-model="entry.is_active" />
          </label>
          <button class="btn-primary" @click="saveHappyHour(entry)">
            Simpan
          </button>
        </div>
      </div>
    </div>

    <div class="filters">
      <input
        v-model="keyword"
        class="input"
        placeholder="Search item..."
      />

      <select v-model="statusFilter" class="select">
        <option value="ALL">All Status</option>
        <option value="LOW">Low Stock</option>
        <option value="OUT">Out of Stock</option>
      </select>

      <select v-model="selectedBranch" class="select">
        <option value="ALL">All Outlet</option>
        <option v-for="b in branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
      </select>

      <div class="per-page">
        <span>Show</span>
        <select v-model="perPage" class="select">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
      </div>
    </div>

    <div class="card table-card">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Outlet</th>
            <th>Stock</th>
            <th>Alert</th>
            <th>Harga Modal</th>
            <th>Harga Jual</th>
            <th>Minuman</th>
            <th>Happy Hour</th>
            <th>Paket</th>
            <th>Status</th>
            <th width="140">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="11" class="empty">Loading...</td>
          </tr>
          <tr v-else-if="!paginatedItems.length">
            <td colspan="11" class="empty">No stock items found</td>
          </tr>
          <tr
            v-for="item in paginatedItems"
            :key="item.id"
            class="row"
          >
            <td class="name">{{ item.name }}</td>
            <td>{{ item.branch_name || "-" }}</td>
            <td>{{ item.stock }}</td>
            <td>{{ item.alert_stock }}</td>
            <td>Rp {{ format(item.cost_price) }}</td>
            <td>Rp {{ format(item.sell_price) }}</td>
            <td>
              <span class="badge" :class="item.is_beverage ? 'success' : 'danger'">
                {{ item.is_beverage ? "YES" : "NO" }}
              </span>
            </td>
            <td>
              <span class="badge" :class="item.is_package ? 'warning' : 'danger'">
                {{ item.is_package ? "PAKET" : "NON-PAKET" }}
              </span>
            </td>
            <td>
              <div class="happy-hour">
                <span class="badge" :class="item.happy_hour_enabled ? 'success' : 'danger'">
                  {{ item.happy_hour_enabled ? "ON" : "OFF" }}
                </span>
                <span class="muted">Rp {{ format(item.happy_hour_price) }}</span>
              </div>
            </td>
            <td>
              <span
                class="badge"
                :class="statusClass(item)"
              >
                {{ statusLabel(item) }}
              </span>
            </td>
            <td class="actions">
              <button @click="openEdit(item)">Edit</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pagination-bar">
        <button @click="prevPage" :disabled="page === 1">Prev</button>
        <span>Page {{ page }} / {{ totalPages }}</span>
        <button @click="nextPage" :disabled="page === totalPages">Next</button>
      </div>
    </div>

    <transition name="modal-fade">
      <div v-if="showForm" class="modal-backdrop" @click.self="closeForm">
        <div class="modal">
          <h3>{{ editingItem ? "Edit Stock Item" : "Add Stock Item" }}</h3>
          <form class="form-grid" @submit.prevent="submitForm">
            <label>
              Nama Item
              <input v-model="form.name" class="input" required />
            </label>
            <label>
              Harga Modal
              <input
                v-model.number="form.cost_price"
                type="number"
                min="0"
                class="input"
                required
              />
            </label>
            <label>
              Harga Jual
              <input
                v-model.number="form.sell_price"
                type="number"
                min="0"
                class="input"
                required
              />
            </label>
            <label class="inline-toggle">
              <span>Minuman (Happy Hour)</span>
              <input v-model="form.is_beverage" type="checkbox" />
            </label>
            <label class="inline-toggle">
              <span>Paket Minuman</span>
              <input v-model="form.is_package" type="checkbox" />
            </label>
              <label>
              Qty Paket
              <input
                v-model.number="form.package_qty"
                type="number"
                min="0"
                class="input"
                :required="form.is_package"
              />
            </label>
            <label>
              Grup Paket
              <input v-model="form.package_group" class="input" placeholder="contoh: beer-330ml" />
            </label>
            <label>
              Harga Paket
              <input
                v-model.number="form.package_price"
                type="number"
                min="0"
                class="input"
                :disabled="!form.is_package"
              />
            </label>
            <label>
              Nama Paket (opsional)
              <input v-model="form.package_name" class="input" :disabled="!form.is_package" />
            </label>
            <label class="inline-toggle">
              <span>Happy Hour Aktif</span>
              <input v-model="form.happy_hour_enabled" type="checkbox" />
            </label>
            <label>
              Harga Happy Hour
              <input
                v-model.number="form.happy_hour_price"
                type="number"
                min="0"
                class="input"
                :disabled="!form.happy_hour_enabled"
              />
            </label>
            <label>
              Stock
              <input
                v-model.number="form.stock"
                type="number"
                min="0"
                class="input"
                required
              />
            </label>
            <label>
              Alert Stock
              <input
                v-model.number="form.alert_stock"
                type="number"
                min="0"
                class="input"
                required
              />
            </label>
            <div class="form-actions">
              <button type="button" class="btn-ghost" @click="closeForm">
                Cancel
              </button>
              <button type="submit" class="btn-primary">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue"
import Swal from "sweetalert2"
import "sweetalert2/dist/sweetalert2.min.css"
import api from "@/services/api"

const items = ref([])
const branches = ref([])
const selectedBranch = ref("ALL")
const loading = ref(false)
const keyword = ref("")
const statusFilter = ref("ALL")
const perPage = ref(10)
const page = ref(1)
const happyHours = ref([
  { service_type: "FNB", start_time: "17:00", end_time: "22:00", is_active: false },
  { service_type: "SPA", start_time: "17:00", end_time: "22:00", is_active: false },
  { service_type: "LC", start_time: "17:00", end_time: "22:00", is_active: false }
])
const showForm = ref(false)
const editingItem = ref(null)
const form = ref({
  name: "",
  cost_price: 0,
  sell_price: 0,
  is_beverage: false,
  is_package: false,
  package_qty: 0,
  package_group: '',
  package_price: 0,
  package_name: '',
  happy_hour_enabled: false,
  happy_hour_price: 0,
  stock: 0,
  alert_stock: 0
})

const loadItems = async () => {
  loading.value = true
  try {
    const params = selectedBranch.value !== "ALL" ? { branch_id: selectedBranch.value } : undefined
    const res = await api.get("/fnb", { params })
    items.value = res.data || []
  } catch (error) {
    console.error("Load FNB stock failed:", error)
    await Swal.fire({
      icon: "error",
      title: "Gagal memuat data",
      text: "Silakan coba lagi."
    })
  } finally {
    loading.value = false
  }
}

//onMounted(loadItems)
const loadHappyHours = async () => {
  try {
    const res = await api.get("/happy-hours")
    const data = res.data || []
    happyHours.value = happyHours.value.map(entry => {
      const match = data.find(row => row.service_type === entry.service_type)
      if (!match) return entry
      return {
        service_type: entry.service_type,
        start_time: match.start_time?.slice(0, 5) || entry.start_time,
        end_time: match.end_time?.slice(0, 5) || entry.end_time,
        is_active: Boolean(match.is_active)
      }
    })
  } catch (error) {
    console.error("Load happy hours failed:", error)
  }
}

const saveHappyHour = async (entry) => {
  try {
    await api.put(`/happy-hours/${entry.service_type}`, {
      start_time: entry.start_time,
      end_time: entry.end_time,
      is_active: Boolean(entry.is_active)
    })
    await Swal.fire({
      icon: "success",
      title: "Berhasil",
      text: "Jam happy hour tersimpan."
    })
  } catch (error) {
    console.error("Save happy hours failed:", error)
    await Swal.fire({
      icon: "error",
      title: "Gagal menyimpan",
      text: "Periksa kembali data yang diinput."
    })
  }
}

const loadBranches = async () => {
  const res = await api.get("/superadmin/branches")
  branches.value = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : []
}

onMounted(async () => {
  await loadBranches()
  await loadItems()
  await loadHappyHours()
})

const filteredItems = computed(() => {
  const normalizedKeyword = keyword.value.toLowerCase()
  return items.value.filter(item => {
    if (selectedBranch.value !== "ALL" && String(item.branch_id) !== String(selectedBranch.value)) return false
    const matchesName = item.name?.toLowerCase().includes(normalizedKeyword)
    if (!matchesName) return false
    if (statusFilter.value === "LOW") {
      return item.stock > 0 && item.stock <= item.alert_stock
    }
    if (statusFilter.value === "OUT") {
      return item.stock <= 0
    }
    return true
  })
})

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredItems.value.length / perPage.value))
})

const paginatedItems = computed(() => {
  const start = (page.value - 1) * perPage.value
  return filteredItems.value.slice(start, start + perPage.value)
})

const totalItems = computed(() => items.value.length)
const lowStockCount = computed(() =>
  items.value.filter(item => item.stock > 0 && item.stock <= item.alert_stock).length
)
const outOfStockCount = computed(() =>
  items.value.filter(item => item.stock <= 0).length
)

watch([keyword, statusFilter, perPage, selectedBranch], () => {
  page.value = 1
})

watch(selectedBranch, () => {
  loadItems()
})

const openAdd = () => {
  editingItem.value = null
  form.value = {
    name: "",
    cost_price: 0,
    sell_price: 0,
    is_beverage: false,
    is_package: false,
    package_qty: 0,
    package_group: '',
    package_price: 0,
    package_name: '',
    happy_hour_enabled: false,
    happy_hour_price: 0,
    stock: 0,
    alert_stock: 0
  }
  showForm.value = true
}

const openEdit = (item) => {
  editingItem.value = item
  form.value = {
    name: item.name,
    cost_price: Number(item.cost_price || 0),
    sell_price: Number(item.sell_price || item.price || 0),
    is_beverage: Boolean(item.is_beverage),
    is_package: Boolean(item.is_package),
    package_qty: Number(item.package_qty || 0),
    package_group: item.package_group || '',
    package_price: Number(item.package_price || 0),
    package_name: item.package_name || '',
    happy_hour_enabled: Boolean(item.happy_hour_enabled),
    happy_hour_price: Number(item.happy_hour_price || 0),
    stock: Number(item.stock || 0),
    alert_stock: Number(item.alert_stock || 0)
  }
  showForm.value = true
}

const closeForm = () => {
  showForm.value = false
  editingItem.value = null
}

const submitForm = async () => {
  const payload = {
    name: form.value.name,
    cost_price: Number(form.value.cost_price || 0),
    sell_price: Number(form.value.sell_price || 0),
    is_beverage: Boolean(form.value.is_beverage),
    is_package: Boolean(form.value.is_package),
    package_qty: Number(form.value.package_qty || 0),
    package_group: form.value.package_group || null,
    package_price: form.value.is_package ? Number(form.value.package_price || 0) : null,
    package_name: form.value.is_package ? (form.value.package_name || null) : null,
    happy_hour_enabled: Boolean(form.value.happy_hour_enabled),
    happy_hour_price: form.value.happy_hour_enabled
      ? Number(form.value.happy_hour_price || 0)
      : null,
    stock: Number(form.value.stock || 0),
    alert_stock: Number(form.value.alert_stock || 0)
  }

  try {
    if (editingItem.value) {
      await api.put(`/fnb/${editingItem.value.id}`, payload)
    } else {
      await api.post("/fnb", payload)
    }
    await loadItems()
    closeForm()
    await Swal.fire({
      icon: "success",
      title: "Berhasil",
      text: "Data stok FNB tersimpan."
    })
  } catch (error) {
    console.error("Save FNB stock failed:", error)
    await Swal.fire({
      icon: "error",
      title: "Gagal menyimpan",
      text: "Periksa kembali data yang diinput."
    })
  }
}

const prevPage = () => {
  if (page.value > 1) page.value -= 1
}

const nextPage = () => {
  if (page.value < totalPages.value) page.value += 1
}

const statusLabel = (item) => {
  if (item.stock <= 0) return "OUT"
  if (item.stock <= item.alert_stock) return "LOW"
  return "SAFE"
}

const statusClass = (item) => {
  if (item.stock <= 0) return "danger"
  if (item.stock <= item.alert_stock) return "warning"
  return "success"
}

const format = (value) => Number(value || 0).toLocaleString("id-ID")
</script>

<style scoped>
.stock-page {
  padding: 24px;
  color: #fff;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.subtitle {
  color: #9b9b9b;
  font-size: 13px;
}

.btn-primary {
  background: #c9a24d;
  color: #000;
  padding: 10px 16px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.btn-primary:hover {
  transform: translateY(-2px);
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.stat-card {
  background: linear-gradient(145deg, #0e0e0e, #151515);
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 12px 40px rgba(0,0,0,.45);
  transition: transform .25s ease-in-out;
}

.stat-card:hover {
  transform: translateY(-4px);
}

.stat-card.warning h3 {
  color: #f1c40f;
}

.stat-card.danger h3 {
  color: #e74c3c;
}

.filters {
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.per-page {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #aaa;
}

.input,
.select {
  background: #111;
  border: 1px solid #222;
  padding: 8px 12px;
  border-radius: 12px;
  color: #fff;
}

.card {
  background: #111;
  border-radius: 16px;
  padding: 16px;
  margin-top: 20px;
  box-shadow: 0 12px 40px rgba(0,0,0,.45);
}
.happy-hour-card h3 {
  margin: 0 0 6px;
}

.happy-hour-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.happy-hour-item {
  background: #0f0f0f;
  border: 1px solid #222;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.happy-hour-title {
  font-weight: 600;
  color: #c9a24d;
}


table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  color: #aaa;
  font-size: 12px;
  padding: 12px;
}

td {
  padding: 12px;
  border-top: 1px solid #222;
}

.row {
  transition: background 0.2s ease-in-out;
}

.row:hover {
  background: rgba(201,162,77,.08);
}

.name {
  font-weight: 600;
}

.badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
}

.badge.success {
  background: rgba(39,174,96,.2);
  color: #2ecc71;
}

.badge.warning {
  background: rgba(241,196,15,.2);
  color: #f1c40f;
}

.badge.danger {
  background: rgba(231,76,60,.2);
  color: #e74c3c;
}

.happy-hour {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.muted {
  color: #9b9b9b;
  font-size: 12px;
}

.actions button {
  background: transparent;
  border: 1px solid #c9a24d;
  color: #c9a24d;
  padding: 6px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: all .2s ease-in-out;
}

.actions button:hover {
  background: #c9a24d;
  color: #000;
}

.pagination-bar {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
  align-items: center;
}

.pagination-bar button {
  border: none;
  background: #222;
  color: #fff;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background .2s ease-in-out;
}

.pagination-bar button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty {
  text-align: center;
  padding: 24px;
  color: #888;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 50;
}

.modal {
  background: #151515;
  padding: 24px;
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 30px 80px rgba(0,0,0,.55);
  animation: slideIn .25s ease-in-out;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #bbb;
  font-size: 13px;
}

.inline-toggle {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 12px;
  background: #101010;
  border: 1px solid #222;
}

.inline-toggle input {
  width: 18px;
  height: 18px;
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}

.btn-ghost {
  background: transparent;
  border: 1px solid #333;
  color: #ddd;
  padding: 8px 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: all .2s ease-in-out;
}

.btn-ghost:hover {
  border-color: #c9a24d;
  color: #c9a24d;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity .25s ease-in-out;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@keyframes slideIn {
  from {
    transform: translateY(12px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .header {
    flex-direction: column;
    align-items: flex-start;
  }

  table {
    display: block;
    overflow-x: auto;
  }
}
</style>