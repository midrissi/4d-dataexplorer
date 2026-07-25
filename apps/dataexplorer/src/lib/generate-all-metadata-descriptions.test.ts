import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { CatalogWithMetadataExpanded } from '@4d/rest'
import { createEmptyMetadata } from './assistant-metadata-schema'
import {
  collectDescriptionTasks,
  countMissingDescriptions,
  generateAllMetadataDescriptions,
} from './generate-all-metadata-descriptions'
import { configureTestLlm, mockLlmFetch, unconfigureTestLlm } from './metadata-llm.test-helper'

const catalog: CatalogWithMetadataExpanded = {
  dataClasses: [
    {
      name: 'User',
      collectionName: 'User',
      dataURI: '/User',
      attributes: [{ name: 'name', kind: 'storage', type: 'string' }],
      methods: [{ name: 'greet', applyTo: 'entity', exposed: true }],
    },
  ],
  singletons: [
    {
      name: 'App',
      exposed: true,
      methods: [{ name: 'version', exposed: true }],
    },
  ],
  methods: [{ name: 'login', exposed: true }],
}

describe('generate-all-metadata-descriptions', () => {
  test('collectDescriptionTasks finds all empty descriptions', () => {
    const metadata = createEmptyMetadata()
    metadata.dataClasses = {
      User: {
        description: 'Users',
        attributes: { name: {} },
        methods: { greet: {} },
      },
    }

    const tasks = collectDescriptionTasks(catalog, metadata, true)
    expect(tasks.some((t) => t.type === 'dataclass' && t.dataclassName === 'User')).toBe(false)
    expect(tasks.some((t) => t.type === 'attribute')).toBe(true)
    expect(tasks.some((t) => t.type === 'singleton')).toBe(true)
    expect(tasks.some((t) => t.type === 'catalog-method')).toBe(true)
  })

  test('countMissingDescriptions matches collect length', () => {
    const metadata = createEmptyMetadata()
    expect(countMissingDescriptions(catalog, metadata)).toBe(
      collectDescriptionTasks(catalog, metadata, true).length
    )
  })

  test('collectDescriptionTasks with onlyMissing=false includes everything', () => {
    const metadata = createEmptyMetadata()
    metadata.dataClasses = { User: { description: 'Users' } }
    const tasks = collectDescriptionTasks(catalog, metadata, false)
    expect(tasks.some((t) => t.type === 'dataclass')).toBe(true)
  })
})

describe('generateAllMetadataDescriptions', () => {
  let restore: () => void = () => {}

  beforeEach(() => {
    configureTestLlm()
  })

  afterEach(() => {
    restore()
    restore = () => {}
    unconfigureTestLlm()
  })

  function setLlm(content: string | ((call: { body: unknown }) => string)) {
    const m = mockLlmFetch(content as (call: { url: string; body: unknown }) => string)
    restore = m.restore
    return m
  }

  test('generates descriptions for every task type and reports progress', async () => {
    setLlm('Generated description.')
    const metadata = createEmptyMetadata()
    const progress: number[] = []
    const updates: number[] = []

    const result = await generateAllMetadataDescriptions({
      catalog,
      metadata,
      onProgress: (p) => progress.push(p.current),
      onMetadataUpdate: () => updates.push(1),
    })

    const total = collectDescriptionTasks(catalog, metadata, true).length
    expect(result.generated).toBe(total)
    expect(result.failed).toBe(0)
    expect(result.cancelled).toBe(false)
    expect(progress.length).toBe(total)
    expect(updates.length).toBe(total)
    // every applyDescriptionTask branch populates the description
    expect(result.metadata.dataClasses.User?.description).toBe('Generated description.')
    expect(result.metadata.dataClasses.User?.attributes?.name?.description).toBe(
      'Generated description.'
    )
    expect(result.metadata.dataClasses.User?.methods?.greet?.description).toBe(
      'Generated description.'
    )
    expect(result.metadata.singletons.App?.description).toBe('Generated description.')
    expect(result.metadata.singletons.App?.methods?.version?.description).toBe(
      'Generated description.'
    )
    expect(result.metadata.catalogMethods.login?.description).toBe('Generated description.')
  })

  test('counts failures when generation throws', async () => {
    // Empty completion content makes completeDescription throw for description tasks.
    setLlm('   ')
    const metadata = createEmptyMetadata()
    const result = await generateAllMetadataDescriptions({ catalog, metadata })
    const total = collectDescriptionTasks(catalog, metadata, true).length
    expect(result.failed).toBe(total)
    expect(result.generated).toBe(0)
  })

  test('returns cancelled when signal already aborted', async () => {
    setLlm('x')
    const controller = new AbortController()
    controller.abort()
    const metadata = createEmptyMetadata()
    const result = await generateAllMetadataDescriptions({
      catalog,
      metadata,
      signal: controller.signal,
    })
    expect(result.cancelled).toBe(true)
    expect(result.generated).toBe(0)
  })

  test('cancels mid-run when signal aborts during processing', async () => {
    setLlm('Generated description.')
    const controller = new AbortController()
    const metadata = createEmptyMetadata()
    const result = await generateAllMetadataDescriptions({
      catalog,
      metadata,
      signal: controller.signal,
      onMetadataUpdate: () => controller.abort(),
    })
    expect(result.cancelled).toBe(true)
    expect(result.generated).toBeGreaterThanOrEqual(1)
  })
})
