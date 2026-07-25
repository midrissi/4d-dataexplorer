type CatalogAttribute = {
  name: string
  kind: 'storage' | 'relatedEntity'
  type: string
  foreignKey?: string
  inverseName?: string
  indexed?: boolean
}

type CatalogDataclass = {
  name: string
  collectionName: string
  uri: string
  dataURI: string
  key: Array<{ name: string }>
  attributes: CatalogAttribute[]
  methods: Array<{
    name: string
    applyTo: string
    exposed: boolean
    allowedOnHTTPGET: boolean
  }>
}

export type LargeStructureCatalog = {
  __UNIQID: string
  __BASEID: string
  __NAME: string
  dataClasses: CatalogDataclass[]
}

export function createLargeStructureCatalog(
  dataclassCount = 500,
  relationsPerDataclass = 3
): LargeStructureCatalog {
  const dataClasses = Array.from({ length: dataclassCount }, (_, index): CatalogDataclass => {
    const name = `PerfClass${String(index).padStart(3, '0')}`
    const foreignKeys = Array.from({ length: relationsPerDataclass }, (_, relationIndex) => ({
      name: `target${relationIndex}ID`,
      kind: 'storage' as const,
      type: 'long',
      indexed: true,
    }))
    const relations = Array.from({ length: relationsPerDataclass }, (_, relationIndex) => {
      const targetIndex = (index + relationIndex + 1) % dataclassCount
      return {
        name: `target${relationIndex}`,
        kind: 'relatedEntity' as const,
        type: `PerfClass${String(targetIndex).padStart(3, '0')}Collection`,
        foreignKey: `target${relationIndex}ID`,
        inverseName: `source${relationIndex}Collection`,
      }
    })

    return {
      name,
      collectionName: `${name}Collection`,
      uri: `/rest/$catalog/${name}`,
      dataURI: `/rest/${name}`,
      key: [{ name: 'ID' }],
      attributes: [
        { name: 'ID', kind: 'storage', type: 'long', indexed: true },
        { name: 'name', kind: 'storage', type: 'string', indexed: true },
        { name: 'createdAt', kind: 'storage', type: 'date' },
        ...foreignKeys,
        ...relations,
      ],
      methods: [
        {
          name: 'findRecent',
          applyTo: 'dataClass',
          exposed: true,
          allowedOnHTTPGET: true,
        },
      ],
    }
  })

  return {
    __UNIQID: 'structure-performance-catalog',
    __BASEID: 'structure-performance-base',
    __NAME: 'Structure Performance Catalog',
    dataClasses,
  }
}
