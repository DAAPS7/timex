import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, /api is served by `npm run cf:dev` (wrangler dev) on :8787.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
  test: { include: ['backend/**/*.test.ts'] },
})
