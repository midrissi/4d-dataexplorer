import { filter, map, Subject } from 'rxjs'

type CommandPaletteMode =
  | 'default'
  | 'go-to'
  | 'go-to-page'
  | 'dataclass-select'
  | 'dataclass-data'
  | 'switch-tabs'

type GraphRelationFilter = 'all' | 'selected' | 'none'

export type EntityIoTarget = {
  dataclassName: string
  entitySetId?: string | null
  filter?: string
  filterParams?: Array<{ type: string; value: string }>
  selectionCount?: number | null
  /** Preferred export columns (e.g. FieldManager visible fields). */
  columns?: string[]
}

type EventType =
  | 'new-entity'
  | 'edit-entity'
  | 'save-entity'
  | 'delete-entity'
  | 'duplicate-entity'
  | 'copy-entity'
  | 'refresh-view'
  | 'nav-prev'
  | 'nav-next'
  | 'cancel-edit'
  | 'go-to-entity'
  | 'go-to-page'
  | 'page-first'
  | 'page-prev'
  | 'page-next'
  | 'page-last'
  | 'highlight-dataclass-in-graph'
  | 'open-command-palette'
  | 'show-keyboard-shortcuts'
  | 'graph-auto-organize'
  | 'graph-set-relation-filter'
  | 'graph-toggle-singletons'
  | 'graph-select-dataclass'
  | 'graph-deselect'
  | 'assistant-metadata-changed'
  | 'catalog-reloaded'
  | 'open-entity-analyze'
  | 'open-entity-export'
  | 'open-entity-import'
  | 'open-entity-anonymize'

type EventPayloadMap = {
  'open-command-palette': { mode?: CommandPaletteMode } | undefined
  'highlight-dataclass-in-graph': string
  'go-to-entity': { index: number; page?: number; positionInPage?: number } | undefined
  'go-to-page': { page: number } | undefined
  'graph-set-relation-filter': GraphRelationFilter
  'graph-select-dataclass': string
  'assistant-metadata-changed': { updatedAt: string }
  'catalog-reloaded': undefined
  /** Remount the active dataclass tab. Set skipFetch when the caller already refreshed data. */
  'refresh-view': { skipFetch?: boolean } | undefined
  'open-entity-analyze': EntityIoTarget
  'open-entity-export': EntityIoTarget
  'open-entity-import': EntityIoTarget
  'open-entity-anonymize': EntityIoTarget
}

type EventPayload<T extends EventType> = T extends keyof EventPayloadMap
  ? EventPayloadMap[T]
  : unknown

interface Event<T extends EventType = EventType> {
  type: T
  payload?: EventPayload<T>
}

const eventSubject = new Subject<Event>()

export const emit = <T extends EventType>(type: T, payload?: EventPayload<T>) => {
  eventSubject.next({ type, payload } as Event<T>)
}

export const on = <T extends EventType>(type: T, callback: (payload: EventPayload<T>) => void) => {
  const subscription = eventSubject
    .pipe(
      filter((event) => event.type === type),
      map((event) => event.payload as EventPayload<T>)
    )
    .subscribe(callback)

  return subscription
}

export type { CommandPaletteMode, GraphRelationFilter }

export const eventBus = { emit, on }
