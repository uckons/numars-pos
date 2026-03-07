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
        :disabled="loadingServices || selectedOrderType === 'SINGLE' || serviceType === 'KARAOKE'"
      >
        <option v-for="n in serviceQtyOptions" :key="n" :value="n">{{ n }}</option>
      </select>
    </div>

    <div class="field">
      <label>{{ selectedServiceQty > 1 ? 'Service per Slot' : 'Pilih Service' }}</label>
      <div class="therapist-grid">
        <select
          v-for="idx in serviceSelectionCount"
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

    <div class="field" v-if="serviceType && !['LOUNGE'].includes(serviceType)">
      <label>
        Nama Terapis
        <small v-if="therapistSelectionCount > 1">(wajib {{ therapistSelectionCount }} terapis)</small>
      </label>
      <div class="therapist-grid">
        <select
          v-for="idx in therapistSelectionCount"
          :key="`ther-${idx}`"
          v-model="selectedTherapistIds[idx - 1]"
          @change="onTherapistSelectionChange(idx - 1, $event.target.value)"
          :disabled="loadingTherapists || !serviceType"
        >
          <option value="">-- Pilih Terapis #{{ idx }} --</option>
          <option
            v-for="t in therapists"
            :key="`ther-opt-${idx}-${t.id}`"
            :value="t.id"
            :disabled="isTherapistDisabled(t.id, idx - 1)"
          >
            {{ t.name }} <span v-if="t.grade_name">({{ t.grade_name }})</span> • {{ t.attendance_status || 'OFF' }}
          </option>
        </select>
      </div>
      <span v-if="loadingTherapists" class="loading-text">Memuat terapis…</span>
    </div>

    <div class="field" v-if="serviceType">
      <label>Nama Tamu</label>
      <input type="text" v-model.trim="guestName" placeholder="Opsional" />
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
    <div class="field" v-if="serviceType === 'KARAOKE'">
      <label>Konfirmasi Karaoke</label>
      <small class="loading-text">Pilihan FNB dan terapis akan muncul setelah klik "Mulai Timer".</small>
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

<div v-if="showKaraokePopup" class="overlay" style="z-index:1001">
  <div class="modal" style="max-height:85vh;overflow:auto">
    <div class="modal-header">
      <h2>Konfirmasi Karaoke</h2>
      <span class="subtitle">Pilih FNB & Terapis</span>
    </div>
    <div class="divider"></div>

    <div class="field">
      <label>Terapis Karaoke ({{ karaokeTherapistPopupCount }})</label>
      <div class="therapist-grid">
        <select v-for="idx in karaokeTherapistPopupCount" :key="`popup-ther-${idx}`" v-model="popupTherapistIds[idx - 1]">
          <option value="">-- Pilih Terapis #{{ idx }} --</option>
          <option v-for="t in therapists" :key="`popup-ther-opt-${idx}-${t.id}`" :value="t.id" :disabled="popupTherapistDisabled(t.id, idx - 1)">
            {{ t.name }} <span v-if="t.grade_name">({{ t.grade_name }})</span> • {{ t.attendance_status || 'OFF' }}
          </option>
        </select>
      </div>
    </div>

    <div class="field">
      <label>FNB KTV</label>
      <div class="therapist-grid">
        <small class="loading-text" v-if="loadingKtvFnb">Memuat FNB KTV…</small>
        <small class="loading-text" v-else-if="!karaokeBaseItems.length && !karaokePackageItems.length">Belum ada FNB bertag KTV untuk outlet ini.</small>

        <div v-if="karaokeBaseItems.length" class="section-caption">Item umum (tag KTV)</div>
        <div v-for="item in karaokeBaseItems" :key="`base-${item.id}`" class="ktv-item-row">
          <input class="ktv-checkbox" type="checkbox" :checked="isKtvItemChecked(item)" @change="toggleKtvItem(item, 'KTV', $event.target.checked)" />
          <span class="ktv-item-name">{{ item.name }}</span>
          <input class="ktv-qty-input" type="number" min="0" :value="(selectedKtvFnbItems.find(v => Number(v.service_id)===Number(item.service_id)) || { qty: getKtvDefaultQtyByTag(item, 'KTV') || 1 }).qty" :disabled="!isKtvItemChecked(item)" @input="updateKtvItemQty(item, $event)" />
        </div>

        <div v-if="karaokePackageItems.length" class="section-caption">Paket {{ selectedKtvPackageTag }} (pilih minimal 1 item)</div>
        <div v-for="item in karaokePackageItems" :key="`pkg-${item.id}`" class="ktv-item-row">
          <input class="ktv-checkbox" type="checkbox" :checked="isKtvItemChecked(item)" @change="toggleKtvItem(item, selectedKtvPackageTag, $event.target.checked)" />
          <span class="ktv-item-name">{{ item.name }}</span>
          <input class="ktv-qty-input" type="number" min="0" :value="(selectedKtvFnbItems.find(v => Number(v.service_id)===Number(item.service_id)) || { qty: getKtvDefaultQtyByTag(item, selectedKtvPackageTag) || 1 }).qty" :disabled="!isKtvItemChecked(item)" @input="updateKtvItemQty(item, $event)" />
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="cancel" @click="showKaraokePopup = false">Batal</button>
      <button class="start" @click="confirmKaraokePopup">OK & Mulai</button>
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
const ktvFnbItems = ref([])
const selectedKtvFnbItems = ref([])

const selectedOrderType = ref("SINGLE")
const selectedServiceQty = ref(1)
const selectedServiceIds = ref([""])
const selectedTherapistIds = ref([""])
const showKaraokePopup = ref(false)
const popupTherapistIds = ref([])
const selectedRoomId = ref("")
const selectedComboQty = ref(1)
const selectedComboServiceIds = ref([])
const manualDuration = ref(0)

const loadingServices = ref(false)
const loadingTherapists = ref(false)
const loadingRooms = ref(false)
const loadingKtvFnb = ref(false)
const isSubmitting = ref(false)
const guestName = ref('')
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

const requiredTherapistQty = computed(() => {
  if (serviceType.value !== 'KARAOKE') return Number(selectedServiceQty.value || 1)
  const name = String(selectedService.value?.name || '').toUpperCase().replace(/\s+/g, '')
  if (name.includes('KTV-4K') || name.includes('KTV4K')) return 2
  return 1
})

const serviceSelectionCount = computed(() => {
  if (serviceType.value === 'KARAOKE') return 1
  return Number(selectedServiceQty.value || 1)
})

const therapistSelectionCount = computed(() => {
  if (serviceType.value === 'KARAOKE') return requiredTherapistQty.value
  return Number(selectedServiceQty.value || 1)
})

const selectedKtvPackageTag = computed(() => {
  const name = String(selectedService.value?.name || '').toUpperCase().replace(/\s+/g, '')
  if (name.includes('KTV-2K') || name.includes('KTV2K')) return 'KTV-2K'
  if (name.includes('KTV-3K') || name.includes('KTV3K')) return 'KTV-3K'
  if (name.includes('KTV-4K') || name.includes('KTV4K')) return 'KTV-4K'
  return 'KTV'
})


const normalizeKtvTagsClient = (value) => {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag || '').trim().toUpperCase()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .replace(/[{}]/g, '')
      .split(',')
      .map((tag) => tag.replace(/^"|"$/g, '').trim().toUpperCase())
      .filter(Boolean)
  }
  return []
}

const karaokeBaseItems = computed(() => ktvFnbItems.value.filter((item) =>
  normalizeKtvTagsClient(item.ktv_group_tags).includes('KTV')
))

const karaokePackageItems = computed(() => {
  const target = selectedKtvPackageTag.value
  return ktvFnbItems.value.filter((item) =>
    normalizeKtvTagsClient(item.ktv_group_tags).includes(target)
  )
})

const getKtvDefaultQtyByTag = (item, tag) => {
  const qtyMap = item?.ktv_group_default_qty
  if (qtyMap && typeof qtyMap === 'object' && !Array.isArray(qtyMap)) {
    const mapped = Number(qtyMap[tag] ?? 0)
    if (Number.isFinite(mapped) && mapped > 0) return Math.floor(mapped)
  }

  const fallback = Number(item?.ktv_default_qty || 0)
  return Number.isFinite(fallback) && fallback > 0 ? Math.floor(fallback) : 0
}


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


const normalizeFnbPayload = (payload) => {
  if (Array.isArray(payload)) return payload

  const candidates = [
    payload?.data,
    payload?.rows,
    payload?.items,
    payload?.results,
    payload?.fnb,
    payload?.data?.data,
    payload?.data?.rows,
    payload?.data?.items,
    payload?.data?.results,
    payload?.data?.fnb
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
  selectedServiceIds.value = resizeSelection(selectedServiceIds.value, serviceSelectionCount.value, { keepFirstValue: true })
  selectedTherapistIds.value = resizeSelection(selectedTherapistIds.value, therapistSelectionCount.value)
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
  if (serviceType.value === 'KARAOKE') {
    selectedOrderType.value = 'SINGLE'
    selectedServiceQty.value = 1
    selectedServiceIds.value = [selectedServiceIds.value[0] || '']
    // Terapis karaoke wajib dipilih manual pada popup, jangan carry over dari pilihan service sebelumnya.
    selectedTherapistIds.value = Array.from({ length: therapistSelectionCount.value }, () => '')
  }
  await fetchTherapists()
  await fetchRooms()
  await fetchKtvFnbItems()
}

const onTherapistSelectionChange = (idx, value) => {
  const therapistId = Number(value)
  if (!Number.isInteger(therapistId) || therapistId <= 0) {
    selectedTherapistIds.value[idx] = ''
    return
  }

  if (!therapistIsSelectable(therapistId)) {
    selectedTherapistIds.value[idx] = ''
    errorMessage.value = 'Terapis dengan status CLOSE/OFF tidak bisa dipilih'
    return
  }

  if (selectedTherapistIds.value.some((id, currentIdx) => currentIdx !== idx && Number(id) === therapistId)) {
    selectedTherapistIds.value[idx] = ''
    errorMessage.value = 'Terapis harus berbeda'
    return
  }

  errorMessage.value = ''
  selectedTherapistIds.value[idx] = String(therapistId)
}

const therapistIsSelectable = (therapistId) => {
  const normalizedId = Number(therapistId)
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) return false

  const therapist = therapists.value.find(t => Number(t.id) === normalizedId)
  if (!therapist) return false

  const attendanceStatus = String(therapist.attendance_status || 'OFF').toUpperCase()
  return attendanceStatus === 'MASUK'
}

const isTherapistDisabled = (therapistId, currentIndex) => {
  const normalizedId = Number(therapistId)
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) return false

  if (!therapistIsSelectable(normalizedId)) {
    return true
  }

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
  if (['LC', 'LOUNGE', 'KARAOKE'].includes(serviceType.value)) return false
  return Boolean(room.is_occupied)
}


const normalizeLabel = (value) => String(value || "")
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractServiceGradeRule = (service) => {
  if (!service?.name) return null
  const serviceName = normalizeLabel(service.name)
  if (!serviceName) return null

  const gradeCandidates = [...new Set(
    therapists.value
      .map(t => String(t?.grade_name || '').trim())
      .filter(Boolean)
  )]

  const sortedCandidates = gradeCandidates.sort((a, b) => b.length - a.length)
  for (const gradeName of sortedCandidates) {
    const normalizedGrade = normalizeLabel(gradeName)
    if (!normalizedGrade) continue

    const matchByWord = serviceName.split(' ').includes(normalizedGrade)
    const matchByPhrase = serviceName.includes(normalizedGrade)
    if (matchByWord || matchByPhrase) {
      return {
        gradeName,
        normalizedGrade
      }
    }
  }

  return null
}

const validateTherapistGradeMatch = (qty) => {
  if (!['SPA', 'LC'].includes(serviceType.value)) return ''

  for (let idx = 0; idx < qty; idx += 1) {
    const serviceId = Number(selectedServiceIds.value[idx] || 0)
    const therapistId = Number(selectedTherapistIds.value[idx] || 0)
    if (!serviceId || !therapistId) continue

    const service = services.value.find(s => Number(s.id) === serviceId)
    const therapist = therapists.value.find(t => Number(t.id) === therapistId)
    if (!service || !therapist) continue

    const rule = extractServiceGradeRule(service)
    if (!rule) continue

    const therapistGrade = normalizeLabel(therapist.grade_name)
    if (!therapistGrade || therapistGrade !== rule.normalizedGrade) {
      const slotNo = idx + 1
      const currentGradeLabel = therapist.grade_name || 'Tanpa Grade'
      return `Terapis slot #${slotNo} harus grade ${rule.gradeName} sesuai service ${service.name}. Saat ini grade terapis: ${currentGradeLabel}`
    }
  }

  return ''
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
    await fetchKtvFnbItems()
  } catch (err) {
    console.error("Error fetching services:", err)
    errorMessage.value = err.response?.data?.message || "Gagal memuat daftar service"
  } finally {
    loadingServices.value = false
  }
}

const fetchTherapists = async () => {
  if (!serviceType.value || ['LOUNGE'].includes(serviceType.value)) return
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



const isKtvItemChecked = (item) => selectedKtvFnbItems.value.some((v) => Number(v.service_id) === Number(item.service_id) && Number(v.qty || 0) > 0)

const toggleKtvItem = (item, tag, checked) => {
  const sid = Number(item?.service_id || 0)
  const idx = selectedKtvFnbItems.value.findIndex(v => Number(v.service_id) === sid)
  if (!checked) {
    if (idx >= 0) selectedKtvFnbItems.value.splice(idx, 1)
    return
  }
  const defaultQty = Math.max(1, getKtvDefaultQtyByTag(item, tag))
  if (idx >= 0) {
    selectedKtvFnbItems.value[idx].qty = Math.max(1, Number(selectedKtvFnbItems.value[idx].qty || defaultQty))
  } else {
    selectedKtvFnbItems.value.push({ service_id: sid, qty: defaultQty })
  }
}

const updateKtvItemQty = (item, event) => {
  const qty = Number(event?.target?.value || 0)
  const sid = Number(item?.service_id || 0)
  const idx = selectedKtvFnbItems.value.findIndex(v => Number(v.service_id) === sid)
  if (qty <= 0) {
    if (idx >= 0) selectedKtvFnbItems.value.splice(idx, 1)
    return
  }
  if (idx >= 0) selectedKtvFnbItems.value[idx].qty = qty
  else selectedKtvFnbItems.value.push({ service_id: sid, qty })
}

const fetchKtvFnbItems = async () => {
  if (serviceType.value !== 'KARAOKE') {
    ktvFnbItems.value = []
    selectedKtvFnbItems.value = []
    return
  }
  try {
    loadingKtvFnb.value = true
    const res = await api.get('/fnb')
    const rows = normalizeFnbPayload(res.data)
    ktvFnbItems.value = rows.filter((item) => normalizeKtvTagsClient(item.ktv_group_tags).length)
    const preselect = []
    ktvFnbItems.value.forEach((item) => {
      const tags = normalizeKtvTagsClient(item.ktv_group_tags)
      const defaultBaseQty = getKtvDefaultQtyByTag(item, 'KTV')
      if (tags.includes('KTV') && defaultBaseQty > 0) {
        preselect.push({ service_id: Number(item.service_id), qty: defaultBaseQty, required: false })
      }
    })
    selectedKtvFnbItems.value = preselect
  } catch (err) {
    ktvFnbItems.value = []
  } finally {
    loadingKtvFnb.value = false
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
  // Reset setiap ganti tipe service agar pilihan terapis selalu explicit dari user.
  selectedTherapistIds.value = Array(therapistSelectionCount.value).fill("")
  if (newType === 'KARAOKE') {
    selectedKtvFnbItems.value = []
  }
  await fetchTherapists()
  await fetchRooms()
  await fetchKtvFnbItems()
})


const karaokeTherapistPopupCount = computed(() => requiredTherapistQty.value)

const popupTherapistDisabled = (therapistId, currentIndex) => {
  const normalizedId = Number(therapistId)
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) return false
  if (!therapistIsSelectable(normalizedId)) return true
  if (therapists.value.find(t => Number(t.id) === normalizedId)?.is_occupied) return true
  return popupTherapistIds.value.some((selectedId, idx) => idx !== currentIndex && Number(selectedId) === normalizedId)
}

const emitStartTimer = (therapistIdsPayload, karaokeFnbPayload = []) => {
  const normalizedServiceIds = selectedServiceIds.value
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)

  isSubmitting.value = true
  emit("start", {
    service_id: normalizedServiceIds[0],
    service_ids: normalizedServiceIds,
    service_type: serviceType.value,
    therapist_id: therapistIdsPayload[0] || null,
    therapist_ids: therapistIdsPayload,
    combo_qty: serviceType.value === 'KARAOKE' ? 1 : Number(selectedServiceQty.value || 1),
    room_id: parseInt(selectedRoomId.value),
    duration_minutes: effectiveDuration.value,
    order_type: selectedOrderType.value,
    karaoke_fnb_items: karaokeFnbPayload,
    guest_name: String(guestName.value || '').trim() || null
  })

  setTimeout(() => {
    isSubmitting.value = false
    showKaraokePopup.value = false
  }, 1000)
}

const confirmKaraokePopup = () => {
  const normalizedPopupTherapists = popupTherapistIds.value.map(v => Number(v)).filter(v => Number.isInteger(v) && v > 0)
  if (normalizedPopupTherapists.length !== karaokeTherapistPopupCount.value) {
    errorMessage.value = `Pilih ${karaokeTherapistPopupCount.value} terapis di popup karaoke`
    return
  }
  if (new Set(normalizedPopupTherapists).size !== normalizedPopupTherapists.length) {
    errorMessage.value = 'Terapis harus berbeda'
    return
  }

  if (normalizedPopupTherapists.some((id) => !therapistIsSelectable(id))) {
    errorMessage.value = 'Terapis CLOSE/OFF tidak bisa dipilih'
    return
  }

  if (karaokePackageItems.value.length) {
    const pickedPackage = selectedKtvFnbItems.value.some((item) => Number(item.qty || 0) > 0 && karaokePackageItems.value.some((it) => Number(it.service_id) === Number(item.service_id)))
    if (!pickedPackage) {
      errorMessage.value = 'Pilih minimal 1 item FNB paket KTV sesuai service karaoke'
      return
    }
  }

  const karaokeFnbPayload = selectedKtvFnbItems.value
    .filter((item) => Number(item.qty || 0) > 0)
    .map((item) => ({ service_id: Number(item.service_id), qty: Number(item.qty || 0) }))

  emitStartTimer(normalizedPopupTherapists, karaokeFnbPayload)
}

const submit = async () => {
  errorMessage.value = ""

  const selectedType = serviceType.value
  const qty = selectedType === "KARAOKE" ? 1 : Number(selectedServiceQty.value || 1)
  const normalizedServiceIds = selectedServiceIds.value
    .map(id => Number(id))
    .filter(id => Number.isInteger(id) && id > 0)

  if (normalizedServiceIds.length !== qty) {
    errorMessage.value = "Pilih service sesuai Qty Service"
    return
  }
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
    if (normalizedTherapistIds.length !== therapistSelectionCount.value) {
      errorMessage.value = "Pilih terapis sesuai ketentuan service"
      return
    }

    if (normalizedTherapistIds.some((id) => !therapistIsSelectable(id))) {
      errorMessage.value = "Terapis CLOSE/OFF tidak bisa dipilih"
      return
    }

    if (new Set(normalizedTherapistIds).size !== normalizedTherapistIds.length) {
      errorMessage.value = "Terapis harus berbeda"
      return
    }

    const gradeMismatchError = validateTherapistGradeMatch(qty)
    if (gradeMismatchError) {
      errorMessage.value = gradeMismatchError
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

  if (selectedType === 'KARAOKE') {
    await fetchKtvFnbItems()
    popupTherapistIds.value = Array.from({ length: karaokeTherapistPopupCount.value }, () => '')
    showKaraokePopup.value = true
    return
  }

  emitStartTimer(normalizedTherapistIds, [])
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
.field input:not([type="checkbox"]) {
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

.section-caption {
  margin-top: 8px;
  margin-bottom: 4px;
  font-size: 12px;
  color: #9fa3aa;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.ktv-item-row {
  display: grid;
  grid-template-columns: 20px 1fr 88px;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid #1f232c;
  border-radius: 10px;
  background: #0c0f14;
}
.ktv-item-name {
  font-size: 15px;
  color: #e6e9ef;
  line-height: 1.3;
}
.ktv-checkbox {
  width: 18px;
  height: 18px;
  appearance: none;
  border: 1px solid #596072;
  border-radius: 6px;
  background: #10141d;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ktv-checkbox:checked {
  border-color: #c9a24d;
  background-color: #c9a24d;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23111' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
}
.ktv-qty-input {
  width: 88px !important;
  height: 36px !important;
  text-align: center;
  font-weight: 700;
}

</style>
