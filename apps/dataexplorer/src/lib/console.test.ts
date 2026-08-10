import { beforeEach, describe, expect, it } from 'bun:test'
import { MAX_CONSOLE_ENTRIES, useConsoleStore } from '~/store/console'
import { consoleService } from './console'

describe('consoleService', () => {
  beforeEach(() => {
    useConsoleStore.setState({ entries: [], filter: 'all', showDecodedUrls: false })
  })

  it('keeps object messages and additional arguments structured', () => {
    const message = { event: 'loaded', count: 3 }
    const details = { source: 'catalog' }

    consoleService.info(message, details, 42)

    const [entry] = useConsoleStore.getState().entries
    expect(entry.level).toBe('info')
    expect(entry.message).toBe(message)
    expect(entry.args).toEqual([details, 42])
  })

  it('clears entries and updates the filter', () => {
    consoleService.warn('warning')
    useConsoleStore.getState().setFilter('warn')
    expect(useConsoleStore.getState().filter).toBe('warn')

    consoleService.clear()
    expect(useConsoleStore.getState().entries).toEqual([])
  })

  it('caps the in-memory log buffer', () => {
    for (let index = 0; index <= MAX_CONSOLE_ENTRIES; index += 1) {
      consoleService.log(index)
    }

    const entries = useConsoleStore.getState().entries
    expect(entries).toHaveLength(MAX_CONSOLE_ENTRIES)
    expect(entries[0]?.message).toBe(1)
  })
})
