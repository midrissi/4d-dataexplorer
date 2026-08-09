import { describe, expect, it } from 'bun:test'
import { docsSlugFromUrl, officialDocsMarkdown, prepareOfficialDocsMarkdown } from './4d-docs-pages'
import { REST_DOCS_BASE } from './toolkit-docs'

describe('4d docs pages', () => {
  it('reads the slug from a 4D REST docs URL', () => {
    expect(docsSlugFromUrl(`${REST_DOCS_BASE}/dataClass`)).toBe('dataClass')
    expect(docsSlugFromUrl(`${REST_DOCS_BASE}/dataClass#dataclass`)).toBe('dataClass')
    expect(docsSlugFromUrl(`${REST_DOCS_BASE}/top_$limit`)).toBe('top_$limit')
  })

  it('rewrites relative markdown links to developer.4d.com', () => {
    const markdown = prepareOfficialDocsMarkdown(
      '---\nid: x\ntitle: x\n---\nSee [functions](ClassFunctions.md#function-calls) and [classes](../Concepts/classes.md#singleton-classes).',
      `${REST_DOCS_BASE}/dataClass`
    )
    expect(markdown).toContain(`${REST_DOCS_BASE}/classFunctions#function-calls`)
    expect(markdown).toContain('https://developer.4d.com/docs/Concepts/classes#singleton-classes')
    expect(markdown).toContain(`Source: [dataClass | 4D Docs](${REST_DOCS_BASE}/dataClass)`)
  })

  it('returns the official dataClass page', () => {
    const page = officialDocsMarkdown(`${REST_DOCS_BASE}/dataClass`)
    expect(page).toContain('Dataclass names can be used directly')
    expect(page).toContain('Available syntaxes')
    expect(page).toContain('__entityModel')
  })
})
