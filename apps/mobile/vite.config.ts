import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import {
  copyAsNodeShimsAliases,
  httpsnippetOptimizeDeps,
  httpsnippetWebkitPlugin,
} from '../dataexplorer/vite.copy-as'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8')) as {
  version: string
}

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react(), httpsnippetWebkitPlugin()],
  envPrefix: ['VITE_', 'TAURI_'],
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    'import.meta.env.VITE_APP_SHELL': JSON.stringify('mobile'),
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
      // Reuse desktop host libs (connection store + native fetch)
      { find: '~desktop', replacement: path.resolve(__dirname, '../desktop/src') },
      { find: '~mobile', replacement: path.resolve(__dirname, './src') },
      { find: '~', replacement: path.resolve(__dirname, '../dataexplorer/src') },
      ...copyAsNodeShimsAliases(),
    ],
  },
  clearScreen: false,
  optimizeDeps: {
    include: ['monaco-editor', ...httpsnippetOptimizeDeps.include],
    exclude: ['@monaco-editor/react', '@4d/base64-decoder'],
    needsInterop: httpsnippetOptimizeDeps.needsInterop,
    rolldownOptions: httpsnippetOptimizeDeps.rolldownOptions,
  },
  assetsInclude: ['**/*.wasm'],
  server: {
    port: 3005,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 3006 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'safari15',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    chunkSizeWarningLimit: 10_000,
    rolldownOptions: {
      onwarn(warning, defaultHandler) {
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
