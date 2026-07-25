import { describe, expect, test } from 'bun:test'
import type { DataClass, DataClassAttribute } from '@4d/rest'
import { buildDataclassGraphModel } from './dataclass-graph-model'

function dataclass(
  name: string,
  attributes: DataClassAttribute[] = [],
  collectionName = `${name}Collection`
): DataClass {
  return {
    name,
    collectionName,
    dataURI: `/rest/${name}`,
    key: [{ name: 'ID' }],
    attributes,
  }
}

describe('buildDataclassGraphModel', () => {
  test('resolves collection aliases and indexes both relation endpoints', () => {
    const catalog = [
      dataclass('Employee', [
        {
          name: 'company',
          kind: 'relatedEntity',
          type: 'Companies',
          foreignKey: 'companyID',
          inverseName: 'employees',
        },
      ]),
      dataclass('Company', [], 'Companies'),
    ]

    const model = buildDataclassGraphModel(catalog)
    const relation = model.relations[0]

    expect(relation).toEqual({
      id: 'Employee-companyID-Company-ID',
      source: 'Employee',
      sourceAttribute: 'company',
      sourceForeignKey: 'companyID',
      target: 'Company',
      targetPrimaryKey: 'ID',
      inverseName: 'employees',
    })
    expect(model.foreignKeysByDataclass.get('Employee')).toEqual(new Set(['companyID']))
    expect(model.primaryKeyTargetsByDataclass.get('Company')).toEqual(new Set(['ID']))
    expect(model.incidentRelationIdsByDataclass.get('Employee')).toEqual(new Set([relation.id]))
    expect(model.incidentRelationIdsByDataclass.get('Company')).toEqual(new Set([relation.id]))
  })

  test('deduplicates relations and ignores missing targets', () => {
    const relation: DataClassAttribute = {
      name: 'company',
      kind: 'relatedEntity',
      type: 'Company',
      foreignKey: 'companyID',
    }
    const catalog = [
      dataclass('Employee', [
        relation,
        { ...relation },
        {
          name: 'missing',
          kind: 'relatedEntity',
          type: 'Missing',
          foreignKey: 'missingID',
        },
      ]),
      dataclass('Company'),
    ]

    expect(buildDataclassGraphModel(catalog).relations).toHaveLength(1)
  })

  test('builds a 500 node and 1500 relation model', () => {
    const catalog = Array.from({ length: 500 }, (_, index) =>
      dataclass(
        `Class${index}`,
        Array.from({ length: 3 }, (_, relationIndex) => ({
          name: `relation${relationIndex}`,
          kind: 'relatedEntity' as const,
          type: `Class${(index + relationIndex + 1) % 500}`,
          foreignKey: `foreignKey${relationIndex}`,
        }))
      )
    )

    const model = buildDataclassGraphModel(catalog)

    expect(model.dataclassByName).toHaveLength(500)
    expect(model.relations).toHaveLength(1500)
  })
})
