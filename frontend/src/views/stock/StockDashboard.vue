<template>
  <div class="stock-page">
    <div class="header">
      <div>
        <h2>FNB Stock Dashboard</h2>
        <p class="subtitle">
          Kelola stok, harga modal, dan harga jual FNB terintegrasi dengan services.
        </p>
      </div>
      <div class="header-actions">
        <button v-if="canManageStock" class="btn-danger" @click="removeDuplicates">Hapus Item Double</button>
        <button v-if="canManageStock" class="btn-primary" @click="openAdd">+ Add Stock</button>
      </div>
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
      <p class="subtitle">Atur jam aktif happy hour untuk FNB, SPA, dan LC per outlet.</p>
      <div class="filters" style="margin-top:10px">
        <select v-model="happyHourBranchId" class="select" @change="loadHappyHours">
          <option value="">Pilih Outlet Happy Hour</option>
          <option v-for="b in branches" :key="`hh-${b.id}`" :value="String(b.id)">{{ b.name }}</option>
        </select>
      </div>
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
            <th>Membership Tag</th>
            <th>Status</th>
            <th>Group</th>
            <th width="200">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="13" class="empty">Loading...</td>
          </tr>
          <tr v-else-if="!paginatedItems.length">
            <td colspan="13" class="empty">No stock items found</td>
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
              <span v-if="item.package_special" class="badge success" style="margin-left:6px">PAKET KHUSUS</span>
            </td>
            <td>
              <span class="badge" :class="item.membership_tag ? 'success' : 'danger'">{{ item.membership_tag ? 'YA' : 'TIDAK' }}</span>
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
            <td>{{ item.item_group || "NORMAL" }}</td>
            <td class="actions">
              <button v-if="canManageStock" @click="openEdit(item)">Edit</button>
              <button v-if="canManageStock" class="danger" @click="deleteItem(item)">Delete</button>
              <span v-if="!canManageStock" class="muted">View only</span>
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
          <div class="modal-header">
          <h3>{{ editingItem ? "Edit Stock Item" : "Add Stock Item" }}</h3>
          <button class="btn-ghost" @click="closeForm" type="button">✕</button>
        </div>
          <form class="form-grid" @submit.prevent="submitForm">
            <label>
              Outlet
              <select v-model="form.branch_id" class="input" :disabled="Boolean(editingItem)">
                <option value="">Pilih Outlet</option>
                <option v-for="b in branches" :key="`fb-${b.id}`" :value="String(b.id)">{{ b.name }}</option>
              </select>
            </label>
            <label>
              Nama Item
              <input v-model="form.name" class="input" required />
            </label>
            <label>
              Item Group
              <select v-model="form.item_group" class="input">
                <option value="NORMAL">Normal</option>
                <option value="VARIAN">Varian</option>
                <option value="CUSTOM">Custom</option>
              </select>
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
            <div class="section-title">Pengaturan Paket & Happy Hour</div>
            <label class="inline-toggle">
              <span>Minuman (Happy Hour)</span>
              <input v-model="form.is_beverage" type="checkbox" />
            </label>
            <label class="inline-toggle">
              <span>Paket Minuman</span>
              <input v-model="form.is_package" type="checkbox" />
            </label>
            <label class="inline-toggle">
              <span>Tag Membership (diskon member)</span>
              <input v-model="form.membership_tag" type="checkbox" />
            </label>
            <label class="inline-toggle" v-if="form.is_package">
              <span>Paket Khusus (stok ikut varian)</span>
              <input v-model="form.package_special" type="checkbox" />
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
            <div class="ktv-tag-wrapper">
              <div class="ktv-tag-title">KTV Group Tags</div>
              <div v-for="tag in KTV_TAG_OPTIONS" :key="`tag-${tag}`" class="ktv-tag-row">
                <label class="ktv-tag-check">
                  <input type="checkbox" :checked="isKtvTagChecked(tag)" @change="toggleKtvTag(tag, $event.target.checked)" />
                  <span>{{ tag }}</span>
                </label>
                <input
                  type="number"
                  min="0"
                  class="input ktv-tag-qty"
                  :disabled="!isKtvTagChecked(tag)"
                  :value="Number(form.ktv_group_default_qty?.[tag] || 0)"
                  @input="setKtvTagQty(tag, $event.target.value)"
                  placeholder="Default Qty"
                />
              </div>
            </div>
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
            <div class="section-title">Persediaan</div>
            <label>
              Stock
              <input
                v-model.number="form.stock"
                type="number"
                min="0"
                class="input"
                :disabled="form.package_special"
                :required="!form.package_special"
              />
            </label>
            <label>
              Alert Stock
              <input
                v-model.number="form.alert_stock"
                type="number"
                min="0"
                class="input"
                :disabled="form.package_special"
                :required="!form.package_special"
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
import { useAuthStore } from "@/store/auth.store"

const auth = useAuthStore()
const items = ref([])
const branches = ref([])
const selectedBranch = ref("ALL")
const happyHourBranchId = ref("")
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
const KTV_TAG_OPTIONS = ["KTV", "KTV-2K", "KTV-3K", "KTV-4K"]

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
  package_special: false,
  happy_hour_enabled: false,
  happy_hour_price: 0,
  stock: 0,
  alert_stock: 0,
  branch_id: "",
  item_group: "NORMAL",
  ktv_group_tags: [],
  ktv_default_qty: 0,
  ktv_group_default_qty: {}
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
    if (!happyHourBranchId.value) return
    const res = await api.get("/happy-hours", { params: { branch_id: happyHourBranchId.value } })
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
      branch_id: Number(happyHourBranchId.value),
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
  if (branches.value.length) {
    happyHourBranchId.value = String(branches.value[0].id)
  }
  await loadItems()
  await loadHappyHours()
})

const hasManagedStock = (item) => !Boolean(item?.package_special)

const filteredItems = computed(() => {
  const normalizedKeyword = keyword.value.toLowerCase()
  return items.value.filter(item => {
    if (selectedBranch.value !== "ALL" && String(item.branch_id) !== String(selectedBranch.value)) return false
    const matchesName = item.name?.toLowerCase().includes(normalizedKeyword)
    if (!matchesName) return false
    if (statusFilter.value === "LOW") {
      return hasManagedStock(item) && item.stock > 0 && item.stock <= item.alert_stock
    }
    if (statusFilter.value === "OUT") {
      return hasManagedStock(item) && item.stock <= 0
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
  items.value.filter(item => hasManagedStock(item) && item.stock > 0 && item.stock <= item.alert_stock).length
)
const outOfStockCount = computed(() =>
  items.value.filter(item => hasManagedStock(item) && item.stock <= 0).length
)

const canManageStock = computed(() => !["Supervisor", "Staff Bar"].includes(String(auth.user?.role || "")))

watch([keyword, statusFilter, perPage, selectedBranch], () => {
  page.value = 1
})

watch(
  () => form.value.is_package,
  (isPackage) => {
    if (!isPackage) form.value.package_special = false
  }
)

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
    package_special: false,
    happy_hour_enabled: false,
    happy_hour_price: 0,
    membership_tag: false,
    stock: 0,
    alert_stock: 0,
    branch_id: selectedBranch.value !== "ALL" ? String(selectedBranch.value) : (branches.value[0] ? String(branches.value[0].id) : ""),
    item_group: "NORMAL",
    ktv_group_tags: [],
    ktv_default_qty: 0,
    ktv_group_default_qty: {}
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
    package_special: Boolean(item.package_special),
    happy_hour_enabled: Boolean(item.happy_hour_enabled),
    happy_hour_price: Number(item.happy_hour_price || 0),
    membership_tag: Boolean(item.membership_tag),
    stock: Number(item.stock || 0),
    alert_stock: Number(item.alert_stock || 0),
    branch_id: String(item.branch_id || ""),
    item_group: item.item_group || "NORMAL",
    ktv_group_tags: Array.isArray(item.ktv_group_tags) ? item.ktv_group_tags : [],
    ktv_default_qty: Number(item.ktv_default_qty || 0),
    ktv_group_default_qty: (item.ktv_group_default_qty && typeof item.ktv_group_default_qty === 'object') ? item.ktv_group_default_qty : {}
  }
  showForm.value = true
}

const closeForm = () => {
  showForm.value = false
  editingItem.value = null
}

const isKtvTagChecked = (tag) => Array.isArray(form.value.ktv_group_tags) && form.value.ktv_group_tags.includes(tag)

const toggleKtvTag = (tag, checked) => {
  const current = new Set(Array.isArray(form.value.ktv_group_tags) ? form.value.ktv_group_tags : [])
  if (checked) current.add(tag)
  else current.delete(tag)
  form.value.ktv_group_tags = [...current]

  const qtyMap = { ...(form.value.ktv_group_default_qty || {}) }
  if (!checked) delete qtyMap[tag]
  else if (qtyMap[tag] === undefined) qtyMap[tag] = 0
  form.value.ktv_group_default_qty = qtyMap
}

const setKtvTagQty = (tag, value) => {
  const qtyMap = { ...(form.value.ktv_group_default_qty || {}) }
  const qty = Number(value || 0)
  qtyMap[tag] = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0
  form.value.ktv_group_default_qty = qtyMap
}

const submitForm = async () => {
  if (!form.value.branch_id) {
    await Swal.fire({ icon: "warning", title: "Outlet wajib dipilih", text: "Pilih outlet untuk item FNB" })
    return
  }

  const payload = {
    branch_id: Number(form.value.branch_id),
    name: form.value.name,
    cost_price: Number(form.value.cost_price || 0),
    sell_price: Number(form.value.sell_price || 0),
    is_beverage: Boolean(form.value.is_beverage),
    is_package: Boolean(form.value.is_package),
    package_qty: Number(form.value.package_qty || 0),
    package_group: form.value.package_group || null,
    item_group: form.value.item_group || "NORMAL",
    package_price: form.value.is_package ? Number(form.value.package_price || 0) : null,
    package_name: form.value.is_package ? (form.value.package_name || null) : null,
    package_special: Boolean(form.value.is_package && form.value.package_special),
    ktv_group_tags: Array.isArray(form.value.ktv_group_tags) ? form.value.ktv_group_tags : [],
    ktv_default_qty: Number(form.value.ktv_default_qty || 0),
    ktv_group_default_qty: form.value.ktv_group_default_qty || {},
    happy_hour_enabled: Boolean(form.value.happy_hour_enabled),
    membership_tag: Boolean(form.value.membership_tag),
    happy_hour_price: form.value.happy_hour_enabled
      ? Number(form.value.happy_hour_price || 0)
      : null,
    stock: form.value.package_special ? 0 : Number(form.value.stock || 0),
    alert_stock: form.value.package_special ? 0 : Number(form.value.alert_stock || 0)
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


const deleteItem = async (item) => {
  const confirm = await Swal.fire({ icon: "warning", title: "Hapus item ini?", text: item.name, showCancelButton: true })
  if (!confirm.isConfirmed) return

  try {
    await api.delete(`/fnb/${item.id}`)
    await loadItems()
    await Swal.fire({ icon: "success", title: "Item dihapus" })
  } catch (error) {
    const message = error?.response?.data?.message || "Gagal menghapus item"
    await Swal.fire({ icon: "error", title: "Delete gagal", text: message })
  }
}

const removeDuplicates = async () => {
  const confirm = await Swal.fire({
    icon: "warning",
    title: "Hapus item double?",
    text: "Sistem akan menyisakan 1 item per nama pada outlet yang dipilih.",
    showCancelButton: true
  })
  if (!confirm.isConfirmed) return

  const res = await api.post("/fnb/remove-duplicates", { branch_id: selectedBranch.value === "ALL" ? null : Number(selectedBranch.value) })
  await loadItems()
  await Swal.fire({ icon: "success", title: `Selesai`, text: `${res.data?.removed_count || 0} item double dihapus.` })
}

const prevPage = () => {
  if (page.value > 1) page.value -= 1
}

const nextPage = () => {
  if (page.value < totalPages.value) page.value += 1
}

const statusLabel = (item) => {
  if (!hasManagedStock(item)) return "N/A"
  if (item.stock <= 0) return "OUT"
  if (item.stock <= item.alert_stock) return "LOW"
  return "SAFE"
}

const statusClass = (item) => {
  if (!hasManagedStock(item)) return "neutral"
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

.badge.neutral {
  background: rgba(127, 140, 141, .25);
  color: #d0d6d8;
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
  background: linear-gradient(145deg, #181818, #111);
  padding: 22px;
  border-radius: 18px;
  width: 100%;
  max-width: 980px;
  max-height: min(92vh, 980px);
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid #2b2b2b;
  box-shadow: 0 30px 80px rgba(0,0,0,.55);
  animation: slideIn .25s ease-in-out;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  margin-top: 14px;
}

.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #bbb;
  font-size: 13px;
}
.section-title {
  grid-column: 1 / -1;
  color: #c9a24d;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .4px;
  text-transform: uppercase;
  padding-top: 4px;
}

.ktv-tag-wrapper {
  border: 1px solid #2c2c2c;
  border-radius: 12px;
  padding: 12px;
  background: #101010;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ktv-tag-title {
  font-weight: 600;
  color: #d5d5d5;
  margin-bottom: 2px;
}

.ktv-tag-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(120px, 170px);
  gap: 10px;
  align-items: center;
}

.ktv-tag-check {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ktv-tag-qty {
  width: 100%;
}

.inline-toggle {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 12px;
  background: #101010;
  border: 1px solid #2c2c2c;
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
.modal-header h3 { margin: 0; }

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


.header-actions {
  display: flex;
  gap: 10px;
}

.btn-danger {
  background: rgba(231, 76, 60, 0.16);
  color: #ff8678;
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid rgba(231,76,60,.45);
  cursor: pointer;
}

.actions button.danger {
  border-color: rgba(231,76,60,.7);
  color: #ff8678;
}

.actions button.danger:hover {
  background: #e74c3c;
  color: #fff;
}

@media (max-width: 768px) {
  .form-grid { grid-template-columns: 1fr; }
  .modal {
    padding: 16px;
    border-radius: 14px;
    max-height: 95vh;
  }
  .modal-backdrop {
    padding: 10px;
    align-items: flex-start;
  }
  .ktv-tag-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
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
