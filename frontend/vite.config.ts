import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// TODO: agregar tailwindcss() de @tailwindcss/vite cuando se instale
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
})
