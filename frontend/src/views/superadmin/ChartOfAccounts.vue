<template>
  <div class="coa-page">
    <div class="page-header">
      <h1>📚 Chart of Accounts (COA)</h1>
      <p class="subtitle">Setup manual COA dari UI tanpa edit database langsung.</p>
    </div>

    <div class="card form-card">
      <h3>{{ form.id ? 'Edit COA' : 'Tambah COA' }}</h3>
      <div class="grid">
        <label>
          Code
          <input v-model="form.code" type="text" placeholder="Contoh: 5112" />
        </label>
        <label>
          Name
          <input v-model="form.name" type="text" placeholder="Contoh: Marketing Expense" />
        </label>
        <label>
          Account Type
          <select v-model="form.account_type">
            <option value="">Pilih Type</option>
            <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <label>
          Parent Account
          <select v-model="form.parent_id">
            <option :value="''">Tanpa Parent</option>
            <option v-for="acc in accounts" :key="acc.id" :value="acc.id">{{ acc.code }} - {{ acc.name }}</option>
          </select>
        </label>
        <label class="switch-row" v-if="form.id">
          <input type="checkbox" v-model="form.is_active" />
          <span>Active</span>
        </label>
      </div>

      <div class="actions">
        <button class="btn btn-primary" :disabled="submitting" @click="submitForm">
          {{ submitting ? 'Menyimpan...' : (form.id ? 'Update COA' : 'Simpan COA') }}
        </button>
        <button class="btn btn-secondary" :disabled="submitting" @click="resetForm">Reset</button>
      </div>
    </div>

    <div class="card list-card">
      <div class="list-head">
        <h3>List COA</h3>
        <label class="inline-switch">
          <input type="checkbox" v-model="includeInactive" @change="fetchCoa" />
          <span>Tampilkan inactive</span>
        </label>
      </div>

      <table class="coa-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Type</th>
            <th>Parent</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="muted">Loading...</td>
          </tr>
          <tr v-else-if="!accounts.length">
            <td colspan="6" class="muted">Belum ada data COA.</td>
          </tr>
          <tr v-else v-for="acc in accounts" :key="acc.id">
            <td>{{ acc.code }}</td>
            <td>{{ acc.name }}</td>
            <td>{{ acc.account_type }}</td>
            <td>{{ acc.parent_code ? `${acc.parent_code} - ${acc.parent_name}` : '-' }}</td>
            <td>
              <span class="badge" :class="acc.is_active ? 'active' : 'inactive'">
                {{ acc.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td>
              <button class="btn-mini" @click="editItem(acc)">Edit</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api'
import Swal from 'sweetalert2'

const types = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']
const accounts = ref([])
const loading = ref(false)
const submitting = ref(false)
const includeInactive = ref(false)

const defaultForm = () => ({
  id: null,
  code: '',
  name: '',
  account_type: '',
  parent_id: '',
  is_active: true
})

const form = ref(defaultForm())

const resetForm = () => {
  form.value = defaultForm()
}

const fetchCoa = async () => {
  loading.value = true
  try {
    const res = await api.get('/accounting/coa', {
      params: {
        include_inactive: includeInactive.value ? 'true' : 'false'
      }
    })
    accounts.value = res.data?.data || []
  } catch (err) {
    console.error('fetch coa error', err)
    await Swal.fire('Error', err.response?.data?.error?.message || 'Gagal memuat COA', 'error')
  } finally {
    loading.value = false
  }
}

const submitForm = async () => {
  const payload = {
    code: String(form.value.code || '').trim(),
    name: String(form.value.name || '').trim(),
    account_type: String(form.value.account_type || '').trim(),
    parent_id: form.value.parent_id ? Number(form.value.parent_id) : null,
    is_active: Boolean(form.value.is_active)
  }

  if (!payload.code || !payload.name || !payload.account_type) {
    await Swal.fire('Validation', 'Code, name, dan account type wajib diisi.', 'warning')
    return
  }

  submitting.value = true
  try {
    if (form.value.id) {
      await api.put(`/accounting/coa/${form.value.id}`, payload)
    } else {
      await api.post('/accounting/coa', payload)
    }
    await Swal.fire('Success', 'COA berhasil disimpan', 'success')
    resetForm()
    await fetchCoa()
  } catch (err) {
    console.error('save coa error', err)
    await Swal.fire('Error', err.response?.data?.error?.message || 'Gagal menyimpan COA', 'error')
  } finally {
    submitting.value = false
  }
}

const editItem = (acc) => {
  form.value = {
    id: acc.id,
    code: acc.code,
    name: acc.name,
    account_type: acc.account_type,
    parent_id: acc.parent_id || '',
    is_active: Boolean(acc.is_active)
  }
}

onMounted(fetchCoa)
</script>

<style scoped>
.coa-page { color: #fff; }
.page-header { margin-bottom: 16px; }
.page-header h1 { margin: 0; color: #c9a24d; }
.subtitle { color: #999; margin-top: 4px; }
.card { background: #1a1a1a; border: 1px solid #2b2b2b; border-radius: 12px; padding: 16px; margin-bottom: 14px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
label { display: grid; gap: 6px; color: #aaa; font-size: 13px; }
input, select { background: #0f0f0f; border: 1px solid #333; color: #fff; border-radius: 8px; padding: 10px; }
.actions { margin-top: 12px; display: flex; gap: 8px; }
.btn { border: none; border-radius: 8px; padding: 10px 14px; cursor: pointer; font-weight: 600; }
.btn-primary { background: #c9a24d; color: #111; }
.btn-secondary { background: #333; color: #fff; }
.list-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.inline-switch { display: flex; align-items: center; gap: 8px; }
.coa-table { width: 100%; border-collapse: collapse; }
.coa-table th, .coa-table td { border-bottom: 1px solid #2f2f2f; padding: 10px 8px; text-align: left; }
.coa-table th { color: #c9a24d; }
.badge { padding: 4px 8px; border-radius: 999px; font-size: 12px; }
.badge.active { background: rgba(46, 204, 113, 0.2); color: #87f6b4; }
.badge.inactive { background: rgba(231, 76, 60, 0.2); color: #ff9d94; }
.btn-mini { background: #2f2f2f; border: none; color: #fff; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
.muted { color: #999; text-align: center; }
.switch-row { display: flex; align-items: center; gap: 8px; margin-top: 24px; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>
