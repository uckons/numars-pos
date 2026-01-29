<template>
  <div class="timer-card" :class="color">
    <h4>{{ timer.room }}</h4>
    <p class="therapist">{{ timer.therapist }}</p>
    <p class="service">{{ timer.service }}</p>

    <div class="time">
      {{ formattedTime }}
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue"

const props = defineProps({
  timer: Object
})

const remainingSeconds = computed(() => 
  props.timer.remaining_seconds || 0
)

const remainingMinutes = computed(() => 
  Math.ceil(remainingSeconds.value / 60)
)

const formattedTime = computed(() => {
  const seconds = remainingSeconds.value
  if (seconds <= 0) return "0:00"
  
  const totalMinutes = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  
  // Format as HH:MM:SS if >= 1 hour, otherwise MM:SS
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  } else {
    return `${m}:${String(s).padStart(2, '0')}`
  }
})

const color = computed(() => {
  const minutes = remainingMinutes.value
  if (minutes <= 10) return "red"
  if (minutes <= 30) return "yellow"
  return "green"
})
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
  font-size: 17px;
  font-weight: 600;
  color: #fff;
}

.therapist {
  color: #ddd;
  font-size: 14px;
  margin-top: 4px;
  font-weight: 500;
}

.service {
  font-size: 12px;
  color: #c9a24d;
  margin-top: 2px;
}

.time {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 700;
  color: #fff;
}
</style>
