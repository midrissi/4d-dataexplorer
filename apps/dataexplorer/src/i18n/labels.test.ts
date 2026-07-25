import { describe, expect, it } from 'bun:test'
import { DEFAULT_LABELS, getIntlLocale, getLabel, LABELS } from './labels'

describe('i18n/labels', () => {
  it('getIntlLocale returns locale code', () => {
    expect(getIntlLocale('en')).toBe('en')
    expect(getIntlLocale('fr')).toBe('fr')
  })

  it('getLabel returns English by default', () => {
    expect(getLabel('en', 'app.title')).toBe(DEFAULT_LABELS['app.title'])
  })

  it('getLabel interpolates params', () => {
    const key = Object.keys(DEFAULT_LABELS).find((k) => DEFAULT_LABELS[k]?.includes('{'))
    if (key) {
      const param = key.match(/\{(\w+)\}/)?.[1]
      if (param) {
        const result = getLabel('en', key, { [param]: 'TEST' })
        expect(result).toContain('TEST')
      }
    }
    expect(getLabel('en', 'command.theme', { name: 'Graphite' })).toContain('Graphite')
  })

  it('getLabel falls back to English for unknown keys', () => {
    expect(getLabel('fr', 'totally.missing.key.xyz')).toBe('totally.missing.key.xyz')
  })

  it('LABELS includes all supported locales', () => {
    expect(Object.keys(LABELS)).toEqual(['en', 'fr', 'es'])
    expect(LABELS.es['app.title']).toBeTruthy()
  })
})
