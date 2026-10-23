import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The public portal (spec 017): its own port, so the team app (:5173) and the portal run side by side.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    // The QR is opened from phones through a cloudflared quick tunnel (spec 017, D10).
    allowedHosts: ['.trycloudflare.com'],
    proxy: { '/api': 'http://localhost:8000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
