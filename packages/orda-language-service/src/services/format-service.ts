import { tokenize } from '../lexer/lexer.ts'
import type { FormatOptions } from '../types/language.ts'
import type { Token } from '../types/tokens.ts'
import { TokenKind } from '../types/tokens.ts'

const DEFAULT_OPTIONS: Required<FormatOptions> = {
  keywordCase: 'upper',
  normalizeOperators: true,
  spaceAroundOperators: true,
}

const KEYWORDS = new Set(['and', 'or', 'not', 'in', 'is', 'asc', 'desc', 'order', 'by', 'eval'])

const OPERATOR_NORMALIZE: Readonly<Record<string, string>> = {
  '==': '=',
  '===': 'IS',
  '!==': 'IS NOT',
  '!=': '#',
  '&&': 'AND',
  '||': 'OR',
  '&': 'AND',
  '|': 'OR',
}

/**
 * Normalise / pretty-print an ORDA query string.
 *
 * - Ensures single spaces around comparators and logical operators
 * - Normalises operator aliases (== → =, === → IS, etc.) when `normalizeOperators` is true
 * - Applies keyword casing
 * - Removes redundant whitespace
 */
export function format(query: string, options?: FormatOptions): string {
  const opts: Required<FormatOptions> = { ...DEFAULT_OPTIONS, ...options }
  const tokens = tokenize(query)
  const parts: string[] = []

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (tok.kind === TokenKind.EOF) break

    let text = tok.text
    const prev = parts[parts.length - 1]

    // Operator normalisation
    if (opts.normalizeOperators) {
      const normalized = OPERATOR_NORMALIZE[text]
      if (normalized !== undefined) text = normalized
    }

    // Keyword casing
    if (KEYWORDS.has(tok.text.toLowerCase())) {
      text = applyCase(text, opts.keywordCase)
    }

    // IS NOT is emitted as a single string by normalisation — split handling already done above
    // Handle spacing
    if (opts.spaceAroundOperators) {
      const needsSpaceBefore = needsLeadingSpace(tok, tokens[i - 1])
      const needsSpaceAfter = needsTrailingSpace(tok, tokens[i + 1])

      if (prev !== undefined && prev !== '(' && !prev.endsWith(' ') && needsSpaceBefore) {
        parts.push(' ')
      }

      parts.push(text)

      if (needsSpaceAfter && i + 1 < tokens.length && tokens[i + 1]?.kind !== TokenKind.EOF) {
        parts.push(' ')
      }
    } else {
      parts.push(text)
    }
  }

  return parts.join('').trim()
}

function applyCase(text: string, mode: FormatOptions['keywordCase']): string {
  if (mode === 'upper') return text.toUpperCase()
  if (mode === 'lower') return text.toLowerCase()
  return text
}

function isOperatorToken(tok: Token): boolean {
  const opKinds = new Set([
    TokenKind.Equal,
    TokenKind.StrictEqual,
    TokenKind.NotEqual,
    TokenKind.StrictNotEqual,
    TokenKind.LessThan,
    TokenKind.GreaterThan,
    TokenKind.LessThanOrEqual,
    TokenKind.GreaterThanOrEqual,
    TokenKind.In,
    TokenKind.Contains,
    TokenKind.And,
    TokenKind.Or,
    TokenKind.Is,
  ])
  return opKinds.has(tok.kind)
}

function needsLeadingSpace(tok: Token, prev: Token | undefined): boolean {
  if (!prev) return false
  if (prev.kind === TokenKind.LParen) return false
  if (tok.kind === TokenKind.RParen) return false
  if (tok.kind === TokenKind.Dot) return false
  if (tok.kind === TokenKind.LBracket) return false
  if (tok.kind === TokenKind.RBracket) return false
  if (tok.kind === TokenKind.Comma) return false
  if (prev.kind === TokenKind.Dot) return false
  if (prev.kind === TokenKind.LBracket) return false
  if (isOperatorToken(tok)) return true
  if (prev && isOperatorToken(prev)) return true
  return false
}

function needsTrailingSpace(tok: Token, next: Token | undefined): boolean {
  if (!next) return false
  if (next.kind === TokenKind.RParen) return false
  if (next.kind === TokenKind.Dot) return false
  if (next.kind === TokenKind.Comma) return false
  if (next.kind === TokenKind.LBracket) return false
  if (isOperatorToken(tok)) return true
  if (tok.kind === TokenKind.Comma) return true
  return false
}
