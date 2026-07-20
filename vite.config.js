import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this as a project site at /multipath/, not the domain root —
  // Railway (the primary deploy target) serves it at root, so this only applies
  // when the Pages build workflow sets GITHUB_PAGES=true.
  base: process.env.GITHUB_PAGES ? '/multipath/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      // Backend routes live in server.js (Express) — run `node server.js`
      // alongside `npm run dev` to exercise them locally.
      '/api': 'http://localhost:3000',
    },
  },
})
