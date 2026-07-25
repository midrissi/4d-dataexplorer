import type { CatalogAllResponse, DataClass, DataClassAttribute } from '@4d/rest'

export type PathSegmentResolution = {
  segment: string
  kind: string
  type: string
  dataClass: string
  behavior?: string
}

export type ValidateDataclassPathSuccess = {
  valid: true
  dataClass: string
  path: string
  resolved: PathSegmentResolution[]
}

export type ValidateDataclassPathFailure = {
  valid: false
  dataClass: string
  path: string
  error: string
  resolved: PathSegmentResolution[]
}

export type ValidateDataclassPathResult =
  | ValidateDataclassPathSuccess
  | ValidateDataclassPathFailure

function isRelationKind(kind: string, behavior?: string): boolean {
  return (
    kind === 'relatedEntity' ||
    kind === 'relatedEntities' ||
    behavior === 'relatedEntity' ||
    behavior === 'relatedEntities'
  )
}

function isRelationAttribute(attr: DataClassAttribute): boolean {
  return isRelationKind(attr.kind, attr.behavior)
}

function relatedDataClassName(attr: DataClassAttribute): string | null {
  const name = (attr.type || attr.path || '').trim()
  return name || null
}

function findDataClass(catalog: CatalogAllResponse, name: string): DataClass | undefined {
  return catalog.dataClasses?.find((dc) => dc.name === name)
}

function findAttribute(dc: DataClass, name: string): DataClassAttribute | undefined {
  return (dc.attributes ?? []).find((attr) => attr.name === name)
}

function attributeNames(dc: DataClass): string[] {
  return (dc.attributes ?? []).map((attr) => attr.name).filter(Boolean)
}

function formatAvailable(names: string[], limit = 40): string {
  if (names.length === 0) return '(none)'
  if (names.length <= limit) return names.join(', ')
  return `${names.slice(0, limit).join(', ')}, … (+${names.length - limit} more)`
}

/**
 * Validate a dotted attribute/relation path on a dataclass (e.g. agency.manager.firstname).
 * Intermediate segments must be relations; the final segment may be storage or a relation.
 * A trailing `*` is allowed after a relation (or alone) to mean all attributes.
 */
export function validateDataclassPath(
  catalog: CatalogAllResponse,
  dataClassName: string,
  rawPath: string
): ValidateDataclassPathResult {
  const dataClass = dataClassName.trim()
  const path = rawPath.trim()
  const resolved: PathSegmentResolution[] = []

  if (!dataClass) {
    return {
      valid: false,
      dataClass,
      path,
      error: 'dataClass is required',
      resolved,
    }
  }

  if (!path) {
    return {
      valid: false,
      dataClass,
      path,
      error: 'path is required (e.g. "agency.manager.firstname")',
      resolved,
    }
  }

  const root = findDataClass(catalog, dataClass)
  if (!root) {
    return {
      valid: false,
      dataClass,
      path,
      error: `Dataclass "${dataClass}" not found in catalog`,
      resolved,
    }
  }

  const segments = path
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean)
  if (segments.length === 0) {
    return {
      valid: false,
      dataClass,
      path,
      error: 'path is required (e.g. "agency.manager.firstname")',
      resolved,
    }
  }

  let currentDc = root
  let pathSoFar = ''

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (segment == null) continue
    const isLast = i === segments.length - 1
    pathSoFar = pathSoFar ? `${pathSoFar}.${segment}` : segment
    const parentPath = pathSoFar.includes('.')
      ? pathSoFar.slice(0, pathSoFar.lastIndexOf('.'))
      : dataClass

    if (segment === '*') {
      if (i === 0) {
        // Root wildcard: all attributes on the dataclass
        resolved.push({
          segment: '*',
          kind: 'wildcard',
          type: '*',
          dataClass: currentDc.name,
        })
        continue
      }
      const prev = resolved[resolved.length - 1]
      if (!prev || !isRelationKind(prev.kind, prev.behavior)) {
        return {
          valid: false,
          dataClass,
          path,
          error: `${path} is not valid: "*" is only allowed after a relation attribute`,
          resolved,
        }
      }
      if (!isLast) {
        return {
          valid: false,
          dataClass,
          path,
          error: `${path} is not valid: "*" must be the final segment`,
          resolved,
        }
      }
      resolved.push({
        segment: '*',
        kind: 'wildcard',
        type: '*',
        dataClass: currentDc.name,
      })
      continue
    }

    const attr = findAttribute(currentDc, segment)
    if (!attr) {
      const available = formatAvailable(attributeNames(currentDc))
      const onLabel = i === 0 ? currentDc.name : parentPath
      return {
        valid: false,
        dataClass,
        path,
        error: `${path} is not valid, no ${segment} attribute on ${onLabel} (${currentDc.name}). Available: ${available}`,
        resolved,
      }
    }

    const relation = isRelationAttribute(attr)
    resolved.push({
      segment,
      kind: attr.kind,
      type: String(attr.type ?? ''),
      dataClass: currentDc.name,
      ...(attr.behavior ? { behavior: attr.behavior } : {}),
    })

    if (!isLast) {
      if (!relation) {
        return {
          valid: false,
          dataClass,
          path,
          error: `${path} is not valid: "${pathSoFar}" is not a relation on ${currentDc.name} (kind=${attr.kind}); cannot continue with "${segments[i + 1]}"`,
          resolved,
        }
      }
      const relatedName = relatedDataClassName(attr)
      if (!relatedName) {
        return {
          valid: false,
          dataClass,
          path,
          error: `${path} is not valid: relation "${pathSoFar}" has no related dataclass type`,
          resolved,
        }
      }
      const nextDc = findDataClass(catalog, relatedName)
      if (!nextDc) {
        return {
          valid: false,
          dataClass,
          path,
          error: `${path} is not valid: related dataclass "${relatedName}" for "${pathSoFar}" not found in catalog`,
          resolved,
        }
      }
      currentDc = nextDc
    }
  }

  return {
    valid: true,
    dataClass,
    path,
    resolved,
  }
}
