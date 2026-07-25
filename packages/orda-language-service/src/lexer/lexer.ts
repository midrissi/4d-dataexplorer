import type { Token } from '../types/tokens.ts'
import { makeToken, TokenKind } from '../types/tokens.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isAlpha(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'
}

function isAlphaNum(ch: string): boolean {
  return isAlpha(ch) || isDigit(ch)
}

// ---------------------------------------------------------------------------
// Keyword table (lower-case → TokenKind)
// ---------------------------------------------------------------------------

const KEYWORDS: Readonly<Record<string, TokenKind>> = {
  and: TokenKind.And,
  or: TokenKind.Or,
  not: TokenKind.Not,
  is: TokenKind.Is,
  in: TokenKind.In,
  asc: TokenKind.Asc,
  desc: TokenKind.Desc,
  eval: TokenKind.Eval,
  true: TokenKind.Boolean,
  false: TokenKind.Boolean,
  null: TokenKind.Null,
  order: TokenKind.Identifier, // handled at multi-token level in parser
  by: TokenKind.Identifier, // same
}

// ---------------------------------------------------------------------------
// Lexer class
// ---------------------------------------------------------------------------

export class Lexer {
  private readonly input: string
  private pos: number

  constructor(input: string) {
    this.input = input
    this.pos = 0
  }

  tokenize(): Token[] {
    const tokens: Token[] = []

    while (this.pos < this.input.length) {
      this.skipWhitespace()
      if (this.pos >= this.input.length) break

      const tok = this.nextToken()
      if (tok !== null) tokens.push(tok)
    }

    tokens.push(makeToken(TokenKind.EOF, '', this.pos, this.pos))
    return tokens
  }

  private peek(offset = 0): string {
    return this.input[this.pos + offset] ?? ''
  }

  private advance(): string {
    return this.input[this.pos++] ?? ''
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++
    }
  }

  private nextToken(): Token | null {
    const start = this.pos
    const ch = this.peek()

    // Single-char punctuation
    if (ch === '.') {
      this.advance()
      return makeToken(TokenKind.Dot, '.', start, this.pos)
    }
    if (ch === '[') {
      this.advance()
      return makeToken(TokenKind.LBracket, '[', start, this.pos)
    }
    if (ch === ']') {
      this.advance()
      return makeToken(TokenKind.RBracket, ']', start, this.pos)
    }
    if (ch === '(') {
      this.advance()
      return makeToken(TokenKind.LParen, '(', start, this.pos)
    }
    if (ch === ')') {
      this.advance()
      return makeToken(TokenKind.RParen, ')', start, this.pos)
    }
    if (ch === ',') {
      this.advance()
      return makeToken(TokenKind.Comma, ',', start, this.pos)
    }
    if (ch === '@') {
      this.advance()
      return makeToken(TokenKind.Wildcard, '@', start, this.pos)
    }

    // Logical pipe-based operators: |  ||
    if (ch === '|') {
      this.advance()
      if (this.peek() === '|') {
        this.advance()
        return makeToken(TokenKind.Or, '||', start, this.pos)
      }
      return makeToken(TokenKind.Or, '|', start, this.pos)
    }

    // Logical ampersand-based operators: &  &&
    if (ch === '&') {
      this.advance()
      if (this.peek() === '&') {
        this.advance()
        return makeToken(TokenKind.And, '&&', start, this.pos)
      }
      return makeToken(TokenKind.And, '&', start, this.pos)
    }

    // Comparators: =  ==  ===
    if (ch === '=') {
      this.advance()
      if (this.peek() === '=') {
        this.advance()
        if (this.peek() === '=') {
          this.advance()
          return makeToken(TokenKind.StrictEqual, '===', start, this.pos)
        }
        return makeToken(TokenKind.Equal, '==', start, this.pos)
      }
      return makeToken(TokenKind.Equal, '=', start, this.pos)
    }

    // Comparators: #  !=  !==
    if (ch === '#') {
      this.advance()
      return makeToken(TokenKind.NotEqual, '#', start, this.pos)
    }
    if (ch === '!') {
      this.advance()
      if (this.peek() === '=') {
        this.advance()
        if (this.peek() === '=') {
          this.advance()
          return makeToken(TokenKind.StrictNotEqual, '!==', start, this.pos)
        }
        return makeToken(TokenKind.NotEqual, '!=', start, this.pos)
      }
      // bare '!' is Unknown
      return makeToken(TokenKind.Unknown, '!', start, this.pos)
    }

    // Comparators: <  <=
    if (ch === '<') {
      this.advance()
      if (this.peek() === '=') {
        this.advance()
        return makeToken(TokenKind.LessThanOrEqual, '<=', start, this.pos)
      }
      return makeToken(TokenKind.LessThan, '<', start, this.pos)
    }

    // Comparators: >  >=
    if (ch === '>') {
      this.advance()
      if (this.peek() === '=') {
        this.advance()
        return makeToken(TokenKind.GreaterThanOrEqual, '>=', start, this.pos)
      }
      return makeToken(TokenKind.GreaterThan, '>', start, this.pos)
    }

    // % keyword operator
    if (ch === '%') {
      this.advance()
      return makeToken(TokenKind.Contains, '%', start, this.pos)
    }

    // Placeholder: :1  :name  :name.sub
    if (ch === ':') {
      return this.readPlaceholder(start)
    }

    // String literal: 'text'
    if (ch === "'") {
      return this.readString(start)
    }

    // Date literal: "YYYY-MM-DD" (double-quoted ISO date)
    // Note: 4D query strings use "YYYY-MM-DD" with double quotes for dates
    if (ch === '"') {
      return this.readDoubleQuotedDate(start)
    }

    // Number: digits or -digits (unary minus only at start of value context)
    if (isDigit(ch) || (ch === '-' && isDigit(this.peek(1)))) {
      return this.readNumber(start)
    }

    // Identifier / keyword
    if (isAlpha(ch)) {
      return this.readIdentifierOrKeyword(start)
    }

    // Unknown character — consume and continue
    this.advance()
    return makeToken(TokenKind.Unknown, ch, start, this.pos)
  }

  // -------------------------------------------------------------------------

  private readPlaceholder(start: number): Token {
    this.advance() // consume ':'
    if (isDigit(this.peek())) {
      // indexed placeholder  :1  :12
      let numStr = ''
      while (isDigit(this.peek())) numStr += this.advance()
      return makeToken(TokenKind.Placeholder, `:${numStr}`, start, this.pos)
    }
    if (isAlpha(this.peek())) {
      // named placeholder  :name  :name.prop
      let name = ''
      while (isAlphaNum(this.peek())) name += this.advance()
      while (this.peek() === '.' && isAlpha(this.peek(1))) {
        name += this.advance() // '.'
        while (isAlphaNum(this.peek())) name += this.advance()
      }
      return makeToken(TokenKind.Placeholder, `:${name}`, start, this.pos)
    }
    return makeToken(TokenKind.Unknown, ':', start, this.pos)
  }

  private readString(start: number): Token {
    this.advance() // consume opening '
    let _value = ''
    while (this.pos < this.input.length) {
      const c = this.advance()
      if (c === "'") break
      _value += c
    }
    const raw = this.input.slice(start, this.pos)
    return makeToken(TokenKind.String, raw, start, this.pos)
  }

  private readDoubleQuotedDate(start: number): Token {
    this.advance() // consume "
    let content = ''
    while (this.pos < this.input.length && this.peek() !== '"') {
      content += this.advance()
    }
    if (this.peek() === '"') this.advance()

    // Check if it looks like a date YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(content)) {
      return makeToken(TokenKind.Date, `"${content}"`, start, this.pos)
    }
    // Otherwise treat as a plain string-like token
    return makeToken(TokenKind.String, `"${content}"`, start, this.pos)
  }

  private readNumber(start: number): Token {
    let num = ''
    if (this.peek() === '-') num += this.advance()
    while (isDigit(this.peek())) num += this.advance()
    if (this.peek() === '.' && isDigit(this.peek(1))) {
      num += this.advance() // '.'
      while (isDigit(this.peek())) num += this.advance()
    }
    return makeToken(TokenKind.Number, num, start, this.pos)
  }

  private readIdentifierOrKeyword(start: number): Token {
    let text = ''
    while (isAlphaNum(this.peek())) text += this.advance()
    const lower = text.toLowerCase()
    const kind = KEYWORDS[lower] ?? TokenKind.Identifier
    return makeToken(kind, text, start, this.pos)
  }
}

/**
 * Tokenize an ORDA query string into a flat token array.
 * The last token is always `EOF`.
 */
export function tokenize(input: string): Token[] {
  return new Lexer(input).tokenize()
}
