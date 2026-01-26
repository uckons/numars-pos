<template>
  <div class="page">
    <!-- HEADER -->
    <div class="header">
      <div>
        <h2>Orders</h2>
        <p class="subtitle">Summary & latest transactions</p>
      </div>
    </div>

    <!-- STATS -->
    <div class="stats">
      <div class="stat-card">
        <p>Total Orders Today</p>
        <h3>{{ stats.total }}</h3>
      </div>

      <div class="stat-card spa">
        <p>SPA</p>
        <h3>{{ stats.spa }}</h3>
      </div>

      <div class="stat-card lc">
        <p>LC</p>
        <h3>{{ stats.lc }}</h3>
      </div>

      <div class="stat-card fnb">
        <p>FNB</p>
        <h3>{{ stats.fnb }}</h3>
      </div>

      <div class="stat-card karaoke">
        <p>Karaoke</p>
        <h3>{{ stats.karaoke }}</h3>
      </div>
    </div>
<!-- FILTER -->
    <div class="card filter-card">
      <div class="filters">
        <input type="date" v-model="dateFrom" />
        <input type="date" v-model="dateTo" />

        <select v-model="perPage">
          <option v-for="n in [100,200,300,400,500]" :key="n" :value="n">
            {{ n }} / page
          </option>
        </select>

        <button class="btn-outline" @click="applyFilter">
          Apply
        </button>
      </div>
    </div>
    <!-- TABLE -->
    <div class="card table-card">
      <h3 class="table-title">Latest Orders</h3>

      <div class="table-wrapper">
        <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Category</th>
            <th>Total</th>
            <th>Time</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="!orders.length">
            <td colspan="4" class="empty">No orders found</td>
          </tr>

          <tr
            v-for="o in orders"
            :key="o.id"
            class="row-hover"
          >
            <td>#{{ o.id }}</td>
            <td>
              <span class="badge">{{ o.categories }}</span>
            </td>
            <td class="price">Rp {{ format(o.total) }}</td>
            <td>{{ new Date(o.created_at).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
      </div>
<!-- PAGINATION -->
      <div class="pagination">
        <button @click="page--" :disabled="page === 1">Prev</button>
        <span>Page {{ page }} / {{ totalPages }}</span>
        <button @click="page++" :disabled="page === totalPages">Next</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import api from "@/services/api"

const orders = ref([])
const filtered = ref([])

const page = ref(1)
const perPage = ref(100)

const dateFrom = ref("")
const dateTo = ref("")

const stats = ref({
  total: 0,
  spa: 0,
  lc: 0,
  fnb: 0,
  karaoke: 0
})

onMounted(async () => {
  const res = await api.get("/superadmin/orders")
  orders.value = res.data || []
  applyFilter()
})

const applyFilter = () => {
  page.value = 1

  filtered.value = orders.value.filter(o => {
    const d = new Date(o.created_at)
    if (dateFrom.value && d < new Date(dateFrom.value)) return false
    if (dateTo.value && d > new Date(dateTo.value + " 23:59")) return false
    return true
  })

  calculateStats()
}

const calculateStats = () => {
  stats.value = { total: 0, spa: 0, lc: 0, fnb: 0, karaoke: 0 }
  const today = new Date().toDateString()

  filtered.value.forEach(o => {
    if (new Date(o.created_at).toDateString() === today) {
      stats.value.total++
      const k = o.category?.toLowerCase()
      if (stats.value[k] !== undefined) stats.value[k]++
    }
  })
}

const totalPages = computed(() =>
  Math.ceil(filtered.value.length / perPage.value)
)

const pagedOrders = computed(() => {
  const start = (page.value - 1) * perPage.value
  return filtered.value.slice(start, start + perPage.value)
})

const format = v => Number(v || 0).toLocaleString("id-ID")
</script>
<style scoped>
/* PAGE */
.page {
  padding: 24px;
}

/* HEADER */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.subtitle {
  font-size: 13px;
  color: var(--text-muted);
}

/* STATS */
.stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-top: 16px;
}

.stat-card {
  background: linear-gradient(145deg, #0e0e0e, #151515);
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 12px 40px rgba(0,0,0,.45);
  transition: all .25s ease;
}
.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 60px rgba(0,0,0,.6);
}

.stat-card p {
  font-size: 13px;
  color: #999;
}
.stat-card h3 {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 700;
}

.stat-card.spa h3 { color: #c9a24d }
.stat-card.lc h3 { color: #3498db }
.stat-card.fnb h3 { color: #2ecc71 }
.stat-card.karaoke h3 { color: #e67e22 }

/* CARD */
.card {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 16px;
  margin-top: 20px;
  box-shadow: var(--shadow-soft);
}

.table-title {
  margin-bottom: 12px;
}

/* TABLE */
.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
}

th {
  text-align: left;
  padding: 12px;
  font-size: 13px;
  color: var(--text-muted);
}

td {
  padding: 12px;
  border-top: 1px solid var(--border-soft);
}

.row-hover:hover {
  background: rgba(201,162,77,.05);
}

.price {
  font-weight: 600;
}

/* BADGE */
.badge {
  background: rgba(201,162,77,.2);
  color: var(--gold);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
}

/* EMPTY */
.empty {
  text-align: center;
  padding: 30px;
  color: var(--text-muted);
}
.filters {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.filters input,
.filters select {
  background: #000;
  border: 1px solid var(--border-soft);
  color: white;
  padding: 8px;
  border-radius: var(--radius);
  flex: 1;
  min-width: 150px;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.pagination button {
  background: none;
  border: 1px solid var(--gold);
  color: var(--gold);
  padding: 6px 14px;
  border-radius: var(--radius);
}

.pagination button:disabled {
  opacity: .4;
  cursor: not-allowed;
}
/* ROW HOVER */
tbody tr {
  transition: 
    background 0.25s ease,
    transform 0.25s ease,
    box-shadow 0.25s ease;
}

tbody tr:hover {
  background: linear-gradient(
    90deg,
    rgba(201,162,77,0.08),
    rgba(201,162,77,0.02)
  );
  transform: translateX(4px);
  box-shadow: inset 4px 0 0 var(--gold);
}

/* RESPONSIVE STYLES */
@media (max-width: 768px) {
  .page {
    padding: 16px;
  }

  .stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-card {
    padding: 14px;
  }

  .stat-card h3 {
    font-size: 22px;
  }

  .filters {
    flex-direction: column;
  }

  .filters input,
  .filters select {
    width: 100%;
  }

  .pagination {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .page {
    padding: 12px;
  }

  .stats {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .stat-card {
    padding: 12px;
  }

  .stat-card h3 {
    font-size: 20px;
  }

  .card {
    padding: 12px;
  }

  th, td {
    padding: 8px;
    font-size: 12px;
  }
}

</style>
