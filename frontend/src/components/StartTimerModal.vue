<template>
  <div class="overlay">
    <div class="modal">
      <h2>Mulai Timer</h2>

      <!-- ERROR MESSAGE -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- SERVICE SELECTION -->
      <div class="field">
        <label>Pilih Service</label>
        <select v-model="selectedService" :disabled="loading">
          <option value="">-- Pilih Service --</option>
          <option v-for="service in services" :key="service.id" :value="service">
            {{ service.name }} ({{ service.duration_minutes }} menit)
          </option>
        </select>
      </div>

      <!-- THERAPIST -->
      <div class="field">
        <label>Pilih Terapis</label>
        <select v-model="selectedTherapist" :disabled="loading || !serviceType">
          <option value="">-- Pilih Terapis --</option>
          <option v-for="therapist in therapists" :key="therapist.id" :value="therapist">
            {{ therapist.name }}
          </option>
        </select>
        <div v-if="loadingTherapists" class="loading-text">Memuat terapis...</div>
      </div>

      <!-- ROOM -->
      <div class="field">
        <label>Pilih Room</label>
        <select v-model="selectedRoom" :disabled="loading || !serviceType">
          <option value="">-- Pilih Room --</option>
          <option 
            v-for="room in rooms" 
            :key="room.id" 
            :value="room"
            :disabled="room.is_occupied"
          >
            {{ room.name }} {{ room.is_occupied ? '❌ Terisi' : '✅ Tersedia' }}
          </option>
        </select>
        <div v-if="loadingRooms" class="loading-text">Memuat rooms...</div>
      </div>

      <!-- DURATION (AUTO-FILLED, READONLY) -->
      <div class="duration">
        ⏱ Durasi: <strong>{{ duration }} menit</strong>
      </div>

      <!-- ACTIONS -->
      <div class="actions">
        <button class="cancel" @click="$emit('close')">
          Batal
        </button>
        <button 
          class="start" 
          @click="submit"
          :disabled="!canSubmit || loading"
        >
          {{ loading ? 'Memproses...' : 'Mulai' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue"
import api from "@/services/api"
import { useAuthStore } from "@/store/auth.store"

const emit = defineEmits(["close", "start"])
const auth = useAuthStore()

// State
const services = ref([])
const therapists = ref([])
const rooms = ref([])
const selectedService = ref(null)
const selectedTherapist = ref(null)
const selectedRoom = ref(null)
const loading = ref(false)
const loadingServices = ref(false)
const loadingTherapists = ref(false)
const loadingRooms = ref(false)
const error = ref("")

// Computed
const serviceType = computed(() => selectedService.value?.type || "")
const duration = computed(() => selectedService.value?.duration_minutes || 0)

const canSubmit = computed(() => {
  return selectedService.value && 
         selectedTherapist.value && 
         selectedRoom.value && 
         !selectedRoom.value.is_occupied
})

// Watch service type changes to reload therapists and rooms
watch(serviceType, (newType) => {
  if (newType) {
    fetchTherapists()
    fetchRooms()
  }
})

// Fetch services on mount
onMounted(async () => {
  await fetchServices()
})

// Fetch all services (will be filtered by type on selection)
const fetchServices = async () => {
  loadingServices.value = true
  error.value = ""
  
  try {
    const response = await api.get("/services", {
      params: {
        branch_id: auth.user.branch_id,
        is_active: true
      }
    })
    
    // Filter to only show SPA and LC services with duration
    services.value = response.data.filter(s => 
      (s.type === 'SPA' || s.type === 'LC') && s.duration_minutes
    )
  } catch (err) {
    console.error("Error fetching services:", err)
    error.value = "Gagal memuat daftar service"
  } finally {
    loadingServices.value = false
  }
}

// Fetch therapists filtered by service type
const fetchTherapists = async () => {
  if (!serviceType.value) return
  
  loadingTherapists.value = true
  error.value = ""
  
  try {
    const response = await api.get("/timers/therapists", {
      params: {
        branch_id: auth.user.branch_id,
        service_type: serviceType.value
      }
    })
    therapists.value = response.data
  } catch (err) {
    console.error("Error fetching therapists:", err)
    error.value = "Gagal memuat daftar terapis"
  } finally {
    loadingTherapists.value = false
  }
}

// Fetch rooms filtered by service type
const fetchRooms = async () => {
  if (!serviceType.value) return
  
  loadingRooms.value = true
  error.value = ""
  
  try {
    const response = await api.get("/timers/rooms", {
      params: {
        branch_id: auth.user.branch_id,
        service_type: serviceType.value
      }
    })
    rooms.value = response.data
  } catch (err) {
    console.error("Error fetching rooms:", err)
    error.value = "Gagal memuat daftar room"
  } finally {
    loadingRooms.value = false
  }
}

const submit = async () => {
  if (!canSubmit.value) {
    error.value = "Mohon lengkapi semua field"
    return
  }

  if (selectedRoom.value.is_occupied) {
    error.value = "Room yang dipilih sedang terisi"
    return
  }

  loading.value = true
  error.value = ""

  try {
    emit("start", {
      service_id: selectedService.value.id,
      service_type: selectedService.value.type,
      therapist_id: selectedTherapist.value.id,
      therapist_name: selectedTherapist.value.name,
      room_id: selectedRoom.value.id,
      room_name: selectedRoom.value.name,
      duration: duration.value
    })
  } catch (err) {
    console.error("Error starting timer:", err)
    error.value = "Gagal memulai timer"
    loading.value = false
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal {
  width: 400px;
  background: #0f0f0f;
  border: 1px solid #222;
  border-radius: 16px;
  padding: 20px;
  color: #fff;
  max-height: 90vh;
  overflow-y: auto;
}

h2 {
  margin: 0 0 16px;
  font-size: 18px;
}

.error-message {
  background: #ff4444;
  color: #fff;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}

.field {
  margin-bottom: 12px;
}

label {
  font-size: 12px;
  color: #aaa;
  display: block;
  margin-bottom: 4px;
}

select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #222;
  background: #111;
  color: #fff;
  cursor: pointer;
}

select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

select option:disabled {
  color: #666;
}

.loading-text {
  font-size: 11px;
  color: #c9a24d;
  margin-top: 4px;
}

.duration {
  margin: 14px 0;
  font-size: 14px;
  color: #c9a24d;
  text-align: center;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

button {
  flex: 1;
  padding: 10px;
  border-radius: 12px;
  border: none;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel {
  background: #222;
  color: #aaa;
}

.start {
  background: #c9a24d;
  color: #000;
}

.start:hover:not(:disabled) {
  opacity: 0.9;
}
</style>
