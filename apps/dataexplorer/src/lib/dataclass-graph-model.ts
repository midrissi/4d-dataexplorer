import type { DataClass } from '@4d/rest'

export type DataclassRelation = {
  id: string
  source: string
  sourceAttribute: string
  sourceForeignKey: string
  target: string
  targetPrimaryKey: string
  inverseName: string
}

export type DataclassGraphModel = {
  dataclassByName: Map<string, DataClass>
  collectionToDataclass: Map<string, string>
  foreignKeysByDataclass: Map<string, Set<string>>
  primaryKeyTargetsByDataclass: Map<string, Set<string>>
  relations: DataclassRelation[]
  incidentRelationIdsByDataclass: Map<string, Set<string>>
}

export function buildDataclassGraphModel(catalog: DataClass[]): DataclassGraphModel {
  const dataclassByName = new Map<string, DataClass>()
  const collectionToDataclass = new Map<string, string>()
  const foreignKeysByDataclass = new Map<string, Set<string>>()
  const primaryKeyTargetsByDataclass = new Map<string, Set<string>>()
  const incidentRelationIdsByDataclass = new Map<string, Set<string>>()

  for (const dataclass of catalog) {
    dataclassByName.set(dataclass.name, dataclass)
    collectionToDataclass.set(dataclass.name, dataclass.name)
    collectionToDataclass.set(dataclass.collectionName, dataclass.name)
    foreignKeysByDataclass.set(dataclass.name, new Set())
    primaryKeyTargetsByDataclass.set(dataclass.name, new Set())
    incidentRelationIdsByDataclass.set(dataclass.name, new Set())
  }

  const relationIds = new Set<string>()
  const relations: DataclassRelation[] = []

  for (const dataclass of catalog) {
    for (const attribute of dataclass.attributes) {
      if (attribute.kind !== 'relatedEntity' || !attribute.foreignKey) continue

      const target = collectionToDataclass.get(attribute.type) ?? attribute.type
      const targetDataclass = dataclassByName.get(target)
      const targetPrimaryKey = targetDataclass?.key?.[0]?.name
      if (!targetDataclass || !targetPrimaryKey) continue

      const id = `${dataclass.name}-${attribute.foreignKey}-${target}-${targetPrimaryKey}`
      if (relationIds.has(id)) continue
      relationIds.add(id)

      foreignKeysByDataclass.get(dataclass.name)?.add(attribute.foreignKey)
      primaryKeyTargetsByDataclass.get(target)?.add(targetPrimaryKey)
      incidentRelationIdsByDataclass.get(dataclass.name)?.add(id)
      incidentRelationIdsByDataclass.get(target)?.add(id)
      relations.push({
        id,
        source: dataclass.name,
        sourceAttribute: attribute.name,
        sourceForeignKey: attribute.foreignKey,
        target,
        targetPrimaryKey,
        inverseName: attribute.inverseName ?? '',
      })
    }
  }

  return {
    dataclassByName,
    collectionToDataclass,
    foreignKeysByDataclass,
    primaryKeyTargetsByDataclass,
    relations,
    incidentRelationIdsByDataclass,
  }
}
