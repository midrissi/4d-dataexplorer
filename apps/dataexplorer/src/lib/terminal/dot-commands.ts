import terminalHelpMarkdown from '~/content/terminal-help.md?raw'
import { useDataExplorerStore } from '~/store'
import { useSettingsStore } from '~/store/settings'
import { useTerminalStore } from '~/store/terminal'
import { useTerminalSnippetsStore } from '~/store/terminal-snippets'

export type DotCommandName =
  | 'help'
  | 'clear'
  | 'exit'
  | 'history'
  | 'snippets'
  | 'save'
  | 'load'
  | 'run'
  | 'rm'
  | 'classes'
  | 'about'
  | 'theme'
  | 'unknown'

export type ParsedDotCommand = {
  name: DotCommandName
  raw: string
  arg: string
}

export type DotCommandResult =
  | { kind: 'noop' }
  | { kind: 'message'; text: string }
  | { kind: 'markdown'; markdown: string }
  | { kind: 'load'; code: string }
  | { kind: 'run'; code: string }
  | { kind: 'error'; message: string }

const ALIASES: Record<string, DotCommandName> = {
  help: 'help',
  h: 'help',
  '?': 'help',
  clear: 'clear',
  cls: 'clear',
  exit: 'exit',
  quit: 'exit',
  q: 'exit',
  history: 'history',
  hist: 'history',
  snippets: 'snippets',
  ls: 'snippets',
  save: 'save',
  load: 'load',
  run: 'run',
  rm: 'rm',
  delete: 'rm',
  del: 'rm',
  classes: 'classes',
  ds: 'classes',
  about: 'about',
  theme: 'theme',
}

/** Primary commands shown in `.` autocomplete (aliases match but insert the primary name). */
export type DotCommandSuggest = {
  command: string
  aliases?: string[]
  detail: string
  /** Inserted after the leading `.` — trailing space when an arg is expected. */
  insertText?: string
}

export const DOT_COMMAND_SUGGESTIONS: readonly DotCommandSuggest[] = [
  { command: 'help', aliases: ['h', '?'], detail: 'Show terminal help' },
  { command: 'clear', aliases: ['cls'], detail: 'Clear the scrollback' },
  { command: 'exit', aliases: ['quit', 'q'], detail: 'Close the terminal dock' },
  { command: 'history', aliases: ['hist'], detail: 'List recent commands' },
  { command: 'snippets', aliases: ['ls'], detail: 'List saved snippet files' },
  {
    command: 'save',
    detail: 'Save the last run as a snippet',
    insertText: 'save ',
  },
  { command: 'load', detail: 'Open a snippet .js file', insertText: 'load ' },
  { command: 'run', detail: 'Run a saved snippet', insertText: 'run ' },
  { command: 'rm', aliases: ['delete', 'del'], detail: 'Delete a snippet', insertText: 'rm ' },
  { command: 'classes', aliases: ['ds'], detail: 'List dataclass names' },
  { command: 'about', detail: 'Short about line' },
  { command: 'theme', detail: 'Tip: switch theme in Settings' },
]

/** True when the buffer so far is a single-line `.command` being typed. */
export function isDotCommandContext(before: string): boolean {
  return /^\.([A-Za-z?][\w-]*)?$/.test(before)
}

/** Filter / match primary commands (and aliases) by the text after `.`. */
export function filterDotCommandSuggestions(
  prefix: string,
  suggestions: readonly DotCommandSuggest[] = DOT_COMMAND_SUGGESTIONS
): DotCommandSuggest[] {
  const p = prefix.toLowerCase()
  if (!p) return [...suggestions]
  return suggestions.filter((s) => {
    if (s.command.toLowerCase().startsWith(p)) return true
    return (s.aliases ?? []).some((a) => a.toLowerCase().startsWith(p))
  })
}

/**
 * Parse a single-line `.command` (multi-line input is never a dot command).
 */
export function parseDotCommand(code: string): ParsedDotCommand | null {
  const trimmed = code.trim()
  if (!trimmed.startsWith('.') || trimmed.includes('\n')) return null
  const match = trimmed.match(/^\.([A-Za-z?][\w-]*)(?:\s+(.*))?$/)
  if (!match) return null
  const raw = (match[1] ?? '').toLowerCase()
  const arg = (match[2] ?? '').trim()
  const name = ALIASES[raw] ?? 'unknown'
  return { name, raw, arg }
}

function lastRunnableHistory(): string | null {
  const history = useTerminalStore.getState().history
  for (let i = history.length - 1; i >= 0; i--) {
    const code = history[i]?.code
    if (!code) continue
    if (parseDotCommand(code)) continue
    return code
  }
  return null
}

/**
 * Execute a parsed dot command against app stores. Side effects (clear, exit)
 * run here; UI-facing payloads are returned for the panel to append.
 */
export function executeDotCommand(parsed: ParsedDotCommand): DotCommandResult {
  switch (parsed.name) {
    case 'help':
      return { kind: 'markdown', markdown: terminalHelpMarkdown }

    case 'clear':
      useTerminalStore.getState().clearOutput()
      return { kind: 'noop' }

    case 'exit':
      useTerminalStore.getState().clearOutput()
      useSettingsStore.getState().setConsoleOpen(false)
      return { kind: 'noop' }

    case 'history': {
      const history = useTerminalStore.getState().history
      if (history.length === 0) {
        return { kind: 'message', text: 'No history yet.' }
      }
      const lines = history
        .slice(-20)
        .map((entry, index) => `${String(index + 1).padStart(2, ' ')}  ${entry.code}`)
        .join('\n')
      return { kind: 'message', text: lines }
    }

    case 'snippets': {
      const snippets = useTerminalSnippetsStore.getState().snippets
      if (snippets.length === 0) {
        return {
          kind: 'message',
          text: 'No snippets yet. Create a .js file in the terminal bar, or .save <name> after a run.',
        }
      }
      const lines = snippets
        .map((s) => `  ${`${s.name}.js`.padEnd(20, ' ')}  ${s.code.split('\n')[0] ?? ''}`)
        .join('\n')
      return { kind: 'message', text: lines }
    }

    case 'save': {
      if (!parsed.arg) {
        return { kind: 'error', message: 'Usage: .save <name>' }
      }
      const code = lastRunnableHistory()
      if (!code) {
        return { kind: 'error', message: 'Nothing to save — run an expression first.' }
      }
      const created = useTerminalSnippetsStore.getState().addSnippet({
        name: parsed.arg,
        code,
      })
      if (!created) {
        const exists = useTerminalSnippetsStore.getState().getByName(parsed.arg)
        if (exists) {
          return {
            kind: 'error',
            message: `Snippet "${parsed.arg}" already exists. .rm it first or pick another name.`,
          }
        }
        return {
          kind: 'error',
          message: 'Could not save snippet. Use a name like myQuery (letters, digits, _ or -).',
        }
      }
      return { kind: 'message', text: `Saved snippet "${created.name}".` }
    }

    case 'load': {
      if (!parsed.arg) return { kind: 'error', message: 'Usage: .load <name>' }
      const snippet = useTerminalSnippetsStore.getState().getByName(parsed.arg)
      if (!snippet) return { kind: 'error', message: `Unknown snippet "${parsed.arg}".` }
      return { kind: 'load', code: snippet.code }
    }

    case 'run': {
      if (!parsed.arg) return { kind: 'error', message: 'Usage: .run <name>' }
      const snippet = useTerminalSnippetsStore.getState().getByName(parsed.arg)
      if (!snippet) return { kind: 'error', message: `Unknown snippet "${parsed.arg}".` }
      return { kind: 'run', code: snippet.code }
    }

    case 'rm': {
      if (!parsed.arg) return { kind: 'error', message: 'Usage: .rm <name>' }
      const snippet = useTerminalSnippetsStore.getState().getByName(parsed.arg)
      if (!snippet) return { kind: 'error', message: `Unknown snippet "${parsed.arg}".` }
      useTerminalSnippetsStore.getState().removeSnippet(snippet.id)
      return { kind: 'message', text: `Deleted snippet "${snippet.name}".` }
    }

    case 'classes': {
      const names = useDataExplorerStore.getState().dataclasses.map((d) => d.name)
      if (names.length === 0) {
        return { kind: 'message', text: 'No dataclasses loaded yet.' }
      }
      return { kind: 'message', text: names.join('\n') }
    }

    case 'about':
      return {
        kind: 'message',
        text: `ORDA Terminal · Data Explorer ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''}`.trim(),
      }

    case 'theme':
      return {
        kind: 'message',
        text: 'Theme lives in Settings → Appearance. Tip: match Monaco prefs under Editor.',
      }

    case 'unknown':
      return {
        kind: 'error',
        message: `Unknown command ".${parsed.raw}". Type .help for the list.`,
      }
  }
}
