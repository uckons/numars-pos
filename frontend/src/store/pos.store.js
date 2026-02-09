import { defineStore } from "pinia"
import { ref, watch } from "vue"

export const usePosStore = defineStore("pos", () => {
  const items = ref(
    JSON.parse(localStorage.getItem("pos-cart") || "[]")
  )

  // 🆕 Track current order ID
  const currentOrderId = ref(null)
  // 🆕 Track selected therapist & room
const selectedTherapist = ref(null)
const selectedRoom = ref(null)

  const itemKey = (service) => [
    service.id,
    Number(service.base_price || 0),
    service.price_label || '',
    service.is_package ? 'P' : 'N'
  ].join(':')

  function addService(service) {
    const key = itemKey(service)
    const found = items.value.find(i => i.cart_key === key)
    if (found) {
      found.qty += Number(service.seed_qty || 1)
    } else {
      items.value.push({
        id: service.id,
        name: service.name,
        base_price: Number(service.base_price),
        price_label: service.price_label || null,
        is_package: Boolean(service.is_package),
        package_qty: Number(service.package_qty || 0),
        package_group: service.package_group || null,
        package_service_id: service.package_service_id || null,
        package_price: Number(service.package_price || 0) || null,
        package_name: service.package_name || null,
        package_total: Number(service.package_total || 0) || null,
        locked_package: Boolean(service.locked_package),
        cart_key: key,
        qty: Number(service.seed_qty || 1)
      })
    }
  }

  const locked = ref(false)
  
  function lock() {
    locked.value = true
  }

  function unlock() {
    locked.value = false
  }

  function inc(id, cartKey = null) {
    const item = items.value.find(i => i.id === id && (!cartKey || i.cart_key === cartKey))
    if (item) item.qty++
  }

  function dec(id, cartKey = null) {
    const item = items.value.find(i => i.id === id && (!cartKey || i.cart_key === cartKey))
    if (item && item.qty > 1) item.qty--
  }

  function remove(id, cartKey = null) {
    items.value = items.value.filter(i => !(i.id === id && (!cartKey || i.cart_key === cartKey)))
  }

  function clear() {
    items.value = []
    currentOrderId.value = null  // 🆕 Reset order ID
  }
 function setTherapist(therapist) {
  selectedTherapist.value = therapist
}

function setRoom(room) {
  selectedRoom.value = room
}
function findByCartKey(cartKey) {
    return items.value.find(i => i.cart_key === cartKey)
  }

  function convertToPackage(cartKey, packageService) {
    const item = findByCartKey(cartKey)
    if (!item || !packageService) return

    const packageQty = Number(packageService.package_qty || item.package_qty || 0)
    if (!packageQty || item.qty < packageQty) return

    const bundles = Math.floor(item.qty / packageQty)
    const remainder = item.qty % packageQty

    item.qty = remainder
    if (item.qty === 0) {
      items.value = items.value.filter(i => i.cart_key !== cartKey)
    }

    const packageTotal = Number(
      packageService.package_price ?? packageService.base_price ?? 0
    )
    const unitPriceInPackage = packageQty > 0 ? packageTotal / packageQty : packageTotal

    for (let idx = 0; idx < bundles; idx += 1) {
      addService({
        ...packageService,
        is_package: true,
        locked_package: true,
        price_label: 'PAKET',
        package_total: packageTotal,
        seed_qty: packageQty,
        base_price: Number(unitPriceInPackage)
      })
    }
  }

  // 🔥 AUTO SAVE
  watch(
    items,
    v => localStorage.setItem("pos-cart", JSON.stringify(v)),
    { deep: true }
  )

  return {
  items,
  currentOrderId,
  selectedTherapist,    // 🆕
  selectedRoom,         // 🆕
  addService,
  locked,
  lock,
  unlock,
  inc,
  dec,
  remove,
  clear,
  findByCartKey,
  convertToPackage,
  setTherapist,         // 🆕
  setRoom              // 🆕
}
})
