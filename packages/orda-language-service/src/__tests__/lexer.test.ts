import { describe, expect, test } from 'bun:test'
import { tokenize } from '../lexer/lexer.ts'
import { TokenKind } from '../types/tokens.ts'

describe('tokenize', () => {
  test('single equality condition', () => {
    const tokens = tokenize("firstName = 'John'")
    expect(tokens[0]).toMatchObject({ kind: TokenKind.Identifier, text: 'firstName' })
    expect(tokens[1]).toMatchObject({ kind: TokenKind.Equal, text: '=' })
    expect(tokens[2]).toMatchObject({ kind: TokenKind.String })
    expect(tokens[3]).toMatchObject({ kind: TokenKind.EOF })
  })

  test('indexed placeholders', () => {
    const tokens = tokenize('age > :1 AND salary <= :2')
    expect(tokens.find((t) => t.kind === TokenKind.Placeholder && t.text === ':1')).toBeTruthy()
    expect(tokens.find((t) => t.kind === TokenKind.Placeholder && t.text === ':2')).toBeTruthy()
  })

  test('named placeholder with subpath', () => {
    const tokens = tokenize(':settings.userId')
    expect(tokens[0]).toMatchObject({ kind: TokenKind.Placeholder, text: ':settings.userId' })
  })

  test('comparison operators', () => {
    expect(tokenize('a == b')[1].kind).toBe(TokenKind.Equal)
    expect(tokenize('a === b')[1].kind).toBe(TokenKind.StrictEqual)
    expect(tokenize('a # b')[1].kind).toBe(TokenKind.NotEqual)
    expect(tokenize('a != b')[1].kind).toBe(TokenKind.NotEqual)
    expect(tokenize('a !== b')[1].kind).toBe(TokenKind.StrictNotEqual)
    expect(tokenize('a < b')[1].kind).toBe(TokenKind.LessThan)
    expect(tokenize('a > b')[1].kind).toBe(TokenKind.GreaterThan)
    expect(tokenize('a <= b')[1].kind).toBe(TokenKind.LessThanOrEqual)
    expect(tokenize('a >= b')[1].kind).toBe(TokenKind.GreaterThanOrEqual)
    expect(tokenize('a IN b')[1].kind).toBe(TokenKind.In)
    expect(tokenize('a % b')[1].kind).toBe(TokenKind.Contains)
  })

  test('logical operators', () => {
    expect(tokenize('a AND b')[1].kind).toBe(TokenKind.And)
    expect(tokenize('a and b')[1].kind).toBe(TokenKind.And)
    expect(tokenize('a & b')[1].kind).toBe(TokenKind.And)
    expect(tokenize('a && b')[1].kind).toBe(TokenKind.And)
    expect(tokenize('a OR b')[1].kind).toBe(TokenKind.Or)
    expect(tokenize('a or b')[1].kind).toBe(TokenKind.Or)
    expect(tokenize('a | b')[1].kind).toBe(TokenKind.Or)
    expect(tokenize('a || b')[1].kind).toBe(TokenKind.Or)
  })

  test('boolean and null keywords', () => {
    expect(tokenize('true')[0].kind).toBe(TokenKind.Boolean)
    expect(tokenize('false')[0].kind).toBe(TokenKind.Boolean)
    expect(tokenize('null')[0].kind).toBe(TokenKind.Null)
  })

  test('date literal', () => {
    const tokens = tokenize('"2024-01-15"')
    expect(tokens[0].kind).toBe(TokenKind.Date)
  })

  test('collection brackets', () => {
    const tokens = tokenize('hobbies[a].name')
    expect(tokens[0]).toMatchObject({ kind: TokenKind.Identifier, text: 'hobbies' })
    expect(tokens[1]).toMatchObject({ kind: TokenKind.LBracket })
    expect(tokens[2]).toMatchObject({ kind: TokenKind.Identifier, text: 'a' })
    expect(tokens[3]).toMatchObject({ kind: TokenKind.RBracket })
    expect(tokens[4]).toMatchObject({ kind: TokenKind.Dot })
    expect(tokens[5]).toMatchObject({ kind: TokenKind.Identifier, text: 'name' })
  })

  test('tracks offsets correctly', () => {
    const tokens = tokenize('abc = 1')
    expect(tokens[0].start).toBe(0)
    expect(tokens[0].end).toBe(3)
    expect(tokens[1].start).toBe(4)
    expect(tokens[1].end).toBe(5)
  })

  test('wildcard @', () => {
    const tokens = tokenize("name = 'S@'")
    // @ inside a string is part of the string token, not a Wildcard token
    expect(tokens[2].kind).toBe(TokenKind.String)
    expect(tokens[2].text).toBe("'S@'")
  })

  test('NOT keyword', () => {
    const tokens = tokenize('not(a = 1)')
    expect(tokens[0].kind).toBe(TokenKind.Not)
  })

  test('order/by are plain identifiers', () => {
    const tokens = tokenize('order by name')
    expect(tokens[0]).toMatchObject({ kind: TokenKind.Identifier, text: 'order' })
    expect(tokens[1]).toMatchObject({ kind: TokenKind.Identifier, text: 'by' })
  })

  test('number literals', () => {
    expect(tokenize('42')[0]).toMatchObject({ kind: TokenKind.Number, text: '42' })
    expect(tokenize('3.14')[0]).toMatchObject({ kind: TokenKind.Number, text: '3.14' })
  })

  test('empty string produces only EOF', () => {
    const tokens = tokenize('')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].kind).toBe(TokenKind.EOF)
  })
})
