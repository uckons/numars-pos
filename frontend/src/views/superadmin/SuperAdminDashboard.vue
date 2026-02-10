<template>
  <div class="layout">
    <!-- SIDEBAR -->
    <aside class="sidebar">
      <h2>SUPER ADMIN</h2>

      <nav>
        <button :class="{active:tab==='users'}" @click="tab='users'"> <UsersIcon size="18" /> Users</button>
        <button :class="{active:tab==='branches'}" @click="tab='branches'"> <UsersIcon size="18" />Branches</button>
        <button :class="{active:tab==='orders'}" @click="tab='orders'"> <UsersIcon size="18" />Orders</button>
        <button :class="{active:tab==='timers'}" @click="tab='timers'"> <UsersIcon size="18" />Timers</button>
        <button :class="{active:tab==='audit'}" @click="tab='audit'"> <ShieldCheck size="18" /> Audit Logs</button>
        <button :class="{active:tab==='services'}" @click="tab='services'"> <Store size="18" /> Services</button>
        <button :class="{active:tab==='therapists'}" @click="tab='therapists'"> <UsersIcon size="18" /> Therapists</button>
        <button :class="{active:tab==='rooms'}" @click="tab='rooms'"> <Store size="18" /> Rooms</button>
        <button :class="{active:tab==='stock'}" @click="tab='stock'"> <Package size="18" /> FNB Stock</button>
        <button :class="{active:tab==='grades'}" @click="tab='grades'"> 🏆 Grades</button>
      </nav>

      <!-- LOGOUT -->
      <button class="logout" @click="logout"> <UsersIcon size="18" />Logout</button>
    </aside>

    <!-- CONTENT -->
    <main class="content">
      <Users v-if="tab==='users'" />
      <Branches v-if="tab==='branches'" />
      <Orders v-if="tab==='orders'" />
      <Timers v-if="tab==='timers'" />
      <Services v-if="tab==='services'" :branch-id="1" />
      <Therapists v-if="tab==='therapists'" />
      <Rooms v-if="tab==='rooms'" />
      <StockDashboard v-if="tab==='stock'" />
      <Grades v-if="tab==='grades'" />
    </main>
  </div>
</template>

<script setup>
import { ref } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "@/store/auth.store"
import { Users as UsersIcon, Store, ClipboardList, Timer, LogOut, Package } from "lucide-vue-next"
import AuditLogs from "./AuditLogs.vue"
import { ShieldCheck } from "lucide-vue-next"
import StockDashboard from "@/views/stock/StockDashboard.vue"
import Users from "./Users.vue"
import Branches from "./Branches.vue"
import Orders from "./Orders.vue"
import Timers from "./Timers.vue"
import Services from "./Services.vue"
import Therapists from './Therapists.vue'
import Rooms from './Rooms.vue'
import Grades from './Grades.vue'


const tab = ref("users")
const auth = useAuthStore()
const router = useRouter()

const logout = () => {
  auth.logout()
  router.push("/login")
}
</script>
<AuditLogs v-if="tab==='audit'" />

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
  background: #0e0e0e;
  color: white;
}

.sidebar {
  width: 220px;
  background: #111;
  border-right: 1px solid #C9A24D;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.sidebar h2 {
  color: #C9A24D;
  margin-bottom: 16px;
}

nav button {
  width: 100%;
  background: transparent;
  border: none;
  color: white;
  padding: 10px;
  text-align: left;
  cursor: pointer;
}

nav button.active {
  background: #C9A24D;
  color: black;
}

.logout {
  margin-top: auto;
  background: #b02a2a;
  border: none;
  padding: 10px;
  color: white;
  cursor: pointer;
}

.content {
  flex: 1;
  padding: 20px;
}
</style>
