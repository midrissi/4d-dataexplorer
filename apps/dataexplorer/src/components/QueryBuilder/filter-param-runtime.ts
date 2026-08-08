import type { RuntimeArgument } from '~/store/method-executor-types'
import type { FilterParam } from '~/store/tabs'

export function filterParamToRuntimeArgument(
  param: FilterParam,
  index: number,
  id: string
): RuntimeArgument {
  const name = `:${index + 1}`
  switch (param.type) {
    case 'boolean':
      return {
        id,
        kind: 'boolean',
        name,
        value: param.value === 'true' || param.value === '1',
      }
    case 'number':
      return { id, kind: 'number', name, value: param.value }
    case 'date':
      return { id, kind: 'date', name, value: param.value }
    case 'json':
      return { id, kind: 'custom', name, value: param.value || 'null' }
    default:
      return { id, kind: 'string', name, value: param.value }
  }
}

export function runtimeArgumentToFilterParam(argument: RuntimeArgument): FilterParam {
  switch (argument.kind) {
    case 'boolean':
      return { type: 'boolean', value: argument.value ? 'true' : 'false' }
    case 'number':
      return { type: 'number', value: argument.value }
    case 'date':
      return { type: 'date', value: argument.value }
    case 'custom':
      return { type: 'json', value: argument.value }
    default:
      return { type: 'string', value: argument.kind === 'string' ? argument.value : '' }
  }
}
