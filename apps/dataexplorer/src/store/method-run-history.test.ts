import { beforeEach, describe, expect, it } from 'bun:test'
import { useMethodRunHistoryStore } from './method-run-history'

const config = {
  scope: 'dataclass' as const,
  methodName: 'hello',
  dataClass: 'City',
  arguments: [{ id: '1', kind: 'custom' as const, value: '"world"' }],
}

describe('method run history', () => {
  beforeEach(() => useMethodRunHistoryStore.setState({ runs: [] }))

  it('stores successful run configurations and deduplicates them', () => {
    const store = useMethodRunHistoryStore.getState()
    store.addRun(config, 'other')
    store.addRun(config, 'other')
    expect(useMethodRunHistoryStore.getState().runs).toHaveLength(1)
  })

  it('removes and clears runs', () => {
    useMethodRunHistoryStore.getState().addRun(config, 'other')
    const id = useMethodRunHistoryStore.getState().runs[0]?.id
    expect(id).toBeDefined()
    if (id) useMethodRunHistoryStore.getState().removeRun(id)
    expect(useMethodRunHistoryStore.getState().runs).toEqual([])

    useMethodRunHistoryStore.getState().addRun(config, 'other')
    useMethodRunHistoryStore.getState().clearRuns()
    expect(useMethodRunHistoryStore.getState().runs).toEqual([])
  })
})
