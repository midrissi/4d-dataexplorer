import type { CatalogWithMetadataExpanded } from '@4d/rest'
import { filterAssistantExposedMethods } from './assistant-exposed-method'
import type { AssistantMetadataSchema } from './assistant-metadata-schema'
import type { DescriptionTaskFilter } from './description-task-filter'
import { filterDescriptionTasks } from './description-task-filter'
import {
  generateAttributeDescription,
  generateDataclassDescription,
  generateMethodDescription,
  generateSingletonDescription,
} from './generate-metadata-description'

export type DescriptionTask =
  | { type: 'dataclass'; dataclassName: string; label: string }
  | { type: 'attribute'; dataclassName: string; attributeName: string; label: string }
  | {
      type: 'dataclass-method'
      dataclassName: string
      methodName: string
      label: string
    }
  | { type: 'singleton'; singletonName: string; label: string }
  | {
      type: 'singleton-method'
      singletonName: string
      methodName: string
      label: string
    }
  | { type: 'catalog-method'; methodName: string; label: string }

function isEmptyDescription(value: string | undefined): boolean {
  return !value?.trim()
}

export type { AttributeExclusionFilter, DescriptionTaskFilter } from './description-task-filter'

export function collectDescriptionTasks(
  catalog: CatalogWithMetadataExpanded,
  metadata: AssistantMetadataSchema,
  onlyMissing = true,
  filter?: DescriptionTaskFilter
): DescriptionTask[] {
  const tasks: DescriptionTask[] = []
  const seenSingletons = new Set<string>()

  for (const dc of catalog.dataClasses ?? []) {
    const dcMeta = metadata.dataClasses[dc.name]
    if (!onlyMissing || isEmptyDescription(dcMeta?.description)) {
      tasks.push({
        type: 'dataclass',
        dataclassName: dc.name,
        label: dc.name,
      })
    }

    for (const attr of dc.attributes ?? []) {
      const desc = dcMeta?.attributes?.[attr.name]?.description
      if (!onlyMissing || isEmptyDescription(desc)) {
        tasks.push({
          type: 'attribute',
          dataclassName: dc.name,
          attributeName: attr.name,
          label: `${dc.name}.${attr.name}`,
        })
      }
    }

    const seenMethods = new Set<string>()
    for (const method of filterAssistantExposedMethods(dc.methods)) {
      if (!method.name || seenMethods.has(method.name)) continue
      seenMethods.add(method.name)
      const desc = dcMeta?.methods?.[method.name]?.description
      if (!onlyMissing || isEmptyDescription(desc)) {
        tasks.push({
          type: 'dataclass-method',
          dataclassName: dc.name,
          methodName: method.name,
          label: `${dc.name}.${method.name}`,
        })
      }
    }
  }

  for (const singleton of catalog.singletons ?? []) {
    if (seenSingletons.has(singleton.name)) continue
    seenSingletons.add(singleton.name)

    const sMeta = metadata.singletons[singleton.name]
    if (!onlyMissing || isEmptyDescription(sMeta?.description)) {
      tasks.push({
        type: 'singleton',
        singletonName: singleton.name,
        label: singleton.name,
      })
    }

    const seenMethods = new Set<string>()
    for (const method of filterAssistantExposedMethods(singleton.methods)) {
      if (!method.name || seenMethods.has(method.name)) continue
      seenMethods.add(method.name)
      const desc = sMeta?.methods?.[method.name]?.description
      if (!onlyMissing || isEmptyDescription(desc)) {
        tasks.push({
          type: 'singleton-method',
          singletonName: singleton.name,
          methodName: method.name,
          label: `${singleton.name}.${method.name}`,
        })
      }
    }
  }

  const seenCatalogMethods = new Set<string>()
  for (const method of filterAssistantExposedMethods(catalog.methods)) {
    if (!method.name || seenCatalogMethods.has(method.name)) continue
    seenCatalogMethods.add(method.name)
    const desc = metadata.catalogMethods[method.name]?.description
    if (!onlyMissing || isEmptyDescription(desc)) {
      tasks.push({
        type: 'catalog-method',
        methodName: method.name,
        label: method.name,
      })
    }
  }

  return filterDescriptionTasks(tasks, catalog, filter)
}

export function countMissingDescriptions(
  catalog: CatalogWithMetadataExpanded,
  metadata: AssistantMetadataSchema,
  filter?: DescriptionTaskFilter
): number {
  return collectDescriptionTasks(catalog, metadata, true, filter).length
}

function applyDescriptionTask(
  metadata: AssistantMetadataSchema,
  task: DescriptionTask,
  description: string
): AssistantMetadataSchema {
  switch (task.type) {
    case 'dataclass':
      return {
        ...metadata,
        dataClasses: {
          ...metadata.dataClasses,
          [task.dataclassName]: {
            ...metadata.dataClasses[task.dataclassName],
            description,
          },
        },
      }
    case 'attribute':
      return {
        ...metadata,
        dataClasses: {
          ...metadata.dataClasses,
          [task.dataclassName]: {
            ...metadata.dataClasses[task.dataclassName],
            attributes: {
              ...metadata.dataClasses[task.dataclassName]?.attributes,
              [task.attributeName]: { description },
            },
          },
        },
      }
    case 'dataclass-method':
      return {
        ...metadata,
        dataClasses: {
          ...metadata.dataClasses,
          [task.dataclassName]: {
            ...metadata.dataClasses[task.dataclassName],
            methods: {
              ...metadata.dataClasses[task.dataclassName]?.methods,
              [task.methodName]: {
                ...metadata.dataClasses[task.dataclassName]?.methods?.[task.methodName],
                description,
              },
            },
          },
        },
      }
    case 'singleton':
      return {
        ...metadata,
        singletons: {
          ...metadata.singletons,
          [task.singletonName]: {
            ...metadata.singletons[task.singletonName],
            description,
          },
        },
      }
    case 'singleton-method':
      return {
        ...metadata,
        singletons: {
          ...metadata.singletons,
          [task.singletonName]: {
            ...metadata.singletons[task.singletonName],
            methods: {
              ...metadata.singletons[task.singletonName]?.methods,
              [task.methodName]: {
                ...metadata.singletons[task.singletonName]?.methods?.[task.methodName],
                description,
              },
            },
          },
        },
      }
    case 'catalog-method':
      return {
        ...metadata,
        catalogMethods: {
          ...metadata.catalogMethods,
          [task.methodName]: {
            ...metadata.catalogMethods[task.methodName],
            description,
          },
        },
      }
  }
}

async function runDescriptionTask(
  catalog: CatalogWithMetadataExpanded,
  task: DescriptionTask,
  signal?: AbortSignal
): Promise<string> {
  switch (task.type) {
    case 'dataclass':
      return generateDataclassDescription({
        catalog,
        dataclassName: task.dataclassName,
        signal,
      })
    case 'attribute':
      return generateAttributeDescription({
        catalog,
        dataclassName: task.dataclassName,
        attributeName: task.attributeName,
        signal,
      })
    case 'dataclass-method':
      return generateMethodDescription({
        catalog,
        context: 'dataclass',
        ownerName: task.dataclassName,
        methodName: task.methodName,
        signal,
      })
    case 'singleton':
      return generateSingletonDescription({
        catalog,
        singletonName: task.singletonName,
        signal,
      })
    case 'singleton-method':
      return generateMethodDescription({
        catalog,
        context: 'singleton',
        ownerName: task.singletonName,
        methodName: task.methodName,
        signal,
      })
    case 'catalog-method':
      return generateMethodDescription({
        catalog,
        context: 'catalog',
        ownerName: task.methodName,
        methodName: task.methodName,
        signal,
      })
  }
}

export type GenerateAllDescriptionsProgress = {
  current: number
  total: number
  task: DescriptionTask
}

export type GenerateAllDescriptionsResult = {
  metadata: AssistantMetadataSchema
  generated: number
  failed: number
  cancelled: boolean
}

export async function generateAllMetadataDescriptions(input: {
  catalog: CatalogWithMetadataExpanded
  metadata: AssistantMetadataSchema
  onlyMissing?: boolean
  filter?: DescriptionTaskFilter
  signal?: AbortSignal
  onProgress?: (progress: GenerateAllDescriptionsProgress) => void
  onMetadataUpdate?: (metadata: AssistantMetadataSchema) => void
}): Promise<GenerateAllDescriptionsResult> {
  const tasks = collectDescriptionTasks(
    input.catalog,
    input.metadata,
    input.onlyMissing ?? true,
    input.filter
  )
  let metadata = input.metadata
  let generated = 0
  let failed = 0
  let cancelled = false

  for (let index = 0; index < tasks.length; index++) {
    if (input.signal?.aborted) {
      cancelled = true
      break
    }

    const task = tasks[index]
    input.onProgress?.({ current: index + 1, total: tasks.length, task })

    try {
      const description = await runDescriptionTask(input.catalog, task, input.signal)
      metadata = applyDescriptionTask(metadata, task, description)
      generated++
      input.onMetadataUpdate?.(metadata)
    } catch (error) {
      if (input.signal?.aborted) {
        cancelled = true
        break
      }
      failed++
      console.warn('Failed to generate metadata description', task, error)
    }
  }

  return { metadata, generated, failed, cancelled }
}
