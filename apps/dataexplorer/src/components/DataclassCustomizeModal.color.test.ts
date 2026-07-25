import { describe, expect, it } from 'bun:test'
import { getDataclassColorClasses, isHexColor } from './DataclassCustomizeModal'

describe('dataclass customization colors', () => {
  it('detects hex colors', () => {
    expect(isHexColor('#7D3C98')).toBe(true)
    expect(isHexColor('#fff')).toBe(true)
    expect(isHexColor('blue')).toBe(false)
    expect(isHexColor('#gg0000')).toBe(false)
  })

  it('maps preset names to tailwind classes', () => {
    const classes = getDataclassColorClasses({ color: 'green' })
    expect(classes.text).toBe('text-green-500')
    expect(classes.style).toBeUndefined()
  })

  it('maps hex colors to CSS variable classes', () => {
    const classes = getDataclassColorClasses({ color: '#7D3C98' })
    expect(classes.text).toBe('text-[var(--dc-color)]')
    expect(classes.bg).toBe('bg-[var(--dc-color)]')
    expect(classes.style).toBeDefined()
    expect((classes.style as Record<string, string>)['--dc-color']).toBe('#7D3C98')
  })
})
