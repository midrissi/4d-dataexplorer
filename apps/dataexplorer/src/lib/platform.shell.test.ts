import { afterEach, describe, expect, test } from 'bun:test'
import {
  getAppShell,
  isDesktop,
  isDesktopShell,
  isMobileShell,
  isNativeShell,
  isWeb,
} from './platform'

describe('platform shell detection', () => {
  const original = import.meta.env.VITE_APP_SHELL

  afterEach(() => {
    ;(import.meta.env as { VITE_APP_SHELL?: string }).VITE_APP_SHELL = original
  })

  test('mobile shell helpers', () => {
    ;(import.meta.env as { VITE_APP_SHELL?: string }).VITE_APP_SHELL = 'mobile'
    expect(getAppShell()).toBe('mobile')
    expect(isMobileShell()).toBe(true)
    expect(isDesktopShell()).toBe(false)
    expect(isNativeShell()).toBe(true)
    expect(isDesktop()).toBe(true)
    expect(isWeb()).toBe(false)
  })

  test('desktop shell helpers', () => {
    ;(import.meta.env as { VITE_APP_SHELL?: string }).VITE_APP_SHELL = 'desktop'
    expect(getAppShell()).toBe('desktop')
    expect(isDesktopShell()).toBe(true)
    expect(isMobileShell()).toBe(false)
    expect(isNativeShell()).toBe(true)
  })

  test('web shell helpers', () => {
    ;(import.meta.env as { VITE_APP_SHELL?: string }).VITE_APP_SHELL = 'web'
    expect(getAppShell()).toBe('web')
    expect(isWeb()).toBe(true)
    expect(isNativeShell()).toBe(false)
    expect(isDesktop()).toBe(false)
  })
})
