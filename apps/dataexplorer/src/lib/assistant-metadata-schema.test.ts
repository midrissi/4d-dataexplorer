import { describe, expect, test } from 'bun:test'
import type { CatalogWithMetadataExpanded } from '@4d/rest'
import {
  ASSISTANT_METADATA_VERSION,
  createEmptyMetadata,
  formatMetadataForSystemPrompt,
  hasMetadataContent,
  mergeCatalogIntoMetadata,
  parseMetadataSchema,
  sanitizeMetadataFilename,
  touchMetadata,
} from './assistant-metadata-schema'
import { getMetadataExportFilename } from './export-metadata-schema'

const sampleCatalog: CatalogWithMetadataExpanded = {
  __NAME: 'My Database',
  dataClasses: [
    {
      name: 'User',
      collectionName: 'User',
      dataURI: '/User',
      attributes: [
        { name: 'firstname', kind: 'storage', type: 'string' },
        { name: 'lastname', kind: 'storage', type: 'string' },
      ],
      methods: [
        {
          name: 'getFullName',
          applyTo: 'entity',
          exposed: true,
          paramsText: 'getFullName() : Text',
        },
      ],
    },
  ],
  singletons: [
    {
      name: 'Info',
      exposed: true,
      methods: [{ name: 'version', exposed: true, paramsText: 'version() : Text' }],
    },
  ],
  methods: [{ name: 'authentify', exposed: true, paramsText: 'authentify($user : Text) : bool' }],
}

describe('assistant-metadata-schema', () => {
  test('createEmptyMetadata sets version and empty sections', () => {
    const empty = createEmptyMetadata('Test')
    expect(empty.version).toBe(ASSISTANT_METADATA_VERSION)
    expect(empty.databaseName).toBe('Test')
    expect(empty.dataClasses).toEqual({})
  })

  test('mergeCatalogIntoMetadata seeds structure and preserves edits', () => {
    const existing = createEmptyMetadata('Old')
    existing.dataClasses = {
      User: {
        description: 'App users',
        attributes: { firstname: { description: 'Given name' } },
        methods: { getFullName: { description: 'Returns full name' } },
      },
    }

    const merged = mergeCatalogIntoMetadata(sampleCatalog, existing)
    expect(merged.databaseName).toBe('My Database')
    expect(merged.dataClasses.User.description).toBe('App users')
    expect(merged.dataClasses.User.attributes?.firstname.description).toBe('Given name')
    expect(merged.dataClasses.User.attributes?.lastname).toBeDefined()
    expect(merged.singletons.Info).toBeDefined()
    expect(merged.catalogMethods.authentify).toBeDefined()
  })

  test('mergeCatalogIntoMetadata excludes publicOnServer methods', () => {
    const catalogWithInternal: CatalogWithMetadataExpanded = {
      ...sampleCatalog,
      dataClasses: [
        {
          ...sampleCatalog.dataClasses[0],
          methods: [
            {
              name: 'getFullName',
              applyTo: 'entity',
              exposed: true,
              paramsText: 'getFullName() : Text',
            },
            { name: '_embeddingClient', applyTo: 'entity', scope: 'publicOnServer' },
          ],
        },
      ],
    }

    const existing = createEmptyMetadata()
    existing.dataClasses = {
      User: {
        methods: {
          getFullName: { description: 'Public method' },
          _embeddingClient: { description: 'Should be removed' },
        },
      },
    }

    const merged = mergeCatalogIntoMetadata(catalogWithInternal, existing)
    expect(merged.dataClasses.User.methods?.getFullName?.description).toBe('Public method')
    expect(merged.dataClasses.User.methods?._embeddingClient).toBeUndefined()
  })

  test('parseMetadataSchema validates version', () => {
    expect(
      parseMetadataSchema({ version: 2, dataClasses: {}, singletons: {}, catalogMethods: {} })
    ).toBeNull()
    const valid = parseMetadataSchema({
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      dataClasses: { User: { description: 'Users' } },
      singletons: {},
      catalogMethods: {},
    })
    expect(valid?.dataClasses.User.description).toBe('Users')
  })

  test('formatMetadataForSystemPrompt omits empty metadata', () => {
    expect(formatMetadataForSystemPrompt(createEmptyMetadata())).toBe('')
    const withContent = mergeCatalogIntoMetadata(sampleCatalog, {
      ...createEmptyMetadata(),
      dataClasses: {
        User: { description: 'Users table' },
      },
    })
    const prompt = formatMetadataForSystemPrompt(withContent)
    expect(prompt).toContain('## Database metadata')
    expect(prompt).toContain('Users table')
  })

  test('parseMetadataSchema migrates prefixItems paramsSchema to arguments', () => {
    const valid = parseMetadataSchema({
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      dataClasses: {
        User: {
          methods: {
            searchByDescription: {
              description: 'Semantic search',
              paramsSchema: {
                type: 'array',
                prefixItems: [
                  { type: 'string', description: 'Query' },
                  { type: 'integer', minimum: 1 },
                ],
                minItems: 2,
                maxItems: 2,
              },
            },
          },
        },
      },
      singletons: {},
      catalogMethods: {},
    })
    expect(valid?.dataClasses.User.methods?.searchByDescription?.arguments).toEqual([
      { type: 'string', description: 'Query' },
      { type: 'integer', minimum: 1 },
    ])
  })

  test('formatMetadataForSystemPrompt includes arguments', () => {
    const withContent = mergeCatalogIntoMetadata(sampleCatalog, {
      ...createEmptyMetadata(),
      dataClasses: {
        User: {
          methods: {
            getFullName: {
              arguments: [{ type: 'string', description: 'Format' }],
            },
          },
        },
      },
    })
    const prompt = formatMetadataForSystemPrompt(withContent)
    expect(prompt).toContain('"arguments"')
    expect(prompt).toContain('Format')
  })

  test('sanitizeMetadataFilename produces safe basename', () => {
    expect(sanitizeMetadataFilename('My Database!')).toBe('My-Database')
    expect(getMetadataExportFilename('My Database')).toBe('My-Database.metadata-schema.json')
  })
})

describe('assistant-metadata-schema parsing edge cases', () => {
  test('parseMetadataSchema parses singletons and catalog methods with paramsSchema migration', () => {
    const parsed = parseMetadataSchema({
      version: 1,
      databaseName: 'DB',
      updatedAt: '2026-01-01T00:00:00.000Z',
      dataClasses: {
        User: {
          description: 'Users',
          attributes: {
            firstname: { description: 'Given name' },
            invalid: 'not-an-object',
            blank: {},
          },
          methods: { greet: { description: 'Says hi' }, broken: 'nope' },
        },
        notObject: 'skip',
      },
      singletons: {
        Info: {
          description: 'Info singleton',
          methods: {
            version: {
              paramsSchema: {
                type: 'array',
                prefixItems: [{ type: 'string' }],
                minItems: 1,
                maxItems: 1,
              },
            },
          },
        },
        bad: 42,
      },
      catalogMethods: {
        login: { description: 'Logs in' },
        broken: null,
      },
    })

    expect(parsed?.databaseName).toBe('DB')
    expect(parsed?.dataClasses.User.attributes?.firstname.description).toBe('Given name')
    expect(parsed?.dataClasses.User.attributes?.invalid).toBeUndefined()
    expect(parsed?.dataClasses.notObject).toBeUndefined()
    expect(parsed?.dataClasses.User.methods?.greet?.description).toBe('Says hi')
    expect(parsed?.singletons.Info.description).toBe('Info singleton')
    expect(parsed?.singletons.Info.methods?.version?.arguments).toEqual([{ type: 'string' }])
    expect(parsed?.singletons.bad).toBeUndefined()
    expect(parsed?.catalogMethods.login?.description).toBe('Logs in')
  })

  test('parseMetadataSchema rejects non-objects and defaults updatedAt', () => {
    expect(parseMetadataSchema(null)).toBeNull()
    expect(parseMetadataSchema('string')).toBeNull()
    const parsed = parseMetadataSchema({
      version: 1,
      dataClasses: {},
      singletons: {},
      catalogMethods: {},
    })
    expect(typeof parsed?.updatedAt).toBe('string')
  })

  test('hasMetadataContent reflects whether any documentation exists', () => {
    expect(hasMetadataContent(null)).toBe(false)
    expect(hasMetadataContent(undefined)).toBe(false)
    expect(hasMetadataContent(createEmptyMetadata())).toBe(false)
    const withContent = {
      ...createEmptyMetadata(),
      dataClasses: { User: { description: 'Users' } },
    }
    expect(hasMetadataContent(withContent)).toBe(true)
  })

  test('touchMetadata refreshes updatedAt', () => {
    const original = { ...createEmptyMetadata(), updatedAt: '2000-01-01T00:00:00.000Z' }
    const touched = touchMetadata(original)
    expect(touched.updatedAt).not.toBe(original.updatedAt)
    expect(touched.dataClasses).toEqual(original.dataClasses)
  })

  test('sanitizeMetadataFilename falls back to database for empty input', () => {
    expect(sanitizeMetadataFilename('')).toBe('database')
    expect(sanitizeMetadataFilename('***')).toBe('database')
  })
})
