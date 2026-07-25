import { describe, expect, test } from 'bun:test'
import { buildCatalogIndex } from '../schema/catalog-index.ts'
import { DiagnosticCode, DiagnosticSeverity } from '../types/diagnostics.ts'
import { validate } from '../validate.ts'
import { testCatalog } from './fixtures.ts'

const index = buildCatalogIndex(testCatalog)

describe('validate', () => {
  test('valid simple query produces no diagnostics', () => {
    const diags = validate("firstName = 'John'", index, 'Users')
    expect(diags).toHaveLength(0)
  })

  test('valid compound query produces no diagnostics', () => {
    const diags = validate('firstName = :1 AND age > 18 order by lastName desc', index, 'Users')
    expect(diags).toHaveLength(0)
  })

  test('relation traversal is valid', () => {
    const diags = validate("user.lastName = 'Smith'", index, 'Orders')
    expect(diags).toHaveLength(0)
  })

  test('unknown attribute produces error', () => {
    const diags = validate("nonexistent = 'x'", index, 'Users')
    const error = diags.find((d) => d.code === DiagnosticCode.UnknownAttribute)
    expect(error).toBeDefined()
    expect(error?.severity).toBe(DiagnosticSeverity.Error)
  })

  test('unknown dataclass produces error', () => {
    const diags = validate("name = 'x'", index, 'Nonexistent')
    const error = diags.find((d) => d.code === DiagnosticCode.UnknownDataclass)
    expect(error).toBeDefined()
  })

  test('% on non-string attribute produces error', () => {
    const diags = validate('age % 1', index, 'Users')
    const error = diags.find((d) => d.code === DiagnosticCode.PercentOperatorOnNonString)
    expect(error).toBeDefined()
  })

  test('% on string attribute is valid', () => {
    const diags = validate("firstName % 'Jo'", index, 'Users')
    const pctError = diags.find((d) => d.code === DiagnosticCode.PercentOperatorOnNonString)
    expect(pctError).toBeUndefined()
  })

  test('IN with non-collection produces error', () => {
    const diags = validate("firstName IN 'John'", index, 'Users')
    const error = diags.find((d) => d.code === DiagnosticCode.InValueMustBeCollection)
    expect(error).toBeDefined()
  })

  test('IN with collection placeholder is valid', () => {
    const diags = validate('firstName IN :1', index, 'Users')
    const error = diags.find((d) => d.code === DiagnosticCode.InValueMustBeCollection)
    expect(error).toBeUndefined()
  })

  test('numeric comparator on string attribute produces warning', () => {
    const diags = validate("firstName > 'a'", index, 'Users')
    const warning = diags.find((d) => d.code === DiagnosticCode.InvalidOperatorForType)
    expect(warning).toBeDefined()
    expect(warning?.severity).toBe(DiagnosticSeverity.Warning)
  })

  test('numeric comparator on number attribute is valid', () => {
    const diags = validate('age > 18', index, 'Users')
    const warning = diags.find((d) => d.code === DiagnosticCode.InvalidOperatorForType)
    expect(warning).toBeUndefined()
  })

  test('relation at leaf position produces warning', () => {
    // "orders" is a relatedEntities — can't be a leaf
    const diags = validate('orders = null', index, 'Users')
    const warning = diags.find((d) => d.code === DiagnosticCode.RelationTraversalError)
    expect(warning).toBeDefined()
  })

  test('type mismatch warning: boolean used with number attribute', () => {
    const diags = validate('age = true', index, 'Users')
    const warning = diags.find((d) => d.code === DiagnosticCode.TypeMismatch)
    expect(warning).toBeDefined()
  })

  test('type mismatch warning: number used with date attribute', () => {
    const diags = validate('createdAt = 42', index, 'Users')
    const warning = diags.find((d) => d.code === DiagnosticCode.TypeMismatch)
    expect(warning).toBeDefined()
  })

  test('type mismatch warning: date used with string attribute', () => {
    const diags = validate('firstName = "2024-01-01"', index, 'Users')
    const warning = diags.find((d) => d.code === DiagnosticCode.TypeMismatch)
    expect(warning).toBeDefined()
  })

  test('unknown attribute in ORDER BY produces error', () => {
    const diags = validate("firstName = 'John' order by missingField", index, 'Users')
    const error = diags.find((d) => d.code === DiagnosticCode.UnknownAttribute)
    expect(error).toBeDefined()
    expect(error?.severity).toBe(DiagnosticSeverity.Error)
  })

  test('NOT and grouped expressions are validated recursively', () => {
    const diags = validate("NOT((firstName = 'John') AND (missingField = 1))", index, 'Users')
    const error = diags.find((d) => d.code === DiagnosticCode.UnknownAttribute)
    expect(error).toBeDefined()
  })

  test('attribute placeholder in condition bypasses schema checks', () => {
    const diags = validate(':1 = 1', index, 'Users')
    const unknownAttr = diags.find((d) => d.code === DiagnosticCode.UnknownAttribute)
    expect(unknownAttr).toBeUndefined()
  })

  test('attribute placeholder in ORDER BY bypasses schema checks', () => {
    const diags = validate("firstName = 'John' order by :1", index, 'Users')
    const unknownAttr = diags.find((d) => d.code === DiagnosticCode.UnknownAttribute)
    expect(unknownAttr).toBeUndefined()
  })

  test('eval() node bypasses attribute checks', () => {
    const diags = validate(
      "eval(length(This.lastname) >= 30) AND firstName = 'French'",
      index,
      'Users'
    )
    // Should only contain diagnostics for firstName attr if lastName check would fail
    // eval() itself should produce no attribute errors
    const evalErrors = diags.filter((d) => d.message.toLowerCase().includes('eval'))
    expect(evalErrors).toHaveLength(0)
  })

  test('empty query is valid', () => {
    const diags = validate('', index, 'Users')
    expect(diags).toHaveLength(0)
  })
})
