import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  defaultPreset,
  getDefaultPreset,
  getPreset,
  macPreset,
  minimalPreset,
  presets,
  vscodePreset,
} from './presets'

describe('shortcuts/presets', () => {
  describe('defaultPreset', () => {
    it('has required shape', () => {
      expect(defaultPreset.id).toBe('default')
      expect(defaultPreset.name).toBe('Default')
      expect(Array.isArray(defaultPreset.shortcuts)).toBe(true)
      expect(defaultPreset.shortcuts.length).toBeGreaterThan(0)
    })

    it('has shortcut with action and keys', () => {
      const exec = defaultPreset.shortcuts.find((s) => s.action === 'query.execute')
      expect(exec).toBeDefined()
      expect(exec?.keys.key).toBe('Enter')
      expect(exec?.keys.modifiers).toContain('ctrl')
    })
  })

  describe('getPreset', () => {
    it('returns preset by id', () => {
      expect(getPreset('default')).toBe(defaultPreset)
      expect(getPreset('minimal')).toBe(minimalPreset)
      expect(getPreset('vscode')).toBe(vscodePreset)
      expect(getPreset('mac')).toBe(macPreset)
    })

    it('returns undefined for unknown id', () => {
      expect(getPreset('unknown')).toBeUndefined()
    })
  })

  describe('presets', () => {
    it('includes all presets', () => {
      expect(presets).toContain(defaultPreset)
      expect(presets).toContain(vscodePreset)
      expect(presets).toContain(minimalPreset)
      expect(presets).toContain(macPreset)
      expect(presets).toHaveLength(4)
    })
  })

  describe('minimalPreset', () => {
    it('has fewer shortcuts than default', () => {
      expect(minimalPreset.shortcuts.length).toBeLessThan(defaultPreset.shortcuts.length)
    })
  })

  describe('macPreset', () => {
    it('uses meta modifier for ctrl actions', () => {
      const first = macPreset.shortcuts[0]
      expect(first?.keys.modifiers).toContain('meta')
    })
  })

  describe('getDefaultPreset', () => {
    const originalPlatform = typeof navigator !== 'undefined' ? navigator.platform : ''

    beforeEach(() => {
      if (typeof navigator !== 'undefined') {
        Object.defineProperty(navigator, 'platform', {
          value: originalPlatform,
          writable: true,
          configurable: true,
        })
      }
    })

    afterEach(() => {
      if (typeof navigator !== 'undefined') {
        Object.defineProperty(navigator, 'platform', {
          value: originalPlatform,
          writable: true,
          configurable: true,
        })
      }
    })

    it('returns a preset (default or mac based on platform)', () => {
      const preset = getDefaultPreset()
      expect(preset).toBeDefined()
      expect(preset.id).toBeDefined()
      expect(preset.shortcuts.length).toBeGreaterThan(0)
      expect([defaultPreset, macPreset]).toContain(preset)
    })
  })
})
