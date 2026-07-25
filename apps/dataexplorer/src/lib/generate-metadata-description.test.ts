import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { CatalogWithMetadataExpanded } from '@4d/rest'
import {
  generateAttributeDescription,
  generateDataclassDescription,
  generateMethodArguments,
  generateMethodDescription,
  generateMethodParamsSchema,
  generateSingletonDescription,
} from './generate-metadata-description'
import { configureTestLlm, mockLlmFetch, unconfigureTestLlm } from './metadata-llm.test-helper'

const catalog: CatalogWithMetadataExpanded = {
  dataClasses: [
    {
      name: 'User',
      collectionName: 'Users',
      dataURI: '/User',
      attributes: [{ name: 'name', kind: 'storage', type: 'string', indexed: true, unique: false }],
      methods: [{ name: 'greet', applyTo: 'entity', exposed: true, paramsText: '$1 : Text' }],
    },
  ],
  singletons: [
    {
      name: 'App',
      exposed: true,
      methods: [{ name: 'version', exposed: true, paramsText: '' }],
    },
  ],
  methods: [{ name: 'login', exposed: true, paramsText: '$1 : Text' }],
}

let restore: () => void = () => {}

beforeEach(() => {
  configureTestLlm()
})

afterEach(() => {
  restore()
  restore = () => {}
  unconfigureTestLlm()
})

function setLlm(content: string) {
  const m = mockLlmFetch(content)
  restore = m.restore
  return m
}

describe('generate-metadata-description', () => {
  describe('when LLM not configured', () => {
    test('all generators throw', async () => {
      unconfigureTestLlm()
      await expect(
        generateDataclassDescription({ catalog, dataclassName: 'User' })
      ).rejects.toThrow('LLM not configured')
      await expect(
        generateAttributeDescription({
          catalog,
          dataclassName: 'User',
          attributeName: 'name',
        })
      ).rejects.toThrow('LLM not configured')
      await expect(generateSingletonDescription({ catalog, singletonName: 'App' })).rejects.toThrow(
        'LLM not configured'
      )
      await expect(
        generateMethodDescription({
          catalog,
          context: 'dataclass',
          ownerName: 'User',
          methodName: 'greet',
        })
      ).rejects.toThrow('LLM not configured')
      await expect(
        generateMethodArguments({
          catalog,
          context: 'dataclass',
          ownerName: 'User',
          methodName: 'greet',
        })
      ).rejects.toThrow('LLM not configured')
    })
  })

  describe('generateDataclassDescription', () => {
    test('returns trimmed description and strips wrapping quotes', async () => {
      setLlm('"Stores application users."')
      const result = await generateDataclassDescription({ catalog, dataclassName: 'User' })
      expect(result).toBe('Stores application users.')
    })

    test('throws when dataclass missing', async () => {
      setLlm('x')
      await expect(
        generateDataclassDescription({ catalog, dataclassName: 'Nope' })
      ).rejects.toThrow('Dataclass not found: Nope')
    })

    test('throws on empty completion', async () => {
      setLlm('   ')
      await expect(
        generateDataclassDescription({ catalog, dataclassName: 'User' })
      ).rejects.toThrow('LLM returned empty description')
    })
  })

  describe('generateAttributeDescription', () => {
    test('returns description', async () => {
      setLlm('The display name.')
      const result = await generateAttributeDescription({
        catalog,
        dataclassName: 'User',
        attributeName: 'name',
      })
      expect(result).toBe('The display name.')
    })

    test('throws when attribute missing', async () => {
      setLlm('x')
      await expect(
        generateAttributeDescription({
          catalog,
          dataclassName: 'User',
          attributeName: 'missing',
        })
      ).rejects.toThrow('Attribute not found')
    })

    test('throws when dataclass missing', async () => {
      setLlm('x')
      await expect(
        generateAttributeDescription({
          catalog,
          dataclassName: 'Nope',
          attributeName: 'name',
        })
      ).rejects.toThrow('Attribute not found')
    })
  })

  describe('generateSingletonDescription', () => {
    test('returns description', async () => {
      setLlm('Application singleton.')
      const result = await generateSingletonDescription({ catalog, singletonName: 'App' })
      expect(result).toBe('Application singleton.')
    })

    test('throws when singleton missing', async () => {
      setLlm('x')
      await expect(
        generateSingletonDescription({ catalog, singletonName: 'Nope' })
      ).rejects.toThrow('Singleton not found: Nope')
    })
  })

  describe('generateMethodDescription', () => {
    test('dataclass context', async () => {
      setLlm('Greets the user.')
      const result = await generateMethodDescription({
        catalog,
        context: 'dataclass',
        ownerName: 'User',
        methodName: 'greet',
      })
      expect(result).toBe('Greets the user.')
    })

    test('singleton context', async () => {
      setLlm('Returns the version.')
      const result = await generateMethodDescription({
        catalog,
        context: 'singleton',
        ownerName: 'App',
        methodName: 'version',
      })
      expect(result).toBe('Returns the version.')
    })

    test('catalog context', async () => {
      setLlm('Logs in.')
      const result = await generateMethodDescription({
        catalog,
        context: 'catalog',
        ownerName: '',
        methodName: 'login',
      })
      expect(result).toBe('Logs in.')
    })

    test('throws when dataclass method missing', async () => {
      setLlm('x')
      await expect(
        generateMethodDescription({
          catalog,
          context: 'dataclass',
          ownerName: 'User',
          methodName: 'nope',
        })
      ).rejects.toThrow('Method not found')
    })

    test('throws when singleton method missing', async () => {
      setLlm('x')
      await expect(
        generateMethodDescription({
          catalog,
          context: 'singleton',
          ownerName: 'App',
          methodName: 'nope',
        })
      ).rejects.toThrow('Method not found')
    })

    test('throws when catalog method missing', async () => {
      setLlm('x')
      await expect(
        generateMethodDescription({
          catalog,
          context: 'catalog',
          ownerName: '',
          methodName: 'nope',
        })
      ).rejects.toThrow('Method not found')
    })
  })

  describe('generateMethodArguments', () => {
    test('parses json object response', async () => {
      setLlm(JSON.stringify({ arguments: [{ type: 'string', description: 'name' }] }))
      const result = await generateMethodArguments({
        catalog,
        context: 'dataclass',
        ownerName: 'User',
        methodName: 'greet',
      })
      expect(result).toEqual([{ type: 'string', description: 'name' }])
    })

    test('parses json fenced response and filters invalid entries', async () => {
      setLlm(
        '```json\n' +
          JSON.stringify({
            arguments: [
              { type: 'string' },
              { description: 'no type' },
              null,
              ['array'],
              { type: 123 },
            ],
          }) +
          '\n```'
      )
      const result = await generateMethodArguments({
        catalog,
        context: 'singleton',
        ownerName: 'App',
        methodName: 'version',
      })
      expect(result).toEqual([{ type: 'string' }])
    })

    test('catalog context', async () => {
      setLlm(JSON.stringify({ arguments: [] }))
      const result = await generateMethodArguments({
        catalog,
        context: 'catalog',
        ownerName: '',
        methodName: 'login',
      })
      expect(result).toEqual([])
    })

    test('throws when arguments not an array', async () => {
      setLlm(JSON.stringify({ arguments: 'nope' }))
      await expect(
        generateMethodArguments({
          catalog,
          context: 'dataclass',
          ownerName: 'User',
          methodName: 'greet',
        })
      ).rejects.toThrow('LLM returned invalid arguments array')
    })

    test('throws when response is not a json object', async () => {
      setLlm(JSON.stringify(['not', 'object']))
      await expect(
        generateMethodArguments({
          catalog,
          context: 'dataclass',
          ownerName: 'User',
          methodName: 'greet',
        })
      ).rejects.toThrow('LLM returned invalid JSON object')
    })

    test('throws when method missing in each context', async () => {
      setLlm(JSON.stringify({ arguments: [] }))
      await expect(
        generateMethodArguments({
          catalog,
          context: 'dataclass',
          ownerName: 'User',
          methodName: 'nope',
        })
      ).rejects.toThrow('Method not found')
      await expect(
        generateMethodArguments({
          catalog,
          context: 'singleton',
          ownerName: 'App',
          methodName: 'nope',
        })
      ).rejects.toThrow('Method not found')
      await expect(
        generateMethodArguments({
          catalog,
          context: 'catalog',
          ownerName: '',
          methodName: 'nope',
        })
      ).rejects.toThrow('Method not found')
    })
  })

  describe('generateMethodParamsSchema (deprecated)', () => {
    test('wraps generateMethodArguments result', async () => {
      setLlm(JSON.stringify({ arguments: [{ type: 'integer' }] }))
      const result = await generateMethodParamsSchema({
        catalog,
        context: 'dataclass',
        ownerName: 'User',
        methodName: 'greet',
      })
      expect(result).toEqual({ arguments: [{ type: 'integer' }] })
    })
  })
})
