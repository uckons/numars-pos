<template>
  <section class="card enterprise-card">
    <div class="card-head">
      <div>
        <h2>Printer Agent Control Center</h2>
        <p class="muted">Konfigurasi routing printer enterprise per branch/channel, termasuk BAR auto-print.</p>
      </div>
      <span class="badge">Secure Routing</span>
    </div>

    <div class="grid three">
      <label>
        Branch
        <select v-model="targetForm.branch_id">
          <option value="">Global Default (all branch)</option>
          <option v-for="b in branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
        </select>
      </label>
      <label>
        Channel
        <select v-model="targetForm.channel">
          <option value="POS_RECEIPT">POS_RECEIPT</option>
          <option value="POS_RECAP">POS_RECAP</option>
          <option value="BAR_INBOX">BAR_INBOX</option>
        </select>
      </label>
      <label>
        Status
        <select v-model="targetForm.is_active">
          <option :value="true">Active</option>
          <option :value="false">Disabled</option>
        </select>
      </label>
    </div>

    <div class="grid">
      <label>
        Agent URL
        <input v-model.trim="targetForm.agent_url" placeholder="http://172.20.0.20:19000" />
      </label>
      <label>
        Agent Token
        <input v-model.trim="targetForm.agent_token" placeholder="opsional" />
      </label>
      <label>
        Printer Name
        <input v-model.trim="targetForm.agent_printer_name" placeholder="contoh: BAR-80MM" />
      </label>
    </div>

    <div class="actions">
      <button class="btn gold" :disabled="loading" @click="saveBackendTarget">Save Backend Routing</button>
      <button class="btn" :disabled="loading" @click="loadBackendTargets">Reload Target List</button>
      <button class="btn" :disabled="loading" @click="applySelectedTargetToTest">Use For Diagnostics</button>
      <button class="btn" :disabled="loading" @click="checkDiagnostics">Check Agent</button>
      <button class="btn" :disabled="loading" @click="testPrint">Test Print</button>
    </div>

    <p v-if="effectivePrinterTarget" class="resolved-info">
      Effective target: <strong>{{ effectivePrinterTarget.branch_name }}</strong> / <strong>{{ effectivePrinterTarget.channel }}</strong>
      → <strong>{{ effectivePrinterTarget.agent_url }}</strong>
    </p>

    <div class="result" v-if="targets.length">
      <h3>Registered Printer Routes</h3>
      <table class="target-table">
        <thead>
          <tr>
            <th>Branch</th>
            <th>Channel</th>
            <th>Agent URL</th>
            <th>Printer</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in targets" :key="`${t.id}`">
            <td>{{ t.branch_name || 'GLOBAL' }}</td>
            <td><span class="chip">{{ t.channel }}</span></td>
            <td>{{ t.agent_url }}</td>
            <td>{{ t.agent_printer_name || '-' }}</td>
            <td>
              <span class="status" :class="t.is_active ? 'active' : 'inactive'">{{ t.is_active ? 'ACTIVE' : 'DISABLED' }}</span>
            </td>
            <td class="row-actions">
              <button class="btn tiny" @click="pickTarget(t)">Edit</button>
              <button class="btn tiny danger" :disabled="loading" @click="deleteTarget(t)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="diagnostics" class="result">
      <h3>Agent Diagnostics</h3>
      <p><strong>Health:</strong> {{ diagnostics.health?.status }} - {{ diagnostics.health?.data?.service || 'OK' }}</p>
      <p><strong>Default Printer:</strong> {{ diagnostics.printers?.data?.defaultPrinter || '-' }}</p>
      <p><strong>Agent DataType:</strong> {{ diagnostics.health?.data?.dataType || '-' }}</p>
      <ul>
        <li v-for="name in diagnostics.printers?.data?.printers || []" :key="name">{{ name }}</li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue"
import api from "@/services/api"
import Swal from "sweetalert2"
import { setPrinterAgentConfig } from "@/utils/printerAgentConfig"

const loading = ref(false)
const diagnostics = ref(null)
const AGENT_REQUEST_TIMEOUT_MS = 65000
const effectivePrinterTarget = ref(null)
const branches = ref([])
const targets = ref([])

const targetForm = ref({
  branch_id: "",
  channel: "BAR_INBOX",
  agent_url: "",
  agent_token: "",
  agent_printer_name: "",
  is_active: true
})

const loadBranches = async () => {
  const res = await api.get("/superadmin/branches")
  branches.value = Array.isArray(res.data) ? res.data : []
}

const loadBackendTargets = async () => {
  loading.value = true
  try {
    const res = await api.get("/superadmin/printer-targets")
    targets.value = Array.isArray(res.data) ? res.data : []
  } catch (err) {
    await Swal.fire({ icon: "error", title: "Gagal", text: err.response?.data?.message || err.message || "Gagal load printer targets" })
  } finally {
    loading.value = false
  }
}

const saveBackendTarget = async () => {
  loading.value = true
  try {
    const payload = {
      ...targetForm.value,
      branch_id: targetForm.value.branch_id ? Number(targetForm.value.branch_id) : null
    }
    await api.post("/superadmin/printer-targets", payload)
    await loadBackendTargets()
    await Swal.fire({ icon: "success", title: "Tersimpan", text: "Routing printer backend berhasil diupdate." })
  } catch (err) {
    await Swal.fire({ icon: "error", title: "Gagal simpan", text: err.response?.data?.message || err.message || "Gagal simpan printer target" })
  } finally {
    loading.value = false
  }
}

const pickTarget = (target) => {
  targetForm.value = {
    branch_id: target.branch_id == null ? "" : String(target.branch_id),
    channel: target.channel || "BAR_INBOX",
    agent_url: target.agent_url || "",
    agent_token: target.agent_token || "",
    agent_printer_name: target.agent_printer_name || "",
    is_active: Boolean(target.is_active)
  }
}

const deleteTarget = async (target) => {
  const branchName = target.branch_name || "GLOBAL"
  const result = await Swal.fire({
    icon: "warning",
    title: "Delete printer route?",
    text: `Route ${branchName} / ${target.channel} akan dihapus permanen.`,
    showCancelButton: true,
    confirmButtonText: "Yes, delete",
    cancelButtonText: "Cancel"
  })

  if (!result.isConfirmed) return

  loading.value = true
  try {
    await api.delete(`/superadmin/printer-targets/${target.id}`)
    await loadBackendTargets()
    await Swal.fire({ icon: "success", title: "Terhapus", text: "Route printer berhasil dihapus." })
  } catch (err) {
    await Swal.fire({ icon: "error", title: "Gagal hapus", text: err.response?.data?.message || err.message || "Gagal menghapus printer target" })
  } finally {
    loading.value = false
  }
}

const applySelectedTargetToTest = () => {
  setPrinterAgentConfig({
    agent_url: targetForm.value.agent_url,
    agent_token: targetForm.value.agent_token,
    agent_printer_name: targetForm.value.agent_printer_name
  })
  Swal.fire({ icon: "success", title: "Diagnostics target updated", text: "Target saat ini dipakai untuk test-agent dan test-print." })
}


const resolvePrinterForDiagnostics = async () => {
  const params = {
    branch_id: targetForm.value.branch_id ? Number(targetForm.value.branch_id) : undefined,
    channel: targetForm.value.channel
  }

  const res = await api.get("/superadmin/printer-targets", { params })
  const rows = Array.isArray(res.data) ? res.data : []
  const active = rows.find((row) => Boolean(row.is_active)) || rows[0] || null

  if (!active) {
    effectivePrinterTarget.value = null
    return {
      agent_url: targetForm.value.agent_url,
      agent_token: targetForm.value.agent_token,
      agent_printer_name: targetForm.value.agent_printer_name,
      source: "form"
    }
  }

  const resolved = {
    agent_url: active.agent_url || "",
    agent_token: active.agent_token || "",
    agent_printer_name: active.agent_printer_name || "",
    source: "backend",
    branch_name: active.branch_name || "GLOBAL",
    channel: active.channel || targetForm.value.channel
  }

  effectivePrinterTarget.value = resolved
  targetForm.value.agent_url = resolved.agent_url
  targetForm.value.agent_token = resolved.agent_token
  targetForm.value.agent_printer_name = resolved.agent_printer_name

  return resolved
}

const checkDiagnostics = async () => {
  loading.value = true
  diagnostics.value = null
  try {
    const resolved = await resolvePrinterForDiagnostics()
    const printer = {
      agent_url: resolved.agent_url,
      agent_token: resolved.agent_token,
      agent_printer_name: resolved.agent_printer_name
    }
    const res = await api.post("/printers/agent-diagnostics", { printer }, { timeout: AGENT_REQUEST_TIMEOUT_MS })
    diagnostics.value = res.data
    await Swal.fire({ icon: "success", title: "Agent reachable", text: `Status health berhasil diambil dari ${printer.agent_url}` })
  } catch (err) {
    const isTimeout = err?.code === "ECONNABORTED" || String(err?.message || "").toLowerCase().includes("timeout")
    const backendMessage = err.response?.data?.message || err.message || "Gagal cek agent"
    const timeoutHint = "Request diagnosa timeout. Ping bisa sukses, tapi endpoint HTTP agent dari backend mungkin lambat/tidak terbuka (cek port 19000, firewall, route dari server)."
    await Swal.fire({
      icon: "error",
      title: "Diagnosa gagal",
      text: isTimeout ? timeoutHint : backendMessage
    })
  } finally {
    loading.value = false
  }
}

const testPrint = async () => {
  loading.value = true
  try {
    const resolved = await resolvePrinterForDiagnostics()
    const printer = {
      agent_url: resolved.agent_url,
      agent_token: resolved.agent_token,
      agent_printer_name: resolved.agent_printer_name
    }
    await api.post("/printers/test-agent-print", { printer }, { timeout: AGENT_REQUEST_TIMEOUT_MS })
    await Swal.fire({ icon: "success", title: "Test print dikirim", text: `Cek printer ${printer.agent_printer_name || "(default)"} di ${printer.agent_url}` })
  } catch (err) {
    const isTimeout = err?.code === "ECONNABORTED" || String(err?.message || "").toLowerCase().includes("timeout")
    const backendMessage = err.response?.data?.message || err.message || "Gagal test print"
    const timeoutHint = "Request test print timeout. Pastikan backend dapat mengakses agent URL/port dan token agent benar."
    await Swal.fire({ icon: "error", title: "Test print gagal", text: isTimeout ? timeoutHint : backendMessage })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadBranches(), loadBackendTargets()])
})
</script>

<style scoped>
.enterprise-card { background: linear-gradient(160deg, #151515 0%, #111 60%, #0c0c0c 100%); border: 1px solid #353535; border-radius: 14px; padding: 18px; box-shadow: 0 16px 36px rgba(0,0,0,.32); }
.card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.muted { color: #b9b9b9; margin-bottom: 4px; }
.badge { background: rgba(201,162,77,.14); color: #eec36a; border: 1px solid rgba(201,162,77,.4); border-radius: 999px; padding: 6px 10px; font-size: 12px; }
.grid { display: grid; gap: 10px; margin-bottom: 10px; }
.grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
label { display: grid; gap: 6px; font-size: 13px; }
input, select { background: #0f0f0f; border: 1px solid #444; color: #fff; border-radius: 8px; padding: 10px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.btn { border: 1px solid #444; background: #1f1f1f; color: #fff; padding: 8px 12px; border-radius: 8px; cursor: pointer; }
.btn.gold { background: #c9a24d; color: #111; border-color: #c9a24d; font-weight: 700; }
.btn.tiny { padding: 6px 10px; font-size: 12px; }
.btn.danger { background: #3a1717; border-color: #763434; color: #ffb4b4; }
.row-actions { display: flex; gap: 6px; align-items: center; }
.result { margin-top: 14px; border-top: 1px solid #2b2b2b; padding-top: 12px; overflow-x: auto; }
.target-table { width: 100%; border-collapse: collapse; min-width: 680px; }
.target-table th, .target-table td { border-bottom: 1px solid #2c2c2c; padding: 8px; text-align: left; font-size: 12px; }
.chip { background: #232323; border: 1px solid #3a3a3a; padding: 4px 8px; border-radius: 999px; }
.status { padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.status.active { background: rgba(26,188,156,.18); color: #5ef0cb; border: 1px solid rgba(26,188,156,.3); }
.status.inactive { background: rgba(231,76,60,.16); color: #ff9b91; border: 1px solid rgba(231,76,60,.3); }
.resolved-info { margin-top: 10px; color: #d8d8d8; font-size: 13px; }

@media (max-width: 980px) {
  .grid.three { grid-template-columns: 1fr; }
}
</style>
