import { describe, expect, it } from 'bun:test'
import { parseInlineMarkdown } from './render-inline-markdown'

describe('parseInlineMarkdown', () => {
  it('parses backticks as code', () => {
    expect(parseInlineMarkdown('Version `1.4.x` ships')).toEqual([
      { type: 'text', value: 'Version ' },
      { type: 'code', value: '1.4.x' },
      { type: 'text', value: ' ships' },
    ])
  })

  it('parses bold markers', () => {
    expect(parseInlineMarkdown('adds **environment variables** today')).toEqual([
      { type: 'text', value: 'adds ' },
      { type: 'bold', value: 'environment variables' },
      { type: 'text', value: ' today' },
    ])
  })

  it('parses markdown links', () => {
    expect(parseInlineMarkdown('See [Console](https://example.com/console)')).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'link', value: 'Console', href: 'https://example.com/console' },
    ])
  })

  it('keeps code, bold, and links in one pass', () => {
    const text =
      'Version `1.4.x` adds **environment variables** with `{{templates}}` and [docs](https://example.com).'
    expect(parseInlineMarkdown(text)).toEqual([
      { type: 'text', value: 'Version ' },
      { type: 'code', value: '1.4.x' },
      { type: 'text', value: ' adds ' },
      { type: 'bold', value: 'environment variables' },
      { type: 'text', value: ' with ' },
      { type: 'code', value: '{{templates}}' },
      { type: 'text', value: ' and ' },
      { type: 'link', value: 'docs', href: 'https://example.com' },
      { type: 'text', value: '.' },
    ])
  })

  it('returns plain text when there is no markup', () => {
    expect(parseInlineMarkdown('plain prose')).toEqual([{ type: 'text', value: 'plain prose' }])
  })
})
