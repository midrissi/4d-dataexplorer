import { tokenize } from '../lexer/lexer.ts'
import type {
  AttributeNode,
  AttributePlaceholderNode,
  BinaryLogicalNode,
  BooleanLiteralNode,
  CollectionLiteralNode,
  ComparatorKind,
  ConditionNode,
  DateLiteralNode,
  EvalNode,
  GroupNode,
  NotNode,
  NullLiteralNode,
  NumberLiteralNode,
  OrderByItemNode,
  OrderByNode,
  PathSegment,
  PlaceholderNode,
  QueryNode,
  QueryRootNode,
  StringLiteralNode,
  ValueNode,
} from '../types/ast.ts'
import type { Diagnostic, TextRange } from '../types/diagnostics.ts'
import { DiagnosticCode, DiagnosticSeverity } from '../types/diagnostics.ts'
import type { ParseResult } from '../types/service.ts'
import type { Token } from '../types/tokens.ts'
import { TokenKind } from '../types/tokens.ts'

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export class Parser {
  private readonly tokens: Token[]
  private pos: number
  readonly diagnostics: Diagnostic[]

  constructor(tokens: Token[]) {
    this.tokens = tokens
    this.pos = 0
    this.diagnostics = []
  }

  // -------------------------------------------------------------------------
  // Token navigation
  // -------------------------------------------------------------------------

  private peek(offset = 0): Token {
    const idx = this.pos + offset
    return this.tokens[idx] ?? this.tokens[this.tokens.length - 1]
  }

  private advance(): Token {
    const tok = this.peek()
    if (tok.kind !== TokenKind.EOF) this.pos++
    return tok
  }

  private current(): Token {
    return this.peek()
  }

  private isEOF(): boolean {
    return this.current().kind === TokenKind.EOF
  }

  private addError(msg: string, code: DiagnosticCode, range: TextRange): void {
    this.diagnostics.push({
      message: msg,
      severity: DiagnosticSeverity.Error,
      range,
      code,
    })
  }

  private tokenRange(tok: Token): TextRange {
    return { start: tok.start, end: tok.end }
  }

  private range(start: number, end: number): TextRange {
    return { start, end }
  }

  // -------------------------------------------------------------------------
  // Logical operator check
  // -------------------------------------------------------------------------

  private isLogicalOp(): boolean {
    const k = this.current().kind
    return k === TokenKind.And || k === TokenKind.Or
  }

  // ORDER BY detection: two consecutive tokens "order" "by" (case-insensitive identifiers)
  private isOrderBy(): boolean {
    const cur = this.current()
    const next = this.peek(1)
    return (
      cur.kind === TokenKind.Identifier &&
      cur.text.toLowerCase() === 'order' &&
      next.kind === TokenKind.Identifier &&
      next.text.toLowerCase() === 'by'
    )
  }

  // -------------------------------------------------------------------------
  // Root
  // -------------------------------------------------------------------------

  parseRoot(): QueryRootNode {
    const start = this.current().start

    if (this.isEOF()) {
      return { kind: 'QueryRoot', filter: null, orderBy: null, range: this.range(0, 0) }
    }

    const filter = this.parseQueryString()

    let orderBy: OrderByNode | null = null
    if (this.isOrderBy()) {
      orderBy = this.parseOrderBy()
    }

    const end = this.current().end
    return { kind: 'QueryRoot', filter, orderBy, range: this.range(start, end) }
  }

  // -------------------------------------------------------------------------
  // QueryString  = Clause { LogicalOp Clause }
  // -------------------------------------------------------------------------

  parseQueryString(): QueryNode {
    let left = this.parseClause()

    while (!this.isEOF() && !this.isOrderBy() && this.isLogicalOp()) {
      const opTok = this.advance()
      const opKind = opTok.kind === TokenKind.And ? 'AND' : 'OR'

      if (this.isEOF() || this.isOrderBy()) {
        this.addError(
          'Expected expression after logical operator',
          DiagnosticCode.UnexpectedEndOfInput,
          this.tokenRange(opTok)
        )
        break
      }

      const right = this.parseClause()
      const node: BinaryLogicalNode = {
        kind: 'BinaryLogical',
        operator: opKind,
        operatorRange: this.tokenRange(opTok),
        left,
        right,
        range: this.range(left.range.start, right.range.end),
      }
      left = node
    }

    return left
  }

  // -------------------------------------------------------------------------
  // Clause = NOT "(" ... ")" | "(" ... ")" | eval(...) | Condition
  // -------------------------------------------------------------------------

  private parseClause(): QueryNode {
    const cur = this.current()

    // NOT ( ... )
    if (cur.kind === TokenKind.Not) {
      return this.parseNot()
    }

    // ( ... )
    if (cur.kind === TokenKind.LParen) {
      return this.parseGroup()
    }

    // eval(...)
    if (cur.kind === TokenKind.Eval) {
      return this.parseEval()
    }

    return this.parseCondition()
  }

  // -------------------------------------------------------------------------
  // NOT  "(" QueryString ")"
  // -------------------------------------------------------------------------

  private parseNot(): NotNode {
    const notTok = this.advance() // consume NOT
    const startPos = notTok.start

    // NOT may or may not have parens in 4D but docs say parens are mandatory
    if (this.current().kind !== TokenKind.LParen) {
      this.addError(
        'NOT requires parentheses: not(…)',
        DiagnosticCode.UnclosedParenthesis,
        this.tokenRange(notTok)
      )
    }

    const inner = this.current().kind === TokenKind.LParen ? this.parseGroup() : this.parseClause()

    return {
      kind: 'Not',
      operand: inner,
      range: this.range(startPos, inner.range.end),
    }
  }

  // -------------------------------------------------------------------------
  // "(" QueryString ")"
  // -------------------------------------------------------------------------

  private parseGroup(): GroupNode {
    const open = this.advance() // consume (
    const inner = this.parseQueryString()

    if (this.current().kind === TokenKind.RParen) {
      const close = this.advance()
      return {
        kind: 'Group',
        inner,
        range: this.range(open.start, close.end),
      }
    }

    this.addError(
      'Missing closing parenthesis',
      DiagnosticCode.UnclosedParenthesis,
      this.tokenRange(this.current())
    )
    return {
      kind: 'Group',
      inner,
      range: this.range(open.start, inner.range.end),
    }
  }

  // -------------------------------------------------------------------------
  // eval( formula text )
  // -------------------------------------------------------------------------

  private parseEval(): EvalNode {
    const evalTok = this.advance() // consume eval
    const start = evalTok.start

    if (this.current().kind !== TokenKind.LParen) {
      this.addError(
        'eval() requires parentheses',
        DiagnosticCode.UnexpectedToken,
        this.tokenRange(evalTok)
      )
      return { kind: 'Eval', formula: '', range: this.tokenRange(evalTok) }
    }

    this.advance() // consume (

    // Collect everything up to matching )
    let depth = 1
    const formulaStart = this.current().start
    let formulaEnd = formulaStart

    while (!this.isEOF() && depth > 0) {
      const tok = this.advance()
      if (tok.kind === TokenKind.LParen) depth++
      else if (tok.kind === TokenKind.RParen) {
        depth--
        if (depth === 0) {
          formulaEnd = tok.start
          break
        }
      }
      formulaEnd = tok.end
    }

    const formula = this.tokens
      .filter((t) => t.start >= formulaStart && t.end <= formulaEnd)
      .map((t) => t.text)
      .join(' ')

    return {
      kind: 'Eval',
      formula,
      range: this.range(start, formulaEnd),
    }
  }

  // -------------------------------------------------------------------------
  // Condition = (AttributePath | Placeholder) Comparator Value
  // -------------------------------------------------------------------------

  private parseCondition(): ConditionNode {
    const start = this.current().start
    const left = this.parseAttributeOrPlaceholder()
    const { kind: opKind, range: opRange } = this.parseComparator()
    const right = this.parseValue()

    return {
      kind: 'Condition',
      left,
      operator: opKind,
      operatorRange: opRange,
      right,
      range: this.range(start, right.range.end),
    }
  }

  // -------------------------------------------------------------------------
  // AttributePath | Placeholder
  // -------------------------------------------------------------------------

  private parseAttributeOrPlaceholder(): AttributeNode | AttributePlaceholderNode {
    if (this.current().kind === TokenKind.Placeholder) {
      return this.parsePlaceholderAsAttribute()
    }
    return this.parseAttributePath()
  }

  private parsePlaceholderAsAttribute(): AttributePlaceholderNode {
    const tok = this.advance()
    const raw = tok.text.slice(1) // strip ':'
    const isIndexed = /^\d+$/.test(raw)
    return {
      kind: 'AttributePlaceholder',
      index: isIndexed ? Number.parseInt(raw, 10) : undefined,
      name: isIndexed ? undefined : raw,
      range: this.tokenRange(tok),
    }
  }

  private parseAttributePath(): AttributeNode {
    const start = this.current().start
    const segments: PathSegment[] = []

    const firstSeg = this.parsePathSegment()
    if (firstSeg) segments.push(firstSeg)
    else {
      // Recovery: emit unknown identifier node
      const tok = this.current()
      this.addError(
        `Expected attribute name, got '${tok.text}'`,
        DiagnosticCode.UnexpectedToken,
        this.tokenRange(tok)
      )
      return { kind: 'Attribute', segments: [], range: this.tokenRange(tok) }
    }

    while (this.current().kind === TokenKind.Dot) {
      this.advance() // consume .
      const seg = this.parsePathSegment()
      if (seg) {
        segments.push(seg)
      } else {
        this.addError(
          'Expected attribute name after dot',
          DiagnosticCode.UnexpectedToken,
          this.tokenRange(this.current())
        )
        break
      }
    }

    const end = segments[segments.length - 1]?.range.end ?? start
    return { kind: 'Attribute', segments, range: this.range(start, end) }
  }

  private parsePathSegment(): PathSegment | null {
    const cur = this.current()
    if (
      cur.kind !== TokenKind.Identifier &&
      cur.kind !== TokenKind.Asc && // asc/desc can be used as attr names
      cur.kind !== TokenKind.Desc
    ) {
      return null
    }

    const nameTok = this.advance()
    let collectionLetter: string | null = null
    let end = nameTok.end

    // Optional [letter] or []
    if (this.current().kind === TokenKind.LBracket) {
      this.advance() // consume [
      if (this.current().kind === TokenKind.Identifier && this.current().text.length === 1) {
        collectionLetter = this.advance().text
      }
      if (this.current().kind === TokenKind.RBracket) {
        end = this.advance().end
      } else {
        this.addError(
          'Missing closing bracket ]',
          DiagnosticCode.UnclosedBracket,
          this.tokenRange(this.current())
        )
      }
    }

    return {
      kind: 'PathSegment' as const,
      name: nameTok.text,
      collectionLetter,
      range: this.range(nameTok.start, end),
    }
  }

  // -------------------------------------------------------------------------
  // Comparator
  // -------------------------------------------------------------------------

  private parseComparator(): { kind: ComparatorKind; range: TextRange } {
    const tok = this.current()

    switch (tok.kind) {
      case TokenKind.Equal:
        this.advance()
        return { kind: '=', range: this.tokenRange(tok) }

      case TokenKind.StrictEqual:
        this.advance()
        return { kind: '===', range: this.tokenRange(tok) }

      case TokenKind.NotEqual:
        this.advance()
        return { kind: '#', range: this.tokenRange(tok) }

      case TokenKind.StrictNotEqual:
        this.advance()
        return { kind: '!==', range: this.tokenRange(tok) }

      case TokenKind.LessThan:
        this.advance()
        return { kind: '<', range: this.tokenRange(tok) }

      case TokenKind.GreaterThan:
        this.advance()
        return { kind: '>', range: this.tokenRange(tok) }

      case TokenKind.LessThanOrEqual:
        this.advance()
        return { kind: '<=', range: this.tokenRange(tok) }

      case TokenKind.GreaterThanOrEqual:
        this.advance()
        return { kind: '>=', range: this.tokenRange(tok) }

      case TokenKind.In:
        this.advance()
        return { kind: 'IN', range: this.tokenRange(tok) }

      case TokenKind.Contains:
        this.advance()
        return { kind: '%', range: this.tokenRange(tok) }

      // IS  /  IS NOT
      case TokenKind.Is: {
        const isTok = this.advance()
        if (
          this.current().kind === TokenKind.Not ||
          (this.current().kind === TokenKind.Identifier &&
            this.current().text.toLowerCase() === 'not')
        ) {
          const notTok = this.advance()
          return {
            kind: '!==',
            range: this.range(isTok.start, notTok.end),
          }
        }
        return { kind: '===', range: this.tokenRange(isTok) }
      }

      default:
        this.addError(
          `Expected comparator operator, got '${tok.text}'`,
          DiagnosticCode.MissingComparator,
          this.tokenRange(tok)
        )
        return { kind: '=', range: this.tokenRange(tok) }
    }
  }

  // -------------------------------------------------------------------------
  // Value
  // -------------------------------------------------------------------------

  private parseValue(): ValueNode {
    const tok = this.current()

    switch (tok.kind) {
      case TokenKind.String:
        return this.parseStringValue()

      case TokenKind.Number:
        return this.parseNumberValue()

      case TokenKind.Boolean:
        return this.parseBooleanValue()

      case TokenKind.Date:
        return this.parseDateValue()

      case TokenKind.Null: {
        this.advance()
        const node: NullLiteralNode = { kind: 'NullLiteral', range: this.tokenRange(tok) }
        return node
      }

      case TokenKind.LBracket:
        return this.parseCollectionValue()

      case TokenKind.Placeholder:
        return this.parsePlaceholderValue()

      default: {
        this.addError(
          `Expected value, got '${tok.text}'`,
          DiagnosticCode.MissingValue,
          this.tokenRange(tok)
        )
        // Synthesise a null placeholder for error recovery
        const nullNode: NullLiteralNode = {
          kind: 'NullLiteral',
          range: this.tokenRange(tok),
        }
        return nullNode
      }
    }
  }

  private parseStringValue(): StringLiteralNode {
    const tok = this.advance()
    // Strip surrounding quotes
    const raw = tok.text
    const value = raw.startsWith("'")
      ? raw.slice(1, raw.endsWith("'") ? -1 : undefined)
      : raw.slice(1, raw.endsWith('"') ? -1 : undefined)
    return { kind: 'StringLiteral', value, raw, range: this.tokenRange(tok) }
  }

  private parseNumberValue(): NumberLiteralNode {
    const tok = this.advance()
    return { kind: 'NumberLiteral', value: Number(tok.text), range: this.tokenRange(tok) }
  }

  private parseBooleanValue(): BooleanLiteralNode {
    const tok = this.advance()
    return {
      kind: 'BooleanLiteral',
      value: tok.text.toLowerCase() === 'true',
      range: this.tokenRange(tok),
    }
  }

  private parseDateValue(): DateLiteralNode {
    const tok = this.advance()
    const value = tok.text.slice(1, -1) // strip "…"
    return { kind: 'DateLiteral', value, range: this.tokenRange(tok) }
  }

  private parseCollectionValue(): CollectionLiteralNode {
    const open = this.advance() // consume [
    const elements: ValueNode[] = []

    while (!this.isEOF() && this.current().kind !== TokenKind.RBracket) {
      elements.push(this.parseValue())
      if (this.current().kind === TokenKind.Comma) this.advance()
    }

    if (this.current().kind === TokenKind.RBracket) {
      const close = this.advance()
      return { kind: 'CollectionLiteral', elements, range: this.range(open.start, close.end) }
    }

    this.addError(
      'Missing closing bracket ]',
      DiagnosticCode.UnclosedBracket,
      this.tokenRange(this.current())
    )
    return {
      kind: 'CollectionLiteral',
      elements,
      range: this.range(open.start, this.current().end),
    }
  }

  private parsePlaceholderValue(): PlaceholderNode {
    const tok = this.advance()
    const raw = tok.text.slice(1) // strip ':'
    const parts = raw.split('.')
    const first = parts[0]
    const subPath = parts.slice(1)

    const isIndexed = /^\d+$/.test(first)
    return {
      kind: 'Placeholder',
      index: isIndexed ? Number.parseInt(first, 10) : undefined,
      name: isIndexed ? undefined : first,
      subPath,
      range: this.tokenRange(tok),
    }
  }

  // -------------------------------------------------------------------------
  // ORDER BY
  // -------------------------------------------------------------------------

  private parseOrderBy(): OrderByNode {
    const orderTok = this.advance() // "order"
    this.advance() // "by"
    const start = orderTok.start
    const items: OrderByItemNode[] = []

    items.push(this.parseOrderByItem())
    while (this.current().kind === TokenKind.Comma) {
      this.advance() // consume ,
      items.push(this.parseOrderByItem())
    }

    const end = items[items.length - 1]?.range.end ?? start
    return { kind: 'OrderBy', items, range: this.range(start, end) }
  }

  private parseOrderByItem(): OrderByItemNode {
    const start = this.current().start
    const attr = this.parseAttributeOrPlaceholder()
    let direction: 'asc' | 'desc' = 'asc'

    if (this.current().kind === TokenKind.Asc) {
      this.advance()
      direction = 'asc'
    } else if (this.current().kind === TokenKind.Desc) {
      this.advance()
      direction = 'desc'
    }

    const end = this.tokens[this.pos - 1]?.end ?? attr.range.end
    return { kind: 'OrderByItem', attribute: attr, direction, range: this.range(start, end) }
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function parse(input: string): ParseResult {
  const tokens = tokenize(input)
  const parser = new Parser(tokens)
  const ast = parser.parseRoot()
  return { ast, diagnostics: parser.diagnostics }
}
