import { describe, expect, test } from 'bun:test'
import { createLanguageService } from '../language-service.ts'
import { testCatalog } from './fixtures.ts'

describe('createLanguageService', () => {
  const svc = createLanguageService(testCatalog, 'Users')

  test('parse returns AST', () => {
    const { ast, diagnostics } = svc.parse("firstName = 'John'")
    expect(ast.filter?.kind).toBe('Condition')
    expect(diagnostics).toHaveLength(0)
  })

  test('validate returns empty array for valid query', () => {
    const diags = svc.validate('firstName = :1 AND age > 18')
    expect(diags).toHaveLength(0)
  })

  test('validate returns diagnostics for unknown attribute', () => {
    const diags = svc.validate('nonexistent = 1')
    expect(diags.length).toBeGreaterThan(0)
  })

  test('complete returns items', () => {
    const items = svc.complete('', 0)
    expect(items.length).toBeGreaterThan(0)
  })

  test('hover returns info', () => {
    const result = svc.hover("firstName = 'John'", 0)
    expect(result).not.toBeNull()
    expect(result?.contents.value).toContain('firstName')
  })

  test('signature returns help for placeholder', () => {
    const result = svc.signature('age > :1', 7)
    expect(result).not.toBeNull()
  })

  test('format normalises query', () => {
    const result = svc.format("firstName=='John'&&age>18")
    expect(result).toContain('AND')
    expect(result).toContain('=')
  })

  test('resolve finds attribute', () => {
    const result = svc.resolve('firstName')
    expect(result?.attribute.name).toBe('firstName')
  })

  test('resolve follows relations', () => {
    const ordersSvc = createLanguageService(testCatalog, 'Orders')
    const result = ordersSvc.resolve('user.lastName')
    expect(result?.attribute.name).toBe('lastName')
    expect(result?.dataclass.name).toBe('Users')
  })

  test('resolve returns null for unknown path', () => {
    expect(svc.resolve('nonexistent')).toBeNull()
  })
})
