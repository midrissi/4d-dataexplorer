import { describe, expect, it } from 'bun:test'
import {
  applyToolkitDocs,
  docsForEmojiKey,
  formatDocsDescription,
  formatPostmanRequestDocs,
  REST_DOCS_BASE,
} from './toolkit-docs'
import type { ToolkitNode } from './toolkit-types'

describe('toolkit docs', () => {
  it('maps emoji keys to official 4D REST pages', () => {
    expect(docsForEmojiKey('request.catalog')?.url).toBe(`${REST_DOCS_BASE}/catalog`)
    expect(docsForEmojiKey('request.serverInfo')?.url).toBe(`${REST_DOCS_BASE}/info`)
    expect(docsForEmojiKey('request.list')?.url).toBe(`${REST_DOCS_BASE}/dataClass`)
    expect(docsForEmojiKey('request.login')).toBeUndefined()
  })

  it('appends a markdown docs link', () => {
    expect(formatDocsDescription('Hello', `${REST_DOCS_BASE}/info`)).toBe(
      `Hello\n\n[4D Docs](${REST_DOCS_BASE}/info)`
    )
  })

  it('uses the official 4D page markdown for Postman docs', () => {
    const docs = formatPostmanRequestDocs('short summary', `${REST_DOCS_BASE}/dataClass`)
    expect(docs).toContain('Available syntaxes')
    expect(docs).toContain('__ENTITIES')
    expect(docs).toContain(`Source: [dataClass | 4D Docs](${REST_DOCS_BASE}/dataClass)`)
  })

  it('applies docs to operations and query params', () => {
    const nodes: ToolkitNode[] = [
      {
        type: 'operation',
        operation: {
          id: 'info:server',
          label: 'Server info',
          operationId: 'info_server',
          emojiKey: 'request.serverInfo',
          method: 'GET',
          path: '/rest/$info',
          query: [{ key: '$filter', value: '' }],
        },
      },
    ]
    const withDocs = applyToolkitDocs(nodes, true)
    const operation =
      withDocs[0] && withDocs[0].type === 'operation' ? withDocs[0].operation : undefined
    expect(operation?.docsUrl).toBe(`${REST_DOCS_BASE}/info`)
    expect(operation?.description).toContain('entity sets')
    expect(operation?.query?.[0]?.description).toContain('$filter')

    const without = applyToolkitDocs(nodes, false)
    const plain = without[0] && without[0].type === 'operation' ? without[0].operation : undefined
    expect(plain?.docsUrl).toBeUndefined()
    expect(plain?.description).toBeUndefined()
  })
})
