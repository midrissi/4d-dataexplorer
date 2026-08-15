import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const shimsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src/lib/copy-as/shims')

/** Browser stand-ins for Node modules pulled in by the snippet generator. */
export function copyAsNodeShimsAliases() {
  return [
    {
      find: 'event-stream',
      replacement: path.join(shimsDir, 'event-stream.ts'),
    },
    {
      find: /^url$/,
      replacement: path.join(shimsDir, 'url.ts'),
    },
    {
      find: /^querystring$/,
      replacement: path.join(shimsDir, 'querystring.ts'),
    },
    {
      find: 'form-data/lib/form_data',
      replacement: path.join(shimsDir, 'form-data.ts'),
    },
    {
      find: /^form-data$/,
      replacement: path.join(shimsDir, 'form-data.ts'),
    },
  ]
}

/**
 * WKWebView/Safari TDZ: `export default require_foo()` initializes the module's
 * `default` binding while CJS helpers may read `.default` on the same namespace.
 */
function rewriteHttpsnippetDefault(code: string): string | null {
  if (!/export default require_\w+\(\);/.test(code)) return null
  return code.replace(
    /export default (require_\w+)\(\);/g,
    [
      'const __httpsnippetNs = $1();',
      'export const HTTPSnippet = __httpsnippetNs.HTTPSnippet;',
      'export default __httpsnippetNs;',
    ].join('\n')
  )
}

export function httpsnippetWebkitPlugin(): Plugin {
  return {
    name: 'httpsnippet-webkit-default',
    renderChunk(code) {
      const next = rewriteHttpsnippetDefault(code)
      return next ? { code: next, map: null } : null
    },
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        const next = rewriteHttpsnippetDefault(chunk.code)
        if (next) chunk.code = next
      }
    },
  }
}

export const httpsnippetOptimizeDeps = {
  include: ['httpsnippet'],
  needsInterop: ['httpsnippet'],
  rolldownOptions: {
    plugins: [httpsnippetWebkitPlugin()],
  },
}
