import { describe, expect, test } from 'bun:test'
import { parse } from '../parser/parser.ts'

describe('parse', () => {
  test('simple equality', () => {
    const { ast, diagnostics } = parse("firstName = 'John'")
    expect(diagnostics).toHaveLength(0)
    expect(ast.filter?.kind).toBe('Condition')
  })

  test('indexed placeholder value', () => {
    const { ast, diagnostics } = parse('age > :1')
    expect(diagnostics).toHaveLength(0)
    const cond = ast.filter
    expect(cond?.kind).toBe('Condition')
    if (cond?.kind === 'Condition') {
      expect(cond.right.kind).toBe('Placeholder')
      if (cond.right.kind === 'Placeholder') {
        expect(cond.right.index).toBe(1)
      }
    }
  })

  test('AND expression', () => {
    const { ast, diagnostics } = parse("firstName = 'John' AND age > 18")
    expect(diagnostics).toHaveLength(0)
    expect(ast.filter?.kind).toBe('BinaryLogical')
    if (ast.filter?.kind === 'BinaryLogical') {
      expect(ast.filter.operator).toBe('AND')
    }
  })

  test('OR expression', () => {
    const { ast } = parse("status = 'active' OR status = 'pending'")
    expect(ast.filter?.kind).toBe('BinaryLogical')
    if (ast.filter?.kind === 'BinaryLogical') {
      expect(ast.filter.operator).toBe('OR')
    }
  })

  test('nested AND/OR', () => {
    const { ast, diagnostics } = parse(
      "(firstName = 'D@' OR firstName = 'R@') AND (lastName = 'S@' OR lastName = 'K@')"
    )
    expect(diagnostics).toHaveLength(0)
    expect(ast.filter?.kind).toBe('BinaryLogical')
  })

  test('NOT clause', () => {
    const { ast, diagnostics } = parse("not(firstName = 'Kim')")
    expect(diagnostics).toHaveLength(0)
    expect(ast.filter?.kind).toBe('Not')
  })

  test('relation traversal', () => {
    const { ast, diagnostics } = parse("user.lastName = 'Smith'")
    expect(diagnostics).toHaveLength(0)
    if (ast.filter?.kind === 'Condition') {
      const left = ast.filter.left
      expect(left.kind).toBe('Attribute')
      if (left.kind === 'Attribute') {
        expect(left.segments).toHaveLength(2)
        expect(left.segments[0].name).toBe('user')
        expect(left.segments[1].name).toBe('lastName')
      }
    }
  })

  test('collection path [a] notation', () => {
    const { ast, diagnostics } = parse("hobbies[a].name = 'skiing'")
    expect(diagnostics).toHaveLength(0)
    if (ast.filter?.kind === 'Condition') {
      const left = ast.filter.left
      if (left.kind === 'Attribute') {
        expect(left.segments[0].collectionLetter).toBe('a')
        expect(left.segments[1].name).toBe('name')
      }
    }
  })

  test('IN operator with collection literal', () => {
    const { ast, diagnostics } = parse("firstName IN ['Kim', 'Dixie']")
    expect(diagnostics).toHaveLength(0)
    if (ast.filter?.kind === 'Condition') {
      expect(ast.filter.operator).toBe('IN')
      expect(ast.filter.right.kind).toBe('CollectionLiteral')
    }
  })

  test('% (contains) operator', () => {
    const { ast, diagnostics } = parse('description % :1')
    expect(diagnostics).toHaveLength(0)
    if (ast.filter?.kind === 'Condition') {
      expect(ast.filter.operator).toBe('%')
    }
  })

  test('IS comparator', () => {
    const { ast, diagnostics } = parse('active IS true')
    expect(diagnostics).toHaveLength(0)
    if (ast.filter?.kind === 'Condition') {
      expect(ast.filter.operator).toBe('===')
    }
  })

  test('IS NOT comparator', () => {
    const { ast, diagnostics } = parse('active IS NOT true')
    expect(diagnostics).toHaveLength(0)
    if (ast.filter?.kind === 'Condition') {
      expect(ast.filter.operator).toBe('!==')
    }
  })

  test('null value', () => {
    const { ast, diagnostics } = parse('spouse = null')
    expect(diagnostics).toHaveLength(0)
    if (ast.filter?.kind === 'Condition') {
      expect(ast.filter.right.kind).toBe('NullLiteral')
    }
  })

  test('eval() formula', () => {
    const { ast, diagnostics } = parse(
      "eval(length(This.lastname) >= 30) AND nationality = 'French'"
    )
    expect(diagnostics).toHaveLength(0)
    expect(ast.filter?.kind).toBe('BinaryLogical')
    if (ast.filter?.kind === 'BinaryLogical') {
      expect(ast.filter.left.kind).toBe('Eval')
    }
  })

  test('order by clause', () => {
    const { ast, diagnostics } = parse('nationality = :1 order by campus.name desc, lastName')
    expect(diagnostics).toHaveLength(0)
    expect(ast.orderBy).not.toBeNull()
    expect(ast.orderBy?.items).toHaveLength(2)
    expect(ast.orderBy?.items[0].direction).toBe('desc')
    expect(ast.orderBy?.items[1].direction).toBe('asc')
  })

  test('attribute placeholder in left-hand side', () => {
    const { ast, diagnostics } = parse(":1 = 1234 AND :2 = 'Smith'")
    expect(diagnostics).toHaveLength(0)
    if (ast.filter?.kind === 'BinaryLogical') {
      expect(ast.filter.left.kind).toBe('Condition')
      if (ast.filter.left.kind === 'Condition') {
        expect(ast.filter.left.left.kind).toBe('AttributePlaceholder')
      }
    }
  })

  test('empty input', () => {
    const { ast, diagnostics } = parse('')
    expect(diagnostics).toHaveLength(0)
    expect(ast.filter).toBeNull()
  })

  test('AST nodes carry ranges', () => {
    const { ast } = parse('age > 18')
    const cond = ast.filter
    expect(cond?.range.start).toBeGreaterThanOrEqual(0)
    expect(cond?.range.end).toBeGreaterThan(0)
  })

  test('date literal', () => {
    const { ast, diagnostics } = parse('createdAt > "2024-01-01"')
    expect(diagnostics).toHaveLength(0)
    if (ast.filter?.kind === 'Condition') {
      expect(ast.filter.right.kind).toBe('DateLiteral')
    }
  })
})
