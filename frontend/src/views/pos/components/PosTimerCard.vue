<template>
  <div class="timer-card" :class="color">
    <h4>{{ timer.room }}</h4>
    <p class="therapist">{{ timer.therapist }}</p>
    <p class="service">{{ timer.service }}</p>

    <div class="time">
      {{ formatTime(remaining) }}
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue"

const props = defineProps({
  timer: Object
})

const remaining = computed(() => {
  // Use remaining_seconds if available, otherwise fall back to remaining_minutes
  if (props.timer.remaining_seconds != null) {
    return Math.max(0, props.timer.remaining_seconds)
  }
  return Math.max(0, Math.ceil(props.timer.remaining_minutes || 0)) * 60
})

const color = computed(() => {
  const minutes = Math.floor(remaining.value / 60)
  if (minutes <= 10) return "red"
  if (minutes <= 30) return "yellow"
  return "green"
})

const formatTime = (seconds) => {
  if (seconds == null) return "--"
  
  const totalMinutes = Math.floor(seconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const s = seconds % 60
  
  if (h > 0) {
    // Format as HH:MM:SS when >= 1 hour
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  } else {
    // Format as MM:SS when < 1 hour
    return `${m}:${s.toString().padStart(2, '0')}`
  }
}
</script>

<style scoped>
.timer-card {
  border-radius: 16px;
  padding: 14px;
  background: #111;
  box-shadow: 0 12px 40px rgba(0,0,0,.4);
  transition: .25s;
}

.timer-card:hover {
  transform: translateY(-4px);
}

.green { border-left: 6px solid #2ecc71 }
.yellow { border-left: 6px solid #f1c40f }
.red { border-left: 6px solid #e74c3c }

h4 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.therapist {
  color: #ddd;
  font-size: 15px;
  margin-top: 4px;
  font-weight: 500;
}

.service {
  font-size: 12px;
  color: #c9a24d;
}

.time {
  margin-top: 10px;
  font-size: 26px;
  font-weight: 700;
}
</style>
