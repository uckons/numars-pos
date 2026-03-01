<template>
  <div class="layout">
    <!-- SIDEBAR -->
    <aside class="sidebar">
      <h2>SUPER ADMIN</h2>

      <nav>
        <button class="nav-btn" :class="{active:tab==='users'}" @click="tab='users'"><UsersIcon size="18" /> Users</button>
        <button class="nav-btn" :class="{active:tab==='branches'}" @click="tab='branches'"><Building2 size="18" /> Branches</button>
        <button class="nav-btn" :class="{active:tab==='orders'}" @click="tab='orders'"><ReceiptText size="18" /> Orders</button>
        <button class="nav-btn" :class="{active:tab==='timers'}" @click="tab='timers'"><Timer size="18" /> Timers</button>
        <button class="nav-btn" :class="{active:tab==='audit'}" @click="tab='audit'"><ShieldCheck size="18" /> Audit Logs</button>
        <button class="nav-btn" :class="{active:tab==='services'}" @click="tab='services'"><Store size="18" /> Services</button>
        <button class="nav-btn" :class="{active:tab==='therapists'}" @click="tab='therapists'"><UsersRound size="18" /> Therapists</button>
        <button class="nav-btn" :class="{active:tab==='agent-profiles'}" @click="tab='agent-profiles'"><Calculator size="18" /> Agent Profiles</button>
        <button class="nav-btn" :class="{active:tab==='coa'}" @click="tab='coa'"><BookCopy size="18" /> COA</button>
        <button class="nav-btn" :class="{active:tab==='rooms'}" @click="tab='rooms'"><DoorOpen size="18" /> Rooms</button>
        <button class="nav-btn" :class="{active:tab==='stock'}" @click="tab='stock'"><Package size="18" /> FNB Stock</button>
        <button class="nav-btn" :class="{active:tab==='grades'}" @click="tab='grades'"><Trophy size="18" /> Grades</button>
        <button class="nav-btn" :class="{active:tab==='printer-agent'}" @click="tab='printer-agent'"><Printer size="18" /> Printer Agent</button>
        <button class="nav-btn" @click="openAccountingUAT()"><ScrollText size="18" /> Accounting UAT (Full Page)</button>
              </nav>

      <!-- LOGOUT -->
      <button class="logout nav-btn" @click="logout"><LogOut size="18" /> Logout</button>
    </aside>

    <!-- CONTENT -->
    <main class="content">
      <Users v-if="tab==='users'" />
      <Branches v-if="tab==='branches'" />
      <Orders v-if="tab==='orders'" />
      <Timers v-if="tab==='timers'" />
      <AuditLogs v-if="tab==='audit'" />
      <Services v-if="tab==='services'" :branch-id="1" />
      <Therapists v-if="tab==='therapists'" />
      <AgentProfiles v-if="tab==='agent-profiles'" />
      <ChartOfAccounts v-if="tab==='coa'" />
      <Rooms v-if="tab==='rooms'" />
      <StockDashboard v-if="tab==='stock'" />
      <Grades v-if="tab==='grades'" />
      <PrinterAgentTools v-if="tab==='printer-agent'" />
    </main>
  </div>
</template>

<script setup>
import { ref } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "@/store/auth.store"
import { Users as UsersIcon, Store, Package, ShieldCheck, Building2, ReceiptText, Timer, UsersRound, DoorOpen, Trophy, LogOut, Printer, ScrollText, Calculator, BookCopy } from "lucide-vue-next"
import AuditLogs from "./AuditLogs.vue"
import StockDashboard from "@/views/stock/StockDashboard.vue"
import Users from "./Users.vue"
import Branches from "./Branches.vue"
import Orders from "./Orders.vue"
import Timers from "./Timers.vue"
import Services from "./Services.vue"
import Therapists from './Therapists.vue'
import Rooms from './Rooms.vue'
import Grades from './Grades.vue'
import PrinterAgentTools from './PrinterAgentTools.vue'
import AgentProfiles from './AgentProfiles.vue'
import ChartOfAccounts from './ChartOfAccounts.vue'


const tab = ref("users")
const auth = useAuthStore()
const router = useRouter()


const openAccountingUAT = () => {
  localStorage.setItem('accountingUAT.activeModule', 'manual-journal')
  router.push('/superadmin/accounting-uat?module=manual-journal')
}


const logout = () => {
  auth.logout()
  router.push("/login")
}
</script>

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

nav {
  display: grid;
  gap: 8px;
}

nav button {
  width: 100%;
  background: transparent;
  border: none;
  color: white;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  border-radius: 10px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  font-size: 14px;
}

nav button.active {
  background: #C9A24D;
  color: black;
}

.logout {
  margin-top: auto;
  background: #b02a2a;
  border: none;
  padding: 10px 12px;
  color: white;
  cursor: pointer;
}

.content {
  flex: 1;
  padding: 20px;
}
</style>
