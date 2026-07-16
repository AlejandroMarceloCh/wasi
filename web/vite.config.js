import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // #7: partir el bundle monolítico. Los vendors pesados (leaflet+cluster,
    // d3, react) van a chunks separados para que el chunk de la app quede bien
    // por debajo de 500 kB y el navegador los cachee entre versiones.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          leaflet: ['leaflet', 'leaflet.markercluster'],
          d3: ['d3'],
        },
      },
    },
  },
})
