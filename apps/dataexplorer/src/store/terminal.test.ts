import { beforeEach, describe, expect, it } from 'bun:test'
import { useTerminalStore } from './terminal'

describe('terminal history', () => {
  beforeEach(() => {
    useTerminalStore.setState({
      output: [],
      history: [],
      historyIndex: null,
      historyDraft: '',
      draft: '',
      running: false,
    })
  })

  it('cycles older and newer commands', () => {
    const store = useTerminalStore.getState()
    store.pushHistory('first()')
    store.pushHistory('second()')

    expect(store.historyUp('')).toBe('second()')
    expect(useTerminalStore.getState().historyUp('')).toBe('first()')
    expect(useTerminalStore.getState().historyDown()).toBe('second()')
  })

  it('restores the unsubmitted draft after the newest command', () => {
    const store = useTerminalStore.getState()
    store.pushHistory('savedCommand()')

    expect(store.historyUp('workInProgress()')).toBe('savedCommand()')
    // Updating the visible editor draft must not overwrite the stashed draft.
    useTerminalStore.getState().setDraft('savedCommand()')
    expect(useTerminalStore.getState().historyDown()).toBe('workInProgress()')
    expect(useTerminalStore.getState().historyIndex).toBeNull()
  })
})
