<template>
  <div class="timer-grid">
    <div
      v-for="t in timers"
      :key="t.id"
      class="timer-card"
      :class="statusClass(t.remaining_seconds)"
    >
      <h4>{{ t.room_name || "Room ?" }}</h4>
      <p class="therapist">{{ t.therapist_name || "-" }}</p>
      <p class="time">{{ formatTime(t.remaining_seconds) }}</p>
    </div>

    <div v-if="!timers.length" class="empty">
      Tidak ada timer aktif
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue"
import api from "@/services/api"
import { formatSecondsToTime } from "@/utils/timeFormat"

const timers = ref([]) // ✅ WAJIB DEFAULT ARRAY
let tickInterval = null
let reloadInterval = null
let tickCount = 0

const loadTimers = async () => {
  try {
    console.log('[PosTimerGrid] Reloading timers from backend...')
    const res = await api.get("/timers/active")
    const rawTimers = res.data || []
    
    // Convert remaining_minutes to remaining_seconds
    timers.value = rawTimers.map(t => ({
      ...t,
      remaining_seconds: (t.remaining_minutes || 0) * 60
    }))
    
    console.log(`[PosTimerGrid] Loaded ${timers.value.length} timers`)
  } catch (e) {
    console.error("Timer load failed", e)
    timers.value = []
  }
}

const tick = () => {
  tickCount++
  
  // Log every 30 seconds instead of every second
  if (tickCount % 30 === 0) {
    console.log(`[PosTimerGrid] Tick count: ${tickCount}`)
  }
  
  // Decrement each timer by 1 second
  timers.value = timers.value.map(t => ({
    ...t,
    remaining_seconds: Math.max(0, t.remaining_seconds - 1)
  }))
  // Note: We don't filter out expired timers here - let backend handle that on next reload
}

onMounted(async () => {
  console.log('[PosTimerGrid] Component mounted, starting timers...')
  await loadTimers()
  
  // Tick every 1 second for smooth UI updates
  tickInterval = setInterval(tick, 1000)
  
  // Reload from backend every 30 seconds to resync
  reloadInterval = setInterval(loadTimers, 30000)
})

onUnmounted(() => {
  console.log('[PosTimerGrid] Component unmounted, clearing intervals')
  if (tickInterval) clearInterval(tickInterval)
  if (reloadInterval) clearInterval(reloadInterval)
})

const statusClass = (seconds) => {
  const minutes = Math.ceil(seconds / 60)
  if (minutes <= 10) return "danger"
  if (minutes <= 30) return "warning"
  return "success"
}

const formatTime = formatSecondsToTime
</script>

<style scoped>
.timer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.timer-card {
  background: #111;
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
  transition: .2s;
}

.timer-card:hover {
  transform: translateY(-3px);
}

.timer-card.success { border-left: 4px solid #2ecc71 }
.timer-card.warning { border-left: 4px solid #f1c40f }
.timer-card.danger  { border-left: 4px solid #e74c3c }

h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.therapist {
  font-size: 14px;
  color: #ddd;
  margin-top: 4px;
  font-weight: 500;
}

.time {
  font-size: 24px;
  font-weight: bold;
  margin-top: 6px;
  color: #fff;
}

.empty {
  grid-column: 1 / -1;
  text-align: center;
  color: #777;
  padding: 40px;
}
</style>
