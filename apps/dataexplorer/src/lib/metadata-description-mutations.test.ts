import { describe, expect, test } from 'bun:test'
import type { CatalogWithMetadataExpanded } from '@4d/rest'
import { createEmptyMetadata, mergeCatalogIntoMetadata } from './assistant-metadata-schema'
import {
  applyMetadataDescriptionUpdates,
  clearMetadataDescriptions,
  parseMetadataDescriptionUpdate,
} from './metadata-description-mutations'

const catalog: CatalogWithMetadataExpanded = {
  dataClasses: [
    {
      name: 'User',
      collectionName: 'User',
      dataURI: '/User',
      key: [{ name: 'ID' }],
      attributes: [
        { name: 'ID', kind: 'storage', type: 'long', identifying: true },
        { name: 'name', kind: 'storage', type: 'string' },
      ],
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

describe('metadata-description-mutations', () => {
  test('clearMetadataDescriptions clears matching descriptions', () => {
    const metadata = mergeCatalogIntoMetadata(catalog, {
      ...createEmptyMetadata(),
      dataClasses: {
        User: {
          description: 'Users table',
          attributes: {
            ID: { description: 'Primary key' },
            name: { description: 'Display name' },
          },
          methods: {
            greet: { description: 'Says hello' },
          },
        },
      },
    })

    const result = clearMetadataDescriptions({
      catalog,
      metadata,
      filter: {
        includeTypes: ['dataclass', 'attribute'],
        excludeAttributes: { idLike: true },
      },
    })

    expect(result.cleared).toBe(2)
    expect(result.metadata.dataClasses.User.description).toBeUndefined()
    expect(result.metadata.dataClasses.User.attributes?.ID?.description).toBe('Primary key')
    expect(result.metadata.dataClasses.User.attributes?.name?.description).toBeUndefined()
    expect(result.metadata.dataClasses.User.methods?.greet?.description).toBe('Says hello')
  })

  test('clearMetadataDescriptions can clear all descriptions', () => {
    const metadata = mergeCatalogIntoMetadata(catalog, {
      ...createEmptyMetadata(),
      dataClasses: {
        User: {
          description: 'Users table',
          attributes: {
            name: { description: 'Display name' },
          },
        },
      },
    })

    const result = clearMetadataDescriptions({ catalog, metadata })
    expect(result.cleared).toBe(2)
    expect(result.metadata.dataClasses.User.description).toBeUndefined()
    expect(result.metadata.dataClasses.User.attributes?.name?.description).toBeUndefined()
  })

  test('applyMetadataDescriptionUpdates sets descriptions', () => {
    const metadata = mergeCatalogIntoMetadata(catalog, createEmptyMetadata())
    const result = applyMetadataDescriptionUpdates({
      catalog,
      metadata,
      updates: [
        { type: 'dataclass', dataclassName: 'User', description: 'App users' },
        {
          type: 'attribute',
          dataclassName: 'User',
          attributeName: 'name',
          description: 'Full name',
        },
      ],
    })

    expect(result.updated).toBe(2)
    expect(result.errors).toEqual([])
    expect(result.metadata.dataClasses.User.description).toBe('App users')
    expect(result.metadata.dataClasses.User.attributes?.name?.description).toBe('Full name')
  })

  test('applyMetadataDescriptionUpdates sets method arguments', () => {
    const metadata = mergeCatalogIntoMetadata(catalog, createEmptyMetadata())
    const result = applyMetadataDescriptionUpdates({
      catalog,
      metadata,
      updates: [
        {
          type: 'dataclass-method',
          dataclassName: 'User',
          methodName: 'greet',
          arguments: [{ type: 'string', description: 'Salutation' }],
        },
      ],
    })

    expect(result.updated).toBe(1)
    expect(result.metadata.dataClasses.User.methods?.greet?.arguments).toEqual([
      { type: 'string', description: 'Salutation' },
    ])
  })

  test('clearMetadataDescriptions clears method arguments when requested', () => {
    const metadata = mergeCatalogIntoMetadata(catalog, {
      ...createEmptyMetadata(),
      dataClasses: {
        User: {
          methods: {
            greet: {
              description: 'Says hello',
              arguments: [{ type: 'string' }],
            },
          },
        },
      },
    })

    const result = clearMetadataDescriptions({
      catalog,
      metadata,
      clearArguments: true,
    })

    expect(result.cleared).toBe(1)
    expect(result.metadata.dataClasses.User.methods?.greet).toBeUndefined()
  })

  test('applyMetadataDescriptionUpdates updates singletons and catalog methods', () => {
    const metadata = mergeCatalogIntoMetadata(catalog, createEmptyMetadata())
    const result = applyMetadataDescriptionUpdates({
      catalog,
      metadata,
      updates: [
        { type: 'singleton', singletonName: 'App', description: 'App singleton' },
        {
          type: 'singleton-method',
          singletonName: 'App',
          methodName: 'version',
          description: 'Returns version',
          arguments: [{ type: 'string' }],
        },
        {
          type: 'catalog-method',
          methodName: 'login',
          description: 'Logs in',
          arguments: [{ type: 'string' }],
        },
      ],
    })

    expect(result.updated).toBe(3)
    expect(result.metadata.singletons.App.description).toBe('App singleton')
    expect(result.metadata.singletons.App.methods?.version?.description).toBe('Returns version')
    expect(result.metadata.singletons.App.methods?.version?.arguments).toEqual([{ type: 'string' }])
    expect(result.metadata.catalogMethods.login?.description).toBe('Logs in')
    expect(result.metadata.catalogMethods.login?.arguments).toEqual([{ type: 'string' }])
  })

  test('applyMetadataDescriptionUpdates clears method arguments via null and clearArguments', () => {
    const metadata = mergeCatalogIntoMetadata(catalog, {
      ...createEmptyMetadata(),
      dataClasses: {
        User: {
          methods: { greet: { description: 'Hi', arguments: [{ type: 'string' }] } },
        },
      },
      singletons: {
        App: { methods: { version: { arguments: [{ type: 'number' }] } } },
      },
      catalogMethods: { login: { arguments: [{ type: 'string' }] } },
    })
    const result = applyMetadataDescriptionUpdates({
      catalog,
      metadata,
      updates: [
        { type: 'dataclass-method', dataclassName: 'User', methodName: 'greet', arguments: null },
        {
          type: 'singleton-method',
          singletonName: 'App',
          methodName: 'version',
          clearArguments: true,
        },
        { type: 'catalog-method', methodName: 'login', arguments: null },
      ],
    })

    expect(result.updated).toBe(3)
    expect(result.metadata.dataClasses.User.methods?.greet?.arguments).toBeUndefined()
    expect(result.metadata.singletons.App.methods?.version?.arguments).toBeUndefined()
    expect(result.metadata.catalogMethods.login?.arguments).toBeUndefined()
  })

  test('applyMetadataDescriptionUpdates records errors for unknown owners', () => {
    const metadata = mergeCatalogIntoMetadata(catalog, createEmptyMetadata())
    const result = applyMetadataDescriptionUpdates({
      catalog,
      metadata,
      updates: [
        { type: 'dataclass', dataclassName: 'Missing', description: 'x' },
        { type: 'singleton', singletonName: 'Missing', description: 'x' },
        {
          type: 'attribute',
          dataclassName: 'Missing',
          attributeName: 'a',
          description: 'x',
        },
      ],
    })

    expect(result.updated).toBe(0)
    expect(result.errors.length).toBe(3)
    expect(result.errors[0]).toContain('Dataclass not found: Missing')
    expect(result.errors[1]).toContain('Singleton not found: Missing')
  })

  test('clearMetadataDescriptions clears singleton and catalog method descriptions', () => {
    const metadata = mergeCatalogIntoMetadata(catalog, {
      ...createEmptyMetadata(),
      singletons: {
        App: {
          description: 'App singleton',
          methods: { version: { description: 'v' } },
        },
      },
      catalogMethods: { login: { description: 'Logs in' } },
    })

    const result = clearMetadataDescriptions({ catalog, metadata })
    expect(result.cleared).toBe(3)
    expect(result.metadata.singletons.App.description).toBeUndefined()
    expect(result.metadata.singletons.App.methods?.version).toBeUndefined()
    expect(result.metadata.catalogMethods.login).toBeUndefined()
  })

  test('clearMetadataDescriptions with onlyDescribed=false counts matched', () => {
    const metadata = mergeCatalogIntoMetadata(catalog, createEmptyMetadata())
    const result = clearMetadataDescriptions({ catalog, metadata, onlyDescribed: false })
    expect(result.cleared).toBe(0)
    expect(result.matched).toBeGreaterThan(0)
  })
})

describe('parseMetadataDescriptionUpdate', () => {
  test('returns null for non-objects and unknown types', () => {
    expect(parseMetadataDescriptionUpdate(null)).toBeNull()
    expect(parseMetadataDescriptionUpdate('x')).toBeNull()
    expect(parseMetadataDescriptionUpdate({})).toBeNull()
    expect(parseMetadataDescriptionUpdate({ type: 'unknown' })).toBeNull()
  })

  test('parses dataclass update', () => {
    expect(
      parseMetadataDescriptionUpdate({ type: 'dataclass', dataclassName: 'User', description: 'd' })
    ).toEqual({ type: 'dataclass', dataclassName: 'User', description: 'd' })
    expect(parseMetadataDescriptionUpdate({ type: 'dataclass', dataclassName: 'User' })).toBeNull()
  })

  test('parses attribute update', () => {
    expect(
      parseMetadataDescriptionUpdate({
        type: 'attribute',
        dataclassName: 'User',
        attributeName: 'name',
        description: 'd',
      })
    ).toEqual({
      type: 'attribute',
      dataclassName: 'User',
      attributeName: 'name',
      description: 'd',
    })
    expect(
      parseMetadataDescriptionUpdate({ type: 'attribute', dataclassName: 'User', description: 'd' })
    ).toBeNull()
  })

  test('parses dataclass-method update with arguments and clear flags', () => {
    expect(
      parseMetadataDescriptionUpdate({
        type: 'dataclass-method',
        dataclassName: 'User',
        methodName: 'greet',
        description: 'd',
        arguments: [{ type: 'string' }],
      })
    ).toMatchObject({ type: 'dataclass-method', methodName: 'greet', description: 'd' })

    expect(
      parseMetadataDescriptionUpdate({
        type: 'dataclass-method',
        dataclassName: 'User',
        methodName: 'greet',
        arguments: null,
      })
    ).toMatchObject({ arguments: null })

    expect(
      parseMetadataDescriptionUpdate({
        type: 'dataclass-method',
        dataclassName: 'User',
        methodName: 'greet',
        clearParamsSchema: true,
      })
    ).toMatchObject({ clearArguments: true })

    expect(
      parseMetadataDescriptionUpdate({ type: 'dataclass-method', dataclassName: 'User' })
    ).toBeNull()
  })

  test('parses singleton and singleton-method updates', () => {
    expect(
      parseMetadataDescriptionUpdate({
        type: 'singleton',
        singletonName: 'App',
        description: 'd',
      })
    ).toEqual({ type: 'singleton', singletonName: 'App', description: 'd' })
    expect(parseMetadataDescriptionUpdate({ type: 'singleton', singletonName: 'App' })).toBeNull()

    expect(
      parseMetadataDescriptionUpdate({
        type: 'singleton-method',
        singletonName: 'App',
        methodName: 'version',
        description: 'd',
      })
    ).toMatchObject({ type: 'singleton-method', methodName: 'version' })
    expect(
      parseMetadataDescriptionUpdate({ type: 'singleton-method', singletonName: 'App' })
    ).toBeNull()
  })

  test('parses catalog-method update', () => {
    expect(
      parseMetadataDescriptionUpdate({
        type: 'catalog-method',
        methodName: 'login',
        description: 'd',
      })
    ).toMatchObject({ type: 'catalog-method', methodName: 'login', description: 'd' })
    expect(parseMetadataDescriptionUpdate({ type: 'catalog-method' })).toBeNull()
  })
})
