import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT) || 5199,
    strictPort: true
  },
  optimizeDeps: {
    include: ['tines-sdk']
  }
})
