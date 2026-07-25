import { describe, expect, test } from 'bun:test'
import type { CatalogAllResponse } from '@4d/rest'
import { buildStaticAiModalPromptExamples } from './ai-modal-prompt-examples'

const catalog = {
  dataClasses: [
    {
      name: 'Car',
      collectionName: 'Cars',
      dataURI: '/rest/Car',
      attributes: [
        { name: 'model', kind: 'storage', type: 'string' },
        { name: 'agency', kind: 'relatedEntity', type: 'Agency' },
        { name: 'created', kind: 'storage', type: 'date' },
      ],
    },
  ],
} as CatalogAllResponse

describe('buildStaticAiModalPromptExamples', () => {
  test('query examples use string and relation attributes from schema', () => {
    const examples = buildStaticAiModalPromptExamples('query', 'Car', catalog)
    expect(examples).toHaveLength(3)
    expect(examples[0]?.prompt).toContain('model')
    expect(examples[2]?.prompt).toContain('agency')
  })

  test('ask and generate return three prompts', () => {
    expect(buildStaticAiModalPromptExamples('ask', 'Car', catalog)).toHaveLength(3)
    expect(buildStaticAiModalPromptExamples('generate', 'Car', catalog)).toHaveLength(3)
  })
})
