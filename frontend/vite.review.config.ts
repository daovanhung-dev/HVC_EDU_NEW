import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const sourceRoot = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  root: fileURLToPath(new URL('./review', import.meta.url)),
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^@\/services\/(data-queries|commands)$/, replacement: `${sourceRoot}/devtools/ui-review/mock-services.ts` },
      { find: /^@\/services\/supabase$/, replacement: `${sourceRoot}/devtools/ui-review/mock-supabase.ts` },
      { find: /^@\/stores\/auth\.store$/, replacement: `${sourceRoot}/devtools/ui-review/mock-auth.store.ts` },
      { find: '@', replacement: sourceRoot },
    ],
  },
  server: { host: '127.0.0.1', port: 4178, strictPort: true },
})
