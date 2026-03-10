import { createRouter, createWebHistory } from "vue-router"
import { useAuthStore } from "../store/auth.store"

const Login = () => import("../views/Login.vue")
const SuperAdminDashboard = () => import("../views/superadmin/SuperAdminDashboard.vue")
const OwnerDashboard = () => import("../views/owner/OwnerDashboard.vue")
const ManagerDashboard = () => import("../views/manager/ManagerDashboard.vue")
const SupervisorDashboard = () => import("../views/supervisor/SupervisorDashboard.vue")
const BarDashboard = () => import("../views/bar/BarDashboard.vue")
const KasirDashboard = () => import("@/views/kasir/KasirDashboard.vue")
const TerapisDashboard = () => import("../views/terapis/TerapisDashboard.vue")
const Users = () => import("../views/superadmin/Users.vue")
const Therapists = () => import("@/views/superadmin/Therapists.vue")
const AuditLogs = () => import("../views/superadmin/AuditLogs.vue")
const AccountingUAT = () => import("@/views/superadmin/AccountingUAT.vue")
const KasirBarInbox = () => import("@/views/kasir/KasirBarInbox.vue")
const KasirMembership = () => import("@/views/kasir/KasirMembership.vue")

const routes = [
  { path: "/login", component: Login },
  {
    path: "/superadmin",
    component: SuperAdminDashboard,
    meta: { auth: true, roles: ["SuperAdmin"] },
    children: [
      { path: "users", component: Users },
      { path: "therapists", component: Therapists }
    ]
  },
  { path: "/owner", component: OwnerDashboard, meta: { auth: true, roles: ["SuperAdmin", "Owner"] } },
  { path: "/manager", component: ManagerDashboard, meta: { auth: true, roles: ["Manager"] } },
  { path: "/manager/accounting-uat", component: AccountingUAT, meta: { auth: true, roles: ["Manager"] } },
  { path: "/superadmin/accounting-uat", component: AccountingUAT, meta: { auth: true, roles: ["SuperAdmin"] } },
  { path: "/owner/accounting-uat", component: AccountingUAT, meta: { auth: true, roles: ["Owner", "SuperAdmin"] } },
  { path: "/supervisor", component: SupervisorDashboard, meta: { auth: true, roles: ["Supervisor"] } },
  { path: "/bar", component: BarDashboard, meta: { auth: true, roles: ["Staff Bar"] } },
  { path: "/kasir", component: KasirDashboard, meta: { auth: true, roles: ["Kasir"] } },
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
  {
    path: "/kasir/bar-inbox",
    name: "KasirBarInbox",
    component: KasirBarInbox,
    meta: { requiresAuth: true }
  },
  {
    path: "/kasir/membership",
    name: "KasirMembership",
    component: KasirMembership,
    meta: { requiresAuth: true }
  },
  {
    path: "/superadmin/audit-logs",
    component: AuditLogs,
    meta: { auth: true, roles: ["SuperAdmin"] }
  },
  {
    path: "/terapis",
    component: TerapisDashboard,
    meta: { auth: true, roles: ["Terapis"] }
  },
  { path: "/", redirect: "/login" }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  const needsAuth = Boolean(to.meta.auth || to.meta.requiresAuth)
  if (needsAuth && !auth.isLoggedIn) return "/login"
  if (to.meta.roles && !to.meta.roles.includes(auth.role)) return "/login"
})

export default router
