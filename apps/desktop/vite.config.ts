import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8')) as {
  version: string
}

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'TAURI_'],
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    'import.meta.env.VITE_APP_SHELL': JSON.stringify('desktop'),
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
        find: '@4d/orda-language-service',
        replacement: path.resolve(__dirname, '../../packages/orda-language-service/src/index.ts'),
      },
      {
        find: '@4d/base64-decoder',
        replacement: path.resolve(__dirname, '../../packages/base64-decoder/src/index.ts'),
      },
      // ~ resolves to the shared dataexplorer source
      { find: '~desktop', replacement: path.resolve(__dirname, './src') },
      { find: '~', replacement: path.resolve(__dirname, '../dataexplorer/src') },
    ],
  },
  // Vite options tailored for Tauri development
  clearScreen: false,
  // Patched package — do not serve a stale prebundle that ignores
  // patches/@monaco-editor%2Freact@4.7.0.patch (getModel null race).
  // WASM package uses top-level await + import.meta.url for the .wasm asset.
  optimizeDeps: {
    exclude: ['@monaco-editor/react', '@4d/base64-decoder'],
  },
  assetsInclude: ['**/*.wasm'],
  server: {
    port: 3003,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 3004 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Tauri uses Chromium on Windows and WebKit on macOS/Linux
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari14',
    // Don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // Main chunk includes Monaco, assistant, AG Grid, etc. (~9MB).
    chunkSizeWarningLimit: 10_000,
    rolldownOptions: {
      onwarn(warning, defaultHandler) {
        // Shared platform.ts keeps a dynamic import for the web build; desktop
        // already has @tauri-apps/api/core via the HTTP bridge.
        // @4djs/assistant also mixes static + dynamic @4djs/ai-widgets imports.
        if (
          warning.code === 'INEFFECTIVE_DYNAMIC_IMPORT' &&
          typeof warning.message === 'string' &&
          (warning.message.includes('@tauri-apps/api/core') ||
            warning.message.includes('@4djs/ai-widgets'))
        ) {
          return
        }
        defaultHandler(warning)
      },
    },
  },
})
