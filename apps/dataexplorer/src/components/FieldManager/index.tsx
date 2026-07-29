import {
  Button,
  Checkbox,
  cn,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
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
import { mobileFullscreenDialogClass } from '~/lib/mobile-menu'
import { isMobileShell } from '~/lib/platform'
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

function SortableField({
  path,
  onRemove,
  compact = false,
}: {
  path: string
  onRemove: (path: string) => void
  compact?: boolean
}) {
  const { t } = useTranslation()
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
        'flex items-center gap-1.5 rounded-md border bg-background text-sm',
        compact ? 'px-1.5 py-1' : 'min-h-11 gap-2 px-2.5 py-2',
        isDragging && 'opacity-70 shadow-md'
      )}
    >
      <button
        type="button"
        className={cn(
          'cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing',
          !compact && 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md'
        )}
        aria-label={t('fieldManager.reorder')}
        {...attributes}
        {...listeners}
      >
        <GripVertical className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
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
        className={cn(
          'rounded text-muted-foreground hover:bg-muted hover:text-foreground',
          compact ? 'p-0.5' : 'flex h-9 w-9 shrink-0 items-center justify-center'
        )}
        aria-label={t('common.remove')}
      >
        <X className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
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
  const mobile = isMobileShell()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<FieldManagerView>(initialView)
  const [mobilePane, setMobilePane] = useState<'browse' | 'selected'>('browse')
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
      setMobilePane('browse')
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

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className={cn(
        'h-6 gap-1 px-2 text-xs',
        hasSelection && 'border-primary/50 text-primary',
        mobile && 'h-9 shrink-0 px-2.5'
      )}
    >
      <Columns3 className="h-3.5 w-3.5" />
      <span className={cn('@[28rem]/entity-list:inline hidden', mobile && 'inline')}>
        {t('fieldManager.fields')}
      </span>
      {hasSelection && (
        <span className="rounded-sm bg-primary/15 px-1 font-mono text-[10px] leading-none">
          {fieldConfig[initialView].length || fieldConfig.table.length}
        </span>
      )}
    </Button>
  )

  const attributeBrowser = (
    <div className={cn('flex min-h-0 flex-col', mobile ? 'flex-1' : 'h-105')}>
      <div className={cn('border-b', mobile ? 'p-3' : 'p-2')}>
        <div className="relative">
          <Search
            className={cn(
              'absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground',
              mobile ? 'h-4 w-4' : 'h-3.5 w-3.5'
            )}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('fieldManager.searchPlaceholder')}
            className={cn(mobile ? 'h-11 pl-9 text-base' : 'h-6 pl-7 text-xs')}
          />
        </div>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center gap-0.5 border-b text-xs',
          mobile ? 'gap-1 px-3 py-2.5' : 'px-2 py-1.5'
        )}
      >
        <button
          type="button"
          onClick={() => goToCrumb(-1)}
          className={cn(
            'rounded px-1.5 font-medium hover:bg-muted',
            mobile ? 'min-h-9 px-2.5 text-sm' : 'py-0.5',
            crumbs.length === 0 ? 'text-foreground' : 'text-primary'
          )}
        >
          {dataclassName}
        </button>
        {crumbs.map((crumb, index) => {
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
                  'rounded px-1.5 hover:bg-muted',
                  mobile ? 'min-h-9 px-2.5 text-sm' : 'py-0.5',
                  index === crumbs.length - 1 ? 'text-foreground' : 'text-primary'
                )}
              >
                {crumb.name}
              </button>
            </span>
          )
        })}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className={cn(mobile ? 'space-y-0.5 p-2' : 'p-1')}>
          {crumbs.length > 0 && (
            <button
              type="button"
              onClick={() => goToCrumb(crumbs.length - 2)}
              className={cn(
                'mb-1 flex w-full items-center gap-1.5 rounded-md text-muted-foreground hover:bg-muted',
                mobile ? 'min-h-11 gap-2 px-3 text-sm' : 'px-2 py-1.5 text-xs'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
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
              if (toOne) {
                return (
                  <button
                    key={attr.name}
                    type="button"
                    onClick={() => drillInto(attr)}
                    title={t('fieldManager.drillInto', { name: attr.name })}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg text-left hover:bg-muted/60',
                      mobile ? 'min-h-12 px-3 py-2.5' : 'gap-1.5 px-1.5 py-1'
                    )}
                  >
                    <Link2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm">{attr.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {attr.type}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                )
              }
              if (toMany) {
                return (
                  <div
                    key={attr.name}
                    className={cn(
                      'flex cursor-default items-center gap-2 rounded-lg opacity-60',
                      mobile ? 'min-h-12 px-3 py-2.5' : 'gap-1.5 px-1.5 py-1'
                    )}
                  >
                    <Network className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{attr.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {attr.type}
                    </span>
                  </div>
                )
              }
              return (
                <div
                  key={attr.name}
                  className={cn(
                    'flex items-center gap-2 rounded-lg hover:bg-muted/60',
                    mobile ? 'min-h-12 px-3 py-2.5' : 'gap-1.5 px-1.5 py-1'
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleField(attr.name)}
                    aria-label={attr.name}
                    className="shrink-0"
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm"
                    onClick={() => toggleField(attr.name)}
                  >
                    {attr.name}
                  </button>
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
  )

  const selectionPanel = (
    <div className={cn('flex min-h-0 flex-col', mobile ? 'flex-1' : 'h-105')}>
      <div
        className={cn(
          'flex items-center justify-between border-b',
          mobile ? 'min-h-12 px-3' : 'px-3 py-2'
        )}
      >
        <span className="font-medium text-sm">
          {view === 'table' ? t('fieldManager.tableColumns') : t('fieldManager.cardFields')}
          <span className="ml-1.5 text-muted-foreground">({selected.length})</span>
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onResetView(view)}
            className={cn(
              'flex items-center gap-1 text-muted-foreground hover:text-foreground',
              mobile ? 'min-h-9 gap-1.5 px-2 text-sm' : 'text-xs'
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('fieldManager.reset')}
          </button>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className={cn('space-y-1.5', mobile ? 'p-3' : 'space-y-1 p-2')}>
          {selected.length === 0 ? (
            <EmptyPanel
              icon={view === 'table' ? Columns3 : LayoutGrid}
              badgeLabel="0"
              badgeTone="muted"
              title={t('fieldManager.emptySelectionTitle')}
              description={t('fieldManager.emptySelectionDescription')}
              ghost="rows"
              size="sm"
              className={mobile ? 'min-h-28' : 'min-h-40'}
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={selected} strategy={verticalListSortingStrategy}>
                {selected.map((path) => (
                  <SortableField key={path} path={path} onRemove={handleRemove} compact={!mobile} />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </ScrollArea>
    </div>
  )

  const viewToggle = (
    <div
      className={cn(
        'flex shrink-0 items-center border-b',
        mobile ? 'px-3 py-2.5' : 'justify-between gap-2 px-3 py-2'
      )}
    >
      {!mobile ? <span className="font-medium text-sm">{t('fieldManager.title')}</span> : null}
      <div
        className={cn(
          'flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5',
          mobile && 'w-full'
        )}
        role="tablist"
        aria-label={t('fieldManager.title')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === 'table'}
          onClick={() => setView('table')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md transition-colors',
            mobile ? 'h-10 px-3 text-sm' : 'h-5 gap-1 px-1.5 text-[11px]',
            view === 'table'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Table2 className="h-3.5 w-3.5" />
          {t('fieldManager.tableColumns')}
          {fieldConfig.table.length > 0 && (
            <span className="font-mono text-[10px]">({fieldConfig.table.length})</span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'cards'}
          onClick={() => setView('cards')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md transition-colors',
            mobile ? 'h-10 px-3 text-sm' : 'h-5 gap-1 px-1.5 text-[11px]',
            view === 'cards'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          {t('fieldManager.cardFields')}
          {fieldConfig.cards.length > 0 && (
            <span className="font-mono text-[10px]">({fieldConfig.cards.length})</span>
          )}
        </button>
      </div>
    </div>
  )

  const footer = (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-2 border-t bg-background px-3',
        mobile ? 'flex-col items-stretch gap-2 py-3' : 'py-2'
      )}
    >
      <p className="text-muted-foreground text-xs leading-relaxed">
        {t('fieldManager.footerHint')}
      </p>
      <Button
        type="button"
        variant={isDirtyFromDefault ? 'default' : 'outline'}
        size="sm"
        className={cn('gap-1.5', mobile ? 'h-12 text-base' : 'h-7')}
        onClick={onSaveDefault}
      >
        <Save className="h-4 w-4" />
        {t('fieldManager.saveDefault', { name: dataclassName })}
      </Button>
    </div>
  )

  const panelBody = mobile ? (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-border border-b px-2">
        <span className="pl-1 font-medium text-base">{t('fieldManager.title')}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          onClick={() => setOpen(false)}
          aria-label={t('common.close')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {viewToggle}

      <div
        className="mx-3 mt-2 flex shrink-0 gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
        role="tablist"
        aria-label={t('fieldManager.selectedPane')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === 'browse'}
          onClick={() => setMobilePane('browse')}
          className={cn(
            'flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md text-sm transition-colors',
            mobilePane === 'browse'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <ListChecks className="h-3.5 w-3.5" />
          {t('fieldManager.browsePane')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === 'selected'}
          onClick={() => setMobilePane('selected')}
          className={cn(
            'flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md text-sm transition-colors',
            mobilePane === 'selected'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          {t('fieldManager.selectedPane')}
          <span className="rounded-sm bg-muted px-1.5 font-mono text-[10px] tabular-nums">
            {selected.length}
          </span>
        </button>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
        {mobilePane === 'browse' ? attributeBrowser : selectionPanel}
      </div>

      {footer}
    </div>
  ) : (
    <>
      {viewToggle}
      <div className="grid grid-cols-2 divide-x">
        {attributeBrowser}
        {selectionPanel}
      </div>
      {footer}
    </>
  )

  if (mobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className={mobileFullscreenDialogClass('overflow-hidden')} hideCloseButton>
          <DialogTitle className="sr-only">{t('fieldManager.title')}</DialogTitle>
          {panelBody}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('fieldManager.tooltip')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="end" className="w-170 p-0" sideOffset={6}>
        {panelBody}
      </PopoverContent>
    </Popover>
  )
}
