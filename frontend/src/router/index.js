import { createRouter, createWebHistory } from "vue-router"
import { useAuthStore } from "../store/auth.store"

import Login from "../views/Login.vue"
import SuperAdminDashboard from "../views/superadmin/SuperAdminDashboard.vue"
import OwnerDashboard from "../views/owner/OwnerDashboard.vue"
import ManagerDashboard from "../views/manager/ManagerDashboard.vue"
import PosLayout from "@/views/pos/PosLayout.vue"
import KasirDashboard from "@/views/kasir/KasirDashboard.vue"
import TerapisDashboard from "../views/terapis/TerapisDashboard.vue"
//import SuperAdminDashboard from "../views/superadmin/SuperAdminDashboard.vue"
import Users from "../views/superadmin/Users.vue"
import Therapists from "@/views/superadmin/Therapists.vue"
import AuditLogs from "../views/superadmin/AuditLogs.vue"
import Services from "@/views/superadmin/Services.vue"
import Branches from "@/views/superadmin/Branches.vue"
import PosCashier from "@/views/pos/PosCashier.vue"
const routes = [
  { path: "/login", component: Login },

  // 🔥 SUPER ADMIN (GLOBAL)
 // { path: "/superadmin", component: SuperAdminDashboard, meta: { auth: true, roles: ["SuperAdmin"] }},
   {
  path: "/superadmin",
  component: SuperAdminDashboard,
  meta: { auth: true, roles: ["SuperAdmin"] },
  children: [
    { path: "users", component: Users },
    { path: "therapists", component: Therapists }
  ]
},
  // OWNER
  { path: "/owner",component: OwnerDashboard,meta: { auth: true, roles: ["SuperAdmin","Owner"] }},

  // MANAGER
  { path: "/manager",
    component: ManagerDashboard,
    meta: { auth: true, roles: ["Manager"] }
  },

  // KASIR
  {
    path: "/kasir",
    component: KasirDashboard,
    meta: { auth: true, roles: ["Kasir"] },
    //children: [
    //{
    //  path: "",
    //  component: KasirDashboard
   // }
  //]
  },
//{
//  path: "/kasir/pos",
//  component: PosCashier,
//  meta: { auth: true, roles: ["Kasir"] }
//}
{
  path: "/kasir/pos",
  name: "KasirPOS",
  component: () => import("@/views/pos/PosCashier.vue"),
  meta: { requiresAuth: true, transition: "slide-pos" }
},
{
  path: "/kasir/orders",
  name: "KasirOrders",
  component: () => import("@/views/kasir/KasirOrders.vue"),
  meta: { requiresAuth: true }
},
{
  path: "/kasir/reports",
  name: "KasirReports",
  component: () => import("@/views/kasir/KasirReports.vue"),
  meta: { requiresAuth: true }
},

//AUDIT
{
  path: "/superadmin/audit-logs",
  component: AuditLogs,
  meta: { auth: true, roles: ["SuperAdmin"] }
},

  // TERAPIS
  {
    path: "/terapis",
    component: TerapisDashboard,
    meta: { auth: true, roles: ["Terapis"] }
  },

  { path: "/", redirect: "/login" },
]

//const routes = [
//  { path: "/login", component: Login },
//  { path: "/owner", component: OwnerDashboard, meta: { auth: true, roles: ["SuperAdmin","Owner"] } },
//  { path: "/manager", component: ManagerDashboard, meta: { auth: true, roles: ["Manager"] } },
//  { path: "/kasir", component: KasirDashboard, meta: { auth: true, roles: ["Kasir"] } },
//  { path: "/terapis", component: TerapisDashboard, meta: { auth: true, roles: ["Terapis"] } },
//  { path: "/", redirect: "/login" },
//]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.auth && !auth.isLoggedIn) return "/login"
  if (to.meta.roles && !to.meta.roles.includes(auth.role)) return "/login"
})

export default router
