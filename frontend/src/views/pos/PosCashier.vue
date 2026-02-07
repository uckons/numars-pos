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
      pos.currentOrderId = orderId
      order.items.forEach(item => {
        const cartItem = {
          id: item.service_id,
          name: item.service_name,
          base_price: item.price,
          price_label: item.price_label || null,
          is_package: Boolean(item.is_package),
          qty: 1
        }
        
        // Add sebanyak qty
        for (let i = 0; i < item.qty; i++) {
          pos.addService(cartItem)
        }
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
}
.left {
  padding: 16px;
  overflow-y: auto;
}
.right {
  border-left: 1px solid #222;
}
</style>
