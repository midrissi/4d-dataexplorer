import { describe, expect, it } from 'bun:test'
import {
  escapeHtml,
  formatOrdaHoverMarkdown,
  ordaHoverHeaderIcon,
  parseOrdaHover,
} from './orda-hover'

describe('escapeHtml', () => {
  it('escapes ampersands and angle brackets', () => {
    expect(escapeHtml('a & b <c> d')).toBe('a &amp; b &lt;c&gt; d')
  })
})

describe('parseOrdaHover', () => {
  it('returns null for an empty string', () => {
    expect(parseOrdaHover('')).toBeNull()
  })

  it('returns null when there are no property lines', () => {
    expect(parseOrdaHover('**Title only**')).toBeNull()
  })

  it('strips bold markers from the title and parses entries', () => {
    const parsed = parseOrdaHover('**Employee.name**\n- Type: `string`\n- Kind: storage')
    expect(parsed).toEqual({
      title: 'Employee.name',
      entries: [
        { key: 'Type', value: '`string`' },
        { key: 'Kind', value: 'storage' },
      ],
    })
  })
})

describe('ordaHoverHeaderIcon', () => {
  it('uses the references icon for relations', () => {
    expect(ordaHoverHeaderIcon([{ key: 'Kind', value: 'relatedEntity' }])).toBe('references')
    expect(ordaHoverHeaderIcon([{ key: 'Kind', value: 'relatedEntities' }])).toBe('references')
  })

  it('uses the key icon for primary keys', () => {
    expect(
      ordaHoverHeaderIcon([
        { key: 'Kind', value: 'storage' },
        { key: 'Primary key', value: 'yes' },
      ])
    ).toBe('key')
  })

  it('falls back to the field icon for scalar attributes', () => {
    expect(ordaHoverHeaderIcon([{ key: 'Kind', value: 'storage' }])).toBe('symbol-field')
  })
})

describe('formatOrdaHoverMarkdown', () => {
  it('returns the raw string when it cannot be parsed', () => {
    expect(formatOrdaHoverMarkdown('plain text')).toBe('plain text')
  })

  it('renders a header with a contextual codicon', () => {
    const md = formatOrdaHoverMarkdown('**Employee.name**\n- Type: `string`')
    expect(md).toContain('$(symbol-field)&nbsp; **Employee.name**')
  })

  it('renders a markdown table with per-row icons and themed badges', () => {
    const md = formatOrdaHoverMarkdown('**Employee.name**\n- Type: `string`')
    expect(md).toContain('| :-- | :-- |')
    expect(md).toContain('$(symbol-class)&nbsp; Type')
    expect(md).toContain('background-color:var(--vscode-badge-background)')
    expect(md).toContain('&nbsp;string&nbsp;')
  })

  it('escapes HTML in property values', () => {
    const md = formatOrdaHoverMarkdown('**T.a**\n- Type: `<b>x</b>`')
    expect(md).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(md).not.toContain('<b>x</b>')
  })

  it('appends a relation tip when the attribute is a relation', () => {
    const md = formatOrdaHoverMarkdown(
      '**Reservation.employee**\n- Kind: relatedEntity\n- Related dataclass: `Employee`'
    )
    expect(md).toContain('$(lightbulb)')
    expect(md).toContain('explore **Employee** attributes')
  })

  it('omits the relation tip for scalar attributes', () => {
    const md = formatOrdaHoverMarkdown('**Employee.name**\n- Kind: storage')
    expect(md).not.toContain('$(lightbulb)')
  })
})
