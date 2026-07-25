import { createAssistantToolRegistry, type DatastoreToolsAdapter } from '@4djs/assistant/tools'
import { api, client } from '~/lib/api'
import { useSettingsStore } from '~/store/settings'
import { refreshAssistantMethodTools } from './method-tools'
import { registerNamespacedDatastoreTools, registerUiTools } from './ui-tools'

const datastoreAdapter: DatastoreToolsAdapter = {
  async getCatalog() {
    const catalog = await client.catalog.getAllWithMetadataCached()
    const dataclasses = await api.getDataclasses()
    const counts = Object.fromEntries(dataclasses.map((dc) => [dc.name, dc.count]))
    return {
      ...catalog,
      dataClasses: (catalog.dataClasses ?? []).map((dc) => ({
        ...dc,
        entityCount: counts[dc.name] ?? 0,
      })),
    }
  },
  getServerInfo: () => api.getServerInfo(),
  queryEntities: (input) => {
    const q = input as typeof input & { top?: number; expand?: string[] }
    return api.getEntities(q.dataClass, {
      page: q.page ?? 1,
      top: q.top ?? q.limit ?? 20,
      filter: q.filter,
      sort: q.sort,
      order: q.order ?? 'desc',
      select: q.select,
      expand: q.expand,
      filterParams: q.filterParams,
      // Direct dataclass query — avoid entity-set create + re-applying $filter/$params
      // on /$entityset/{id}, which can drop placeholders (desktop Tauri HTTP).
      createEntitySet: false,
    })
  },
  getEntity: (dataClass, key) => api.getEntity(dataClass, key),
  createEntity: (dataClass, data) => api.createEntity(dataClass, data),
  updateEntity: (dataClass, key, data) => api.updateEntity(dataClass, key, data),
  deleteEntity: (dataClass, key) => api.deleteEntity(dataClass, key),
  assertWritable: () =>
    useSettingsStore.getState().readonlyMode
      ? 'Read-only mode is enabled. Disable read-only mode in the header to mutate data.'
      : null,
}

export const dataExplorerToolRegistry = createAssistantToolRegistry()
registerNamespacedDatastoreTools(dataExplorerToolRegistry, datastoreAdapter)
registerUiTools(dataExplorerToolRegistry)

void refreshAssistantMethodTools(dataExplorerToolRegistry)

useSettingsStore.persist.onFinishHydration(() => {
  void refreshAssistantMethodTools(dataExplorerToolRegistry)
})
