import { beforeEach, describe, expect, it } from 'bun:test'
import { saveBasePickLists, setCurrentBaseId } from '~/lib/storage'
import { useEnvironmentsStore } from './environments'

const declarations = [{ id: '1', name: 'empIds', dataclass: 'Employee', attribute: 'ID' }]

describe('environments store pick lists', () => {
  beforeEach(() => {
    setCurrentBaseId('base-ensure')
    saveBasePickLists(declarations)
    useEnvironmentsStore.getState().invalidatePickListValues('Employee', 'ID')
  })

  it('bumps revision only on real cache transitions', async () => {
    let calls = 0
    const loader = async () => {
      calls += 1
      return { values: ['1', '2'], truncated: false }
    }

    const before = useEnvironmentsStore.getState().revision
    const first = await useEnvironmentsStore.getState().ensurePickLists(['empIds'], loader)
    expect(first.lists.empIds).toEqual(['1', '2'])
    expect(calls).toBe(1)
    const afterFirst = useEnvironmentsStore.getState().revision
    expect(afterFirst).toBeGreaterThan(before)

    // A cached list must not notify subscribers again: callers that re-run on
    // `revision` would otherwise loop forever.
    const second = await useEnvironmentsStore.getState().ensurePickLists(['empIds'], loader)
    expect(second.lists.empIds).toEqual(['1', '2'])
    expect(calls).toBe(1)
    expect(useEnvironmentsStore.getState().revision).toBe(afterFirst)
  })

  it('does not bump revision for undeclared names', async () => {
    const before = useEnvironmentsStore.getState().revision
    const result = await useEnvironmentsStore.getState().ensurePickLists(['nope'], async () => ({
      values: ['x'],
      truncated: false,
    }))
    expect(result.missing).toEqual(['nope'])
    expect(useEnvironmentsStore.getState().revision).toBe(before)
  })

  it('keeps stable value identities so consumers can skip re-renders', async () => {
    const loader = async () => ({ values: ['a', 'b'], truncated: false })
    await useEnvironmentsStore.getState().ensurePickLists(['empIds'], loader)
    const first = useEnvironmentsStore.getState().getPickListsResolveMap()
    const second = useEnvironmentsStore.getState().getPickListsResolveMap()
    expect(second.empIds).toBe(first.empIds)
  })
})
