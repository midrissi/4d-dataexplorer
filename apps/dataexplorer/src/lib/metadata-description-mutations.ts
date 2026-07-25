import type { CatalogWithMetadataExpanded } from '@4d/rest'
import { parseMethodArguments } from '@4djs/assistant/tools'
import type {
  AssistantMetadataSchema,
  MethodArgumentSchema,
  MethodMetadata,
} from './assistant-metadata-schema'
import type { DescriptionTaskFilter } from './description-task-filter'
import { collectDescriptionTasks, type DescriptionTask } from './generate-all-metadata-descriptions'

export type MetadataDescriptionUpdate =
  | { type: 'dataclass'; dataclassName: string; description: string }
  | {
      type: 'attribute'
      dataclassName: string
      attributeName: string
      description: string
    }
  | {
      type: 'dataclass-method'
      dataclassName: string
      methodName: string
      description?: string
      arguments?: MethodArgumentSchema[] | null
      clearArguments?: boolean
    }
  | { type: 'singleton'; singletonName: string; description: string }
  | {
      type: 'singleton-method'
      singletonName: string
      methodName: string
      description?: string
      arguments?: MethodArgumentSchema[] | null
      clearArguments?: boolean
    }
  | {
      type: 'catalog-method'
      methodName: string
      description?: string
      arguments?: MethodArgumentSchema[] | null
      clearArguments?: boolean
    }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function methodHasContent(method: MethodMetadata | undefined, includeArguments: boolean): boolean {
  if (!method) return false
  if (method.description?.trim()) return true
  if (includeArguments && method.arguments?.length) return true
  return false
}

export function taskHasMetadataContent(
  metadata: AssistantMetadataSchema,
  task: DescriptionTask,
  includeArguments = false
): boolean {
  switch (task.type) {
    case 'dataclass':
      return Boolean(metadata.dataClasses[task.dataclassName]?.description?.trim())
    case 'attribute':
      return Boolean(
        metadata.dataClasses[task.dataclassName]?.attributes?.[
          task.attributeName
        ]?.description?.trim()
      )
    case 'dataclass-method':
      return methodHasContent(
        metadata.dataClasses[task.dataclassName]?.methods?.[task.methodName],
        includeArguments
      )
    case 'singleton':
      return Boolean(metadata.singletons[task.singletonName]?.description?.trim())
    case 'singleton-method':
      return methodHasContent(
        metadata.singletons[task.singletonName]?.methods?.[task.methodName],
        includeArguments
      )
    case 'catalog-method':
      return methodHasContent(metadata.catalogMethods[task.methodName], includeArguments)
  }
}

function clearMethodFields(
  method: MethodMetadata | undefined,
  clearArguments: boolean
): { method: MethodMetadata | undefined; changed: boolean } {
  if (!method) return { method: undefined, changed: false }

  const next: MethodMetadata = { ...method }
  let changed = false

  if (next.description?.trim()) {
    delete next.description
    changed = true
  }

  if (clearArguments && next.arguments?.length) {
    delete next.arguments
    changed = true
  }

  if (!next.description && !next.arguments?.length) {
    return { method: undefined, changed }
  }

  return { method: next, changed }
}

function clearDescriptionTask(
  metadata: AssistantMetadataSchema,
  task: DescriptionTask,
  clearArguments: boolean
): { metadata: AssistantMetadataSchema; changed: boolean } {
  switch (task.type) {
    case 'dataclass': {
      const current = metadata.dataClasses[task.dataclassName]
      if (!current?.description?.trim()) return { metadata, changed: false }
      return {
        metadata: {
          ...metadata,
          dataClasses: {
            ...metadata.dataClasses,
            [task.dataclassName]: { ...current, description: undefined },
          },
        },
        changed: true,
      }
    }
    case 'attribute': {
      const current = metadata.dataClasses[task.dataclassName]
      const attribute = current?.attributes?.[task.attributeName]
      if (!attribute?.description?.trim()) return { metadata, changed: false }
      return {
        metadata: {
          ...metadata,
          dataClasses: {
            ...metadata.dataClasses,
            [task.dataclassName]: {
              ...current,
              attributes: {
                ...current?.attributes,
                [task.attributeName]: { description: undefined },
              },
            },
          },
        },
        changed: true,
      }
    }
    case 'dataclass-method': {
      const current = metadata.dataClasses[task.dataclassName]
      const method = current?.methods?.[task.methodName]
      const cleared = clearMethodFields(method, clearArguments)
      if (!cleared.changed) return { metadata, changed: false }
      const methods = { ...current?.methods }
      if (cleared.method) {
        methods[task.methodName] = cleared.method
      } else {
        delete methods[task.methodName]
      }
      return {
        metadata: {
          ...metadata,
          dataClasses: {
            ...metadata.dataClasses,
            [task.dataclassName]: { ...current, methods },
          },
        },
        changed: true,
      }
    }
    case 'singleton': {
      const current = metadata.singletons[task.singletonName]
      if (!current?.description?.trim()) return { metadata, changed: false }
      return {
        metadata: {
          ...metadata,
          singletons: {
            ...metadata.singletons,
            [task.singletonName]: { ...current, description: undefined },
          },
        },
        changed: true,
      }
    }
    case 'singleton-method': {
      const current = metadata.singletons[task.singletonName]
      const method = current?.methods?.[task.methodName]
      const cleared = clearMethodFields(method, clearArguments)
      if (!cleared.changed) return { metadata, changed: false }
      const methods = { ...current?.methods }
      if (cleared.method) {
        methods[task.methodName] = cleared.method
      } else {
        delete methods[task.methodName]
      }
      return {
        metadata: {
          ...metadata,
          singletons: {
            ...metadata.singletons,
            [task.singletonName]: { ...current, methods },
          },
        },
        changed: true,
      }
    }
    case 'catalog-method': {
      const method = metadata.catalogMethods[task.methodName]
      const cleared = clearMethodFields(method, clearArguments)
      if (!cleared.changed) return { metadata, changed: false }
      const catalogMethods = { ...metadata.catalogMethods }
      if (cleared.method) {
        catalogMethods[task.methodName] = cleared.method
      } else {
        delete catalogMethods[task.methodName]
      }
      return {
        metadata: {
          ...metadata,
          catalogMethods,
        },
        changed: true,
      }
    }
  }
}

export function clearMetadataDescriptions(input: {
  catalog: CatalogWithMetadataExpanded
  metadata: AssistantMetadataSchema
  filter?: DescriptionTaskFilter
  onlyDescribed?: boolean
  clearArguments?: boolean
}): { metadata: AssistantMetadataSchema; cleared: number; matched: number } {
  const onlyDescribed = input.onlyDescribed !== false
  const clearArguments = input.clearArguments === true
  const tasks = collectDescriptionTasks(input.catalog, input.metadata, false, input.filter)

  let metadata = input.metadata
  let cleared = 0

  for (const task of tasks) {
    if (onlyDescribed && !taskHasMetadataContent(metadata, task, clearArguments)) {
      continue
    }
    const result = clearDescriptionTask(metadata, task, clearArguments)
    metadata = result.metadata
    if (result.changed) cleared++
  }

  return { metadata, cleared, matched: tasks.length }
}

function assertDataclassExists(catalog: CatalogWithMetadataExpanded, name: string): void {
  if (!catalog.dataClasses.some((dataclass) => dataclass.name === name)) {
    throw new Error(`Dataclass not found: ${name}`)
  }
}

function assertSingletonExists(catalog: CatalogWithMetadataExpanded, name: string): void {
  if (!catalog.singletons?.some((singleton) => singleton.name === name)) {
    throw new Error(`Singleton not found: ${name}`)
  }
}

function applyMetadataDescriptionUpdate(
  metadata: AssistantMetadataSchema,
  catalog: CatalogWithMetadataExpanded,
  update: MetadataDescriptionUpdate
): AssistantMetadataSchema {
  switch (update.type) {
    case 'dataclass': {
      assertDataclassExists(catalog, update.dataclassName)
      const current = metadata.dataClasses[update.dataclassName] ?? {}
      return {
        ...metadata,
        dataClasses: {
          ...metadata.dataClasses,
          [update.dataclassName]: {
            ...current,
            description: update.description.trim(),
          },
        },
      }
    }
    case 'attribute': {
      assertDataclassExists(catalog, update.dataclassName)
      const current = metadata.dataClasses[update.dataclassName] ?? {}
      return {
        ...metadata,
        dataClasses: {
          ...metadata.dataClasses,
          [update.dataclassName]: {
            ...current,
            attributes: {
              ...current.attributes,
              [update.attributeName]: { description: update.description.trim() },
            },
          },
        },
      }
    }
    case 'dataclass-method': {
      assertDataclassExists(catalog, update.dataclassName)
      const current = metadata.dataClasses[update.dataclassName] ?? {}
      const method = { ...current.methods?.[update.methodName] }
      if (typeof update.description === 'string') {
        method.description = update.description.trim()
      }
      if (update.clearArguments || update.arguments === null) {
        delete method.arguments
      } else if (Array.isArray(update.arguments)) {
        method.arguments = update.arguments
      }
      return {
        ...metadata,
        dataClasses: {
          ...metadata.dataClasses,
          [update.dataclassName]: {
            ...current,
            methods: {
              ...current.methods,
              [update.methodName]: method,
            },
          },
        },
      }
    }
    case 'singleton': {
      assertSingletonExists(catalog, update.singletonName)
      const current = metadata.singletons[update.singletonName] ?? {}
      return {
        ...metadata,
        singletons: {
          ...metadata.singletons,
          [update.singletonName]: {
            ...current,
            description: update.description.trim(),
          },
        },
      }
    }
    case 'singleton-method': {
      assertSingletonExists(catalog, update.singletonName)
      const current = metadata.singletons[update.singletonName] ?? {}
      const method = { ...current.methods?.[update.methodName] }
      if (typeof update.description === 'string') {
        method.description = update.description.trim()
      }
      if (update.clearArguments || update.arguments === null) {
        delete method.arguments
      } else if (Array.isArray(update.arguments)) {
        method.arguments = update.arguments
      }
      return {
        ...metadata,
        singletons: {
          ...metadata.singletons,
          [update.singletonName]: {
            ...current,
            methods: {
              ...current.methods,
              [update.methodName]: method,
            },
          },
        },
      }
    }
    case 'catalog-method': {
      const method = { ...metadata.catalogMethods[update.methodName] }
      if (typeof update.description === 'string') {
        method.description = update.description.trim()
      }
      if (update.clearArguments || update.arguments === null) {
        delete method.arguments
      } else if (Array.isArray(update.arguments)) {
        method.arguments = update.arguments
      }
      return {
        ...metadata,
        catalogMethods: {
          ...metadata.catalogMethods,
          [update.methodName]: method,
        },
      }
    }
  }
}

export function applyMetadataDescriptionUpdates(input: {
  catalog: CatalogWithMetadataExpanded
  metadata: AssistantMetadataSchema
  updates: MetadataDescriptionUpdate[]
}): { metadata: AssistantMetadataSchema; updated: number; errors: string[] } {
  let metadata = input.metadata
  let updated = 0
  const errors: string[] = []

  for (const [index, update] of input.updates.entries()) {
    try {
      metadata = applyMetadataDescriptionUpdate(metadata, input.catalog, update)
      updated++
    } catch (error) {
      errors.push(`updates[${index}]: ${error instanceof Error ? error.message : 'Invalid update'}`)
    }
  }

  return { metadata, updated, errors }
}

export function parseMetadataDescriptionUpdate(value: unknown): MetadataDescriptionUpdate | null {
  if (!isPlainObject(value) || typeof value.type !== 'string') return null

  switch (value.type) {
    case 'dataclass':
      if (typeof value.dataclassName !== 'string' || typeof value.description !== 'string') {
        return null
      }
      return {
        type: 'dataclass',
        dataclassName: value.dataclassName,
        description: value.description,
      }
    case 'attribute':
      if (
        typeof value.dataclassName !== 'string' ||
        typeof value.attributeName !== 'string' ||
        typeof value.description !== 'string'
      ) {
        return null
      }
      return {
        type: 'attribute',
        dataclassName: value.dataclassName,
        attributeName: value.attributeName,
        description: value.description,
      }
    case 'dataclass-method':
      if (typeof value.dataclassName !== 'string' || typeof value.methodName !== 'string') {
        return null
      }
      return {
        type: 'dataclass-method',
        dataclassName: value.dataclassName,
        methodName: value.methodName,
        description: typeof value.description === 'string' ? value.description : undefined,
        arguments:
          value.arguments === null
            ? null
            : (parseMethodArguments(value.arguments) ??
              (value.clearParamsSchema === true ? null : undefined)),
        clearArguments: value.clearArguments === true || value.clearParamsSchema === true,
      }
    case 'singleton':
      if (typeof value.singletonName !== 'string' || typeof value.description !== 'string') {
        return null
      }
      return {
        type: 'singleton',
        singletonName: value.singletonName,
        description: value.description,
      }
    case 'singleton-method':
      if (typeof value.singletonName !== 'string' || typeof value.methodName !== 'string') {
        return null
      }
      return {
        type: 'singleton-method',
        singletonName: value.singletonName,
        methodName: value.methodName,
        description: typeof value.description === 'string' ? value.description : undefined,
        arguments:
          value.arguments === null
            ? null
            : (parseMethodArguments(value.arguments) ??
              (value.clearParamsSchema === true ? null : undefined)),
        clearArguments: value.clearArguments === true || value.clearParamsSchema === true,
      }
    case 'catalog-method':
      if (typeof value.methodName !== 'string') return null
      return {
        type: 'catalog-method',
        methodName: value.methodName,
        description: typeof value.description === 'string' ? value.description : undefined,
        arguments:
          value.arguments === null
            ? null
            : (parseMethodArguments(value.arguments) ??
              (value.clearParamsSchema === true ? null : undefined)),
        clearArguments: value.clearArguments === true || value.clearParamsSchema === true,
      }
    default:
      return null
  }
}
