import {
  Button,
  Checkbox,
  cn,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  GripVertical,
  LayoutGrid,
  Link2,
  ListChecks,
  Network,
  RotateCcw,
  Save,
  Search,
  Table2,
  X,
} from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import type { FieldConfig } from '~/store/tabs'

// A single attribute as returned by api.getDataclassSchema.
type SchemaAttr = {
  name: string
  type: string
  kind?: string
  // For calculated/alias attributes, the kind of value they resolve to.
  behavior?: 'relatedEntity' | 'relatedEntities'
}

// One level of drill-down into a relation: the relation attribute name and the
// dataclass it points to.
type Crumb = { name: string; dataclass: string }

type FieldManagerView = 'table' | 'cards'

function isToOneRelation(attr: SchemaAttr): boolean {
  return attr.kind === 'relatedEntity' || attr.behavior === 'relatedEntity'
}

function isToManyRelation(attr: SchemaAttr): boolean {
  return attr.kind === 'relatedEntities' || attr.behavior === 'relatedEntities'
}

function isRelation(attr: SchemaAttr): boolean {
  return isToOneRelation(attr) || isToManyRelation(attr)
}

// =============================================================================
// Sortable selected-field chip
// =============================================================================

function SortableField({ path, onRemove }: { path: string; onRemove: (path: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: path,
  })

  const style: CSSProperties = {
    ...(transform != null && {
      transform: CSS.Transform.toString({ ...transform, x: 0 }),
    }),
    transition,
  }

  const segments = path.split('.')
  const leaf = segments[segments.length - 1]
  const prefix = segments.slice(0, -1).join(' › ')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-1.5 rounded-md border bg-background px-1.5 py-1 text-sm',
        isDragging && 'opacity-70 shadow-md'
      )}
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 flex-1 truncate">
        {prefix && (
          <span className="text-muted-foreground text-xs">
            {prefix}
            {' › '}
          </span>
        )}
        <span className="font-medium">{leaf}</span>
      </span>
      <button
        type="button"
        onClick={() => onRemove(path)}
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// =============================================================================
// FieldManager
// =============================================================================

export function FieldManager({
  dataclassName,
  fieldConfig,
  initialView,
  onChangeFields,
  onResetView,
  onSaveDefault,
  isDirtyFromDefault,
}: {
  dataclassName: string
  fieldConfig: FieldConfig
  /** Which list to edit first, based on the active view mode. */
  initialView: FieldManagerView
  onChangeFields: (view: FieldManagerView, fields: string[]) => void
  onResetView: (view: FieldManagerView) => void
  onSaveDefault: () => void
  /** True when the current selection differs from the saved per-dataclass default. */
  isDirtyFromDefault: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<FieldManagerView>(initialView)
  const [search, setSearch] = useState('')
  // Drill path into relations. Empty = root dataclass.
  const [crumbs, setCrumbs] = useState<Crumb[]>([])
  const [schemaCache, setSchemaCache] = useState<Record<string, SchemaAttr[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Reset transient browsing state whenever the popover is (re)opened.
  useEffect(() => {
    if (open) {
      setView(initialView)
      setSearch('')
      setCrumbs([])
    }
  }, [open, initialView])

  // The dataclass currently being browsed (root, or the last drilled relation).
  const currentDataclass = crumbs.length > 0 ? crumbs[crumbs.length - 1].dataclass : dataclassName
  // Dotted prefix built from the drill path, e.g. "company" or "manager.manager".
  const prefix = crumbs.map((c) => c.name).join('.')

  // Lazily load the schema for the dataclass at the current drill level.
  useEffect(() => {
    if (!open) return
    if (schemaCache[currentDataclass]) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getDataclassSchema(currentDataclass)
      .then((result) => {
        if (cancelled) return
        setSchemaCache((prev) => ({
          ...prev,
          [currentDataclass]: result.attributes as SchemaAttr[],
        }))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, currentDataclass, schemaCache])

  const selected = fieldConfig[view]
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const attributes = schemaCache[currentDataclass] ?? []
  const filteredAttributes = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? attributes.filter((a) => a.name.toLowerCase().includes(q)) : attributes
    // Show scalar/relation attributes; hide 4D system attributes.
    return list
      .filter((a) => !a.name.startsWith('__'))
      .slice()
      .sort((a, b) => {
        // Relations last so scalar fields are easy to pick.
        const ar = isRelation(a) ? 1 : 0
        const br = isRelation(b) ? 1 : 0
        if (ar !== br) return ar - br
        return a.name.localeCompare(b.name)
      })
  }, [attributes, search])

  const toFullPath = useCallback((name: string) => (prefix ? `${prefix}.${name}` : name), [prefix])

  const toggleField = useCallback(
    (name: string) => {
      const full = toFullPath(name)
      const next = selectedSet.has(full) ? selected.filter((p) => p !== full) : [...selected, full]
      onChangeFields(view, next)
    },
    [selected, selectedSet, toFullPath, onChangeFields, view]
  )

  const drillInto = useCallback((attr: SchemaAttr) => {
    setCrumbs((prev) => [...prev, { name: attr.name, dataclass: attr.type }])
    setSearch('')
  }, [])

  const goToCrumb = useCallback((index: number) => {
    // index === -1 goes back to root.
    setCrumbs((prev) => prev.slice(0, index + 1))
    setSearch('')
  }, [])

  const handleRemove = useCallback(
    (path: string) => {
      onChangeFields(
        view,
        selected.filter((p) => p !== path)
      )
    },
    [onChangeFields, view, selected]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = selected.indexOf(String(active.id))
      const newIndex = selected.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1) return
      onChangeFields(view, arrayMove(selected, oldIndex, newIndex))
    },
    [selected, onChangeFields, view]
  )

  const hasSelection = fieldConfig.table.length > 0 || fieldConfig.cards.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className={cn('h-6 gap-1 px-2', hasSelection && 'border-primary/50 text-primary')}
              >
                <Columns3 className="h-3.5 w-3.5" />
                <span className="@[28rem]/entity-list:inline hidden">
                  {t('fieldManager.fields')}
                </span>
                {hasSelection && (
                  <span className="rounded-sm bg-primary/15 px-1 font-mono text-[10px] leading-none">
                    {fieldConfig[initialView].length || fieldConfig.table.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('fieldManager.tooltip')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="end" className="w-170 p-0" sideOffset={6}>
        {/* Header: view toggle */}
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm">{t('fieldManager.title')}</span>
          </div>
          <div className="flex h-6 items-center gap-0.5 rounded-sm border p-px">
            <button
              type="button"
              onClick={() => setView('table')}
              className={cn(
                'flex h-5 items-center gap-1 rounded-sm px-1.5 text-[11px] transition-colors',
                view === 'table'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Table2 className="h-3 w-3" />
              {t('fieldManager.tableColumns')}
              {fieldConfig.table.length > 0 && (
                <span className="font-mono">({fieldConfig.table.length})</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setView('cards')}
              className={cn(
                'flex h-5 items-center gap-1 rounded-sm px-1.5 text-[11px] transition-colors',
                view === 'cards'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="h-3 w-3" />
              {t('fieldManager.cardFields')}
              {fieldConfig.cards.length > 0 && (
                <span className="font-mono">({fieldConfig.cards.length})</span>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x">
          {/* Left: attribute browser */}
          <div className="flex h-105 flex-col">
            {/* Search */}
            <div className="border-b p-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('fieldManager.searchPlaceholder')}
                  className="h-6 pl-7 text-xs"
                />
              </div>
            </div>

            {/* Breadcrumb */}
            <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5 text-xs">
              <button
                type="button"
                onClick={() => goToCrumb(-1)}
                className={cn(
                  'rounded px-1 py-0.5 font-medium hover:bg-muted',
                  crumbs.length === 0 ? 'text-foreground' : 'text-primary'
                )}
              >
                {dataclassName}
              </button>
              {crumbs.map((crumb, index) => {
                // Cumulative path is unique per level, even for self-referential relations.
                const crumbKey = crumbs
                  .slice(0, index + 1)
                  .map((c) => c.name)
                  .join('.')
                return (
                  <span key={crumbKey} className="flex items-center gap-0.5">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => goToCrumb(index)}
                      className={cn(
                        'rounded px-1 py-0.5 hover:bg-muted',
                        index === crumbs.length - 1 ? 'text-foreground' : 'text-primary'
                      )}
                    >
                      {crumb.name}
                    </button>
                  </span>
                )
              })}
            </div>

            {/* Attribute list */}
            <ScrollArea className="flex-1">
              <div className="p-1">
                {crumbs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => goToCrumb(crumbs.length - 2)}
                    className="mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground text-xs hover:bg-muted"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    {t('fieldManager.back')}
                  </button>
                )}
                {loading && attributes.length === 0 ? (
                  <p className="px-2 py-3 text-muted-foreground text-sm">{t('common.loading')}</p>
                ) : error ? (
                  <p className="px-2 py-3 text-destructive text-sm">{error}</p>
                ) : filteredAttributes.length === 0 ? (
                  <EmptyPanel
                    icon={search.trim() ? Search : ListChecks}
                    badgeIcon={search.trim() ? Search : undefined}
                    badgeTone={search.trim() ? 'amber' : 'muted'}
                    title={
                      search.trim()
                        ? t('fieldManager.noAttributesSearchTitle')
                        : t('fieldManager.noAttributesTitle')
                    }
                    description={
                      search.trim()
                        ? t('fieldManager.noAttributesSearchDescription')
                        : t('fieldManager.noAttributesDescription')
                    }
                    ghost="none"
                    size="sm"
                  />
                ) : (
                  filteredAttributes.map((attr) => {
                    const full = toFullPath(attr.name)
                    const checked = selectedSet.has(full)
                    const toOne = isToOneRelation(attr)
                    const toMany = isToManyRelation(attr)
                    // Scalars are selectable leaves; to-one relations are drill-only
                    // (click to navigate into them); to-many relations are shown
                    // muted as non-navigable dead-ends.
                    if (toOne) {
                      return (
                        <button
                          key={attr.name}
                          type="button"
                          onClick={() => drillInto(attr)}
                          title={t('fieldManager.drillInto', { name: attr.name })}
                          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-muted/60"
                        >
                          <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1 truncate text-sm">{attr.name}</span>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            {attr.type}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      )
                    }
                    return (
                      <div
                        key={attr.name}
                        className={cn(
                          'flex items-center gap-1.5 rounded-md px-1.5 py-1',
                          toMany ? 'opacity-60' : 'hover:bg-muted/60'
                        )}
                      >
                        {toMany ? (
                          <Network className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleField(attr.name)}
                            aria-label={attr.name}
                            className="shrink-0"
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm">{attr.name}</span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {attr.type}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right: selected + reorder */}
          <div className="flex h-105 flex-col">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="font-medium text-sm">
                {view === 'table' ? t('fieldManager.tableColumns') : t('fieldManager.cardFields')}
                <span className="ml-1.5 text-muted-foreground">({selected.length})</span>
              </span>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onResetView(view)}
                  className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t('fieldManager.reset')}
                </button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-1 p-2">
                {selected.length === 0 ? (
                  <EmptyPanel
                    icon={view === 'table' ? Columns3 : LayoutGrid}
                    badgeLabel="0"
                    badgeTone="muted"
                    title={t('fieldManager.emptySelectionTitle')}
                    description={t('fieldManager.emptySelectionDescription')}
                    ghost="rows"
                    size="sm"
                    className="min-h-40"
                  />
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={selected} strategy={verticalListSortingStrategy}>
                      {selected.map((path) => (
                        <SortableField key={path} path={path} onRemove={handleRemove} />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <p className="text-muted-foreground text-xs">{t('fieldManager.footerHint')}</p>
          <Button
            type="button"
            variant={isDirtyFromDefault ? 'default' : 'outline'}
            size="sm"
            className="h-7 gap-1.5"
            onClick={onSaveDefault}
          >
            <Save className="h-3.5 w-3.5" />
            {t('fieldManager.saveDefault', { name: dataclassName })}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
