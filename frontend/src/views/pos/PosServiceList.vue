<template>
  <div class="service-list">
    <!-- CATEGORY TABS -->
    <div class="tabs">
      <button
        v-for="c in categories"
        :key="c"
        :class="{ active: activeCategory === c }"
        @click="activeCategory = c"
      >
        {{ c }}
      </button>
    </div>

    <div class="toolbar">
      <div class="search-wrap">
        <input
          v-model.trim="searchKeyword"
          class="search"
          type="text"
          placeholder="Cari service..."
        />
        <button v-if="searchKeyword" class="btn-reset" @click="resetSearch">Reset</button>
      </div>
      <select v-model.number="pageSize" class="page-size">
        <option :value="8">8 / halaman</option>
        <option :value="12">12 / halaman</option>
        <option :value="16">16 / halaman</option>
        <option :value="24">24 / halaman</option>
      </select>
    </div>

    <!-- SERVICES GRID -->
    <div class="grid">
      <div
        v-for="s in paginatedServices"
        :key="s.id"
        class="service-card"
        @click="select(s)"
      >
        <div class="card-top">
          <h4>{{ s.name }}</h4>
          <span class="badge">{{ s.type }}</span>
          <span v-if="s.price_label" class="badge price-badge">{{ s.price_label }}</span>
        </div>

        <div class="card-bottom">
          <span class="duration">
            ⏱ {{ s.duration_minutes }} min
          </span>
          <strong class="price">
            Rp {{ format(s.base_price) }}
          </strong>
        </div>
      </div>

      <div v-if="!filteredServices.length" class="empty">
        Tidak ada service yang cocok
      </div>
    </div>

    <div v-if="filteredServices.length" class="pagination">
      <button :disabled="page <= 1" @click="page -= 1">Prev</button>
      <span>Halaman {{ page }} / {{ totalPages }}</span>
      <button :disabled="page >= totalPages" @click="page += 1">Next</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue"
import Swal from "sweetalert2"
import api from "@/services/api"
import { usePosStore } from "@/store/pos.store"
const pos = usePosStore()

const services = ref([])
const activeCategory = ref("ALL")
const searchKeyword = ref("")
const page = ref(1)
const pageSize = ref(12)

const categories = [
  "ALL",
  "SPA",
  "LC",
  "FNB",
  "LOUNGE",
  "KARAOKE"
]

const loadServices = async () => {
  const res = await api.get("/services", {
    params: { is_active: true, _ts: Date.now() },
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache"
    }
  })
  services.value = res.data.data || res.data
}

let refreshTimer = null
const handleWindowFocus = () => {
  loadServices().catch(() => {})
}

onMounted(async () => {
  await loadServices()
  refreshTimer = setInterval(() => {
    loadServices().catch(() => {})
  }, 15000)
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleWindowFocus)
  }
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (typeof window !== 'undefined') {
    window.removeEventListener('focus', handleWindowFocus)
  }
})

watch([activeCategory, searchKeyword, pageSize], () => {
  page.value = 1
})

const regularPackageGroups = computed(() => {
  const groups = new Set()
  services.value
    .filter(s => s.type === 'FNB' && !s.is_package && s.package_group)
    .forEach(s => groups.add(s.package_group))
  return groups
})

const sellableServices = computed(() =>
  services.value.filter((s) => {
    if (s.type === 'FNB' && s.is_package && s.package_group) {
      return !regularPackageGroups.value.has(s.package_group)
    }
    return true
  })
)

const filteredServices = computed(() => {
  const byCategory = activeCategory.value === "ALL"
    ? sellableServices.value
    : sellableServices.value.filter(s => s.type === activeCategory.value)

  const keyword = searchKeyword.value.toLowerCase()
  if (!keyword) return byCategory

  return byCategory.filter(s =>
    String(s.name || '').toLowerCase().includes(keyword) ||
    String(s.type || '').toLowerCase().includes(keyword)
  )
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredServices.value.length / pageSize.value)))

const paginatedServices = computed(() => {
  const safePage = Math.min(page.value, totalPages.value)
  const start = (safePage - 1) * pageSize.value
  return filteredServices.value.slice(start, start + pageSize.value)
})

const packageByGroup = computed(() => {
  const map = new Map()
  services.value
    .filter(s => s.type === 'FNB' && s.is_package && s.package_group)
    .forEach(s => map.set(s.package_group, s))
  return map
})

const enrichService = (service) => {
  if (service.type !== 'FNB') return service
  if (!service.package_group) return service

  const pkg = packageByGroup.value.get(service.package_group)
  if (!pkg) return service

  const regular = services.value.find(
    s => s.type === 'FNB' && !s.is_package && s.package_group === service.package_group
  )

  const seed = service.is_package
    ? (regular
        ? { ...regular }
        : { ...service, is_package: false, price_label: null })
    : { ...service }

  const packageQty = Number(pkg.package_qty || seed.package_qty || 0)
  if (!packageQty) return seed

  return {
    ...seed,
    package_group: seed.package_group || pkg.package_group,
    package_qty: packageQty,
    package_service_id: pkg.id,
    package_price: Number(pkg.package_price || pkg.base_price || 0),
    package_name: pkg.package_name || pkg.name || seed.name,
    package_label: 'PAKET'
  }
}

const maybeOfferPackage = async (cartKey) => {
  const item = pos.findByCartKey(cartKey)
  if (!item || item.is_package) return

  const packageQty = Number(item.package_qty || 0)
  if (!packageQty || item.qty % packageQty !== 0) return

  const packageService = services.value.find(s => s.id === item.package_service_id)
  if (!packageService) return

  const confirm = await Swal.fire({
    icon: 'question',
    title: 'Jadikan paket?',
    text: `Qty ${item.name} sudah ${item.qty}. Gunakan harga paket?`,
    showCancelButton: true,
    confirmButtonText: 'Ya, jadikan paket',
    cancelButtonText: 'Tidak'
  })

  if (confirm.isConfirmed) {
    pos.convertToPackage(item.cart_key, packageService)
  }
}

const select = async (service) => {
  const enriched = enrichService(service)
  pos.addService(enriched)

  const key = [
    enriched.id,
    Number(enriched.base_price || 0),
    enriched.price_label || "",
    enriched.is_package ? "P" : "N"
  ].join(":")

  await maybeOfferPackage(key)
}

const resetSearch = () => {
  searchKeyword.value = ""
}

const format = (v) => Number(v || 0).toLocaleString("id-ID")
</script>

<style scoped>
.service-list { display: flex; flex-direction: column; height: 100%; }
.tabs { display: flex; gap: 10px; margin-bottom: 12px; }
.tabs button { padding: 10px 18px; border-radius: 14px; border: 1px solid #222; background: #111; color: #aaa; font-weight: 600; cursor: pointer; transition: all .2s ease; }
.tabs button:hover { color: #fff; border-color: #c9a24d; }
.tabs button.active { background: #c9a24d; color: #000; border-color: #c9a24d; }
.toolbar { display: flex; gap: 10px; margin-bottom: 12px; align-items: center; }
.search-wrap { display:flex; gap:8px; flex: 0 1 520px; min-width: 280px; }
.search, .page-size { height: 40px; border-radius: 10px; border: 1px solid #2a2a2a; background:#101010; color:#fff; padding:0 12px; }
.search { flex: 1; max-width: 420px; }
.btn-reset { height: 40px; padding: 0 14px; border-radius: 10px; border: 1px solid #3a3a3a; background: #1b1b1b; color: #ddd; cursor: pointer; }
.btn-reset:hover { border-color:#c9a24d; color:#fff; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.service-card { background: linear-gradient(145deg, #0e0e0e, #151515); border-radius: 18px; padding: 16px; box-shadow: 0 12px 35px rgba(0,0,0,.45); cursor: pointer; transition: all .25s ease; display: flex; flex-direction: column; justify-content: space-between; }
.service-card:hover { transform: translateY(-4px); box-shadow: 0 22px 60px rgba(0,0,0,.7); }
.card-top h4 { margin: 0; font-size: 16px; font-weight: 700; }
.badge { margin-top: 6px; display: inline-block; background: rgba(201,162,77,.2); color: #c9a24d; padding: 4px 10px; border-radius: 12px; font-size: 12px; width: fit-content; }
.price-badge { margin-left: 6px; background: #f5c518; color: #111; }
.card-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
.duration { font-size: 12px; color: #888; }
.price { font-size: 16px; font-weight: 700; color: #2ecc71; }
.empty { grid-column: 1 / -1; text-align: center; color: #666; padding: 30px; }
.pagination { display:flex; align-items:center; justify-content:center; gap:12px; margin-top: 14px; }
.pagination button { background:#222; color:#fff; border:1px solid #333; border-radius:8px; padding:6px 12px; cursor:pointer; }
.pagination button:disabled { opacity:.4; cursor:not-allowed; }
@media (max-width: 900px) {
  .toolbar { flex-wrap: wrap; }
  .search-wrap { flex: 1 1 100%; }
  .search { max-width: none; }
}

</style>
