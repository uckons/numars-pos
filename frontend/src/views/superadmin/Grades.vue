<template>
  <div class="grades-page">
    <div class="page-header">
      <h1>🏆 Manajemen Grade Terapis</h1>
      <button class="btn btn-add" @click="openAddModal">
        ➕ Tambah Grade
      </button>
    </div>

    <!-- Info Cards -->
    <div class="info-cards">
      <div class="card">
        <div class="card-label">Total Grades</div>
        <div class="card-value">{{ grades.length }}</div>
      </div>
      <div class="card">
        <div class="card-label">Min Komisi (Rp)</div>
        <div class="card-value">Rp {{ formatCurrency(minCommission) }}</div>
      </div>
      <div class="card">
        <div class="card-label">Max Komisi (Rp)</div>
        <div class="card-value">Rp {{ formatCurrency(maxCommission) }}</div>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="grades-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Nama Grade</th>
            <th>Komisi Fix (Rp)</th>
            <th>Jumlah Terapis</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="loading">Loading...</td>
          </tr>
          <tr v-else-if="grades.length === 0">
            <td colspan="5" class="empty">Belum ada data grade</td>
          </tr>
          <tr v-else v-for="(grade, index) in grades" :key="grade.id">
            <td>{{ index + 1 }}</td>
            <td class="grade-name">
              <span class="badge" :class="`badge-${grade.name.toLowerCase()}`">
                {{ grade.name }}
              </span>
            </td>
            <td class="commission">
              <strong>Rp {{ formatCurrency(grade.commission_amount ?? grade.commission_percent) }}</strong>
            </td>
            <td>
              <span class="therapist-count">
                {{ grade.therapist_count || 0 }} terapis
              </span>
            </td>
            <td class="actions">
              <button class="btn-icon btn-edit" @click="openEditModal(grade)" title="Edit">
                ✏️
              </button>
              <button 
                class="btn-icon btn-delete" 
                @click="deleteGrade(grade)" 
                title="Hapus"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Add/Edit -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ isEdit ? 'Edit Grade' : 'Tambah Grade Baru' }}</h2>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>

        <form @submit.prevent="submitForm" class="modal-form">
          <div class="form-group">
            <label>Nama Grade *</label>
            <input 
              type="text" 
              v-model="form.name" 
              placeholder="e.g. Diamond, VIP, etc"
              required
            />
            <small class="hint">Nama grade harus unik</small>
          </div>

          <div class="form-group">
            <label>Komisi Fix (Rp) *</label>
            <input 
              type="number" 
              v-model.number="form.commission_amount" 
              placeholder="Contoh: 25000"
              min="0"
              step="1000"
              required
            />
            <small class="hint">Nominal komisi fix rupiah per jumlah kerja (>= 0)</small>
          </div>

          <!-- Preview -->
          <div class="preview" v-if="form.name && form.commission_amount !== ''">
            <div class="preview-label">Preview:</div>
            <div class="preview-badge">
              <span class="badge badge-preview">{{ form.name }}</span>
              <span class="preview-commission">Rp {{ formatCurrency(form.commission_amount) }}</span>
            </div>
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
import { ref, computed, onMounted } from 'vue'
import api from '@/services/api'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

// State
const grades = ref([])
const loading = ref(false)
const submitting = ref(false)

const showModal = ref(false)
const isEdit = ref(false)
const form = ref({
  name: '',
  commission_amount: ''
})

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

// Computed
const minCommission = computed(() => {
  if (grades.value.length === 0) return 0
  return Math.min(...grades.value.map(g => Number(g.commission_amount ?? g.commission_percent ?? 0)))
})

const maxCommission = computed(() => {
  if (grades.value.length === 0) return 0
  return Math.max(...grades.value.map(g => Number(g.commission_amount ?? g.commission_percent ?? 0)))
})

// Fetch Grades with therapist count
const fetchGrades = async () => {
  try {
    loading.value = true
    const res = await api.get('/grades')
    
    // Get therapist count for each grade
    for (let grade of res.data) {
      try {
        const countRes = await api.get('/therapists', { 
          params: { grade_id: grade.id, limit: 1 } 
        })
        grade.therapist_count = countRes.data.pagination.totalRecords
      } catch (e) {
        grade.therapist_count = 0
      }
    }
    
    grades.value = res.data
  } catch (err) {
    console.error('Fetch grades error:', err)
    await SwalTheme.fire({
      icon: 'error',
      title: 'Error',
      text: err.response?.data?.message || 'Gagal memuat data grade'
    })
  } finally {
    loading.value = false
  }
}

// Open Add Modal
const openAddModal = () => {
  isEdit.value = false
  form.value = {
    name: '',
    commission_amount: ''
  }
  showModal.value = true
}

// Open Edit Modal
const openEditModal = (grade) => {
  isEdit.value = true
  form.value = {
    id: grade.id,
    name: grade.name,
    commission_amount: grade.commission_amount ?? grade.commission_percent
  }
  showModal.value = true
}

// Close Modal
const closeModal = () => {
  showModal.value = false
  form.value = {
    name: '',
    commission_amount: ''
  }
}

// Submit Form
const submitForm = async () => {
  try {
    submitting.value = true

    if (isEdit.value) {
      await api.put(`/grades/${form.value.id}`, {
        name: form.value.name,
        commission_amount: form.value.commission_amount
      })
      await SwalTheme.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Grade berhasil diupdate',
        timer: 2000,
        showConfirmButton: false
      })
    } else {
      await api.post('/grades', {
        name: form.value.name,
        commission_amount: form.value.commission_amount
      })
      await SwalTheme.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Grade baru berhasil ditambahkan',
        timer: 2000,
        showConfirmButton: false
      })
    }

    closeModal()
    fetchGrades()
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

// Delete Grade
const deleteGrade = async (grade) => {
  const result = await SwalTheme.fire({
    icon: 'warning',
    title: 'Hapus Grade?',
    html: `
      <p>Anda yakin ingin menghapus grade:</p>
      <strong>${grade.name} (Rp ${formatCurrency(grade.commission_amount ?? grade.commission_percent)})</strong>
      <p style="margin-top:10px;color:#e74c3c;font-size:13px;">
        ⚠️ Grade yang masih digunakan tidak bisa dihapus!
      </p>
    `,
    showCancelButton: true,
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal'
  })

  if (!result.isConfirmed) return

  try {
    await api.delete(`/grades/${grade.id}`)
    await SwalTheme.fire({
      icon: 'success',
      title: 'Berhasil',
      text: 'Grade berhasil dihapus',
      timer: 2000,
      showConfirmButton: false
    })
    fetchGrades()
  } catch (err) {
    console.error('Delete grade error:', err)
    
    if (err.response?.data?.hasTherapists) {
      await SwalTheme.fire({
        icon: 'error',
        title: 'Tidak Dapat Menghapus',
        html: `
          <p>${err.response.data.message}</p>
          <p style="margin-top:10px;color:#aaa;font-size:13px;">
            Ada ${err.response.data.count} terapis yang menggunakan grade ini
          </p>
        `
      })
    } else {
      await SwalTheme.fire({
        icon: 'error',
        title: 'Gagal',
        text: err.response?.data?.message || 'Gagal menghapus grade'
      })
    }
  }
}

const formatCurrency = (value) => Number(value || 0).toLocaleString("id-ID")

// Lifecycle
onMounted(() => {
  fetchGrades()
})
</script>

<style scoped>
.grades-page {
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

/* ===== INFO CARDS ===== */
.info-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.card {
  background: linear-gradient(145deg, #1a1a1a, #1f1f1f);
  border: 1px solid #333;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease-out;
}

.card:hover {
  transform: translateY(-4px);
  border-color: #c9a24d;
  box-shadow: 0 8px 20px rgba(201, 162, 77, 0.2);
}

.card-label {
  font-size: 13px;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.card-value {
  font-size: 32px;
  font-weight: 700;
  color: #c9a24d;
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

/* ===== TABLE ===== */
.table-container {
  background: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 24px;
}

.grades-table {
  width: 100%;
  border-collapse: collapse;
}

.grades-table thead {
  background: #222;
}

.grades-table th {
  padding: 16px;
  text-align: left;
  font-size: 13px;
  font-weight: 700;
  color: #c9a24d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.grades-table tbody tr {
  border-bottom: 1px solid #222;
  transition: background 0.2s ease-out;
}

.grades-table tbody tr:hover {
  background: #252525;
}

.grades-table td {
  padding: 16px;
  font-size: 14px;
  color: #ddd;
}

.grades-table td.loading,
.grades-table td.empty {
  text-align: center;
  padding: 40px;
  color: #777;
  font-size: 14px;
}

.grades-table td.grade-name {
  font-weight: 600;
}

.grades-table td.commission {
  font-size: 16px;
}

.grades-table td.commission strong {
  color: #2ecc71;
}

/* ===== BADGES ===== */
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
.badge-preview {
  background: rgba(201, 162, 77, 0.2);
  color: #c9a24d;
  border: 1px solid rgba(201, 162, 77, 0.3);
}

.therapist-count {
  color: #888;
  font-size: 13px;
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
  transform: scale(1.1);
}

.btn-delete:hover {
  background: rgba(231, 76, 60, 0.2);
  transform: scale(1.1);
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
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #c9a24d;
}

.hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #777;
  font-style: italic;
}

/* ===== PREVIEW ===== */
.preview {
  background: #252525;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.preview-label {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.preview-badge {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-commission {
  font-size: 18px;
  font-weight: 700;
  color: #2ecc71;
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
  .grades-page {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .info-cards {
    grid-template-columns: 1fr;
  }

  .table-container {
    overflow-x: auto;
  }

  .grades-table {
    min-width: 600px;
  }

  .modal-content {
    width: 95%;
  }
}
</style>