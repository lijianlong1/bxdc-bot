import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Chromium 86 baseline: avoid ES2022+ that older runtimes may not parse if deps ship untranspiled
  build: {
    target: 'chrome86',
    cssTarget: 'chrome86',
  },
  esbuild: {
    target: 'chrome86',
  },
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // When VITE_API_URL / VITE_AGENT_URL are unset, apiUrl()/agentUrl() use
  // same-origin paths /api/*, /features/*, /agent/* — forward them to backends.
  //
  // Twemoji avatars load from same-origin static files under /twemoji/ (see public/twemoji/).
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:18080',
        changeOrigin: true,
      },
      '/features': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      /** Agent Core (NestJS): POST /agent/run, POST /agent/confirm, … */
      '/agent': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
