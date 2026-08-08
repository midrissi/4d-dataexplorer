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
    'import.meta.env.VITE_APP_SHELL': JSON.stringify('web'),
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
        find: '@4d/ui/editor-prefs',
        replacement: path.resolve(__dirname, '../../packages/ui/src/components/editor-prefs.ts'),
      },
      {
        find: '@4d/ui/code-editor',
        replacement: path.resolve(__dirname, '../../packages/ui/src/code-editor.ts'),
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
  // Pre-bundle monaco-editor so opening Terminal does not trigger a mid-session
  // optimizeDeps reload (can OOM / Aw-Snap the tab).
  optimizeDeps: {
    include: ['monaco-editor'],
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
    // Entry stays large (assistant, UI shell). Heavy panes (Monaco via editors,
    // AG Grid, ELK, Method Executor, Http Client) are lazy-loaded from DataclassView.
    chunkSizeWarningLimit: 5_000,
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
