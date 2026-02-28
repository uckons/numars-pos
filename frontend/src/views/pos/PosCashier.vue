<template>
  <PosLayout>
    <div class="pos-body">
      <div class="left">
        <PosServiceList @add="addToCart" />
      </div>

      <div class="right">
        <PosCart />
      </div>
    </div>
  </PosLayout>
</template>

<script setup>
import { onMounted, watch } from "vue"
import { useRoute } from "vue-router"
import PosLayout from "./PosLayout.vue"
import PosServiceList from "./PosServiceList.vue"
import PosCart from "./PosCart.vue"
import { usePosStore } from "@/store/pos.store"
import api from "@/services/api"

const route = useRoute()
const pos = usePosStore()

// 🆕 Load order function - simpan ke STORE
const loadOrder = async (orderId) => {
  if (!orderId) return
  
  try {
    console.log('Loading order:', orderId)
    const res = await api.get(`/orders/${orderId}`)
    const order = res.data
    
    console.log('Order loaded:', order)
    
    // Load items dari order ke STORE
    if (order.items && order.items.length > 0) {
// Add items ke store
      pos.clear()
      // 🆕 Set current order ID
      pos.currentOrderId = Number(orderId)
      order.items.forEach(item => {
        const itemQty = Number(item.qty || 0)
        if (itemQty <= 0) return
        const itemPrice = Number(item.price || 0)
        const itemSubtotal = Number(item.subtotal || (itemPrice * itemQty) || 0)
        const isComboSnapshot = /^COMBO SERVICE\s*\(/i.test(String(item.service_name || ""))

        const normalizedQty = isComboSnapshot ? 1 : itemQty
        const normalizedBasePrice = isComboSnapshot
          ? Math.round(itemSubtotal)
          : Math.round(itemPrice)

        const isKtvMainService = /^KTV\s*\d/i.test(String(item.service_name || ''))

        const cartItem = {
          id: item.service_id,
          variant_service_id: item.variant_service_id || null,
          name: item.service_name,
          base_price: normalizedBasePrice,
          price_label: item.price_label || null,
          is_package: Boolean(item.is_package),
          is_fnb: Boolean(item.is_fnb),
          type: item.type || null,
          locked_package: Boolean(item.is_package),
          locked_main: Boolean(isKtvMainService),
          therapist_name: item.therapist_name || null,
          seed_qty: normalizedQty,
          qty: 1
        }

        pos.addService(cartItem)
      })
      
      console.log('Store updated, items count:', pos.items.length)
    }
  } catch (err) {
    console.error("Failed to load order:", err)
  }
}

// Load saat mount
onMounted(() => {
  loadOrder(route.query.order_id)
})

// Watch perubahan route
watch(() => route.query.order_id, (newId) => {
  loadOrder(newId)
})

const addToCart = (service) => {
  pos.addService(service)
}
</script>

<style scoped>
.pos-body {
  display: grid;
  grid-template-columns: 1fr 420px;
  height: 100%;
  min-height: 0;
}
.left {
  padding: 16px;
  overflow-y: auto;
  min-height: 0;
}
.right {
  border-left: 1px solid #222;
  min-height: 0;
  overflow: hidden;
}
</style>
