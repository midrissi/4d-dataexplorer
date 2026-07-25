import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8')) as {
  version: string
}
const backendTarget = process.env.BACKEND_URL || 'http://localhost:7080'

const proxyPaths = ['/rest', '/login.html', '/js', '/css', '/img', '/api']

const proxy = proxyPaths.reduce(
  (acc, proxyPath) => {
    acc[proxyPath] = {
      target: backendTarget,
      changeOrigin: true,
      secure: false, // Allow self-signed certificates
    }
    return acc
  },
  {} as Record<string, { target: string; changeOrigin: boolean; secure: boolean }>
)

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_'],
  base: '/dataexplorer/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: [
      {
        find: '@4d/ui/styles',
        replacement: path.resolve(__dirname, '../../packages/ui/src/styles/globals.css'),
      },
      {
        find: '@4d/ui/themes',
        replacement: path.resolve(__dirname, '../../packages/ui/src/themes'),
      },
      {
        find: '@4d/ui',
        replacement: path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      },
      {
        find: '@4d/rest',
        replacement: path.resolve(__dirname, '../../packages/rest/src/index.ts'),
      },
      {
        find: '@4d/base64-decoder',
        replacement: path.resolve(__dirname, '../../packages/base64-decoder/src/index.ts'),
      },
      { find: '~', replacement: path.resolve(__dirname, './src') },
    ],
  },
  // Patched package — do not serve a stale prebundle that ignores
  // patches/@monaco-editor%2Freact@4.7.0.patch (getModel null race).
  // WASM package uses top-level await + import.meta.url for the .wasm asset.
  optimizeDeps: {
    exclude: ['@monaco-editor/react', '@4d/base64-decoder'],
  },
  assetsInclude: ['**/*.wasm'],
  server: {
    port: 3002,
    proxy,
  },
  build: {
    outDir: 'DataBrowser',
    emptyOutDir: true,
    // Main chunk includes Monaco, assistant, AG Grid, etc. (~9MB). Raise until
    // those are deliberately code-split; avoid noisy false alarms each build.
    chunkSizeWarningLimit: 10_000,
    rolldownOptions: {
      onwarn(warning, defaultHandler) {
        // @4djs/assistant statically + dynamically imports @4djs/ai-widgets.
        if (
          warning.code === 'INEFFECTIVE_DYNAMIC_IMPORT' &&
          typeof warning.message === 'string' &&
          warning.message.includes('@4djs/ai-widgets')
        ) {
          return
        }
        defaultHandler(warning)
      },
    },
  },
})
