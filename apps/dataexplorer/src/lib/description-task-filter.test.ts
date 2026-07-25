import { describe, expect, test } from 'bun:test'
import type { CatalogWithMetadataExpanded } from '@4d/rest'
import {
  filterDescriptionTasks,
  isIdLikeAttribute,
  isOptionalAttributeDescription,
  shouldExcludeAttribute,
} from './description-task-filter'
import type { DescriptionTask } from './generate-all-metadata-descriptions'

const catalog: CatalogWithMetadataExpanded = {
  dataClasses: [
    {
      name: 'Employee',
      collectionName: 'Employee',
      dataURI: '/Employee',
      key: [{ name: 'ID' }],
      attributes: [
        { name: 'ID', kind: 'storage', type: 'long', identifying: true },
        { name: 'firstname', kind: 'storage', type: 'string' },
        { name: 'companyID', kind: 'storage', type: 'long' },
        { name: 'notes', kind: 'storage', type: 'string' },
      ],
    },
  ],
}

const tasks: DescriptionTask[] = [
  { type: 'dataclass', dataclassName: 'Employee', label: 'Employee' },
  { type: 'attribute', dataclassName: 'Employee', attributeName: 'ID', label: 'Employee.ID' },
  {
    type: 'attribute',
    dataclassName: 'Employee',
    attributeName: 'firstname',
    label: 'Employee.firstname',
  },
  {
    type: 'attribute',
    dataclassName: 'Employee',
    attributeName: 'companyID',
    label: 'Employee.companyID',
  },
  {
    type: 'attribute',
    dataclassName: 'Employee',
    attributeName: 'notes',
    label: 'Employee.notes',
  },
]

describe('description-task-filter', () => {
  test('isIdLikeAttribute detects common ID fields', () => {
    const dc = catalog.dataClasses[0]
    expect(isIdLikeAttribute(dc.attributes[0], dc)).toBe(true)
    expect(isIdLikeAttribute(dc.attributes[1], dc)).toBe(false)
    expect(isIdLikeAttribute(dc.attributes[2], dc)).toBe(true)
  })

  test('shouldExcludeAttribute honors idLike preset', () => {
    const dc = catalog.dataClasses[0]
    expect(shouldExcludeAttribute(dc.attributes[0], dc, { idLike: true })).toBe(true)
    expect(shouldExcludeAttribute(dc.attributes[1], dc, { idLike: true })).toBe(false)
    expect(shouldExcludeAttribute(dc.attributes[2], dc, { idLike: true })).toBe(true)
  })

  test('filterDescriptionTasks keeps dataclasses and non-ID attributes', () => {
    const filtered = filterDescriptionTasks(tasks, catalog, {
      includeTypes: ['dataclass', 'attribute'],
      excludeAttributes: { idLike: true },
    })

    expect(filtered.map((task) => task.label)).toEqual([
      'Employee',
      'Employee.firstname',
      'Employee.notes',
    ])
  })

  test('filterDescriptionTasks supports explicit attribute name exclusions', () => {
    const filtered = filterDescriptionTasks(tasks, catalog, {
      includeTypes: ['attribute'],
      excludeAttributes: { names: ['notes'] },
    })

    expect(
      filtered.map((task) => (task.type === 'attribute' ? task.attributeName : task.label))
    ).toEqual(['ID', 'firstname', 'companyID'])
  })

  test('isOptionalAttributeDescription mirrors isIdLikeAttribute', () => {
    const dc = catalog.dataClasses[0]
    expect(isOptionalAttributeDescription(dc.attributes[0], dc)).toBe(true)
    expect(isOptionalAttributeDescription(dc.attributes[1], dc)).toBe(false)
  })

  test('shouldExcludeAttribute returns false without a filter', () => {
    const dc = catalog.dataClasses[0]
    expect(shouldExcludeAttribute(dc.attributes[1], dc, undefined)).toBe(false)
  })

  test('shouldExcludeAttribute honors namePattern, identifying and primaryKeys', () => {
    const dc = catalog.dataClasses[0]
    expect(shouldExcludeAttribute(dc.attributes[2], dc, { namePattern: 'ID$' })).toBe(true)
    expect(shouldExcludeAttribute(dc.attributes[1], dc, { namePattern: 'ID$' })).toBe(false)
    // invalid regex is ignored without throwing
    expect(shouldExcludeAttribute(dc.attributes[1], dc, { namePattern: '(' })).toBe(false)
    expect(shouldExcludeAttribute(dc.attributes[0], dc, { identifying: true })).toBe(true)
    expect(shouldExcludeAttribute(dc.attributes[0], dc, { primaryKeys: true })).toBe(true)
    expect(shouldExcludeAttribute(dc.attributes[1], dc, { primaryKeys: true })).toBe(false)
  })

  test('filterDescriptionTasks returns input unchanged without a filter', () => {
    expect(filterDescriptionTasks(tasks, catalog, undefined)).toBe(tasks)
  })

  test('filterDescriptionTasks supports dataclassNames and excludeDataclasses', () => {
    expect(filterDescriptionTasks(tasks, catalog, { dataclassNames: ['Employee'] }).length).toBe(
      tasks.length
    )
    expect(filterDescriptionTasks(tasks, catalog, { dataclassNames: ['Other'] })).toEqual([])
    expect(filterDescriptionTasks(tasks, catalog, { excludeDataclasses: ['Employee'] })).toEqual([])
  })

  test('filterDescriptionTasks drops attribute tasks with missing catalog entries', () => {
    const ghost: DescriptionTask[] = [
      {
        type: 'attribute',
        dataclassName: 'Ghost',
        attributeName: 'x',
        label: 'Ghost.x',
      },
      {
        type: 'attribute',
        dataclassName: 'Employee',
        attributeName: 'missing',
        label: 'Employee.missing',
      },
    ]
    expect(filterDescriptionTasks(ghost, catalog, { includeTypes: ['attribute'] })).toEqual([])
  })
})
