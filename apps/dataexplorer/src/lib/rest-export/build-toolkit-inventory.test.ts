import { describe, expect, it } from 'bun:test'
import { buildToolkitInventory } from './build-toolkit-inventory'
import { createDefaultToolkitConfig } from './toolkit-defaults'
import { REST_DOCS_BASE } from './toolkit-docs'
import { toolkitFolders, toolkitLabels } from './toolkit-emoji'
import { countToolkitFolders, flattenToolkitOperations } from './toolkit-tree'
import type { ToolkitCatalogInput, ToolkitNode } from './toolkit-types'

const catalog: ToolkitCatalogInput = {
  dataClasses: [
    {
      name: 'Company',
      attributes: [{ name: 'name', kind: 'storage' }],
      methods: [
        { name: 'allActive', applyTo: 'dataClass', exposed: true },
        { name: 'fullName', applyTo: 'entity', exposed: true, allowedOnHTTPGET: true },
        { name: 'summarize', applyTo: 'entitySelection', exposed: true },
        { name: 'hiddenFn', applyTo: 'dataClass', exposed: false },
      ],
    },
    {
      name: 'Employee',
      attributes: [{ name: 'lastName', kind: 'storage' }],
      methods: [{ name: 'raise', applyTo: 'entity', exposed: true }],
    },
  ],
  singletons: [
    {
      name: 'Settings',
      methods: [
        { name: 'reload', exposed: true },
        { name: 'secret', exposed: false },
      ],
    },
  ],
  methods: [
    { name: 'authentify', exposed: true },
    { name: 'ping', exposed: true },
  ],
}

function folderNames(nodes: ToolkitNode[]): string[] {
  return nodes.filter((node) => node.type === 'folder').map((node) => node.name)
}

function childFolder(nodes: ToolkitNode[], name: string): ToolkitNode[] {
  const found = nodes.find((node) => node.type === 'folder' && node.name === name)
  return found && found.type === 'folder' ? found.children : []
}

describe('buildToolkitInventory', () => {
  it('builds auth, catalog, info, datastore, and selected dataclass folders', () => {
    const inventory = buildToolkitInventory(
      catalog,
      createDefaultToolkitConfig({
        selectedDataClasses: ['Company'],
        selectedSingletons: ['Settings'],
        variables: { accessKey: 'ak', includeAccessKeyLogin: true },
      })
    )

    expect(folderNames(inventory.nodes)).toEqual([
      toolkitFolders.auth,
      toolkitFolders.catalog,
      toolkitFolders.info,
      toolkitFolders.datastoreFunctions,
      toolkitFolders.singletons,
      'Company',
    ])

    const ops = flattenToolkitOperations(inventory.nodes)
    expect(ops.some((op) => op.label === toolkitLabels.login)).toBe(true)
    expect(ops.some((op) => op.path === '/rest/$catalog/authentify')).toBe(true)
    expect(ops.some((op) => op.path === '/rest/$info')).toBe(true)
    expect(ops.some((op) => op.path === '/rest/$catalog/ping')).toBe(true)
    expect(
      ops.some((op) => op.path === '/rest/$catalog/authentify' && op.id.startsWith('datastore'))
    ).toBe(false)
    expect(ops.map((op) => op.path)).not.toContain('/rest/Employee')

    const catalogOps = flattenToolkitOperations(
      childFolder(inventory.nodes, toolkitFolders.catalog)
    )
    expect(catalogOps.map((op) => op.path)).toEqual([
      '/rest/$catalog',
      '/rest/$catalog/$all',
      '/rest/$catalog/$all',
    ])
    expect(catalogOps.some((op) => op.path === '/rest/$catalog/Company')).toBe(false)

    const companyOps = flattenToolkitOperations(childFolder(inventory.nodes, 'Company'))
    expect(companyOps[0]?.path).toBe('/rest/$catalog/Company')
    expect(companyOps[0]?.label).toBe(toolkitLabels.catalogDataClass('Company'))
  })

  it('nests dataclass functions into dataclass / entity / entitySelection subfolders', () => {
    const inventory = buildToolkitInventory(
      catalog,
      createDefaultToolkitConfig({ selectedDataClasses: ['Company'] })
    )
    const company = childFolder(inventory.nodes, 'Company')
    const functions = childFolder(company, toolkitFolders.functions)
    expect(folderNames(functions)).toEqual([
      toolkitFolders.dataclassScope,
      toolkitFolders.entityScope,
      toolkitFolders.entitySelectionScope,
    ])

    const dataclassOps = flattenToolkitOperations(childFolder(functions, 'dataclass'))
    expect(dataclassOps.map((op) => op.path)).toEqual(['/rest/Company/allActive'])

    const entityOps = flattenToolkitOperations(childFolder(functions, 'entity'))
    expect(entityOps.map((op) => op.path)).toEqual(['/rest/Company({key})/fullName'])

    const selOps = flattenToolkitOperations(childFolder(functions, 'entitySelection'))
    expect(selOps.map((op) => op.path)).toEqual([
      '/rest/Company/summarize',
      '/rest/Company/summarize/$entityset/{entitySetId}',
    ])
  })

  it('places dataclass catalog request in the dataclass folder', () => {
    const inventory = buildToolkitInventory(
      catalog,
      createDefaultToolkitConfig({
        selectedDataClasses: ['Company', 'Employee'],
        categories: {
          crudList: false,
          crudCreate: false,
          crudGet: false,
          crudUpdate: false,
          crudDeleteByKey: false,
          entitySetCreate: false,
          entitySetPage: false,
          entitySetClean: false,
          entitySetRelease: false,
          functions: false,
        },
      })
    )
    const catalogOps = flattenToolkitOperations(
      childFolder(inventory.nodes, toolkitFolders.catalog)
    )
    expect(catalogOps.every((op) => !op.path.startsWith('/rest/$catalog/Company'))).toBe(true)
    expect(catalogOps.every((op) => !op.path.startsWith('/rest/$catalog/Employee'))).toBe(true)

    const company = childFolder(inventory.nodes, 'Company')
    const employee = childFolder(inventory.nodes, 'Employee')
    expect(flattenToolkitOperations(company).map((op) => op.path)).toEqual([
      '/rest/$catalog/Company',
    ])
    expect(flattenToolkitOperations(employee).map((op) => op.path)).toEqual([
      '/rest/$catalog/Employee',
    ])
  })

  it('omits empty function scope folders and unselected dataclasses', () => {
    const inventory = buildToolkitInventory(
      catalog,
      createDefaultToolkitConfig({ selectedDataClasses: ['Employee'] })
    )
    expect(folderNames(inventory.nodes)).toContain('Employee')
    expect(folderNames(inventory.nodes)).not.toContain('Company')

    const functions = childFolder(
      childFolder(inventory.nodes, 'Employee'),
      toolkitFolders.functions
    )
    expect(folderNames(functions)).toEqual([toolkitFolders.entityScope])
  })

  it('omits non-exposed methods unless includeNonExposed is on', () => {
    const catalogWithImpliedPublic: ToolkitCatalogInput = {
      ...catalog,
      dataClasses: [
        {
          name: 'Company',
          methods: [
            { name: 'allActive', applyTo: 'dataClass', exposed: true },
            { name: 'hiddenFn', applyTo: 'dataClass', exposed: false },
            { name: 'legacyPublic', applyTo: 'dataClass', scope: 'public' },
          ],
        },
      ],
    }
    const exposedOnly = buildToolkitInventory(
      catalogWithImpliedPublic,
      createDefaultToolkitConfig({
        selectedDataClasses: ['Company'],
        selectedSingletons: ['Settings'],
      })
    )
    const exposedOps = flattenToolkitOperations(exposedOnly.nodes)
    expect(exposedOps.some((op) => op.path.includes('hiddenFn'))).toBe(false)
    expect(exposedOps.some((op) => op.path.includes('legacyPublic'))).toBe(false)
    expect(exposedOps.some((op) => op.path.includes('/secret'))).toBe(false)

    const withHidden = buildToolkitInventory(
      catalog,
      createDefaultToolkitConfig({
        selectedDataClasses: ['Company'],
        selectedSingletons: ['Settings'],
        categories: { includeNonExposed: true },
      })
    )
    const allOps = flattenToolkitOperations(withHidden.nodes)
    expect(allOps.some((op) => op.path.includes('hiddenFn'))).toBe(true)
    expect(allOps.some((op) => op.path.includes('/secret'))).toBe(true)
    expect(
      flattenToolkitOperations(
        buildToolkitInventory(catalogWithImpliedPublic, {
          ...createDefaultToolkitConfig({
            selectedDataClasses: ['Company'],
            categories: { includeNonExposed: true },
          }),
        }).nodes
      ).some((op) => op.path.includes('legacyPublic'))
    ).toBe(true)
  })

  it('keeps advanced delete/compute off by default and on when flagged', () => {
    const defaults = buildToolkitInventory(
      catalog,
      createDefaultToolkitConfig({ selectedDataClasses: ['Company'] })
    )
    const defaultOps = flattenToolkitOperations(defaults.nodes)
    expect(defaultOps.some((op) => op.label === toolkitLabels.deleteAll)).toBe(false)
    expect(defaultOps.some((op) => op.label === toolkitLabels.compute)).toBe(false)
    expect(defaultOps.some((op) => op.label === toolkitLabels.directoryLogin)).toBe(false)

    const advanced = buildToolkitInventory(
      catalog,
      createDefaultToolkitConfig({
        selectedDataClasses: ['Company'],
        categories: {
          deleteAll: true,
          deleteByFilter: true,
          deleteEntitySet: true,
          compute: true,
          directoryLogin: true,
          httpGetVariants: true,
        },
      })
    )
    const advancedOps = flattenToolkitOperations(advanced.nodes)
    expect(advancedOps.some((op) => op.label === toolkitLabels.deleteAll)).toBe(true)
    expect(advancedOps.some((op) => op.label === toolkitLabels.deleteByFilter)).toBe(true)
    expect(advancedOps.some((op) => op.label === toolkitLabels.deleteEntitySet)).toBe(true)
    expect(advancedOps.some((op) => op.label === toolkitLabels.compute)).toBe(true)
    expect(advancedOps.some((op) => op.path === '/rest/Company/name')).toBe(true)
    expect(advancedOps.some((op) => op.label === toolkitLabels.directoryLogin)).toBe(true)
    expect(
      advancedOps.some((op) => op.method === 'GET' && op.path === '/rest/Company({key})/fullName')
    ).toBe(true)
  })

  it('skips login when accessKey is empty even if includeAccessKeyLogin is true', () => {
    const inventory = buildToolkitInventory(
      catalog,
      createDefaultToolkitConfig({
        selectedDataClasses: [],
        variables: { accessKey: '', includeAccessKeyLogin: true },
      })
    )
    const ops = flattenToolkitOperations(inventory.nodes)
    expect(ops.some((op) => op.label === toolkitLabels.login)).toBe(false)
  })

  it('can omit emojis, customize them, and add dataclass folder emoji', () => {
    const none = buildToolkitInventory(
      catalog,
      createDefaultToolkitConfig({
        selectedDataClasses: ['Company'],
        variables: { accessKey: 'ak', includeAccessKeyLogin: true },
        emoji: { enabled: false },
      })
    )
    expect(folderNames(none.nodes)).toContain('Auth')
    expect(folderNames(none.nodes)).toContain('Company')
    expect(
      flattenToolkitOperations(none.nodes).some((op) => op.label === 'Login (access key)')
    ).toBe(true)
    expect(flattenToolkitOperations(none.nodes).some((op) => op.label === 'List / query')).toBe(
      true
    )

    const withDc = buildToolkitInventory(
      catalog,
      createDefaultToolkitConfig({
        selectedDataClasses: ['Company'],
        emoji: { dataclassFolderEmoji: true, custom: { 'request.list': '🧾' } },
      })
    )
    expect(folderNames(withDc.nodes)).toContain('📁 Company')
    expect(
      flattenToolkitOperations(withDc.nodes).some((op) => op.label === '🧾 List / query')
    ).toBe(true)
  })

  it('counts folders and requests', () => {
    const inventory = buildToolkitInventory(
      catalog,
      createDefaultToolkitConfig({
        selectedDataClasses: ['Company'],
        selectedSingletons: ['Settings'],
      })
    )
    expect(countToolkitFolders(inventory.nodes)).toBeGreaterThan(5)
    expect(flattenToolkitOperations(inventory.nodes).length).toBeGreaterThan(10)
  })

  it('attaches official 4D docs by default and can disable them', () => {
    const withDocs = buildToolkitInventory(
      catalog,
      createDefaultToolkitConfig({
        selectedDataClasses: ['Company'],
        variables: { accessKey: 'ak', includeAccessKeyLogin: true },
      })
    )
    const info = flattenToolkitOperations(withDocs.nodes).find((op) => op.path === '/rest/$info')
    expect(info?.docsUrl).toBe(`${REST_DOCS_BASE}/info`)
    expect(info?.description).toContain('entity sets')
    expect(info?.query).toBeUndefined()

    const list = flattenToolkitOperations(withDocs.nodes).find(
      (op) => op.path === '/rest/Company' && op.method === 'GET' && op.emojiKey === 'request.list'
    )
    expect(list?.docsUrl).toBe(`${REST_DOCS_BASE}/dataClass`)
    expect(list?.query?.find((param) => param.key === '$filter')?.description).toContain('$filter')
    expect(list?.query?.find((param) => param.key === '$filter')?.disabled).toBe(true)
    expect(list?.query?.find((param) => param.key === '$orderby')?.disabled).toBe(true)
    expect(list?.query?.find((param) => param.key === '$attributes')?.disabled).toBe(true)
    expect(list?.query?.find((param) => param.key === '$top')?.disabled).toBeUndefined()
    expect(list?.query?.find((param) => param.key === '$skip')?.disabled).toBeUndefined()

    const login = flattenToolkitOperations(withDocs.nodes).find((op) => op.path === '/api/login')
    expect(login?.docsUrl).toBeUndefined()

    const without = buildToolkitInventory(
      catalog,
      createDefaultToolkitConfig({ selectedDataClasses: ['Company'], includeDocs: false })
    )
    const plainInfo = flattenToolkitOperations(without.nodes).find(
      (op) => op.path === '/rest/$info'
    )
    expect(plainInfo?.docsUrl).toBeUndefined()
    expect(plainInfo?.description).toBeUndefined()
  })
})
