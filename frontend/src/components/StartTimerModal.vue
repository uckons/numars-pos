<template>
<div class="overlay">
  <div class="modal">
    <div class="modal-header">
      <h2>Mulai Timer</h2>
      <span class="subtitle">Atur service & terapis</span>
    </div>

    <div class="divider"></div>

    <div class="field">
      <label>Tipe Layanan</label>
      <select v-model="selectedOrderType" @change="onTypeChange" :disabled="loadingServices">
        <option value="SINGLE">Single</option>
        <option value="COMBO">Combo</option>
      </select>
    </div>

    <div class="field">
      <label>Qty Service</label>
      <select
        v-model.number="selectedServiceQty"
        @change="onQtyChange"
        :disabled="loadingServices || selectedOrderType === 'SINGLE'"
      >
        <option v-for="n in serviceQtyOptions" :key="n" :value="n">{{ n }}</option>
      </select>
    </div>

    <div class="field">
      <label>{{ selectedServiceQty > 1 ? 'Service per Slot' : 'Pilih Service' }}</label>
      <div class="therapist-grid">
        <select
          v-for="idx in selectedServiceQty"
          :key="`svc-${idx}`"
          v-model="selectedServiceIds[idx - 1]"
          @change="onServiceSelectionChange"
          :disabled="loadingServices"
        >
          <option value="">-- Pilih Service #{{ idx }} --</option>
          <option v-for="svc in selectableServices" :key="`opt-${idx}-${svc.id}`" :value="svc.id">
            {{ svc.name }} • {{ svc.duration_minutes ? `${svc.duration_minutes} menit` : 'Durasi manual' }}
          </option>
        </select>
      </div>
      <span v-if="loadingServices" class="loading-text">Memuat service…</span>
    </div>

    <div class="field" v-if="serviceType && !['LOUNGE', 'KARAOKE'].includes(serviceType)">
      <label>
        Nama Terapis
        <small v-if="selectedServiceQty > 1">(wajib {{ selectedServiceQty }} terapis)</small>
      </label>
      <div class="therapist-grid">
        <select
          v-for="idx in selectedServiceQty"
          :key="`ther-${idx}`"
          v-model="selectedTherapistIds[idx - 1]"
          :disabled="loadingTherapists || !serviceType"
        >
          <option value="">-- Pilih Terapis #{{ idx }} --</option>
          <option
            v-for="t in therapists"
            :key="`ther-opt-${idx}-${t.id}`"
            :value="t.id"
            :disabled="isTherapistDisabled(t.id, idx - 1)"
          >
            {{ t.name }} <span v-if="t.grade_name">({{ t.grade_name }})</span>
          </option>
        </select>
      </div>
      <span v-if="loadingTherapists" class="loading-text">Memuat terapis…</span>
    </div>

    <div class="field" v-if="serviceType">
      <label>{{ roomLabel }}</label>
      <select v-model="selectedRoomId" :disabled="loadingRooms">
        <option value="">-- Pilih --</option>
        <option v-for="r in rooms" :key="r.id" :value="r.id" :disabled="isRoomDisabled(r)">
          {{ r.name }} {{ r.is_occupied ? '• Occupied' : '' }}
        </option>
      </select>
      <span v-if="loadingRooms" class="loading-text">Memuat data…</span>
    </div>

    <div class="field" v-if="serviceType && duration === 0">
      <label>Durasi (menit)</label>
      <input
        type="number"
        min="1"
        v-model.number="manualDuration"
        placeholder="Masukkan durasi"
      />
    </div>

    <div class="duration-box" v-if="duration">
      ⏱ Durasi Service
      <strong>{{ duration }} menit</strong>
    </div>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <div class="actions">
      <button class="cancel" @click="$emit('close')">Batal</button>
      <button class="start" @click="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Memproses…' : 'Mulai Timer' }}
      </button>
    </div>
  </div>
</div>

</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue"
import api from "@/services/api"

const emit = defineEmits(["close", "start"])

const services = ref([])
const therapists = ref([])
const rooms = ref([])

const selectedOrderType = ref("SINGLE")
const selectedServiceQty = ref(1)
const selectedServiceIds = ref([""])
const selectedTherapistIds = ref([""])
const selectedRoomId = ref("")
const selectedComboQty = ref(1)
const selectedComboServiceIds = ref([])
const manualDuration = ref(0)

const loadingServices = ref(false)
const loadingTherapists = ref(false)
const loadingRooms = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref("")

const serviceQtyOptions = [1, 2, 3, 4, 5, 6]

const selectedServices = computed(() => {
  const ids = selectedServiceIds.value
    .map(id => Number(id))
    .filter(id => Number.isInteger(id) && id > 0)

  return ids
    .map(id => services.value.find(s => Number(s.id) === id))
    .filter(Boolean)
})
const parseComboQty = (service) => {
  if (!service) return 1
  if (!["SPA", "LC", "LOUNGE"].includes(service.type)) return 1
  const match = String(service.name || "").match(/combo\s*(\d+)/i)
  const qty = match ? Number(match[1]) : 1
  return Number.isInteger(qty) && qty > 1 ? qty : 1
}


const selectedService = computed(() => selectedServices.value[0] || null)

const serviceType = computed(() => selectedService.value?.type || "")

const duration = computed(() => {
  if (!selectedServices.value.length) return 0
  return Number(selectedServices.value[0].duration_minutes || 0)
})

const effectiveDuration = computed(() => duration.value || manualDuration.value)
const isComboMode = computed(() => selectedOrderType.value === "COMBO" && Number(selectedServiceQty.value || 1) > 1)
const timerServiceTypes = ['SPA', 'LC', 'LOUNGE', 'KARAOKE']

const roomLabel = computed(() => {
  if (serviceType.value === 'SPA') return 'Room'
  if (serviceType.value === 'KARAOKE') return 'Ruang KTV'
  return 'Tabel / Sofa'
})

const selectableServices = computed(() => {
  if (!services.value.length) return []

  if (isComboMode.value) {
    return services.value.filter(s => ['SPA', 'LC'].includes(s.type))
  }

  return services.value.filter(s => timerServiceTypes.includes(String(s.type || '').toUpperCase()))
})

const normalizeServicePayload = (payload) => {
  if (Array.isArray(payload)) return payload

  const candidates = [
    payload?.data,
    payload?.rows,
    payload?.items,
    payload?.results,
    payload?.services,
    payload?.data?.data,
    payload?.data?.rows,
    payload?.data?.items,
    payload?.data?.results,
    payload?.data?.services
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

const resizeSelection = (currentValues, qty, { keepFirstValue = false } = {}) => {
  const next = Array.from({ length: qty }, (_, idx) => {
    if (currentValues[idx] !== undefined) return currentValues[idx]
    if (keepFirstValue && idx === 0) return currentValues[0] || ""
    return ""
  })
  return next
}

const initSelections = () => {
  const qty = Number(selectedServiceQty.value || 1)
  selectedServiceIds.value = resizeSelection(selectedServiceIds.value, qty, { keepFirstValue: true })
  selectedTherapistIds.value = resizeSelection(selectedTherapistIds.value, qty)
}

const ensureComboBaseService = () => {
  if (selectedOrderType.value !== "COMBO" || Number(selectedServiceQty.value || 1) <= 1) return
  const allowed = services.value.filter(s => ["SPA", "LC"].includes(s.type))
  if (!allowed.length) return

  const firstId = Number(selectedServiceIds.value[0] || 0)
  const valid = allowed.some(s => Number(s.id) === firstId)
  if (!valid) {
    selectedServiceIds.value = [String(allowed[0].id)]
  }
}

const onTypeChange = () => {
  if (selectedOrderType.value === "SINGLE") {
    selectedServiceQty.value = 1
  }
  ensureComboBaseService()
  initSelections()
}

const onQtyChange = () => {
  if (selectedOrderType.value === "SINGLE") {
    selectedServiceQty.value = 1
  }
  ensureComboBaseService()
  initSelections()
}

const onServiceSelectionChange = async () => {
  if (!serviceType.value) return
  await fetchTherapists()
  await fetchRooms()
}

const isTherapistDisabled = (therapistId, currentIndex) => {
  const normalizedId = Number(therapistId)
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) return false

  if (therapists.value.find(t => Number(t.id) === normalizedId)?.is_occupied) {
    return true
  }

  return selectedTherapistIds.value.some((selectedId, idx) => {
    if (idx === currentIndex) return false
    return Number(selectedId) === normalizedId
  })
}

const isRoomDisabled = (room) => {
  if (!room) return false
  if (['LC', 'LOUNGE'].includes(serviceType.value)) return false
  return Boolean(room.is_occupied)
}

const fetchServices = async () => {
  try {
    loadingServices.value = true
    errorMessage.value = ""

    const res = await api.get("/services", {
      params: { is_active: true, _ts: Date.now() },
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    })

    const allServices = normalizeServicePayload(res.data)
    services.value = allServices.filter(s => timerServiceTypes.includes(String(s?.type || '').toUpperCase()))

    if (!services.value.length) {
      errorMessage.value = "Tidak ada service aktif yang bisa dipilih"
      return
    }

    const first = services.value.find(s => ["SPA", "LC"].includes(s.type)) || services.value[0]
    selectedServiceIds.value = [String(first.id)]
    await onServiceSelectionChange()
  } catch (err) {
    console.error("Error fetching services:", err)
    errorMessage.value = err.response?.data?.message || "Gagal memuat daftar service"
  } finally {
    loadingServices.value = false
  }
}

const fetchTherapists = async () => {
  if (!serviceType.value || ['LOUNGE', 'KARAOKE'].includes(serviceType.value)) return
  try {
    loadingTherapists.value = true
    errorMessage.value = ""

    const res = await api.get("/timers/therapists", {
      params: { service_type: serviceType.value }
    })
    therapists.value = res.data
  } catch (err) {
    console.error("Error fetching therapists:", err)
    errorMessage.value = "Gagal memuat daftar terapis"
  } finally {
    loadingTherapists.value = false
  }
}

const fetchRooms = async () => {
  if (!serviceType.value) return

  try {
    loadingRooms.value = true
    errorMessage.value = ""

    const res = await api.get("/timers/rooms", {
      params: { service_type: serviceType.value }
    })
    rooms.value = res.data
  } catch (err) {
    console.error("Error fetching rooms:", err)
    errorMessage.value = "Gagal memuat daftar room/sofa"
  } finally {
    loadingRooms.value = false
  }
}

watch(serviceType, async (newType, oldType) => {
  if (!newType || newType === oldType) return
  selectedRoomId.value = ""
  selectedTherapistIds.value = Array(selectedServiceQty.value).fill("")
  await fetchTherapists()
  await fetchRooms()
})

const submit = () => {
  errorMessage.value = ""

  const qty = Number(selectedServiceQty.value || 1)
  const normalizedServiceIds = selectedServiceIds.value
    .map(id => Number(id))
    .filter(id => Number.isInteger(id) && id > 0)

  if (normalizedServiceIds.length !== qty) {
    errorMessage.value = "Pilih service sesuai Qty Service"
    return
  }

  const selectedType = serviceType.value
  if (!selectedType) {
    errorMessage.value = "Silakan pilih service"
    return
  }

  if (selectedServices.value.some(s => s.type !== selectedType)) {
    errorMessage.value = "Semua service harus 1 tipe layanan"
    return
  }

  if (qty > 1 && !["SPA", "LC"].includes(selectedType)) {
    errorMessage.value = "Combo hanya berlaku untuk SPA dan LC"
    return
  }

  const normalizedTherapistIds = selectedTherapistIds.value
    .map(id => Number(id))
    .filter(id => Number.isInteger(id) && id > 0)

  if (!['LOUNGE', 'KARAOKE'].includes(selectedType)) {
    if (normalizedTherapistIds.length !== qty) {
      errorMessage.value = "Pilih terapis sesuai Qty Service"
      return
    }

    if (new Set(normalizedTherapistIds).size !== normalizedTherapistIds.length) {
      errorMessage.value = "Terapis harus berbeda"
      return
    }
  }

  if (!selectedRoomId.value) {
    errorMessage.value = `Silakan pilih ${selectedType === 'SPA' ? 'room' : (selectedType === 'KARAOKE' ? 'ruang KTV' : 'tabel/sofa')}`
    return
  }

  if (duration.value === 0 && !manualDuration.value) {
    errorMessage.value = "Silakan isi durasi service"
    return
  }

  isSubmitting.value = true

  emit("start", {
    service_id: normalizedServiceIds[0],
    service_ids: normalizedServiceIds,
    service_type: selectedType,
    therapist_id: normalizedTherapistIds[0] || null,
    therapist_ids: normalizedTherapistIds,
    combo_qty: qty,
    room_id: parseInt(selectedRoomId.value),
    duration_minutes: effectiveDuration.value,
    order_type: selectedOrderType.value
  })

  setTimeout(() => {
    isSubmitting.value = false
  }, 1000)
}

onMounted(() => {
  fetchServices()
})
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
  width: 420px;
  background: linear-gradient(180deg, #0f0f0f, #0a0a0a);
  border: 1px solid #2a2a2a;
  box-shadow: 0 20px 60px rgba(0,0,0,.6);
  border-radius: 16px;
  padding: 20px;
}
.modal-header {
  text-align: center;
}

.therapist-grid {
  display: grid;
  gap: 8px;
}
.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
}
.subtitle {
  font-size: 12px;
  color: #888;
}
.divider {
  height: 1px;
  background: #222;
  margin: 14px 0 18px;
}
.field {
  margin-bottom: 10px;
}
.field label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: #bbb;
}
.field select,
.field input {
  width: 100%;
  height: 42px;
  border-radius: 10px;
  border: 1px solid #2c2c2c;
  background: #101010;
  color: #fff;
  padding: 0 12px;
}
.loading-text {
  font-size: 12px;
  color: #9a9a9a;
}
.duration-box {
  margin-top: 12px;
  border: 1px solid #6c5417;
  background: rgba(201,162,77,.08);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
  color: #f0d58b;
}
.duration-box strong {
  display: block;
  margin-top: 4px;
  color: #fff;
  font-size: 34px;
  font-weight: 800;
}
.error-message {
  margin-top: 10px;
  font-size: 13px;
  color: #ff6b6b;
}
.actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
}
.cancel, .start {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  border: none;
  font-weight: 700;
  cursor: pointer;
}
.cancel {
  background: #2b2b2b;
  color: #bbb;
}
.start {
  background: #c9a24d;
  color: #111;
}
</style>
