import { formatThrownError } from '~/lib/api'
import { consoleService } from '~/lib/console'
import { resolveEnvTemplates } from '~/lib/env'
import { getActiveEnvMap } from '~/lib/env/runtime'
import { type AppApi, createAppApi } from './create-app'

export type TerminalLogLevel = 'log' | 'info' | 'warn' | 'error'

export type TerminalLogEntry = {
  level: TerminalLogLevel
  args: unknown[]
}

export type ExecuteSnippetSuccess = {
  ok: true
  logs: TerminalLogEntry[]
  value: unknown
}

export type ExecuteSnippetFailure = {
  ok: false
  logs: TerminalLogEntry[]
  error: string
  cause?: unknown
}

export type ExecuteSnippetResult = ExecuteSnippetSuccess | ExecuteSnippetFailure

/**
 * True when `code` can be parsed as a single expression (safe to `return (code)`).
 */
export function isExpressionCode(code: string): boolean {
  const trimmed = code.trim()
  if (!trimmed) return false
  try {
    // AsyncFunction so top-level `await` expressions parse.
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
      ...args: string[]
    ) => unknown
    new AsyncFunction(`"use strict"; return (${trimmed})`)
    return true
  } catch {
    return false
  }
}

function wrapSource(code: string): string {
  const trimmed = code.trim()
  if (!trimmed) return 'return undefined'
  if (isExpressionCode(trimmed)) {
    return `return (${trimmed})`
  }
  return trimmed
}

function createCapturedConsole(logs: TerminalLogEntry[], mirrorToAppConsole: boolean) {
  const push = (level: TerminalLogLevel, args: unknown[]) => {
    logs.push({ level, args })
    if (!mirrorToAppConsole) return
    if (level === 'log') consoleService.log(...args)
    else if (level === 'info') consoleService.info(...args)
    else if (level === 'warn') consoleService.warn(...args)
    else consoleService.error(...args)
  }

  return {
    log: (...args: unknown[]) => push('log', args),
    info: (...args: unknown[]) => push('info', args),
    warn: (...args: unknown[]) => push('warn', args),
    error: (...args: unknown[]) => push('error', args),
    debug: (...args: unknown[]) => push('log', args),
  }
}

export type ExecuteSnippetOptions = {
  /** Mirror captured console.* into the app Console panel. @default true */
  mirrorToAppConsole?: boolean
  /** Optional pre-built app facade (defaults to createAppApi()). */
  app?: AppApi
  /** When false, skip `{{var}}` substitution in source. @default true */
  resolveEnvTemplatesInSource?: boolean
}

/**
 * Run a user snippet as an async function with injected `ds`, `console`, and `app`.
 * Does not expose `window`, `fetch`, or other globals beyond the engine defaults.
 */
export async function executeSnippet(
  code: string,
  ds: unknown,
  options: ExecuteSnippetOptions = {}
): Promise<ExecuteSnippetResult> {
  const logs: TerminalLogEntry[] = []
  const mirrorToAppConsole = options.mirrorToAppConsole !== false
  const capturedConsole = createCapturedConsole(logs, mirrorToAppConsole)
  const app = options.app ?? createAppApi()

  try {
    let source = code
    if (options.resolveEnvTemplatesInSource !== false) {
      const resolved = resolveEnvTemplates(code, getActiveEnvMap())
      if (resolved.unresolved.length > 0) {
        capturedConsole.warn(`Unresolved environment variables: ${resolved.unresolved.join(', ')}`)
      }
      source = resolved.text
    }
    const body = wrapSource(source)
    // AsyncFunction is the standard REPL evaluation approach; only ds + console + app are bound.
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<unknown>
    const fn = new AsyncFunction('ds', 'console', 'app', `"use strict";\n${body}`)
    const value = await fn(ds, capturedConsole, app)
    return { ok: true, logs, value }
  } catch (error) {
    return {
      ok: false,
      logs,
      error: formatThrownError(error, 'Snippet failed'),
      cause: error,
    }
  }
}
