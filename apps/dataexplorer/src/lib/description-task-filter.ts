import type { CatalogWithMetadataExpanded, DataClass, DataClassAttribute } from '@4d/rest'
import type { DescriptionTask } from './generate-all-metadata-descriptions'

export type DescriptionTaskType = DescriptionTask['type']

export type AttributeExclusionFilter = {
  /** Exact attribute names, case-insensitive (e.g. "ID", "uuid"). */
  names?: string[]
  /** Regex tested against attribute names (e.g. "^(id|.*ID)$"). */
  namePattern?: string
  /** Exclude primary keys, identifying fields, and common ID field names. */
  idLike?: boolean
  /** Exclude attributes marked identifying in the catalog. */
  identifying?: boolean
  /** Exclude attributes listed in the dataclass key definition. */
  primaryKeys?: boolean
}

export type DescriptionTaskFilter = {
  /** Task types to include. Default: all types when omitted. */
  includeTypes?: DescriptionTaskType[]
  /** Only generate for these dataclass names. */
  dataclassNames?: string[]
  /** Skip these dataclass names. */
  excludeDataclasses?: string[]
  /** Attribute exclusion rules applied to attribute tasks only. */
  excludeAttributes?: AttributeExclusionFilter
}

const DEFAULT_ID_LIKE_NAME = /^id$/i
const ID_SUFFIX_NAME = /id$/i

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function isPrimaryKeyAttribute(dataclass: DataClass, attributeName: string): boolean {
  return (dataclass.key ?? []).some((key) => key.name === attributeName)
}

export function isIdLikeAttribute(attribute: DataClassAttribute, dataclass: DataClass): boolean {
  if (attribute.identifying) return true
  if (isPrimaryKeyAttribute(dataclass, attribute.name)) return true
  if (DEFAULT_ID_LIKE_NAME.test(attribute.name)) return true
  if (ID_SUFFIX_NAME.test(attribute.name) && attribute.name.length > 2) return true
  return false
}

/** Primary-key and ID-like attribute descriptions are optional in the metadata editor. */
export function isOptionalAttributeDescription(
  attribute: DataClassAttribute,
  dataclass: DataClass
): boolean {
  return isIdLikeAttribute(attribute, dataclass)
}

export function shouldExcludeAttribute(
  attribute: DataClassAttribute,
  dataclass: DataClass,
  filter: AttributeExclusionFilter | undefined
): boolean {
  if (!filter) return false

  const normalizedNames = new Set((filter.names ?? []).map(normalizeName))
  if (normalizedNames.has(normalizeName(attribute.name))) return true

  if (filter.namePattern) {
    try {
      if (new RegExp(filter.namePattern, 'i').test(attribute.name)) return true
    } catch {
      // Ignore invalid regex from tool args.
    }
  }

  if (filter.identifying && attribute.identifying) return true
  if (filter.primaryKeys && isPrimaryKeyAttribute(dataclass, attribute.name)) return true
  if (filter.idLike && isIdLikeAttribute(attribute, dataclass)) return true

  return false
}

function taskDataclassName(task: DescriptionTask): string | undefined {
  switch (task.type) {
    case 'dataclass':
    case 'attribute':
    case 'dataclass-method':
      return task.dataclassName
    default:
      return undefined
  }
}

export function filterDescriptionTasks(
  tasks: DescriptionTask[],
  catalog: CatalogWithMetadataExpanded,
  filter: DescriptionTaskFilter | undefined
): DescriptionTask[] {
  if (!filter) return tasks

  const includeTypes = filter.includeTypes ? new Set(filter.includeTypes) : null
  const dataclassNames = filter.dataclassNames?.length ? new Set(filter.dataclassNames) : null
  const excludeDataclasses = filter.excludeDataclasses?.length
    ? new Set(filter.excludeDataclasses)
    : null

  const dataclassByName = new Map(
    (catalog.dataClasses ?? []).map((dataclass) => [dataclass.name, dataclass])
  )

  return tasks.filter((task) => {
    if (includeTypes && !includeTypes.has(task.type)) return false

    const dataclassName = taskDataclassName(task)
    if (dataclassNames && dataclassName && !dataclassNames.has(dataclassName)) return false
    if (excludeDataclasses && dataclassName && excludeDataclasses.has(dataclassName)) {
      return false
    }

    if (task.type === 'attribute') {
      const dataclass = dataclassByName.get(task.dataclassName)
      const attribute = dataclass?.attributes?.find((item) => item.name === task.attributeName)
      if (!dataclass || !attribute) return false
      if (shouldExcludeAttribute(attribute, dataclass, filter.excludeAttributes)) return false
    }

    return true
  })
}
