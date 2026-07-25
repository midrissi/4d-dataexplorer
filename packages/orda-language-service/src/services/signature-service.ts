import { tokenize } from '../lexer/lexer.ts'
import type {
  ParameterInformation,
  SignatureHelp,
  SignatureInformation,
} from '../types/language.ts'
import { TokenKind } from '../types/tokens.ts'

/**
 * Scan a query string for `:1`, `:2`… indexed placeholders and determine
 * which placeholder the cursor is currently "editing".
 *
 * Returns a `SignatureHelp` describing the placeholder signature,
 * with `activeParameter` set to the 0-based index of the active placeholder.
 */
export function signature(query: string, offset: number): SignatureHelp | null {
  const tokens = tokenize(query)

  // Collect all indexed placeholders (and track highest index)
  const placeholders: Array<{ index: number; start: number; end: number }> = []
  let maxIndex = 0

  for (const tok of tokens) {
    if (tok.kind === TokenKind.Placeholder) {
      const raw = tok.text.slice(1)
      if (/^\d+$/.test(raw)) {
        const idx = Number.parseInt(raw, 10)
        placeholders.push({ index: idx, start: tok.start, end: tok.end })
        if (idx > maxIndex) maxIndex = idx
      }
    }
  }

  if (placeholders.length === 0) return null

  // Determine active parameter: the placeholder nearest before/at the cursor
  let activeParam = 0
  for (const p of placeholders) {
    if (p.start <= offset) {
      activeParam = p.index - 1 // 0-based
    }
  }
  activeParam = Math.max(0, Math.min(activeParam, maxIndex - 1))

  // Build parameter list
  const params: ParameterInformation[] = []
  for (let i = 1; i <= maxIndex; i++) {
    params.push({ label: `:${i}`, documentation: `Value for placeholder :${i}` })
  }

  const sigLabel = params.map((p) => p.label).join(', ')
  const sig: SignatureInformation = {
    label: `query(queryString, ${sigLabel})`,
    documentation:
      'Pass positional parameter values after the query string. Each :N placeholder is replaced by the corresponding argument.',
    parameters: params,
  }

  return {
    signatures: [sig],
    activeSignature: 0,
    activeParameter: activeParam,
  }
}
