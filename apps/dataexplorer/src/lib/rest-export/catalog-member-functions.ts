import type { ToolkitCatalogDataClass, ToolkitCatalogMethod } from './toolkit-types'

function isMemberFunction(method: ToolkitCatalogMethod, includeNonExposed: boolean): boolean {
  if (includeNonExposed) return true
  return method.exposed === true
}

export function memberFunctionCount(
  dataClass: Pick<ToolkitCatalogDataClass, 'methods'>,
  includeNonExposed = false
): number {
  return (dataClass.methods ?? []).filter((method) => isMemberFunction(method, includeNonExposed))
    .length
}

export function hasMemberFunctions(
  dataClass: Pick<ToolkitCatalogDataClass, 'methods'>,
  includeNonExposed = false
): boolean {
  return memberFunctionCount(dataClass, includeNonExposed) > 0
}

export function dataClassesWithMemberFunctions<T extends Pick<ToolkitCatalogDataClass, 'methods'>>(
  dataClasses: T[],
  includeNonExposed = false
): T[] {
  return dataClasses.filter((dataClass) => hasMemberFunctions(dataClass, includeNonExposed))
}
