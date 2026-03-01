<template>
  <div class="agent-profiles-page">
    <div class="page-header">
      <h1>🧮 Grid Potongan Agent</h1>
      <p class="subtitle">Kelola profile agent dan nominal potongan per grade.</p>
    </div>

    <div class="card toolbar">
      <div class="form-group">
        <label>Pilih Agent Profile</label>
        <select v-model="form.id" @change="onChangeProfile">
          <option value="">-- Pilih Profile --</option>
          <option v-for="agent in agentProfiles" :key="agent.id" :value="agent.id">
            {{ agent.name }}
          </option>
        </select>
      </div>
      <button class="btn btn-secondary" type="button" @click="startCreateProfile">+ Profile Baru</button>
    </div>

    <div class="card">
      <div class="form-group">
        <label>Nama Agent Profile</label>
        <input v-model="form.name" type="text" placeholder="Contoh: Agent A" />
      </div>

      <table class="grid-table">
        <thead>
          <tr>
            <th>Grade</th>
            <th>Potongan (Rp)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in form.grade_cuts" :key="row.grade_id">
            <td>{{ row.grade_name }}</td>
            <td>
              <input
                type="number"
                min="0"
                step="1000"
                v-model="row.cut_amount"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <div class="actions">
        <button class="btn btn-primary" :disabled="submitting" @click="saveProfile">
          {{ submitting ? 'Menyimpan...' : 'Simpan Grid' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api'
import Swal from 'sweetalert2'

const agentProfiles = ref([])
const grades = ref([])
const submitting = ref(false)

const form = ref({
  id: '',
  name: '',
  grade_cuts: []
})

const hydrateForm = (profile = null) => {
  const cutsMap = new Map((profile?.grade_cuts || []).map((x) => [Number(x.grade_id), Number(x.cut_amount || 0)]))
  form.value = {
    id: profile?.id || '',
    name: profile?.name || '',
    grade_cuts: grades.value.map((grade) => ({
      grade_id: grade.id,
      grade_name: grade.name,
      cut_amount: cutsMap.get(Number(grade.id)) ?? 0
    }))
  }
}

const fetchGrades = async () => {
  const res = await api.get('/grades')
  grades.value = Array.isArray(res.data) ? res.data : []
}

const fetchAgentProfiles = async () => {
  const res = await api.get('/therapists/agent-profiles')
  agentProfiles.value = Array.isArray(res.data) ? res.data : []
}

const onChangeProfile = () => {
  const selected = agentProfiles.value.find((item) => Number(item.id) === Number(form.value.id))
  hydrateForm(selected || null)
}

const startCreateProfile = () => {
  hydrateForm(null)
}

const saveProfile = async () => {
  try {
    const name = String(form.value.name || '').trim()
    if (!name) {
      await Swal.fire({ icon: 'warning', title: 'Nama wajib diisi', text: 'Isi nama agent profile dulu.', background: '#111', color: '#fff' })
      return
    }

    submitting.value = true
    const payload = {
      name,
      grade_cuts: form.value.grade_cuts.map((row) => ({
        grade_id: row.grade_id,
        cut_amount: Number(row.cut_amount || 0)
      }))
    }

    if (form.value.id) {
      await api.put(`/therapists/agent-profiles/${form.value.id}`, payload)
    } else {
      await api.post('/therapists/agent-profiles', payload)
    }

    await fetchAgentProfiles()
    const latest = agentProfiles.value.find((x) => x.name === name)
    hydrateForm(latest || null)

    await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Grid agent profile berhasil disimpan', timer: 1800, showConfirmButton: false, background: '#111', color: '#fff' })
  } catch (err) {
    console.error('Save agent profile error:', err)
    await Swal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || 'Gagal menyimpan grid agent profile', background: '#111', color: '#fff' })
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    await fetchGrades()
    await fetchAgentProfiles()
    if (agentProfiles.value.length) {
      hydrateForm(agentProfiles.value[0])
    } else {
      hydrateForm(null)
    }
  } catch (err) {
    console.error('Init agent profiles page error:', err)
  }
})
</script>

<style scoped>
.agent-profiles-page { color: #fff; }
.page-header { margin-bottom: 16px; }
.page-header h1 { color: #c9a24d; margin: 0 0 4px; }
.subtitle { color: #999; margin: 0; }
.card {
  background: #1a1a1a;
  border: 1px solid #2b2b2b;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.toolbar { display: flex; gap: 12px; align-items: end; }
.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-group label { color: #aaa; font-size: 13px; }
.form-group select,
.form-group input,
.grid-table input {
  background: #0f0f0f;
  border: 1px solid #333;
  color: #fff;
  border-radius: 8px;
  padding: 10px;
}
.grid-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
.grid-table th,
.grid-table td { border-bottom: 1px solid #2f2f2f; padding: 12px 8px; text-align: left; }
.grid-table th { color: #c9a24d; }
.actions { margin-top: 14px; display: flex; justify-content: flex-end; }
.btn { border: none; border-radius: 8px; padding: 10px 14px; cursor: pointer; font-weight: 600; }
.btn-primary { background: #c9a24d; color: #111; }
.btn-secondary { background: #333; color: #fff; }
</style>
