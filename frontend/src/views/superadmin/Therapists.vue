<template>
  <div class="therapists-page">
    <div class="page-header">
      <h1>👤 Manajemen Terapis</h1>
      <button class="btn btn-add" @click="openAddModal">
        ➕ Tambah Terapis
      </button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-group">
        <label>Grade:</label>
        <select v-model="filters.grade_id" @change="fetchTherapists">
          <option value="">Semua Grade</option>
          <option v-for="grade in grades" :key="grade.id" :value="grade.id">
            {{ grade.name }} ({{ formatAccounting(getGradeCommission(grade)) }})
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label>Status:</label>
        <select v-model="filters.active" @change="fetchTherapists">
          <option value="">Semua Status</option>
          <option value="true">Aktif</option>
          <option value="false">Tidak Aktif</option>
        </select>
      </div>

      <div class="filter-group">
        <label>Cabang:</label>
        <select v-model="filters.branch_id" @change="fetchTherapists">
          <option value="">Semua Cabang</option>
          <option v-for="branch in branches" :key="branch.id" :value="branch.id">
            {{ branch.name }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label>Cari:</label>
        <input 
          type="text" 
          v-model="filters.search" 
          @input="debounceSearch"
          placeholder="Nama terapis..."
        />
      </div>

      <button class="btn btn-reset" @click="resetFilters">
        Reset
      </button>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="therapists-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Nama</th>
            <th>Grade</th>
            <th>Komisi</th>
            <th>Cabang</th>
            <th>Status</th>
            <th>PIN Absensi</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" class="loading">
              Loading...
            </td>
          </tr>
          <tr v-else-if="therapists.length === 0">
            <td colspan="8" class="empty">
              Tidak ada data terapis
            </td>
          </tr>
          <tr v-else v-for="(therapist, index) in therapists" :key="therapist.id">
            <td>{{ (pagination.page - 1) * pagination.limit + index + 1 }}</td>
            <td class="name">{{ therapist.name }}</td>
            <td>
              <span class="badge" :class="`badge-${therapist.grade_name?.toLowerCase()}`">
                {{ therapist.grade_name }}
              </span>
            </td>
            <td>{{ formatAccounting(getTherapistCommission(therapist)) }}</td>
            <td>{{ therapist.branch_name }}</td>
            <td>
              <span class="status" :class="therapist.active ? 'status-active' : 'status-inactive'">
                {{ therapist.active ? 'Aktif' : 'Tidak Aktif' }}
              </span>
            </td>
            <td>
              <span class="status" :class="therapist.has_attendance_pin ? 'status-active' : 'status-inactive'">
                {{ therapist.has_attendance_pin ? 'Sudah Diset' : 'Belum Diset' }}
              </span>
            </td>
            <td class="actions">
              <button class="btn-icon btn-edit" @click="openEditModal(therapist)" title="Edit">
                ✏️
              </button>
              <button 
                class="btn-icon btn-delete" 
                @click="deleteTherapist(therapist)" 
                title="Nonaktifkan"
                v-if="therapist.active"
              >
                ❌
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="pagination.totalPages > 1">
      <button 
        class="btn-page" 
        @click="changePage(pagination.page - 1)"
        :disabled="pagination.page === 1"
      >
        ← Prev
      </button>
      
      <span class="page-info">
        Halaman {{ pagination.page }} dari {{ pagination.totalPages }}
      </span>
      
      <button 
        class="btn-page" 
        @click="changePage(pagination.page + 1)"
        :disabled="pagination.page === pagination.totalPages"
      >
        Next →
      </button>
    </div>

    <!-- Modal Add/Edit -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ isEdit ? 'Edit Terapis' : 'Tambah Terapis Baru' }}</h2>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>

        <form @submit.prevent="submitForm" class="modal-form">
          <div class="form-group">
            <label>Nama Terapis *</label>
            <input 
              type="text" 
              v-model="form.name" 
              placeholder="Nama lengkap terapis"
              required
            />
          </div>

          <div class="form-group">
            <label>PIN Absensi</label>
            <input
              type="password"
              v-model="form.attendance_pin"
              placeholder="Minimal 4 karakter (kosongkan untuk reset)"
            />
            <small class="help-text">Digunakan saat status MASUK/CLOSE di dashboard kasir.</small>
          </div>

          <div class="form-group">
            <label>Grade *</label>
            <select v-model="form.grade_id" required>
              <option value="">Pilih Grade</option>
              <option v-for="grade in grades" :key="grade.id" :value="grade.id">
                {{ grade.name }} - Komisi {{ formatAccounting(getGradeCommission(grade)) }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Cabang *</label>
            <select v-model="form.branch_id" required>
              <option value="">Pilih Cabang</option>
              <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                {{ branch.name }}
              </option>
            </select>
          </div>

          <div class="form-group" v-if="isEdit">
            <label>Status</label>
            <select v-model="form.active">
              <option :value="true">Aktif</option>
              <option :value="false">Tidak Aktif</option>
            </select>
          </div>

          <div class="modal-actions">
            <button type="submit" class="btn btn-primary" :disabled="submitting">
              {{ submitting ? 'Menyimpan...' : (isEdit ? 'Update' : 'Simpan') }}
            </button>
            <button type="button" class="btn btn-secondary" @click="closeModal">
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

// State
const therapists = ref([])
const grades = ref([])
const branches = ref([])
const loading = ref(false)
const submitting = ref(false)

const filters = ref({
  grade_id: '',
  active: '',
  branch_id: '',
  search: '',
  page: 1,
  limit: 25
})

const pagination = ref({
  page: 1,
  limit: 25,
  totalRecords: 0,
  totalPages: 0
})

const showModal = ref(false)
const isEdit = ref(false)
const form = ref({
  name: '',
  grade_id: '',
  branch_id: '',
  active: true,
  attendance_pin: ''
})

let searchTimeout = null

// SweetAlert Theme
const SwalTheme = Swal.mixin({
  customClass: {
    popup: 'swal-dark-popup',
    title: 'swal-dark-title',
    content: 'swal-dark-content',
    confirmButton: 'swal-dark-confirm',
    cancelButton: 'swal-dark-cancel',
    denyButton: 'swal-dark-deny'
  },
  buttonsStyling: false
})

const formatAccounting = (value) => {
  const amount = Number(value || 0)
  const formatted = Math.abs(amount).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return amount < 0 ? `(Rp ${formatted})` : `Rp ${formatted}`
}

const getGradeCommission = (grade) => Number(grade?.commission_amount ?? grade?.commission_percent ?? 0)
const getTherapistCommission = (therapist) => Number(therapist?.commission_amount ?? therapist?.commission_percent ?? 0)

// Fetch Therapists
const fetchTherapists = async () => {
  try {
    loading.value = true
    const params = {
      page: filters.value.page,
      limit: filters.value.limit
    }

    if (filters.value.grade_id) params.grade_id = filters.value.grade_id
    if (filters.value.active !== '') params.active = filters.value.active
    if (filters.value.branch_id) params.branch_id = filters.value.branch_id
    if (filters.value.search) params.search = filters.value.search

    const res = await api.get('/therapists', { params })
    therapists.value = res.data.data
    pagination.value = res.data.pagination
  } catch (err) {
    console.error('Fetch therapists error:', err)
    await SwalTheme.fire({
      icon: 'error',
      title: 'Error',
      text: err.response?.data?.message || 'Gagal memuat data terapis'
    })
  } finally {
    loading.value = false
  }
}

// Fetch Grades
const fetchGrades = async () => {
  try {
    const res = await api.get('/grades')  // ← GANTI dari /therapists/grades/list
    grades.value = res.data
    console.log('✅ Grades loaded:', res.data)
  } catch (err) {
    console.error('❌ Fetch grades error:', err)
  }
}


const fetchBranches = async () => {
  try {
    const res = await api.get('/superadmin/branches')
    branches.value = Array.isArray(res.data) ? res.data : []
  } catch (err) {
    console.error('Fetch branches error:', err)
    branches.value = []
  }
}

// Debounce Search
const debounceSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    filters.value.page = 1
    fetchTherapists()
  }, 500)
}

// Reset Filters
const resetFilters = () => {
  filters.value = {
    grade_id: '',
    active: '',
    branch_id: '',
    search: '',
    page: 1,
    limit: 25
  }
  fetchTherapists()
}

// Change Page
const changePage = (page) => {
  filters.value.page = page
  fetchTherapists()
}

// Open Add Modal
const openAddModal = () => {
  isEdit.value = false
  form.value = {
    name: '',
    grade_id: '',
    branch_id: '',
    active: true,
    attendance_pin: ''
  }
  showModal.value = true
}

// Open Edit Modal
const openEditModal = (therapist) => {
  isEdit.value = true
  form.value = {
    id: therapist.id,
    name: therapist.name,
    grade_id: therapist.grade_id,
    branch_id: therapist.branch_id,
    active: therapist.active,
    attendance_pin: ''
  }
  showModal.value = true
}

// Close Modal
const closeModal = () => {
  showModal.value = false
  form.value = {
    name: '',
    grade_id: '',
    branch_id: '',
    active: true,
    attendance_pin: ''
  }
}

// Submit Form
const submitForm = async () => {
  try {
    submitting.value = true

    if (isEdit.value) {
      await api.put(`/therapists/${form.value.id}`, form.value)
      await SwalTheme.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Data terapis berhasil diupdate',
        timer: 2000,
        showConfirmButton: false
      })
    } else {
      await api.post('/therapists', form.value)
      await SwalTheme.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Terapis baru berhasil ditambahkan',
        timer: 2000,
        showConfirmButton: false
      })
    }

    closeModal()
    fetchTherapists()
  } catch (err) {
    console.error('Submit form error:', err)
    await SwalTheme.fire({
      icon: 'error',
      title: 'Gagal',
      text: err.response?.data?.message || 'Gagal menyimpan data'
    })
  } finally {
    submitting.value = false
  }
}

// Delete Therapist
const deleteTherapist = async (therapist) => {
  const result = await SwalTheme.fire({
    icon: 'warning',
    title: 'Nonaktifkan Terapis?',
    html: `
      <p>Anda yakin ingin menonaktifkan terapis:</p>
      <strong>${therapist.name}</strong>
      <p style="margin-top:10px;color:#888;font-size:13px;">
        Terapis yang dinonaktifkan tidak akan muncul di list aktif
      </p>
    `,
    showCancelButton: true,
    confirmButtonText: 'Ya, Nonaktifkan',
    cancelButtonText: 'Batal'
  })

  if (!result.isConfirmed) return

  try {
    await api.delete(`/therapists/${therapist.id}`)
    await SwalTheme.fire({
      icon: 'success',
      title: 'Berhasil',
      text: 'Terapis berhasil dinonaktifkan',
      timer: 2000,
      showConfirmButton: false
    })
    fetchTherapists()
  } catch (err) {
    console.error('Delete therapist error:', err)
    await SwalTheme.fire({
      icon: 'error',
      title: 'Gagal',
      text: err.response?.data?.message || 'Gagal menonaktifkan terapis'
    })
  }
}

// Lifecycle
onMounted(() => {
  fetchGrades()
  fetchBranches()
  fetchTherapists()
})
</script>

<style scoped>
.therapists-page {
  padding: 24px;
  background: #0e0e0e;
  min-height: 100vh;
  color: #fff;
}

/* ===== PAGE HEADER ===== */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #c9a24d;
  margin: 0;
}

/* ===== BUTTONS ===== */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease-out;
}

.btn-add {
  background: #c9a24d;
  color: #000;
}

.btn-add:hover {
  background: #d4b560;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(201, 162, 77, 0.4);
}

.btn-reset {
  background: #333;
  color: #fff;
  padding: 8px 16px;
}

.btn-reset:hover {
  background: #444;
}

.btn-primary {
  background: #c9a24d;
  color: #000;
  padding: 12px 24px;
}

.btn-primary:hover {
  background: #d4b560;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #333;
  color: #fff;
  padding: 12px 24px;
}

.btn-secondary:hover {
  background: #444;
}

/* ===== FILTERS ===== */
.filters {
  background: #1a1a1a;
  padding: 20px;
  border-radius: 12px;
  display: flex;
  gap: 16px;
  align-items: flex-end;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-group label {
  font-size: 13px;
  font-weight: 600;
  color: #aaa;
}

.filter-group select,
.filter-group input {
  padding: 8px 12px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #0e0e0e;
  color: #fff;
  font-size: 14px;
  min-width: 150px;
}

.help-text {
  color: #888;
  font-size: 12px;
}

.filter-group select:focus,
.filter-group input:focus {
  outline: none;
  border-color: #c9a24d;
}

/* ===== TABLE ===== */
.table-container {
  background: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 24px;
}

.therapists-table {
  width: 100%;
  border-collapse: collapse;
}

.therapists-table thead {
  background: #222;
}

.therapists-table th {
  padding: 16px;
  text-align: left;
  font-size: 13px;
  font-weight: 700;
  color: #c9a24d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.therapists-table tbody tr {
  border-bottom: 1px solid #222;
  transition: background 0.2s ease-out;
}

.therapists-table tbody tr:hover {
  background: #252525;
}

.therapists-table td {
  padding: 16px;
  font-size: 14px;
  color: #ddd;
}

.therapists-table td.name {
  font-weight: 600;
  color: #fff;
}

.therapists-table td.loading,
.therapists-table td.empty {
  text-align: center;
  padding: 40px;
  color: #777;
  font-size: 14px;
}

/* ===== BADGES ===== */
/* Default untuk grade custom */
.badge {
  background: rgba(201, 162, 77, 0.2);
  color: #c9a24d;
  border: 1px solid rgba(201, 162, 77, 0.3);
}

.badge-pink {
  background: rgba(255, 182, 193, 0.2);
  color: #ffb6c1;
  border: 1px solid rgba(255, 182, 193, 0.3);
}

.badge-gold {
  background: rgba(255, 215, 0, 0.2);
  color: #ffd700;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.badge-platinum {
  background: rgba(229, 228, 226, 0.2);
  color: #e5e4e2;
  border: 1px solid rgba(229, 228, 226, 0.3);
}
.badge-diamond {
  background: rgba(185, 242, 255, 0.2);
  color: #b9f2ff;
  border: 1px solid rgba(185, 242, 255, 0.3);
}

/* ===== STATUS ===== */
.status {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-active {
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
  border: 1px solid rgba(46, 204, 113, 0.3);
}

.status-inactive {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.3);
}

/* ===== ACTIONS ===== */
.actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s ease-out;
}

.btn-edit:hover {
  background: rgba(52, 152, 219, 0.2);
}

.btn-delete:hover {
  background: rgba(231, 76, 60, 0.2);
}

/* ===== PAGINATION ===== */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #1a1a1a;
  border-radius: 12px;
}

.btn-page {
  padding: 8px 16px;
  background: #333;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease-out;
}

.btn-page:hover:not(:disabled) {
  background: #c9a24d;
  color: #000;
  border-color: #c9a24d;
}

.btn-page:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #aaa;
  font-weight: 600;
}

/* ===== MODAL ===== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: #1a1a1a;
  border: 2px solid #c9a24d;
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  background: linear-gradient(145deg, #c9a24d, #d4b560);
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #c9a24d;
}

.modal-header h2 {
  color: #000;
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.modal-close {
  background: rgba(0, 0, 0, 0.2);
  border: none;
  color: #000;
  width: 35px;
  height: 35px;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.modal-close:hover {
  background: rgba(0, 0, 0, 0.4);
  transform: rotate(90deg);
}

/* ===== FORM ===== */
.modal-form {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #aaa;
  margin-bottom: 8px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 12px;
  border: 1px solid #333;
  border-radius: 8px;
  background: #0e0e0e;
  color: #fff;
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #c9a24d;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.modal-actions .btn {
  flex: 1;
}

/* ===== SWEETALERT DARK THEME ===== */
:deep(.swal-dark-popup) {
  background: linear-gradient(145deg, #0e0e0e, #151515) !important;
  color: #fff !important;
  border-radius: 12px !important;
  border: 1px solid rgba(201, 162, 77, 0.3) !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8) !important;
}

:deep(.swal-dark-title) {
  color: #c9a24d !important;
  font-weight: 700;
}

:deep(.swal-dark-content) {
  color: #cfcfcf !important;
  font-size: 14px;
}

:deep(.swal-dark-confirm) {
  background: #c9a24d !important;
  color: #000 !important;
  border: none !important;
  padding: 10px 24px !important;
  border-radius: 8px !important;
  font-weight: 600;
}

:deep(.swal-dark-cancel) {
  background: transparent !important;
  color: #c9a24d !important;
  border: 1px solid #c9a24d !important;
  padding: 9px 22px !important;
  border-radius: 8px !important;
  font-weight: 600;
}

:deep(.swal-dark-deny) {
  background: transparent !important;
  color: #e74c3c !important;
  border: 1px solid #e74c3c !important;
  padding: 9px 22px !important;
  border-radius: 8px !important;
  font-weight: 600;
}

/* Success icon */
:deep(.swal2-success-ring),
:deep(.swal2-success-fix) {
  border-color: #c9a24d !important;
}
:deep(.swal2-success-line-tip),
:deep(.swal2-success-line-long) {
  background-color: #c9a24d !important;
}

/* Warning icon */
:deep(.swal2-warning) {
  border-color: #f39c12 !important;
  color: #f39c12 !important;
}

/* Error icon */
:deep(.swal2-error) {
  border-color: #e74c3c !important;
}
:deep(.swal2-x-mark-line-left),
:deep(.swal2-x-mark-line-right) {
  background-color: #e74c3c !important;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .therapists-page {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .filters {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group select,
  .filter-group input {
    width: 100%;
    min-width: unset;
  }

  .table-container {
    overflow-x: auto;
  }

  .therapists-table {
    min-width: 800px;
  }

  .modal-content {
    width: 95%;
  }
}
</style>