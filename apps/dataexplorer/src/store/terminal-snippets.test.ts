import { beforeEach, describe, expect, it } from 'bun:test'
import { isValidSnippetName, useTerminalSnippetsStore } from '~/store/terminal-snippets'

describe('terminal snippets store', () => {
  beforeEach(() => {
    useTerminalSnippetsStore.setState({ snippets: [] })
  })

  it('validates names', () => {
    expect(isValidSnippetName('weekendCars')).toBe(true)
    expect(isValidSnippetName('my-query_1')).toBe(true)
    expect(isValidSnippetName('1bad')).toBe(false)
    expect(isValidSnippetName('has space')).toBe(false)
  })

  it('adds, updates, and removes snippets', () => {
    const created = useTerminalSnippetsStore.getState().addSnippet({
      name: 'allCars',
      code: 'ds.Car.all()',
    })
    if (!created) throw new Error('expected snippet')
    expect(created.name).toBe('allCars')
    expect(useTerminalSnippetsStore.getState().snippets).toHaveLength(1)

    expect(
      useTerminalSnippetsStore.getState().addSnippet({ name: 'allCars', code: 'x' })
    ).toBeNull()

    expect(
      useTerminalSnippetsStore.getState().updateSnippet(created.id, {
        name: 'allCars',
        code: 'ds.Car.query("ID > 0")',
      })
    ).toBe(true)
    expect(useTerminalSnippetsStore.getState().getByName('allCars')?.code).toContain('query')

    expect(useTerminalSnippetsStore.getState().removeSnippet(created.id)).toBe(true)
    expect(useTerminalSnippetsStore.getState().snippets).toHaveLength(0)
  })
})
