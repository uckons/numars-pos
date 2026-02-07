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

    <!-- SERVICES GRID -->
    <div class="grid">
      <div
        v-for="s in filteredServices"
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
        No services available
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import Swal from "sweetalert2"
import api from "@/services/api"
import { usePosStore } from "@/store/pos.store"
const pos = usePosStore()
//const emit = defineEmits(["select"])

const services = ref([])
const activeCategory = ref("ALL")

const categories = [
  "ALL",
  "SPA",
  "LC",
  "FNB",
  "LOUNGE",
  "KARAOKE"
]

onMounted(async () => {
  const res = await api.get("/services", {
    params: { is_active: true }
  })
  services.value = res.data.data || res.data
})

//const addToCart = (service) => {
//  console.log("CLICK SERVICE =>", service) // ?? DEBUG
//  pos.add({
//    id: service.id,
//    name: service.name,
//    price: Number(service.base_price),
//    qty: 1
//  })
//}

//const clickService = (s) => {
//  console.log("CLICK SERVICE =>", s)
//  pos.addService(s)
//  console.log("ITEMS NOW =>", pos.items)
//}
const filteredServices = computed(() => {
  if (activeCategory.value === "ALL") {
    return services.value
  }
  return services.value.filter(
    s => s.type === activeCategory.value
  )
})
const packageByGroup = computed(() => {
  const map = new Map()
  services.value
    .filter(s => s.type === 'FNB' && s.is_package && s.package_group)
    .forEach(s => map.set(s.package_group, s))
  return map
})

const enrichService = (service) => {
  if (service.type !== 'FNB' || service.is_package) return service
  if (!service.package_group || !Number(service.package_qty || 0)) return service

  const pkg = packageByGroup.value.get(service.package_group)
  if (!pkg) return service

  return {
    ...service,
    package_service_id: pkg.id,
    package_price: Number(pkg.base_price || 0),
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

//const select = (service) => {
//  emit("select", service)
// }
//const select = (service) => {
//  pos.add(service)
//}
//const addToCart = (service) => {
//  console.log("CLICK SERVICE:", service)
//  pos.add(service)
//}
//const selectService = (s) => {
//  console.log("CLICK SERVICE =>", s)
//  pos.addService(s)
//}
const select = async (service) => {
//  console.log("CLICK SERVICE =>", service)

//  if (!pos.orderId) {
//    await pos.createOrder()
//  }

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
const format = (v) =>
  Number(v || 0).toLocaleString("id-ID")
</script>

<style scoped>
.service-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* TABS */
.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.tabs button {
  padding: 10px 18px;
  border-radius: 14px;
  border: 1px solid #222;
  background: #111;
  color: #aaa;
  font-weight: 600;
  cursor: pointer;
  transition: all .2s ease;
}

.tabs button:hover {
  color: #fff;
  border-color: #c9a24d;
}

.tabs button.active {
  background: #c9a24d;
  color: #000;
  border-color: #c9a24d;
}

/* GRID */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

/* CARD */
.service-card {
  background: linear-gradient(145deg, #0e0e0e, #151515);
  border-radius: 18px;
  padding: 16px;
  box-shadow: 0 12px 35px rgba(0,0,0,.45);
  cursor: pointer;
  transition: all .25s ease;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.service-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 22px 60px rgba(0,0,0,.7);
}

.card-top h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.badge {
  margin-top: 6px;
  display: inline-block;
  background: rgba(201,162,77,.2);
  color: #c9a24d;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  width: fit-content;
}


.price-badge {
  margin-left: 6px;
  background: #f5c518;
  color: #111;
}

.card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
}

.duration {
  font-size: 12px;
  color: #888;
}

.price {
  font-size: 16px;
  font-weight: 700;
  color: #2ecc71;
}

.empty {
  grid-column: 1 / -1;
  text-align: center;
  color: #666;
  padding: 30px;
}
</style>