import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import path from "path"

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return

          if (id.includes("vue") || id.includes("pinia") || id.includes("vue-router")) {
            return "vendor-vue"
          }

          if (id.includes("apexcharts") || id.includes("chart.js") || id.includes("vue-chartjs")) {
            return "vendor-charts"
          }

          if (id.includes("sweetalert2") || id.includes("axios") || id.includes("socket.io-client") || id.includes("lucide-vue-next")) {
            return "vendor-utils"
          }

          return "vendor"
        }
      }
    }
  }
})
