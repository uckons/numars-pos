<template>
  <div class="kasir-dashboard">
    <!-- TOP BAR -->
        <header class="topbar">
      <div class="brand">
        <h1>SKY ePOS</h1>
        <span class="branch">{{auth.user?.branch_name
        || auth.user?.branch
        || auth.user?.branch?.name
        || "Outlet"}}</span>
      </div>

      <div class="user">
        <span class="name">{{ auth.user?.name || auth.user?.username || "User"  }}</span>
        <button class="change-pass" @click="changePassword">Ganti Password</button>
        <button class="logout" @click="logout">Logout</button>
      </div>
    </header>

    <!-- QUICK STATS -->
    <section class="stats">
      <div class="card">
        <p>Order Aktif</p>
        <h2>{{ stats.activeOrders }}</h2>
      </div>
      <div class="card">
        <p>Omset Hari Ini</p>
        <h2>Rp {{ format(stats.todayRevenue) }}</h2>
      </div>
      <div class="card">
        <p>Terapis Aktif</p>
        <h2>{{ stats.activeTherapists }}</h2>
      </div>
    </section>

    <!-- MAIN ACTION -->
      <section class="actions">
      <router-link to="/kasir/pos" class="action primary">
        ➕ Buat Order Baru
      </router-link>

      <router-link to="/kasir/orders" class="action">
        📋 Daftar Order
      </router-link>

      <router-link to="/kasir/reports" class="action">
        📊 Laporan
      </router-link>

      <router-link to="/kasir/bar-inbox" class="action inbox-link">
        📨 Inbox Bar
        <span v-if="unreadBarCount" class="notif-dot">{{ unreadBarCount }}</span>
      </router-link>

      <router-link to="/kasir/membership" class="action">
        👤 Membership
      </router-link>

      <button class="action attendance-action" type="button" @click="showAttendanceModal = true">
        👥 Absensi Terapis
      </button>
    </section>

    <div v-if="showAttendanceModal" class="attendance-modal-backdrop" @click.self="showAttendanceModal = false">
      <section class="attendance-modal card-panel">
        <div class="attendance-head">
          <div>
            <h3>Absensi Terapis</h3>
            <small v-if="attendanceBusinessDate">Tanggal bisnis: {{ attendanceBusinessDate }}</small>
          </div>
          <button class="btn-close-modal" @click="showAttendanceModal = false">✕</button>
        </div>

        <div class="attendance-toolbar">
          <input
            v-model.trim="attendanceSearch"
            class="attendance-search"
            type="text"
            placeholder="Cari nama terapis..."
            @keyup.enter="applyAttendanceFilters"
          >
          <select v-model="attendanceGradeId" class="attendance-grade" @change="applyAttendanceFilters">
            <option value="">Semua Grade</option>
            <option v-for="g in attendanceGrades" :key="g.id" :value="String(g.id)">{{ g.name }}</option>
          </select>
          <button class="btn-filter" @click="applyAttendanceFilters">Cari</button>
        </div>

        <div v-if="!therapistAttendance.length" class="empty">Belum ada data terapis.</div>
        <div v-else class="attendance-list">
          <div v-for="t in therapistAttendance" :key="t.id" class="attendance-row">
            <div class="attendance-name">
              <strong>{{ t.name }}</strong>
              <small class="grade-pill">{{ t.grade_name || '-' }}</small>
              <span class="badge" :class="`badge-${String(t.attendance_status || 'OFF').toLowerCase()}`">{{ t.attendance_status || 'OFF' }}</span>
              <small v-if="!t.has_attendance_pin" class="pin-warning">PIN belum diset</small>
            </div>
            <div class="attendance-actions">
              <button class="btn-state masuk" :disabled="isAttendanceButtonDisabled(t, 'MASUK')" @click="setTherapistAttendance(t, 'MASUK')">MASUK</button>
              <button class="btn-state off" :disabled="isAttendanceButtonDisabled(t, 'OFF')" @click="setTherapistAttendance(t, 'OFF')">OFF</button>
              <button class="btn-state close" :disabled="isAttendanceButtonDisabled(t, 'CLOSE')" @click="setTherapistAttendance(t, 'CLOSE')">CLOSE</button>
              <button class="btn-state absen" :disabled="isAbsenceButtonDisabled(t)" @click="addTherapistAbsence(t)">ABSEN +1 ({{ t.absence_qty || 0 }})</button>
            </div>
          </div>
        </div>

        <div class="attendance-pagination" v-if="attendancePagination.totalPages > 1">
          <button class="btn-page" :disabled="attendancePagination.page <= 1" @click="changeAttendancePage(attendancePagination.page - 1)">Prev</button>
          <span>Halaman {{ attendancePagination.page }} / {{ attendancePagination.totalPages }}</span>
          <button class="btn-page" :disabled="attendancePagination.page >= attendancePagination.totalPages" @click="changeAttendancePage(attendancePagination.page + 1)">Next</button>
        </div>
      </section>
    </div>

 
    <!-- TIMER GRID (AMAN) -->
    <section class="timers">
      <h3>Timer Terapis Aktif</h3>
<!--      
<pre style="color:yellow">
{{ timers }}
</pre>
-->
  <div class="timer-grid">
    <TimeCard
      v-for="t in visibleTimers"
      :key="t.slot"
      :timer="t"
      @start="openStartTimer"
      @stop="stopTimer"
      @extend="syncTimers"
    />
  </div>
</section>
    <!-- ?? TARUH DI SINI (PALING BAWAH) -->
    <StartTimerModal
      v-if="showStartModal"
      @close="showStartModal = false"
      @start="createManualTimer"
    />
  </div>
</template>


<script setup>
import { onMounted, ref, computed, onUnmounted } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "../../store/auth.store"
import TimeCard from "@/components/TimeCard.vue"
import api from "@/services/api"
import StartTimerModal from "@/components/StartTimerModal.vue"
import Swal from "sweetalert2"
import socket from "../../services/socket"

const router = useRouter()
const auth = useAuthStore()

const stats = ref({
  activeOrders: 0,
  todayRevenue: 0,
  activeTherapists: 0
})

const therapistAttendance = ref([])
const attendanceBusinessDate = ref('')
const showAttendanceModal = ref(false)
const attendanceSearch = ref('')
const attendanceGradeId = ref('')
const attendanceGrades = ref([])
const ATTENDANCE_PAGE_LIMIT = 10
const attendancePagination = ref({ page: 1, limit: ATTENDANCE_PAGE_LIMIT, totalRecords: 0, totalPages: 1 })
let attendanceInterval = null

const barMessages = ref([])
const unreadBarCount = computed(() => barMessages.value.filter(m => !m.is_read).length)
let barMessageInterval = null
let barPopupOpen = false
const BAR_MESSAGE_REFRESH_INTERVAL = 5000

const TIMER_SLOTS = 30

const timers = ref(
  Array.from({ length: 30 }, (_, i) => ({
    slot: i + 1,
    status: "EMPTY",
    id: null,
    order_id: null,
    service_name: null,
    therapist_name: null,
    room_name: null,
    start_time: null,
    planned_end_time: null,
    remaining_seconds: null,
    paused: false,
    warned: false
  }))
)
// Show all 30 slots (both empty and running)
const visibleTimers = computed(() => timers.value)

// Countdown interval
let countdownInterval = null
let apiRefreshInterval = null
let isSyncing = false

// Refresh intervals in milliseconds
const COUNTDOWN_INTERVAL = 1000    // 1 second
const API_REFRESH_INTERVAL = 30000 // 30 seconds

const format = n =>
  new Intl.NumberFormat("id-ID").format(n || 0)
// EXPOSE auth to window for quick debugging in browser console (remove after debug)
//if (typeof window !== "undefined") {
//  window.__auth = auth
//  console.log("Auth store (kasir):", auth.user)
//}

const changePassword = async () => {
  const { value: formValues } = await Swal.fire({
    title: 'Ganti Password',
    html:
      '<input id="swal-current-password" class="swal2-input" type="password" placeholder="Password lama">' +
      '<input id="swal-new-password" class="swal2-input" type="password" placeholder="Password baru">',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Simpan',
    cancelButtonText: 'Batal',
    preConfirm: () => {
      const current_password = document.getElementById('swal-current-password')?.value || ''
      const new_password = document.getElementById('swal-new-password')?.value || ''
      const policy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/
      if (!current_password || !new_password) {
        Swal.showValidationMessage('Password lama dan password baru wajib diisi')
        return false
      }
      if (!policy.test(new_password)) {
        Swal.showValidationMessage('Password baru minimal 8 karakter dan wajib huruf besar, huruf kecil, angka, dan karakter khusus dan jangan gunakan tanda @')
        return false
      }
      return { current_password, new_password }
    }
  })
  if (!formValues) return

  try {
    await api.put('/users/change-password', formValues)
    await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Password berhasil diubah' })
  } catch (err) {
    await Swal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || 'Gagal mengubah password' })
  }
}

const logout = () => {
  auth.logout()
  router.push("/login")
}

const loadDashboard = async () => {
  try {
    const headers = {
      Authorization: `Bearer ${auth.token}`
    }

    const s = await fetch("/api/dashboard/kasir", { headers })
    const contentType = String(s.headers.get("content-type") || "").toLowerCase()

    if (!s.ok) {
      const raw = await s.text().catch(() => "")
      throw new Error(`Dashboard API ${s.status}: ${raw.slice(0, 120) || "unknown error"}`)
    }

    if (!contentType.includes("application/json")) {
      const raw = await s.text().catch(() => "")
      throw new Error(`Dashboard API bukan JSON: ${raw.slice(0, 120) || "empty response"}`)
    }

    stats.value = await s.json()
  } catch (err) {
    console.error("Failed to load dashboard stats:", err)
    stats.value = {
      activeOrders: 0,
      todayRevenue: 0,
      activeTherapists: 0
    }
  }
}
const selectedSlot = ref(null)
const showStartModal = ref(false)

const openStartTimer = (slot) => {
  selectedSlot.value = slot
  showStartModal.value = true
}

const stopTimer = async (timerId) => {
  try {
    const timer = timers.value.find(t => t.id === timerId)
    if (!timer) {
      Swal.fire({
        icon: "error",
        title: "Gagal Stop Timer",
        text: "Timer tidak ditemukan",
        background: "#111",
        color: "#fff"
      })
      return
    }

    await api.post(`/timers/${timerId}/stop`)
    
    Swal.fire({
      icon: "success",
      title: "Timer Dihentikan",
      text: "Timer berhasil dihentikan dan masuk ke order list",
      timer: 1500,
      showConfirmButton: false,
      background: "#111",
      color: "#fff"
    })
    
    await syncTimers()
  } catch (err) {
    console.error("Failed to stop timer:", err)
    Swal.fire({
      icon: "error",
      title: "Gagal Stop Timer",
      text: err.response?.data?.message || "Silakan coba lagi",
      background: "#111",
      color: "#fff"
    })
  }
}
const createManualTimer = async (data) => {
  showStartModal.value = false

  try {
    await api.post("/timers/start", {
      slot: selectedSlot.value,
      service_id: data.service_id,
      service_ids: data.service_ids || [data.service_id],
      service_type: data.service_type,
      therapist_id: data.therapist_id,
      therapist_ids: data.therapist_ids || [],
      combo_qty: data.combo_qty || 1,
      room_id: data.room_id,
      duration_minutes: data.duration_minutes,
      order_type: data.order_type,
      karaoke_fnb_items: Array.isArray(data.karaoke_fnb_items) ? data.karaoke_fnb_items : [],
      guest_name: data.guest_name || null
    })

    await syncTimers()
  } catch (err) {
    console.error("Failed to start timer:", err)
    alert(err.response?.data?.message || "Gagal memulai timer. Silakan coba lagi.")
  }
}
const syncTimers = async () => {
  if (isSyncing) return
  
  try {
    isSyncing = true
    const response = await api.get("/timers/slots", {
      params: { branch_id: auth.user.branch_id }
    })
    const slots = response.data
    
    slots.forEach((slot, index) => {
      if (index < timers.value.length) {
        Object.assign(timers.value[index], {
          slot: slot.slot_number,
          status: slot.status,
          id: slot.timer_id || null,
          order_id: slot.order_id,
          service_id: slot.service_id,
          service_name: slot.service_name,
          therapist_name: slot.therapist_name,
          room_name: slot.room_name,
          start_time: slot.start_time,
          planned_end_time: slot.planned_end_time,
          remaining_seconds: slot.remaining_seconds,
          paused: false,
          warned: false
        })
      }
    })
  } catch (err) {
    console.error("Failed to sync timers:", err)
  } finally {
    isSyncing = false
  }
}
const updateCountdown = () => {
  timers.value.forEach(t => {
    if (t.status === "RUNNING" && t.remaining_seconds > 0) {
      t.remaining_seconds--
      
      if (t.remaining_seconds <= 0 && !t.warned) {
        t.warned = true
        
        Swal.fire({
          icon: "info",
          title: "⏰ Timer Selesai",
          html: `
            <strong>${t.therapist_name || "Terapis"}</strong><br/>
            <small>${t.service_name || "Service"}</small><br/>
            Timer telah selesai dan masuk ke order list
          `,
          confirmButtonText: "OK",
          background: "#111",
          color: "#fff",
          confirmButtonColor: "#c9a24d"
        })
        
        console.warn(`⏰ Timer selesai: ${t.therapist_name || "Terapis"}`)
        syncTimers()
      }
    }
  })
}

const loadBarMessages = async () => {
  try {
    const res = await api.get('/orders/bar/messages')
    const rows = Array.isArray(res.data?.data)
      ? res.data.data
      : (Array.isArray(res.data) ? res.data : [])
    barMessages.value = rows
  } catch (err) {
    console.error('Gagal load bar messages', err)
  }
}

const markBarMessageRead = async (messageId) => {
  await api.post(`/orders/bar/messages/${messageId}/read`)
  await loadBarMessages()
}

const showUnreadBarRepopup = async () => {
  if (barPopupOpen) return

  const unread = barMessages.value.find(m => !m.is_read)
  if (!unread) return

  barPopupOpen = true
  try {
    const result = await Swal.fire({
      icon: unread.type === 'CANCELLED' ? 'warning' : 'info',
      title: unread.title || 'Message dari Staff Bar',
      text: unread.message || 'Ada update baru dari bar',
      showCancelButton: true,
      confirmButtonText: 'Tandai Dibaca',
      cancelButtonText: 'Nanti'
    })

    if (result.isConfirmed) {
      await markBarMessageRead(unread.id)
    }
  } finally {
    barPopupOpen = false
  }
}

const loadAttendanceGrades = async () => {
  try {
    const { data } = await api.get('/grades')
    attendanceGrades.value = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
  } catch (err) {
    console.error('Gagal load grade absensi', err)
    attendanceGrades.value = []
  }
}

const loadTherapistAttendance = async (page = attendancePagination.value.page) => {
  try {
    const params = {
      page,
      limit: ATTENDANCE_PAGE_LIMIT
    }
    if (attendanceSearch.value) params.search = attendanceSearch.value
    if (attendanceGradeId.value) params.grade_id = attendanceGradeId.value

    const { data } = await api.get('/therapists/attendance', { params })
    therapistAttendance.value = Array.isArray(data?.data) ? data.data : []
    attendanceBusinessDate.value = data?.business_date || ''
    attendancePagination.value = {
      page: Number(data?.pagination?.page || page),
      limit: Number(data?.pagination?.limit || ATTENDANCE_PAGE_LIMIT),
      totalRecords: Number(data?.pagination?.totalRecords || therapistAttendance.value.length),
      totalPages: Number(data?.pagination?.totalPages || 1)
    }
  } catch (err) {
    console.error('Gagal load absensi terapis', err)
    therapistAttendance.value = []
  }
}

const applyAttendanceFilters = async () => {
  await loadTherapistAttendance(1)
}

const changeAttendancePage = async (nextPage) => {
  if (nextPage < 1 || nextPage > attendancePagination.value.totalPages) return
  await loadTherapistAttendance(nextPage)
}

const isAttendanceButtonDisabled = (therapist, targetStatus) => {
  const current = String(therapist?.attendance_status || 'OFF').toUpperCase()
  const target = String(targetStatus || '').toUpperCase()

  if (current === 'MASUK') {
    if (target === 'MASUK' || target === 'OFF') return true
    return false
  }
  if (current === 'OFF') {
    if (target === 'OFF' || target === 'CLOSE') return true
    return false
  }
  if (current === 'CLOSE') {
    if (target === 'CLOSE') return true
    return false
  }
  return !(target === 'MASUK' || target === 'OFF')
}

const setTherapistAttendance = async (therapist, targetStatus) => {
  const status = String(targetStatus || '').toUpperCase()
  let pin = ''

  if ((status === 'MASUK' || status === 'CLOSE') && !therapist?.has_attendance_pin) {
    await Swal.fire({
      icon: 'warning',
      title: 'PIN belum diset',
      text: 'PIN absensi terapis diset di menu Master Terapis.'
    })
    return
  }

  if (status === 'MASUK' || status === 'CLOSE') {
    const pinAsk = await Swal.fire({
      title: `PIN ${status} - ${therapist?.name || 'Terapis'}`,
      input: 'password',
      inputLabel: 'Masukkan PIN',
      inputPlaceholder: 'PIN',
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      inputValidator: (value) => {
        if (!String(value || '').trim()) return 'PIN wajib diisi'
        return null
      }
    })

    if (!pinAsk.isConfirmed) return
    pin = String(pinAsk.value || '').trim()
  }

  try {
    await api.post(`/therapists/attendance/${therapist.id}`, { status, pin: pin || undefined })
    await loadTherapistAttendance()
  } catch (err) {
    await Swal.fire({
      icon: 'error',
      title: 'Gagal update absensi',
      text: err.response?.data?.message || err.message || 'Terjadi kesalahan'
    })
  }
}



const isAbsenceButtonDisabled = (therapist) => {
  const status = String(therapist?.attendance_status || 'OFF').toUpperCase()
  const absenceQty = Number(therapist?.absence_qty || 0)
  return status === 'MASUK' || absenceQty >= 1
}

const addTherapistAbsence = async (therapist) => {
  try {
    await api.post(`/therapists/attendance/${therapist.id}/absen`, { qty: 1 })
    await loadTherapistAttendance()
  } catch (err) {
    await Swal.fire({
      icon: 'error',
      title: 'Gagal tambah absen',
      text: err.response?.data?.message || err.message || 'Terjadi kesalahan'
    })
  }
}

const formatMessageDate = (v) => new Date(v).toLocaleString('id-ID')

onMounted(async () => {
  socket.emit("join-branch", {
    branch_id: auth.user?.branch_id,
    role: auth.user?.role,
    user_id: auth.user?.id
  })

  socket.on("bar:order:update", async (payload) => {
    await loadBarMessages()
    await Swal.fire({
      icon: payload.status === "READY" ? "success" : "warning",
      title: payload.status === "READY" ? `Order #${payload.order_id} siap dikirim` : `Order #${payload.order_id} dibatalkan`,
      text: payload.note ? `${payload.message}
Alasan: ${payload.note}` : (payload.message || "Update dari staff bar")
    })
    await showUnreadBarRepopup()
  })

  await Promise.allSettled([
    loadDashboard(),
    syncTimers(),
    loadBarMessages(),
    loadAttendanceGrades(),
    loadTherapistAttendance()
  ])
  await showUnreadBarRepopup()

  // Start countdown interval (every 1 second)
  countdownInterval = setInterval(updateCountdown, COUNTDOWN_INTERVAL)

  // Start API refresh interval (every 30 seconds)
  apiRefreshInterval = setInterval(syncTimers, API_REFRESH_INTERVAL)
  barMessageInterval = setInterval(async () => {
    await loadBarMessages()
    await showUnreadBarRepopup()
  }, BAR_MESSAGE_REFRESH_INTERVAL)

  attendanceInterval = setInterval(async () => {
    const prevBusinessDate = attendanceBusinessDate.value
    await loadTherapistAttendance()
    if (prevBusinessDate && attendanceBusinessDate.value && prevBusinessDate !== attendanceBusinessDate.value) {
      await Swal.fire({ icon: 'info', title: 'Shift absensi terapis diperbarui', text: 'Tanggal bisnis baru dimulai sesuai jam tutup outlet.' })
    }
  }, 60000)
})

onUnmounted(() => {
  socket.off("bar:order:update")
  if (countdownInterval) clearInterval(countdownInterval)
  if (apiRefreshInterval) clearInterval(apiRefreshInterval)
  if (barMessageInterval) clearInterval(barMessageInterval)
  if (attendanceInterval) clearInterval(attendanceInterval)
})

</script>

<style scoped>
.kasir-dashboard {
  min-height: 100vh;
  background: #0e0e0e;
  color: #fff;
  padding: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

/* ======================
   TOPBAR
====================== */
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid #222;
}

.brand h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: .5px;
  color: #c9a24d;
}

.branch {
  display: block;
  margin-top: 2px;
  font-size: 14px;
  font-weight: bold;
  color: #ffffff;
}

.user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user .name {
  font-size: 13px;
  font-weight: bold;
  color: #ffffff;
}

.change-pass {
  background: transparent;
  border: 1px solid #c9a24d;
  color: #c9a24d;
  border-radius: 10px;
  padding: 8px 12px;
  font-weight: 700;
  margin-right: 8px;
}

.logout {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  background: #c0392b;
  border: 1px solid #333;
  color: white;
  cursor: pointer;
}

/* ======================
   STATS
====================== */
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  margin: 22px 0;
}

.card {
  background: #111;
  border: 1px solid #222;
  border-radius: 14px;
  padding: 18px 16px;
  text-align: center;
}

.card p {
  margin: 0 0 6px;
  font-size: 12px;
  color: #888;
  letter-spacing: .3px;
}

.card h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #c9a24d;
}

/* ======================
   ACTIONS
====================== */
.actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 26px;
}

.action {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 54px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  background: #111;
  border: 1px solid #222;
  color: #fff;
  transition: all .15s ease;
}

.action:hover {
  border-color: #c9a24d;
  transform: translateY(-2px);
}

.action.primary {
  background: #c9a24d;
  color: #000;
  border-color: #c9a24d;
}

.inbox-link {
  position: relative;
}

.notif-dot {
  position: absolute;
  top: 8px;
  right: 10px;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #e74c3c;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}

.attendance-action {
  border: 1px solid #2d3640;
}

.attendance-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 30;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 64px 18px 18px;
}

.attendance-modal {
  width: min(980px, 100%);
  max-height: 80vh;
  overflow: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
}

.btn-close-modal {
  border: 1px solid #333;
  background: #161616;
  color: #eee;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  cursor: pointer;
}


.card-panel {
  background: #111;
  border: 1px solid #222;
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 18px;
}
.attendance-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.attendance-head h3 { margin:0; font-size:16px; }
.attendance-head small { color:#999; }

.attendance-toolbar { display:flex; gap:8px; margin-bottom:10px; }
.attendance-search, .attendance-grade { background:#0e0e0e; border:1px solid #2c2c2c; color:#fff; border-radius:8px; padding:8px 10px; }
.attendance-search { flex:1; min-width:220px; }
.btn-filter { border:none; border-radius:8px; padding:8px 12px; font-weight:700; background:#c9a24d; color:#111; cursor:pointer; }
.grade-pill { color:#8f8f8f; font-size:11px; border:1px solid #303030; border-radius:999px; padding:2px 8px; }
.attendance-pagination { display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top:12px; }
.btn-page { border:1px solid #333; background:#171717; color:#fff; border-radius:8px; padding:6px 10px; cursor:pointer; }
.btn-page:disabled { opacity:.45; cursor:not-allowed; }
.attendance-list { display:grid; gap:10px; }
.attendance-row { display:flex; justify-content:space-between; align-items:center; border:1px solid #242424; border-radius:10px; padding:10px; }
.attendance-name { display:flex; align-items:center; gap:8px; }
.pin-warning { color:#f39c12; font-size:11px; font-weight:700; }
.attendance-actions { display:flex; gap:8px; }
.btn-state { border:none; border-radius:8px; padding:6px 10px; font-weight:700; cursor:pointer; }
.btn-state.masuk { background:#1f8f4f; color:#fff; }
.btn-state.off { background:#9a7d0a; color:#111; }
.btn-state.close { background:#4d4d4d; color:#fff; }
.btn-state.absen { background:#5a3a00; color:#fbbf24; }
.btn-state:disabled { opacity:.45; cursor:not-allowed; }
.badge { padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; }
.badge-masuk { background:#1f8f4f; color:#fff; }
.badge-off { background:#9a7d0a; color:#111; }
.badge-close { background:#4d4d4d; color:#fff; }

/* ======================
   TIMERS
====================== */
.timers h3 {
  margin: 0 0 14px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.timer-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  align-items: stretch;
}

@media (max-width: 1920px) {
  .timer-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

@media (max-width: 1440px) {
  .timer-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1024px) {
  .timer-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .timer-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}


.empty {
  color: #666;
  font-size: 13px;
  font-style: italic;
}

/* ======================
   POS LAYOUT SLOT
====================== */
.pos-body {
  display: grid;
  grid-template-columns: 1fr 420px;
  height: 100%;
}

.left {
  padding: 16px;
  overflow-y: auto;
}

.right {
  border-left: 1px solid #222;
}

/* ======================
   MOBILE
====================== */
@media (max-width: 768px) {
  .brand h1 {
    font-size: 18px;
  }

  .card h2 {
    font-size: 22px;
  }

  .pos-body {
    grid-template-columns: 1fr;
  }

  .right {
    border-left: none;
    border-top: 1px solid #222;
  }
}


.action:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(0,0,0,.28);
}


</style>
