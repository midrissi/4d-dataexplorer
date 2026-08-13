import { describe, expect, test } from 'bun:test'
import { methodExecutorTabLabel } from './method-list-display'

describe('methodExecutorTabLabel', () => {
  test('falls back when seed or methodName is empty', () => {
    expect(methodExecutorTabLabel(undefined, 'Method Executor')).toBe('Method Executor')
    expect(methodExecutorTabLabel({ scope: 'catalog', methodName: '' }, 'Method Executor')).toBe(
      'Method Executor'
    )
    expect(methodExecutorTabLabel({ scope: 'catalog', methodName: '   ' }, 'Method Executor')).toBe(
      'Method Executor'
    )
  })

  test('formats catalog, dataclass, and singleton targets', () => {
    expect(
      methodExecutorTabLabel({ scope: 'catalog', methodName: 'justATest' }, 'Method Executor')
    ).toBe('justATest')
    expect(
      methodExecutorTabLabel(
        { scope: 'dataclass', methodName: 'all', dataClass: 'Employee' },
        'Method Executor'
      )
    ).toBe('Employee.all')
    expect(
      methodExecutorTabLabel(
        { scope: 'singleton', methodName: 'ping', singletonName: 'Status' },
        'Method Executor'
      )
    ).toBe('Status.ping')
  })
})
