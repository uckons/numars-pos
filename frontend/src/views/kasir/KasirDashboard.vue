<template>
  <div class="kasir-dashboard">
    <!-- TOP BAR -->
        <header class="topbar">
      <div class="brand">
        <h1>NUMARS POS</h1>
        <span class="branch">{{ auth.user.branch_name || "Outlet" }}</span>
      </div>

      <div class="user">
        <span class="name">{{ auth.user.name }}</span>
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

      <router-link to="/kasir/payments" class="action">
        💳 Pembayaran
      </router-link>
    </section>
 
    <!-- TIMER GRID (AMAN) -->
    <section class="timers">
      <h3>Timer Terapis Aktif</h3>
<!--      
<pre style="color:yellow">
{{ timers }}
</pre>
-->
 <div v-if="visibleTimers.length === 0">
    Tidak ada timer berjalan
  </div>

  <div class="timer-grid">
    <TimeCard
      v-for="t in visibleTimers"
      :key="t.slot"
      :timer="t"
      @start="openStartTimer"
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
import { watch } from "vue"
import StartTimerModal from "@/components/StartTimerModal.vue"

const router = useRouter()
const auth = useAuthStore()

const stats = ref({
  activeOrders: 0,
  todayRevenue: 0,
  activeTherapists: 0
})

const TIMER_SLOTS = 30

const timers = ref(
  Array.from({ length: 30 }, (_, i) => ({
    slot: i + 1,
    status: "EMPTY", // ?? PENTING

    order_id: null,
    service_type: null, // SPA | LC
    therapist_name: null,
    room_no: null,      // SPA
    sofa_no: null,      // LC

    start_time: null,
    planned_end_time: null,
    paused: false,
    warned: false
  }))
)
const visibleTimers = computed(() => timers.value.slice(0, 12))

const format = n =>
  new Intl.NumberFormat("id-ID").format(n || 0)

const logout = () => {
  auth.logout()
  router.push("/login")
}

const loadDashboard = async () => {
  const headers = {
    Authorization: `Bearer ${auth.token}`
  }

  const s = await fetch("/api/dashboard/kasir", { headers })
  stats.value = await s.json()

//  const t = await fetch("/api/timers/active", { headers })
//  timers.value = await t.json()
}
const selectedSlot = ref(null)
const showStartModal = ref(false)

const openStartTimer = (slot) => {
  selectedSlot.value = slot
  showStartModal.value = true
}
/* ?????? KODE KAMU DI SINI ?????? */
const createManualTimer = async (data) => {
  showStartModal.value = false

  const slot = timers.value.find(t => t.slot === selectedSlot.value)
  if (!slot) return

  const start = new Date()
  const end = new Date(start.getTime() + data.duration * 60000)

  // Update local state
  Object.assign(slot, {
    status: "RUNNING",
    service_type: data.service_type,
    therapist_name: data.therapist_name,
    therapist_id: data.therapist_id,
    room_no: data.room_name || data.room_no || null,
    room_id: data.room_id || null,
    service_id: data.service_id,
    start_time: start,
    planned_end_time: end,
    paused: false,
    warned: false
  })

  try {
    // TODO: Save to backend with proper order integration
    // This requires creating an order first, then starting the timer
    // For now, timer is tracked in local state only
    // Backend integration should be:
    // 1. Create order (if not exists)
    // 2. Call POST /api/timers/start with { order_id, therapist_id, room_id, service_id, duration_minutes }
    console.log("Timer started with data:", {
      therapist_id: data.therapist_id,
      room_id: data.room_id,
      service_id: data.service_id,
      duration_minutes: data.duration
    })
  } catch (err) {
    console.error("Error creating timer:", err)
    // Revert local state on error
    Object.assign(slot, {
      status: null,
      service_type: null,
      therapist_name: null,
      therapist_id: null,
      room_no: null,
      room_id: null,
      service_id: null,
      start_time: null,
      planned_end_time: null,
      paused: false,
      warned: false
    })
    alert("Gagal membuat timer: " + (err.response?.data?.message || err.message))
  }
}
const syncTimers = async () => {
  const headers = {
   Authorization: `Bearer ${auth.token}`
  }
  const res = await fetch("/api/timers/active", { headers })
  const activeTimers = await res.json()
  // 🔥 RESET SLOT
  timers.value.forEach(t => {
    Object.assign(t, {
      active: false,
      warned: false,
      order_id: null,
      therapist_name: null,
      start_time: null,
      planned_end_time: null,
      paused: false
    })
  })
  activeTimers.forEach(at => {
    const slot = timers.value.find(t => !t.active)
    if (!slot) return

    Object.assign(slot, {
      active: true,
      order_id: at.order_id,
      therapist_name: at.therapist_name,
      start_time: at.start_time,
      planned_end_time: at.planned_end_time
    })
  })
}
onMounted(async () => {
  await loadDashboard()
  await syncTimers()
})

watch(
  timers,
  (list) => {
    const now = Date.now()

    list.forEach(t => {
      if (!t.planned_end_time || t.warned) return

      const remaining =
        new Date(t.planned_end_time).getTime() - now

      if (remaining <= 10 * 60 * 1000 && remaining > 0) {
        t.warned = true

        // UI alert (sementara)
        console.warn(`⏰ Timer hampir habis: ${t.therapist_name || "Terapis"}`)

        // 🔔 nanti bisa ganti toast / sound / modal
      }
    })
  },
  { deep: true }
)
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
  font-size: 12px;
  color: #888;
}

.user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user .name {
  font-size: 13px;
  color: #aaa;
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
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  align-items: stretch;
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


</style>
