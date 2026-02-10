<template>
  <div class="apex-host">
    <div v-if="!available" class="apex-fallback">ApexCharts belum tersedia</div>
    <div v-else ref="chartEl" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  type: { type: String, default: 'line' },
  height: { type: [Number, String], default: 260 },
  options: { type: Object, default: () => ({}) },
  series: { type: Array, default: () => [] }
})

const chartEl = ref(null)
const chart = ref(null)
const available = ref(false)

const buildConfig = () => ({
  chart: {
    type: props.type,
    height: props.height,
    toolbar: { show: false },
    animations: { enabled: false },
    background: 'transparent'
  },
  ...props.options,
  series: props.series
})

const renderChart = async () => {
  if (!available.value || !chartEl.value) return
  if (chart.value) {
    await chart.value.destroy()
    chart.value = null
  }

  const ApexCharts = window?.ApexCharts
  if (!ApexCharts) return

  chart.value = new ApexCharts(chartEl.value, buildConfig())
  await chart.value.render()
}

onMounted(async () => {
  available.value = Boolean(window?.ApexCharts)
  await renderChart()
})

watch(
  () => [props.type, props.height, props.options, props.series],
  async () => {
    await renderChart()
  },
  { deep: true }
)

onBeforeUnmount(async () => {
  if (chart.value) {
    await chart.value.destroy()
  }
})
</script>

<style scoped>
.apex-host {
  min-height: 220px;
}

.apex-fallback {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9aa0ae;
  border: 1px dashed #2f2f2f;
  border-radius: 10px;
}
</style>
