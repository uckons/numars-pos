<template>
  <div class="layout">
    <!-- MOBILE HEADER WITH HAMBURGER -->
    <div class="mobile-header">
      <h2>SUPER ADMIN</h2>
      <button class="hamburger" @click="sidebarOpen = !sidebarOpen" aria-label="Toggle menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>

    <!-- OVERLAY -->
    <div 
      class="overlay" 
      :class="{ active: sidebarOpen }" 
      @click="sidebarOpen = false"
    ></div>

    <!-- SIDEBAR -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <h2 class="desktop-title">SUPER ADMIN</h2>

      <nav>
        <button :class="{active:tab==='users'}" @click="selectTab('users')"> <UsersIcon size="18" /> Users</button>
        <button :class="{active:tab==='branches'}" @click="selectTab('branches')"> <UsersIcon size="18" />Branches</button>
        <button :class="{active:tab==='orders'}" @click="selectTab('orders')"> <UsersIcon size="18" />Orders</button>
        <button :class="{active:tab==='timers'}" @click="selectTab('timers')"> <UsersIcon size="18" />Timers</button>
        <button :class="{active:tab==='audit'}" @click="selectTab('audit')"> <ShieldCheck size="18" /> Audit Logs</button>
        <button :class="{active:tab==='services'}" @click="selectTab('services')"> <Store size="18" /> Services</button>

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
    </main>
  </div>
</template>

<script setup>
import { ref } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "@/store/auth.store"
import { Users as UsersIcon, Store, ClipboardList, Timer, LogOut } from "lucide-vue-next"
import AuditLogs from "./AuditLogs.vue"
import { ShieldCheck } from "lucide-vue-next"

import Users from "./Users.vue"
import Branches from "./Branches.vue"
import Orders from "./Orders.vue"
import Timers from "./Timers.vue"
import Services from "./Services.vue"


const tab = ref("users")
const sidebarOpen = ref(false)
const auth = useAuthStore()
const router = useRouter()

const selectTab = (newTab) => {
  tab.value = newTab
  sidebarOpen.value = false // Close sidebar on mobile after selection
}

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
  position: relative;
}

/* MOBILE HEADER */
.mobile-header {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: #111;
  border-bottom: 1px solid #C9A24D;
  padding: 0 16px;
  align-items: center;
  justify-content: space-between;
  z-index: 1001;
}

.mobile-header h2 {
  color: #C9A24D;
  font-size: 18px;
  margin: 0;
}

/* HAMBURGER BUTTON */
.hamburger {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: transparent;
  border: none;
  padding: 8px;
  cursor: pointer;
  z-index: 1002;
}

.hamburger span {
  display: block;
  width: 25px;
  height: 3px;
  background: #C9A24D;
  border-radius: 2px;
  transition: all 0.3s ease;
}

/* OVERLAY */
.overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 999;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.overlay.active {
  opacity: 1;
  pointer-events: auto;
}

/* SIDEBAR */
.sidebar {
  width: 220px;
  background: #111;
  border-right: 1px solid #C9A24D;
  padding: 16px;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: transform 0.3s ease;
}

.sidebar h2.desktop-title {
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
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

nav button:hover {
  background: rgba(201, 162, 77, 0.1);
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
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.logout:hover {
  background: #8a2020;
}

.content {
  flex: 1;
  padding: 20px;
  overflow-x: hidden;
}

/* RESPONSIVE BREAKPOINTS */

/* Tablet and below (< 768px) */
@media (max-width: 768px) {
  .mobile-header {
    display: flex;
  }

  .overlay {
    display: block;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 280px;
    z-index: 1000;
    transform: translateX(-100%);
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar h2.desktop-title {
    display: none;
  }

  .content {
    margin-top: 60px;
    padding: 16px;
    width: 100%;
  }
}

/* Mobile (< 480px) */
@media (max-width: 480px) {
  .sidebar {
    width: 260px;
  }

  .content {
    padding: 12px;
  }

  .mobile-header {
    padding: 0 12px;
  }

  nav button {
    padding: 12px;
    font-size: 14px;
  }
}
</style>
