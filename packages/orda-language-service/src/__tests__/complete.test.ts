import { describe, expect, test } from 'bun:test'
import { buildCatalogIndex } from '../schema/catalog-index.ts'
import { complete } from '../services/completion-service.ts'
import { CompletionItemKind } from '../types/language.ts'
import { testCatalog } from './fixtures.ts'

const index = buildCatalogIndex(testCatalog)

function completeAt(query: string, dataclass = 'Users') {
  return complete(query, query.length, index, dataclass)
}

describe('complete', () => {
  test('empty query returns all attribute names', () => {
    const items = completeAt('')
    const labels = items.map((i) => i.label)
    expect(labels).toContain('firstName')
    expect(labels).toContain('lastName')
    expect(labels).toContain('age')
    expect(labels).toContain('createdAt')
  })

  test('includes NOT keyword in attribute context', () => {
    const items = completeAt('')
    expect(items.find((i) => i.label === 'NOT')).toBeDefined()
  })

  test('after AND returns attribute completions', () => {
    const q = "firstName = 'John' AND "
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain('lastName')
    expect(labels).toContain('age')
  })

  test('after OR returns attribute completions', () => {
    const q = "firstName = 'John' OR "
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain('firstName')
  })

  test('after comparator returns value hints', () => {
    const q = 'active = '
    const items = complete(q, q.length, index, 'Users')
    const kinds = items.map((i) => i.kind)
    expect(kinds).toContain(CompletionItemKind.Value)
  })

  test('bool attribute comparator returns true/false first', () => {
    const q = 'active = '
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels[0]).toBe('true')
    expect(labels[1]).toBe('false')
    expect(labels).toContain('null')
    expect(labels).toContain(':1')
    expect(labels).not.toContain('0')
  })

  test('number attribute comparator does not suggest booleans', () => {
    const q = 'ID > '
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain(':1')
    expect(labels).toContain('null')
    expect(labels).not.toContain('true')
    expect(labels).not.toContain('false')
  })

  test('string attribute comparator suggests string snippet', () => {
    const q = 'firstName = '
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain(':1')
    expect(labels).toContain("''")
    expect(labels).not.toContain('true')
    const snippet = items.find((i) => i.label === "''")
    expect(snippet?.isSnippet).toBe(true)
    expect(snippet?.insertText).toBe(`'\${1}'`)
  })

  test('next placeholder index advances past existing ones', () => {
    const q = 'age = :1 AND ID > '
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain(':2')
    expect(labels).not.toContain(':1')
  })

  test('empty attribute context includes filter snippets', () => {
    const items = completeAt('')
    const snippets = items.filter((i) => i.kind === CompletionItemKind.Snippet)
    expect(snippets.length).toBeGreaterThan(0)
    expect(snippets.some((i) => i.isSnippet)).toBe(true)
    // Snippets should sort before fields so they stay visible without scrolling.
    const firstSnippetIdx = items.findIndex((i) => i.kind === CompletionItemKind.Snippet)
    const firstFieldIdx = items.findIndex((i) => i.kind === CompletionItemKind.Field)
    expect(firstSnippetIdx).toBeGreaterThanOrEqual(0)
    expect(firstFieldIdx).toBeGreaterThan(firstSnippetIdx)
  })

  test('after a complete condition returns logical operators', () => {
    const q = "firstName = 'John'"
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain('AND')
    expect(labels).toContain('OR')
  })

  test('relation attribute insert text ends with dot', () => {
    const items = completeAt('', 'Users')
    const rel = items.find((i) => i.label === 'orders')
    expect(rel).toBeDefined()
    expect(rel?.insertText).toMatch(/\.$/)
  })

  test('after dot returns related dataclass attributes', () => {
    // Orders.user.  → Users attributes
    const q = 'user.'
    const items = complete(q, q.length, index, 'Orders')
    const labels = items.map((i) => i.label)
    expect(labels).toContain('firstName')
    expect(labels).toContain('lastName')
    expect(labels).not.toContain('orderNumber')
  })

  test('order by context returns attribute completions', () => {
    const q = 'firstName = :1 order by '
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain('firstName')
    expect(labels).toContain('lastName')
  })

  test('after order by attribute returns direction keywords', () => {
    const q = 'firstName = :1 order by lastName '
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain('ASC')
    expect(labels).toContain('DESC')
  })

  test('after ORDER BY comma returns attribute completions', () => {
    const q = 'firstName = :1 order by lastName ASC, '
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain('firstName')
    expect(labels).toContain('email')
  })

  test('partial related attribute after dot is filtered by prefix', () => {
    const q = 'user.la'
    const items = complete(q, q.length, index, 'Orders')
    const labels = items.map((i) => i.label)
    expect(labels).toContain('lastName')
    expect(labels).not.toContain('firstName')
  })

  test('after unknown relation dot falls back to current dataclass attributes', () => {
    const q = 'unknown.'
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain('firstName')
    expect(labels).toContain('age')
  })

  test('after parenthesized expression offers logical operators', () => {
    const q = "(firstName = 'John')"
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain('AND')
    expect(labels).toContain('OR')
  })

  test('non-boolean value context includes placeholder and null', () => {
    const q = 'age = '
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain(':1')
    expect(labels).toContain('null')
    expect(labels).not.toContain('true')
  })

  test('attribute completions filter by typed prefix', () => {
    const q = 'fir'
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain('firstName')
    expect(labels).not.toContain('lastName')
  })

  test('order by direction context remains after DESC', () => {
    const q = 'firstName = :1 order by lastName DESC '
    const items = complete(q, q.length, index, 'Users')
    const labels = items.map((i) => i.label)
    expect(labels).toContain('ASC')
    expect(labels).toContain('DESC')
  })

  test('duplicate catalog attributes appear once in completions', () => {
    const dupCatalog = {
      ...testCatalog,
      dataClasses: testCatalog.dataClasses.map((dc) =>
        dc.name === 'Users'
          ? {
              ...dc,
              attributes: [
                ...dc.attributes,
                { name: 'firstName', kind: 'storage' as const, type: 'string' },
                { name: 'FirstName', kind: 'storage' as const, type: 'string' },
              ],
            }
          : dc
      ),
    }
    const dupIndex = buildCatalogIndex(dupCatalog)
    const items = complete('', 0, dupIndex, 'Users')
    const firstNameItems = items.filter((i) => i.label.toLowerCase() === 'firstname')
    expect(firstNameItems).toHaveLength(1)
  })
})
