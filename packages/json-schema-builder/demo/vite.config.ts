import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@4d/ui/styles',
        replacement: path.resolve(__dirname, '../../ui/src/styles/globals.css'),
      },
      {
        find: '@4d/ui/themes',
        replacement: path.resolve(__dirname, '../../ui/src/themes'),
      },
      {
        find: '@4d/ui',
        replacement: path.resolve(__dirname, '../../ui/src/index.ts'),
      },
    ],
  },
  server: {
    port: 4000,
  },
})
