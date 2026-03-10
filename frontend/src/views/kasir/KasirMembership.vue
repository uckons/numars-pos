<template>
  <div class="kasir-membership-page">
    <header class="head card">
      <div>
        <h2>Dashboard Membership Kasir</h2>
        <p>Daftar member aktif dan pendaftaran member baru.</p>
      </div>
      <div class="head-actions">
        <router-link class="btn-light" to="/kasir">← Dashboard</router-link>
        <button class="btn-primary" @click="refresh">Refresh</button>
      </div>
    </header>

    <section class="card">
      <div class="table-head">
        <h4>Daftar Member</h4>
        <button class="btn-primary" @click="openCreateMemberModal">Tambah Member</button>
      </div>

      <div class="meta">Total {{ members.length }} member aktif</div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>No Kartu</th>
              <th>Nama</th>
              <th>No HP</th>
              <th>Level</th>
              <th>Durasi</th>
              <th>Diskon</th>
              <th>Expired</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!members.length">
              <td colspan="7" class="empty">Belum ada member aktif.</td>
            </tr>
            <tr v-for="m in members" :key="m.id">
              <td>{{ m.card_no }}</td>
              <td>{{ m.full_name }}</td>
              <td>{{ m.phone || '-' }}</td>
              <td>{{ m.level }}</td>
              <td>{{ m.duration_type }}</td>
              <td>{{ m.discount_percent }}%</td>
              <td>{{ formatDate(m.ends_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import Swal from 'sweetalert2'
import api from '@/services/api'

const members = ref([])

const refresh = async () => {
  try {
    const res = await api.get('/memberships/members', { params: { active: 'true' } })
    members.value = Array.isArray(res.data?.data) ? res.data.data : []
  } catch (err) {
    await Swal.fire({ icon: 'error', title: 'Gagal memuat member', text: err?.response?.data?.message || err.message })
  }
}

const openCreateMemberModal = async () => {
  const { value } = await Swal.fire({
    title: 'Tambah Member',
    html: `
      <div style="text-align:left;display:grid;gap:8px;">
        <label style="font-size:12px;">Nama</label>
        <input id="m-name" class="swal2-input" placeholder="Nama" style="margin:0;max-width:100%;" />
        <label style="font-size:12px;">No HP</label>
        <input id="m-phone" class="swal2-input" placeholder="No HP" style="margin:0;max-width:100%;" />
        <label style="font-size:12px;">Type Membership</label>
        <select id="m-level" class="swal2-input" style="margin:0;max-width:100%;">
          <option value="SILVER">SILVER</option><option value="GOLD">GOLD</option><option value="VIP">VIP</option>
        </select>
        <label style="font-size:12px;">Durasi Membership</label>
        <select id="m-duration" class="swal2-input" style="margin:0;max-width:100%;">
          <option value="MONTHLY">Bulanan</option><option value="6_MONTHS">6 Bulan</option><option value="YEARLY">Tahunan</option>
        </select>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Simpan',
    preConfirm: () => ({
      full_name: document.getElementById('m-name')?.value,
      phone: document.getElementById('m-phone')?.value,
      level: document.getElementById('m-level')?.value,
      duration_type: document.getElementById('m-duration')?.value
    })
  })

  if (!value?.full_name) return

  try {
    await api.post('/memberships/members', value)
    await Swal.fire({ icon: 'success', title: 'Member ditambahkan' })
    await refresh()
  } catch (err) {
    await Swal.fire({ icon: 'error', title: 'Gagal', text: err?.response?.data?.message || err.message })
  }
}

const formatDate = (v) => (v ? new Date(v).toLocaleDateString('id-ID') : '-')

onMounted(refresh)
</script>

<style scoped>
.kasir-membership-page { min-height: 100vh; padding: 20px; background: radial-gradient(circle at top right, rgba(245,197,24,.09), transparent 40%), #0c0c0c; color: #fff; }
.card { background: linear-gradient(145deg, rgba(20,20,20,.95), rgba(14,14,14,.95)); border:1px solid #272727; border-radius:14px; padding:16px; margin-bottom:14px; box-shadow: 0 12px 30px rgba(0,0,0,.32); }
.head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
.head h2 { margin:0 0 6px; color:#f5c518; }
.head p { margin:0; color:#9ca3b3; }
.head-actions { display:flex; gap:8px; }
.table-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.meta { color:#9ca3b3; margin-bottom:10px; }
.table-wrap { overflow:auto; }
.table { width:100%; border-collapse: collapse; }
.table th, .table td { border-top:1px solid #262626; padding:10px 8px; text-align:left; font-size:14px; }
.empty { color:#9aa0ae; text-align:center; }
.btn-primary,.btn-light { border:none; border-radius:10px; padding:9px 12px; font-weight:700; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; }
.btn-primary { background:#f5c518; color:#111; }
.btn-light { background:#2a2a2a; color:#fff; }

@media (max-width: 760px) {
  .head { flex-direction: column; }
}
</style>
