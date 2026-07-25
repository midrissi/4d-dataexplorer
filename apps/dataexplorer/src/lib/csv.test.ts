import { describe, expect, it } from 'bun:test'
import { isCsvContentType, looksLikeCsv, parseCsv } from './csv'

describe('csv', () => {
  it('parses simple csv with headers', () => {
    const table = parseCsv('name,age\nAda,36\nGrace,41\n')
    expect(table).toEqual({
      headers: ['name', 'age'],
      rows: [
        ['Ada', '36'],
        ['Grace', '41'],
      ],
    })
  })

  it('handles quoted commas and escaped quotes', () => {
    const table = parseCsv('city,note\n"Paris, FR","He said ""hi"""\n')
    expect(table?.headers).toEqual(['city', 'note'])
    expect(table?.rows[0]).toEqual(['Paris, FR', 'He said "hi"'])
  })

  it('detects semicolon and tab delimiters', () => {
    expect(parseCsv('a;b\n1;2')?.headers).toEqual(['a', 'b'])
    expect(parseCsv('a\tb\n1\t2')?.headers).toEqual(['a', 'b'])
  })

  it('looksLikeCsv requires consistent columns', () => {
    expect(looksLikeCsv('a,b\n1,2\n3,4')).toBe(true)
    expect(looksLikeCsv('{"a":1}')).toBe(false)
    expect(looksLikeCsv('<html></html>')).toBe(false)
    expect(looksLikeCsv('just text')).toBe(false)
  })

  it('recognizes csv content types', () => {
    expect(isCsvContentType('text/csv; charset=utf-8')).toBe(true)
    expect(isCsvContentType('application/json')).toBe(false)
  })
})
