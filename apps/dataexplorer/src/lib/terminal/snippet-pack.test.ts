import { describe, expect, it } from 'bun:test'
import {
  buildSnippetPack,
  decodeSnippetPack,
  defaultSnippetPackFilename,
  encodeSnippetPack,
  parseSnippetPackJson,
  SNIPPET_PACK_FORMAT,
  SNIPPET_PACK_VERSION,
} from './snippet-pack'

describe('snippet-pack', () => {
  it('builds a versioned pack', () => {
    const pack = buildSnippetPack([{ name: 'a', code: 'ds.Car.all()' }], 1_700_000_000_000)
    expect(pack).toEqual({
      format: SNIPPET_PACK_FORMAT,
      version: SNIPPET_PACK_VERSION,
      exportedAt: 1_700_000_000_000,
      snippets: [{ name: 'a', code: 'ds.Car.all()' }],
    })
  })

  it('round-trips gzip encode/decode', async () => {
    const pack = buildSnippetPack([
      { name: 'weekendCars', code: 'ds.Car.query("ID > :1", 10)' },
      { name: 'agencies', code: 'ds.Agency.all()' },
    ])
    const bytes = await encodeSnippetPack(pack)
    expect(bytes.byteLength).toBeGreaterThan(20)
    // gzip magic
    expect(bytes[0]).toBe(0x1f)
    expect(bytes[1]).toBe(0x8b)

    const decoded = await decodeSnippetPack(bytes)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.pack.snippets).toEqual(pack.snippets)
    expect(decoded.pack.format).toBe(SNIPPET_PACK_FORMAT)
  })

  it('rejects bad JSON payloads', () => {
    expect(parseSnippetPackJson(null).ok).toBe(false)
    expect(parseSnippetPackJson({ format: 'other', version: 1, snippets: [] }).ok).toBe(false)
    expect(
      parseSnippetPackJson({
        format: SNIPPET_PACK_FORMAT,
        version: 99,
        snippets: [],
      }).ok
    ).toBe(false)
    expect(
      parseSnippetPackJson({
        format: SNIPPET_PACK_FORMAT,
        version: 1,
        snippets: [{ name: 1, code: 'x' }],
      }).ok
    ).toBe(false)
  })

  it('names download files with date + extension', () => {
    expect(defaultSnippetPackFilename(new Date('2026-07-30T12:00:00Z'))).toBe(
      'orda-snippets-2026-07-30.orda-snippets.gz'
    )
  })
})
