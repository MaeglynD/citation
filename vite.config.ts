import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
    rollupOptions: { output: { manualChunks(id) {
      if (id.includes('/src/data/')) return 'game-data'
      if (id.includes('/node_modules/three/')) return 'three'
      if (/\/node_modules\/(react|react-dom|scheduler|zustand)\//.test(id)) return 'react'
    } } },
  },
})
