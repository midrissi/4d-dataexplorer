import { describe, expect, it } from 'bun:test'
import { filterParamToRuntimeArgument, runtimeArgumentToFilterParam } from './filter-param-runtime'

describe('filterParamToRuntimeArgument / runtimeArgumentToFilterParam', () => {
  it('round-trips a simple string filter param', () => {
    const param = { type: 'string' as const, value: 'Acme' }
    const argument = filterParamToRuntimeArgument(param, 0, 'arg-1')
    expect(argument).toEqual({
      id: 'arg-1',
      kind: 'string',
      name: ':1',
      value: 'Acme',
    })
    expect(runtimeArgumentToFilterParam(argument)).toEqual(param)
  })
})
