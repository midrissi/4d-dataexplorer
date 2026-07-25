import {
  type DataClassAttribute,
  dateValueToInputValue,
  EMPTY_VALUE,
  formatDate,
  formatDuration,
  formatNumber,
  formatValue,
} from '@4d/rest'
import {
  Button,
  Checkbox,
  ClickToCopy,
  CodeEditor,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useConfirm,
  useToast,
  Value,
} from '@4d/ui'
import {
  Boxes,
  Braces,
  Calculator,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Clock,
  Copy,
  Database,
  Edit2,
  ExternalLink,
  FileJson,
  FileText,
  Fingerprint,
  Hash,
  History,
  Image as ImageIcon,
  Info,
  Link2,
  Loader2,
  Lock,
  MousePointerClick,
  Network,
  RefreshCw,
  Save,
  Trash2,
  TreePine,
  Unlink,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BinaryObjectViewer,
  isPrivateBinaryObject,
  PRIVATE_BINARY_OBJECT_KEY,
} from '~/components/BinaryObjectViewer'
import { JsonTreePreview } from '~/components/Console/ObjectTree'
import { DeferredImage } from '~/components/DeferredImage'
import { EmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { EntityDataGrid } from '~/components/EntityDataGrid'
import { EntityForm, type EntityFormHandle } from '~/components/EntityForm'
import { ErrorList } from '~/components/ErrorList'
import { MethodListPopover } from '~/components/MethodExecutor/MethodListPopover'
import { getIntlLocale, useEditorLabels, useTranslation } from '~/i18n'
import { api, formatThrownError } from '~/lib/api'
import { durationValueToInputValue, parseDurationInput } from '~/lib/duration'
import { sanitizeForEditing } from '~/lib/entitySanitizer'
import { eventBus } from '~/lib/eventBus'
import { getImageUri } from '~/lib/fieldPaths'
import { getBaseUrl } from '~/lib/platform'
import { useKeyboardShortcutsContext } from '~/providers/KeyboardShortcutsProvider'
import { type Entity, useDataExplorerStore } from '~/store'
import {
  type EditMode,
  formatShortcut,
  useCodeEditorPrefs,
  useDefaultEditMode,
  useDefaultEntityViewMode,
  useReadonlyMode,
  useShortcut,
  useUpdateCodeEditorPrefs,
} from '~/store/settings'
import { isDataclassTab, useTabsStore } from '~/store/tabs'

function useHighlightInGraph() {
  const openGraphTab = useTabsStore((s) => s.openGraphTab)
  return useCallback(
    (dataclassName: string) => {
      openGraphTab().then(() => {
        eventBus.emit('highlight-dataclass-in-graph', dataclassName)
      })
    },
    [openGraphTab]
  )
}

// Helper to get image URL from entity
function getImageUrl(
  entity: Record<string, unknown>,
  fieldName: string,
  _dataclassName: string | null,
  _entityId: string | null
): string | null {
  return getImageUri(entity[fieldName])
}

// A deferred BLOB attribute is served as a downloadable binary, signalled by
// `$binary=true` in its URI. It is not a relation, so it must not be loaded via
// `$method=subentityset` (which 4D rejects for scalar/blob attributes).
function isDeferredBlobUri(uri: string): boolean {
  return /[?&]\$binary=true(?:&|$)/.test(uri)
}

// Detect a 4D deferred BLOB value and build its absolute download URL.
function getDeferredBlobUrl(value: unknown): string | null {
  if (value && typeof value === 'object' && '__deferred' in value) {
    const d = (value as { __deferred?: { uri?: string; image?: boolean } }).__deferred
    if (d?.uri && !d.image && isDeferredBlobUri(d.uri)) {
      return `${getBaseUrl()}${d.uri}`
    }
  }
  return null
}

// Detect a 4D deferred relation (related entity or related entity set) that can
// be loaded on demand. Image relations render as pictures and deferred BLOBs
// render as downloads, so both are excluded here.
function getDeferredRelation(
  value: unknown
): { uri: string; key?: string; image?: boolean } | null {
  if (value && typeof value === 'object' && '__deferred' in value) {
    const d = (value as { __deferred?: { uri?: string; __KEY?: string; image?: boolean } })
      .__deferred
    if (d?.uri && !d.image && !isDeferredBlobUri(d.uri))
      return { uri: d.uri, key: d.__KEY, image: d.image }
  }
  return null
}

// 4D internal/system attributes are prefixed with a double underscore.
const INTERNAL_ATTR_PREFIX = '__'

function isInternalAttribute(key: string): boolean {
  return key.startsWith(INTERNAL_ATTR_PREFIX)
}

// Pick a representative icon for a given system attribute based on its name.
function getMetadataIcon(key: string) {
  const k = key.replace(/^_+/, '').toLowerCase()
  if (k === 'key' || k.endsWith('key')) return Fingerprint
  if (k === 'timestamp' || k.includes('time')) return Clock
  if (k === 'stamp' || k.includes('stamp')) return History
  if (k.includes('dataclass')) return Database
  if (k.includes('entitymodel') || k.includes('model')) return Boxes
  if (k === 'global' || k.includes('global')) return Hash
  return Info
}

// Prettify a system attribute name for display (strip leading underscores).
function prettyMetadataLabel(key: string): string {
  return key.replace(/^_+/, '')
}

// A distinct, collapsible panel that groups 4D internal/system attributes
// (those prefixed with `__`) and presents them as compact metadata chips,
// visually separated from the entity's own data.
function MetadataPanel({
  entries,
  expandAll,
}: {
  entries: [string, unknown][]
  expandAll?: boolean
}) {
  const { t, language } = useTranslation()
  const locale = getIntlLocale(language)
  const [isExpanded, setIsExpanded] = useState(expandAll ?? false)

  useEffect(() => {
    if (expandAll !== undefined) {
      setIsExpanded(expandAll)
    }
  }, [expandAll])

  if (entries.length === 0) return null

  const formatMetaValue = (value: unknown): string => {
    if (value === null || value === undefined) return EMPTY_VALUE
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        const formatted = formatDate(value, undefined, locale)
        if (formatted !== value && formatted !== EMPTY_VALUE) return formatted
      }
      return value
    }
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-dashed bg-muted/30">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {t('entity.systemMetadata')}
        </span>
        <span className="rounded-full border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {entries.length}
        </span>
      </button>

      {isExpanded && (
        <div className="grid grid-cols-1 gap-1.5 px-3 pt-1 pb-3 sm:grid-cols-2">
          {entries.map(([key, value]) => {
            const Icon = getMetadataIcon(key)
            const display = formatMetaValue(value)
            return (
              <div
                key={key}
                className="group flex items-center gap-2 rounded-md border bg-background/60 px-2.5 py-1.5"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-mono text-[10px] text-muted-foreground uppercase">
                    {prettyMetadataLabel(key)}
                  </span>
                  <span className="truncate font-medium text-foreground text-xs" title={display}>
                    {display}
                  </span>
                </div>
                <ClickToCopy
                  value={typeof value === 'string' ? value : JSON.stringify(value)}
                  tooltipLabel={t('common.clickToCopy')}
                  tooltipCopiedLabel={t('common.copied')}
                  className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                >
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </ClickToCopy>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Tree node component for structured view
function TreeNode({
  keyName,
  value,
  depth = 0,
  expandAll,
}: {
  keyName: string | number
  value: unknown
  depth?: number
  expandAll?: boolean
}) {
  const { t, language } = useTranslation()
  const locale = getIntlLocale(language)
  const [isExpanded, setIsExpanded] = useState(expandAll ?? false)

  const isObject = value !== null && typeof value === 'object'
  const isArray = Array.isArray(value)

  // React to expandAll changes
  useEffect(() => {
    if (expandAll !== undefined) {
      setIsExpanded(expandAll)
    }
  }, [expandAll])

  const renderValue = () => {
    if (value === null || value === undefined) {
      return <Value.Null />
    }
    if (typeof value === 'boolean') {
      return <Value.Boolean value={value} />
    }
    if (typeof value === 'number') {
      // Check if it might be a duration (field name contains common duration patterns)
      const lowerKey = String(keyName).toLowerCase()
      const isDuration =
        lowerKey.includes('duration') ||
        lowerKey.includes('elapsed') ||
        (lowerKey.includes('time') && !lowerKey.includes('timestamp'))

      if (isDuration && value >= 1000 && value <= 604800000) {
        return <Value.Duration value={value} formatter={formatDuration} />
      }
      return <Value.Number value={value} formatter={formatNumber} />
    }
    if (typeof value === 'string') {
      // Check if it's a date (ISO format or 4D formats)
      const isDatePattern =
        value === '0!0!0' || // 4D null date (compact)
        /^\d{4}-\d{2}-\d{2}/.test(value) || // ISO format
        /^\d{1,2}!\d{1,2}!\d{4}$/.test(value) || // 4D dd!mm!yyyy format
        /^!!\d{4}-\d{2}-\d{2}!!$/.test(value) // 4D !!yyyy-mm-dd!! format

      if (isDatePattern) {
        const formatted = formatDate(value, undefined, locale)
        // Only show as date if it was successfully formatted (not the raw value)
        if (formatted !== value && formatted !== EMPTY_VALUE) {
          return <Value.Date value={formatted} />
        }
        // If it's a null date (!!0000-00-00!!), show null tag
        if (formatted === EMPTY_VALUE) {
          return <Value.Null />
        }
      }
      // Check if it's a URL
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return <Value.Url value={value} truncate={50} />
      }
      // Long strings
      if (value.length > 100) {
        return (
          <span className="text-green-600 text-sm dark:text-green-400">
            "{value.slice(0, 100)}..."
          </span>
        )
      }
      return <span className="text-green-600 text-sm dark:text-green-400">"{value}"</span>
    }
    return <span className="text-sm">{String(value)}</span>
  }

  if (!isObject) {
    return (
      <div className="group flex items-start gap-2 py-1">
        <span className="font-medium text-muted-foreground text-sm">{keyName}:</span>
        {renderValue()}
        <ClickToCopy
          value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
          tooltipLabel={t('common.clickToCopy')}
          tooltipCopiedLabel={t('common.copied')}
          className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </ClickToCopy>
      </div>
    )
  }

  // 4D private binary object (blob/picture serialised as base64) — render a
  // dedicated, expandable viewer instead of the generic object tree.
  if (isPrivateBinaryObject(value)) {
    return (
      <div className="space-y-1 py-1">
        <span className="font-medium text-muted-foreground text-sm">{keyName}</span>
        <BinaryObjectViewer base64={value[PRIVATE_BINARY_OBJECT_KEY]} name={String(keyName)} />
      </div>
    )
  }

  // Photo / picture field (deferred image relation) — render the actual image.
  const imageUrl = getImageUri(value)
  if (imageUrl) {
    return (
      <div className="space-y-1 py-1">
        <span className="font-medium text-muted-foreground text-sm">{keyName}</span>
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-fit rounded-md border bg-muted/30 p-1 transition-colors hover:bg-muted"
          title={t('common.openInNewTab')}
        >
          <DeferredImage
            src={imageUrl}
            alt={String(keyName)}
            className="max-h-48 max-w-full rounded object-contain"
          />
        </a>
      </div>
    )
  }

  // Deferred BLOB (downloadable binary) — render the binary viewer so the value
  // can be inspected, previewed and downloaded, not just linked.
  const blobUrl = getDeferredBlobUrl(value)
  if (blobUrl) {
    return (
      <div className="space-y-1 py-1">
        <span className="font-medium text-muted-foreground text-sm">{keyName}</span>
        <BinaryObjectViewer url={blobUrl} name={String(keyName)} />
      </div>
    )
  }

  // Deferred relation (related entity or entity set) — load asynchronously.
  const deferredRel = getDeferredRelation(value)
  if (deferredRel) {
    return (
      <DeferredRelation
        name={keyName}
        uri={deferredRel.uri}
        kind={deferredRel.key != null ? 'relatedEntity' : 'relatedEntities'}
      />
    )
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => [i, v] as const)
    : Object.entries(value as Record<string, unknown>)

  return (
    <div>
      {/* Toggle button */}
      <div className="group flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-auto gap-1.5 rounded py-0.5 pr-2"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">{keyName}</span>
          <span className="rounded-full border px-2 py-0.5 font-mono text-muted-foreground text-xs">
            {isArray ? `[${entries.length}]` : `{${entries.length}}`}
          </span>
        </Button>
        <ClickToCopy
          value={JSON.stringify(value, null, 2)}
          tooltipLabel={t('common.clickToCopy')}
          tooltipCopiedLabel={t('common.copied')}
          className="rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </ClickToCopy>
      </div>

      {/* Children */}
      {isExpanded && (
        <div className="ml-2 border-border/40 border-l pl-4">
          {entries.map(([k, v]) => (
            <TreeNode
              key={String(k)}
              keyName={k}
              value={v}
              depth={depth + 1}
              expandAll={expandAll}
            />
          ))}
          {entries.length === 0 && (
            <p className="py-1 text-muted-foreground text-sm italic">
              {isArray ? t('entity.emptyArray') : t('entity.emptyObject')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Number of related entities loaded per page for related entity sets
const RELATED_PAGE_SIZE = 20

// Stable empty array so per-tab reads don't trigger spurious re-renders
const EMPTY_ENTITIES: Entity[] = []

// The `__ENTITYSET` field of a sub-entity-set response can be either a bare
// entity-set ID or a full REST path like
// `/rest/Reservation/$entityset/591C3B…`. Extract just the trailing ID so it can
// be reused as a server-side entity set reference.
function extractEntitySetId(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const withoutQuery = value.split('?')[0]
  const match = withoutQuery.match(/\$entityset\/([^/]+)/)
  if (match) return match[1]
  // Fallback: last path segment for plain values or unexpected formats.
  const segments = withoutQuery.split('/').filter(Boolean)
  return segments.length > 0 ? segments[segments.length - 1] : withoutQuery
}

// Render a single related-entity field/cell value. Primitives are formatted via
// the shared 4D formatter; nested objects/arrays show a compact muted marker.
function RelationCellValue({ value }: { value: unknown }) {
  const { t, language } = useTranslation()
  const locale = getIntlLocale(language)

  if (value === null || value === undefined) return <Value.Null />

  // Photo / picture field (deferred image relation) — render the actual image.
  const imageUrl = getImageUri(value)
  if (imageUrl) {
    return (
      <a
        href={imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-fit rounded-md border bg-muted/30 p-1 transition-colors hover:bg-muted"
        title={t('common.openInNewTab')}
      >
        <DeferredImage src={imageUrl} className="max-h-32 max-w-full rounded object-contain" />
      </a>
    )
  }

  // Deferred BLOB (downloadable binary) — render a compact download link.
  const blobUrl = getDeferredBlobUrl(value)
  if (blobUrl) {
    return (
      <a
        href={blobUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1 text-primary text-xs underline-offset-2 hover:underline"
        title={t('common.openInNewTab')}
      >
        <FileText className="h-3.5 w-3.5" />
        {t('entity.downloadBlob')}
      </a>
    )
  }

  // Nested deferred relation — show a compact relation marker rather than JSON.
  if (getDeferredRelation(value)) {
    return <span className="font-mono text-muted-foreground text-xs">→</span>
  }
  if (Array.isArray(value)) {
    return <span className="font-mono text-muted-foreground text-xs">[{value.length}]</span>
  }
  if (typeof value === 'object') {
    return <span className="font-mono text-muted-foreground text-xs">{'{…}'}</span>
  }
  if (typeof value === 'boolean') return <Value.Boolean value={value} />

  const formatted = formatValue(value, locale)
  if (formatted === EMPTY_VALUE) return <Value.Null />
  return <span className="text-foreground">{formatted}</span>
}

// Render a loaded related entity as a read-only form (label/value rows). System
// attributes (prefixed with `__`) are grouped into the collapsible metadata
// panel. Nested deferred relations recurse into their own loader card, which in
// turn renders this form again — so metadata is grouped recursively.
function RelatedEntityForm({ entity }: { entity: Record<string, unknown> }) {
  const internalEntries = Object.entries(entity).filter(([key]) => isInternalAttribute(key))
  const fields = Object.entries(entity).filter(([key]) => !isInternalAttribute(key))
  if (internalEntries.length === 0 && fields.length === 0) return null

  return (
    <div className="space-y-2 py-1">
      <MetadataPanel entries={internalEntries} />
      {fields.map(([key, value]) => {
        const rel = getDeferredRelation(value)
        if (rel) {
          return (
            <DeferredRelation
              key={key}
              name={key}
              uri={rel.uri}
              kind={rel.key != null ? 'relatedEntity' : 'relatedEntities'}
              displayMode="form"
            />
          )
        }
        return (
          <div
            key={key}
            className="grid grid-cols-[minmax(140px,auto)_1fr] items-start gap-3 text-sm"
          >
            <span className="font-medium text-muted-foreground">{key}</span>
            <div className="min-w-0">
              <RelationCellValue value={value} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Render a loaded related entity set using the same data grid as the main table
// view, embedded read-only (no actions column). The grid uses a fixed-height
// viewport so the header stays visible while only the rows scroll vertically.
function RelatedEntityTable({
  items,
  sortColumn,
  sortOrder,
  onSortChange,
}: {
  items: Record<string, unknown>[]
  sortColumn: string | null
  sortOrder: 'asc' | 'desc'
  onSortChange: (column: string | null, order: 'asc' | 'desc') => void
}) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return (
      <p className="py-1 text-muted-foreground text-sm italic">{t('entity.noRelatedEntities')}</p>
    )
  }

  return (
    <div className="h-80 overflow-hidden rounded-md border">
      <EntityDataGrid
        entities={items as Entity[]}
        showActions={false}
        sortColumn={sortColumn}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
      />
    </div>
  )
}

// Deferred relation loader — fetches a related entity or related entity set on
// demand and renders the result inline. Used by both the tree and form views in
// the entity viewer. `displayMode` controls how a loaded single entity renders:
// 'tree' (key/value tree nodes) or 'form' (read-only form rows). Entity sets are
// always rendered as a table.
function isRelationAttribute(attr: Pick<DataClassAttribute, 'kind' | 'behavior'>): boolean {
  return (
    attr.kind === 'relatedEntity' ||
    attr.kind === 'relatedEntities' ||
    attr.behavior === 'relatedEntity' ||
    attr.behavior === 'relatedEntities'
  )
}

function relationKindFromAttr(
  attr: Pick<DataClassAttribute, 'kind' | 'behavior'>
): 'relatedEntity' | 'relatedEntities' {
  if (attr.kind === 'relatedEntities' || attr.behavior === 'relatedEntities') {
    return 'relatedEntities'
  }
  return 'relatedEntity'
}

/**
 * Empty relatedEntity / relatedEntities — compact dashed chrome with schema
 * metadata revealed on expand (collapsed by default).
 */
function NullRelatedEntityCard({
  attr,
  foreignKeyValue,
}: {
  attr: Pick<
    DataClassAttribute,
    'name' | 'type' | 'kind' | 'behavior' | 'foreignKey' | 'inverseName' | 'path' | 'scope'
  >
  foreignKeyValue?: unknown
}) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const isSet = relationKindFromAttr(attr) === 'relatedEntities'
  const relatedType =
    typeof attr.type === 'string' && attr.type.trim() ? attr.type : t('entity.relatedEntity')
  const RelationIcon = isSet ? Network : Link2

  const metaParts: Array<{ key: string; label: string; value: string; mono?: boolean }> = []
  if (attr.foreignKey) {
    const fkDisplay =
      foreignKeyValue === null || foreignKeyValue === undefined || foreignKeyValue === ''
        ? EMPTY_VALUE
        : String(foreignKeyValue)
    metaParts.push({
      key: 'fk',
      label: t('entity.relationForeignKey'),
      value: `${attr.foreignKey}=${fkDisplay}`,
      mono: true,
    })
  }
  if (attr.inverseName) {
    metaParts.push({
      key: 'inv',
      label: t('entity.relationInverse'),
      value: attr.inverseName,
      mono: true,
    })
  }
  if (attr.path) {
    metaParts.push({
      key: 'path',
      label: t('entity.relationPath'),
      value: attr.path,
      mono: true,
    })
  }
  if (attr.scope) {
    metaParts.push({
      key: 'scope',
      label: t('entity.relationScope'),
      value: attr.scope,
    })
  }

  const description = isSet
    ? t('entity.nullRelatedEntitiesDescription', { type: relatedType })
    : t('entity.nullRelatedEntityDescription', { type: relatedType })

  return (
    <div className="my-0.5 overflow-hidden rounded-md border border-border/70 border-dashed bg-muted/10">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left transition-colors hover:bg-muted/40"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-muted/70 text-muted-foreground">
          <Unlink className="h-3 w-3" />
        </span>
        <RelationIcon className="h-3 w-3 shrink-0 text-muted-foreground/80" />
        <span className="min-w-0 truncate font-medium text-[13px] leading-none">{attr.name}</span>
        <span className="shrink-0 rounded-sm border bg-background/80 px-1.5 py-px font-mono text-[10px] text-muted-foreground leading-none">
          {relatedType}
        </span>
        <span className="ml-auto shrink-0 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
          {t('entity.nullRelatedEntityTitle')}
        </span>
        <Value.Null className="shrink-0 border-destructive/25 bg-destructive/10 text-destructive" />
      </button>

      {isExpanded ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-border/40 border-t border-dashed bg-background/20 px-2 py-1">
          <p className="min-w-0 truncate text-[11px] text-muted-foreground leading-snug">
            {description}
          </p>
          {metaParts.length > 0 ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {metaParts.map((part) => (
                <span
                  key={part.key}
                  className="inline-flex max-w-full items-center gap-0.5 rounded-sm border border-border/60 bg-muted/30 px-1.5 py-px text-[9px] text-muted-foreground leading-none"
                  title={`${part.label}: ${part.value}`}
                >
                  <span className="shrink-0 font-medium uppercase tracking-wide opacity-60">
                    {part.label}
                  </span>
                  <span
                    className={cn('min-w-0 truncate text-foreground/90', part.mono && 'font-mono')}
                  >
                    {part.value}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function DeferredRelation({
  name,
  uri,
  kind,
  relatedDataclass,
  displayMode = 'tree',
}: {
  name: string | number
  uri: string
  kind: 'relatedEntity' | 'relatedEntities'
  relatedDataclass?: string
  displayMode?: 'tree' | 'form'
}) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  // Reloading in place (parent entity changed or manual refresh) keeps the
  // currently displayed data visible and only shows a header spinner, so the
  // content swaps without flickering once the new data arrives.
  const [isReloading, setIsReloading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [entity, setEntity] = useState<Record<string, unknown> | null>(null)
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  // Server-side entity set metadata captured when loading a related set, so it
  // can be opened in its own tab.
  const [relatedSetId, setRelatedSetId] = useState<string | null>(null)
  const [relatedModel, setRelatedModel] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const openEntitySetTab = useTabsStore((s) => s.openEntitySetTab)
  const selectDataclass = useDataExplorerStore((s) => s.selectDataclass)

  const isSet = kind === 'relatedEntities'

  const load = useCallback(
    async (mode: 'initial' | 'more' | 'reload') => {
      // For an in-place reload, keep showing the existing content and surface a
      // spinner in the header instead of flipping to the empty loading state.
      if (mode === 'reload') {
        setIsReloading(true)
      } else {
        setStatus('loading')
      }
      setErrorMsg(null)
      try {
        if (isSet) {
          const skip = mode === 'more' ? items.length : 0
          const data = await api.fetchRelated(uri, {
            top: RELATED_PAGE_SIZE,
            skip,
            subEntitySet: true,
            sort: sortColumn ?? undefined,
            order: sortOrder,
          })
          const fetched = (data.__ENTITIES as Record<string, unknown>[] | undefined) ?? []
          const count = (data.__COUNT as number | undefined) ?? fetched.length
          setTotal(count)
          setItems((prev) => (mode === 'more' ? [...prev, ...fetched] : fetched))
          setRelatedSetId(extractEntitySetId(data.__ENTITYSET))
          setRelatedModel((data.__entityModel as string | undefined) ?? null)
        } else {
          const data = await api.fetchRelated(uri)
          setEntity(data)
        }
        setStatus('loaded')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : t('entity.failedToLoadRelated'))
        setStatus('error')
      } finally {
        setIsReloading(false)
      }
    },
    [isSet, items.length, uri, t, sortColumn, sortOrder]
  )

  // Header sort is server-side for related entity sets: changing sort triggers
  // an in-place reload of the current relation.
  useEffect(() => {
    if (!isSet) return
    if (status !== 'loaded') return
    load('reload')
  }, [isSet, status, load])

  const collapse = useCallback(() => {
    setStatus('idle')
    setEntity(null)
    setItems([])
    setTotal(0)
    setRelatedSetId(null)
    setRelatedModel(null)
    setSortColumn(null)
    setSortOrder('asc')
    setErrorMsg(null)
  }, [])

  const handleRelatedSortChange = useCallback((column: string | null, order: 'asc' | 'desc') => {
    setSortColumn(column)
    setSortOrder(order)
  }, [])

  // When the parent entity changes, the relation URI changes too. If this
  // relation was already expanded, reload it so it reflects the newly selected
  // entity instead of showing stale related data. Collapsed relations stay idle.
  const prevUriRef = useRef(uri)
  useEffect(() => {
    if (prevUriRef.current === uri) return
    prevUriRef.current = uri
    if (status === 'loaded' || status === 'error') {
      load('reload')
    }
  }, [uri, status, load])

  // Open the loaded related entity set in its own tab. Title mirrors the REST
  // deferred path, e.g. "Reservation[2]/alternatives". Reuses an existing tab for
  // the same entity set if one is already open instead of creating a duplicate.
  const openInTab = useCallback(() => {
    if (!relatedSetId || !relatedModel) return
    const customTitle = uri.replace(/^\/rest\//, '').split('?')[0]
    openEntitySetTab({
      dataclassName: relatedModel,
      entitySetId: relatedSetId,
      customTitle,
      viewMode: 'table',
      forceNew: false,
    })
    selectDataclass(relatedModel)
  }, [relatedSetId, relatedModel, uri, openEntitySetTab, selectDataclass])

  const RelationIcon = isSet ? Network : Link2

  // Toggle from the header: load when idle/error, collapse when loaded.
  const toggleFromHeader = useCallback(() => {
    if (status === 'loaded') collapse()
    else if (status !== 'loading') load('initial')
  }, [status, collapse, load])

  return (
    <div className="my-1 rounded-lg border border-border/60 bg-muted/20">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={toggleFromHeader}
          disabled={status === 'loading'}
          aria-expanded={status === 'loaded'}
          className="-ml-1 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          {status === 'loaded' ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <RelationIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate font-medium text-sm">{name}</span>
          <span className="rounded-full border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {relatedDataclass ?? (isSet ? t('entity.relatedEntities') : t('entity.relatedEntity'))}
            {isSet && status === 'loaded' ? ` · ${total}` : ''}
          </span>
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          {(status === 'loading' || isReloading) && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {status === 'loaded' && (
            <>
              {isSet && relatedSetId && relatedModel && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground"
                        onClick={openInTab}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('entity.openRelatedInTab')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                      onClick={() => load('reload')}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('entity.reloadRelated')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                      onClick={collapse}
                    >
                      <ChevronsDownUp className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('entity.collapseRelated')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </div>

      {status === 'error' && errorMsg && (
        <div className="px-2.5 pb-2">
          <ErrorList error={errorMsg} variant="inline" />
        </div>
      )}

      {status === 'loaded' && (
        <div className="border-border/40 border-t px-2.5 py-1.5">
          {isSet ? (
            items.length === 0 ? (
              <p className="py-1 text-muted-foreground text-sm italic">
                {t('entity.noRelatedEntities')}
              </p>
            ) : (
              <>
                <RelatedEntityTable
                  items={items}
                  sortColumn={sortColumn}
                  sortOrder={sortOrder}
                  onSortChange={handleRelatedSortChange}
                />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">
                    {t('entity.relatedShowingCount', { shown: items.length, total })}
                  </span>
                  {items.length < total && relatedSetId && relatedModel && (
                    <Button type="button" variant="outline" size="xs" onClick={openInTab}>
                      <ExternalLink />
                      {t('entity.viewAllInTab')}
                    </Button>
                  )}
                </div>
              </>
            )
          ) : entity ? (
            displayMode === 'form' ? (
              <RelatedEntityForm entity={entity} />
            ) : (
              <div>
                <MetadataPanel
                  entries={Object.entries(entity).filter(([k]) => isInternalAttribute(k))}
                />
                {Object.entries(entity)
                  .filter(([k]) => !isInternalAttribute(k))
                  .map(([k, v]) => (
                    <TreeNode key={k} keyName={k} value={v} />
                  ))}
              </div>
            )
          ) : (
            <p className="py-1 text-muted-foreground text-sm italic">
              {t('entity.noRelatedEntity')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Entity stats component
function EntityStats({ entity }: { entity: Record<string, unknown> }) {
  const { t } = useTranslation()
  const stats = useMemo(() => {
    const countFields = (obj: unknown, depth = 0): { fields: number; depth: number } => {
      if (obj === null || typeof obj !== 'object') {
        return { fields: 0, depth }
      }
      const entries = Array.isArray(obj) ? obj : Object.values(obj)
      let totalFields = entries.length
      let maxDepth = depth

      for (const value of entries) {
        if (value !== null && typeof value === 'object') {
          const nested = countFields(value, depth + 1)
          totalFields += nested.fields
          maxDepth = Math.max(maxDepth, nested.depth)
        }
      }
      return { fields: totalFields, depth: maxDepth }
    }

    const { fields, depth } = countFields(entity)
    const jsonSize = JSON.stringify(entity).length

    return { fields, depth, jsonSize }
  }, [entity])

  return (
    <div className="flex items-center gap-4 text-muted-foreground text-xs">
      <span>{t('entity.fieldsCount', { count: stats.fields })}</span>
      <span className="text-border">•</span>
      <span>{t('entity.levelsDeep', { count: stats.depth })}</span>
      <span className="text-border">•</span>
      <span>{t('entity.sizeKb', { size: (stats.jsonSize / 1024).toFixed(1) })}</span>
    </div>
  )
}

// Image field component (extracted to avoid conditional hooks)
function ImageField({
  attr,
  entity,
  dataclassName,
  entityId,
  isEditing,
  isReadonly,
  onFieldChange,
}: {
  attr: { name: string; readOnly?: boolean; kind?: string }
  entity: Record<string, unknown>
  dataclassName: string | null
  entityId: string | null
  isEditing: boolean
  isReadonly: boolean
  onFieldChange: (field: string, value: unknown) => void
}) {
  const { t } = useTranslation()
  const imageUrl = getImageUrl(entity, attr.name, dataclassName, entityId)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fieldId = `field-${attr.name}`

  // Set preview URL when value changes
  useEffect(() => {
    if (imageUrl) {
      setPreviewUrl(imageUrl)
    } else {
      setPreviewUrl(null)
    }
  }, [imageUrl])

  // Validate file type (images and PDFs)
  const isValidFileType = useCallback((file: File): boolean => {
    return file.type.startsWith('image/') || file.type === 'application/pdf'
  }, [])

  // Handle file upload
  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file || !isEditing || isReadonly) return

      // Validate file type
      if (!isValidFileType(file)) {
        alert(t('entity.selectImageOrPdf'))
        return
      }

      setUploading(true)
      try {
        // Create preview for images only
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onloadend = () => {
            setPreviewUrl(reader.result as string)
          }
          reader.readAsDataURL(file)
        } else if (file.type === 'application/pdf') {
          // For PDFs, show a placeholder or icon
          setPreviewUrl(null)
        }

        // Upload file (use $rawPict=true for images, $binary=true for PDFs)
        const isImage = file.type.startsWith('image/')
        const result = await api.uploadFile(file, isImage)
        // Store upload ID in form data
        onFieldChange(attr.name, { ID: result.ID })
      } catch (err) {
        alert(err instanceof Error ? err.message : t('entity.failedToUploadFile'))
        setPreviewUrl(imageUrl || null)
      } finally {
        setUploading(false)
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [attr.name, isEditing, isReadonly, imageUrl, onFieldChange, isValidFileType, t]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        await handleFileUpload(file)
      }
    },
    [handleFileUpload]
  )

  const handleRemoveImage = useCallback(() => {
    if (isReadonly) return
    setPreviewUrl(null)
    onFieldChange(attr.name, null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [attr.name, isReadonly, onFieldChange])

  // Drag and drop handlers
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!isEditing || isReadonly) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
    },
    [isEditing, isReadonly]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isEditing || isReadonly) return
      e.preventDefault()
      e.stopPropagation()
    },
    [isEditing, isReadonly]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!isEditing || isReadonly) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const file = e.dataTransfer.files?.[0]
      if (file) {
        await handleFileUpload(file)
      }
    },
    [isEditing, isReadonly, handleFileUpload]
  )

  return (
    <div className="grid grid-cols-[minmax(180px,auto)_1fr] items-start gap-3">
      <Label htmlFor={fieldId} className="flex items-center gap-1.5 pt-2 text-sm">
        <span>{attr.name}</span>
        <div className="flex items-center gap-1">
          {attr.readOnly && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>{t('entity.readOnlyField')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {attr.kind && attr.kind === 'calculated' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Calculator className="h-3 w-3 shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>{t('entity.computedField')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </Label>
      <div>
        {previewUrl ? (
          <section
            className={cn(
              'relative inline-block rounded-md transition-colors',
              isDragging && 'ring-2 ring-primary ring-offset-2'
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            aria-label={t('entity.imageDropZoneAria')}
          >
            <DeferredImage
              src={previewUrl}
              alt={attr.name}
              className="max-h-48 max-w-full rounded-md border object-contain"
            />
            {isEditing && !isReadonly && (
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="h-6 gap-1 px-2 text-xs"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t('entity.uploading')}
                    </>
                  ) : (
                    <>
                      <Upload className="h-3 w-3" />
                      {t('entity.replace')}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveImage}
                  disabled={uploading}
                  className="h-6 gap-1 px-2 text-destructive text-xs"
                >
                  <X className="h-3 w-3" />
                  {t('common.remove')}
                </Button>
              </div>
            )}
          </section>
        ) : (
          <section
            className={cn(
              'rounded-lg transition-colors',
              isDragging && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              isEditing && !isReadonly && 'cursor-pointer'
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => {
              if (isEditing && !isReadonly && !uploading) {
                fileInputRef.current?.click()
              }
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && isEditing && !isReadonly && !uploading) {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            role={isEditing && !isReadonly ? 'button' : undefined}
            tabIndex={isEditing && !isReadonly ? 0 : undefined}
            aria-label={t('entity.imageDropZoneAria')}
          >
            <EmptyPanel
              icon={ImageIcon}
              badgeIcon={isEditing && !isReadonly ? Upload : undefined}
              badgeTone="primary"
              title={isDragging ? t('entity.dropImageOrPdfHere') : t('entity.noImage')}
              description={
                isEditing && !isReadonly
                  ? t('entity.orDragAndDropHere')
                  : t('entity.noImageDescription')
              }
              ghost="rows"
              bordered
              size="sm"
              className="min-h-36 w-full"
              action={
                isEditing && !isReadonly ? (
                  <EmptyPanelAction
                    icon={uploading ? Loader2 : Upload}
                    disabled={uploading}
                    onClick={(event) => {
                      event.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    {uploading ? t('entity.uploading') : t('entity.uploadImageOrPdf')}
                  </EmptyPanelAction>
                ) : undefined
              }
            />
          </section>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isReadonly || !isEditing}
        />
      </div>
    </div>
  )
}

// Blob field component (generic file upload, any file type)
function BlobField({
  attr,
  entity,
  isEditing,
  isReadonly,
  onFieldChange,
}: {
  attr: { name: string; readOnly?: boolean }
  entity: Record<string, unknown>
  isEditing: boolean
  isReadonly: boolean
  onFieldChange: (field: string, value: unknown) => void
}) {
  const { t } = useTranslation()
  const value = entity[attr.name]
  // An existing, unmodified BLOB comes back as a deferred download URI.
  const existingBlobUrl = getDeferredBlobUrl(value)
  const hasUpload = (value && typeof value === 'object' && 'ID' in value) || existingBlobUrl != null
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fieldId = `field-${attr.name}`

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file || !isEditing || isReadonly) return
      setUploading(true)
      try {
        const result = await api.uploadFile(file, false)
        onFieldChange(attr.name, { ID: result.ID })
        setFileName(file.name)
      } catch (err) {
        alert(err instanceof Error ? err.message : t('entity.failedToUploadFile'))
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [attr.name, isEditing, isReadonly, onFieldChange, t]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void handleFileUpload(file)
    },
    [handleFileUpload]
  )

  const handleRemove = useCallback(() => {
    if (isReadonly) return
    onFieldChange(attr.name, null)
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [attr.name, isReadonly, onFieldChange])

  const [isDragging, setIsDragging] = useState(false)
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!isEditing || isReadonly) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
    },
    [isEditing, isReadonly]
  )
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isEditing || isReadonly) return
      e.preventDefault()
      e.stopPropagation()
    },
    [isEditing, isReadonly]
  )
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!isEditing || isReadonly) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void handleFileUpload(file)
    },
    [isEditing, isReadonly, handleFileUpload]
  )

  return (
    <div className="grid grid-cols-[minmax(180px,auto)_1fr] items-start gap-3">
      <Label htmlFor={fieldId} className="flex items-center gap-1.5 pt-2 text-sm">
        <span>{attr.name}</span>
      </Label>
      <div>
        {existingBlobUrl && !fileName && !isEditing ? (
          <BinaryObjectViewer url={existingBlobUrl} name={attr.name} />
        ) : (
          <section
            className={cn(
              'flex flex-col items-center justify-center rounded-md border-2 border-muted-foreground/25 border-dashed p-4 transition-colors',
              isDragging && 'border-primary bg-primary/5',
              isEditing && !isReadonly && 'cursor-pointer hover:border-primary/50'
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => {
              if (isEditing && !isReadonly && !uploading) fileInputRef.current?.click()
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && isEditing && !isReadonly && !uploading) {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            role={isEditing && !isReadonly ? 'button' : undefined}
            tabIndex={isEditing && !isReadonly ? 0 : undefined}
            aria-label={t('entity.fileDropZoneAria')}
          >
            {hasUpload || fileName ? (
              <>
                <p className="text-muted-foreground text-sm">
                  {fileName ?? t('entity.fileUploaded')}
                </p>
                {existingBlobUrl && !fileName && (
                  <a
                    href={existingBlobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-xs transition-colors hover:bg-muted"
                    title={t('common.openInNewTab')}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {t('entity.downloadBlob')}
                  </a>
                )}
                {isEditing && !isReadonly && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      disabled={uploading}
                      className="h-6 gap-1 px-2 text-xs"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('entity.uploading')}
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3" />
                          {t('entity.replace')}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemove()
                      }}
                      disabled={uploading}
                      className="h-6 gap-1 px-2 text-destructive text-xs"
                    >
                      <X className="h-3 w-3" />
                      {t('common.remove')}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="mb-2 text-muted-foreground text-sm">
                  {isDragging ? t('entity.dropFileHere') : t('entity.noFile')}
                </p>
                {isEditing && !isReadonly && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      disabled={uploading}
                      className="h-6 gap-1 px-2 text-xs"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('entity.uploading')}
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3" />
                          {t('entity.uploadFile')}
                        </>
                      )}
                    </Button>
                    <p className="mt-2 text-muted-foreground text-xs">
                      {t('entity.orDragAndDropHere')}
                    </p>
                  </>
                )}
              </>
            )}
          </section>
        )}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isReadonly || !isEditing}
        />
      </div>
    </div>
  )
}

function FormViewDurationField({
  attr,
  value,
  onFieldChange,
  fieldId,
  isReadonly,
}: {
  attr: { name: string }
  value: unknown
  onFieldChange: (field: string, value: number | null) => void
  fieldId: string
  isReadonly: boolean
}) {
  const { t } = useTranslation()
  const formatted = durationValueToInputValue(value)
  const [rawString, setRawString] = useState(formatted)
  const lastPushedRef = useRef<number | null>(null)

  useEffect(() => {
    const same =
      (value == null && lastPushedRef.current == null) ||
      (typeof value === 'number' && value === lastPushedRef.current)
    if (same) return
    lastPushedRef.current = typeof value === 'number' && !Number.isNaN(value) ? value : null
    setRawString(durationValueToInputValue(value))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setRawString(next)
    const parsed = parseDurationInput(next)
    if (parsed !== null) {
      lastPushedRef.current = parsed
      onFieldChange(attr.name, parsed)
      // Do not setRawString(formatted) here: it overwrites the user's input while typing.
      // Sync from props happens in useEffect.
    } else {
      lastPushedRef.current = null
      onFieldChange(attr.name, null)
    }
  }

  const handleBlur = () => {
    setRawString(durationValueToInputValue(value))
  }

  return (
    <Input
      id={fieldId}
      type="text"
      value={rawString}
      onChange={handleChange}
      onBlur={handleBlur}
      readOnly={isReadonly}
      disabled={isReadonly}
      placeholder={t('entity.durationPlaceholder')}
    />
  )
}

// Object/unknown attribute rendered as syntax-highlighted JSON. Read-only mode
// Object attributes: read mode uses the console JSON tree; edit mode uses the
// code editor (toolbar, formatting, validation). Local text state keeps editing
// smooth without reformatting on every keystroke; remounting (via key) reseeds it.
function ObjectCodeField({
  value,
  isReadonly,
  onChange,
  labels,
  editorPrefs,
  onEditorPrefsChange,
}: {
  value: unknown
  isReadonly: boolean
  onChange: (value: unknown) => void
  labels: React.ComponentProps<typeof CodeEditor>['labels']
  editorPrefs: React.ComponentProps<typeof CodeEditor>['editorPrefs']
  onEditorPrefsChange: React.ComponentProps<typeof CodeEditor>['onEditorPrefsChange']
}) {
  if (isReadonly) {
    return (
      <div className="overflow-hidden rounded-md border">
        <JsonTreePreview
          value={value ?? null}
          className="h-auto max-h-72"
          contentClassName="max-h-64"
        />
      </div>
    )
  }

  return (
    <ObjectCodeFieldEditor
      value={value}
      onChange={onChange}
      labels={labels}
      editorPrefs={editorPrefs}
      onEditorPrefsChange={onEditorPrefsChange}
    />
  )
}

function ObjectCodeFieldEditor({
  value,
  onChange,
  labels,
  editorPrefs,
  onEditorPrefsChange,
}: {
  value: unknown
  onChange: (value: unknown) => void
  labels: React.ComponentProps<typeof CodeEditor>['labels']
  editorPrefs: React.ComponentProps<typeof CodeEditor>['editorPrefs']
  onEditorPrefsChange: React.ComponentProps<typeof CodeEditor>['onEditorPrefsChange']
}) {
  const [text, setText] = useState(() => (value != null ? JSON.stringify(value, null, 2) : ''))
  const [invalid, setInvalid] = useState(false)

  const handleChange = (next: string) => {
    setText(next)
    if (!next.trim()) {
      setInvalid(false)
      onChange(null)
      return
    }
    try {
      const parsed = JSON.parse(next)
      setInvalid(false)
      onChange(parsed)
    } catch {
      // Keep the raw text so the user can keep typing; mark as invalid.
      setInvalid(true)
      onChange(next)
    }
  }

  const lineCount = text ? text.split('\n').length : 1
  const height = `${Math.min(Math.max(lineCount, 3), 18) * 21 + 16}px`

  return (
    <div className="overflow-hidden rounded-md border">
      <CodeEditor
        value={text}
        onChange={handleChange}
        language="json"
        showLineNumbers
        highlightActiveLine
        toolbar
        error={invalid}
        height={height}
        fontSize={12}
        labels={labels}
        editorPrefs={editorPrefs}
        onEditorPrefsChange={onEditorPrefsChange}
      />
    </div>
  )
}

// Form view component for editing entities with form controls
function FormView({
  entity,
  dataclassName,
  isEditing,
  readonlyMode,
  onFieldChange,
  entityId,
}: {
  entity: Record<string, unknown>
  dataclassName: string | null
  isEditing: boolean
  readonlyMode: boolean
  onFieldChange: (field: string, value: unknown) => void
  entityId: string | null
}) {
  const { t } = useTranslation()
  const editorLabels = useEditorLabels()
  const codeEditorPrefs = useCodeEditorPrefs()
  const updateCodeEditorPrefs = useUpdateCodeEditorPrefs()
  const [schema, setSchema] = useState<Awaited<ReturnType<typeof api.getDataclassSchema>> | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch schema when dataclass changes
  useEffect(() => {
    if (!dataclassName) {
      setSchema(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    api
      .getDataclassSchema(dataclassName)
      .then((s) => {
        setSchema(s)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('entity.failedToLoadSchema'))
        setLoading(false)
      })
  }, [dataclassName, t])

  // Get displayable attributes (filter out system fields, primary key).
  // Relations are shown inline (as loaders) in view mode but hidden in edit mode.
  // Readonly fields are shown in view mode but hidden in edit mode.
  const displayableAttributes = useMemo(() => {
    if (!schema) return []

    const primaryKey = schema.key
    const systemFields = new Set(['__TIMESTAMP', '__KEY', '__STAMP', '__DATACLASS'])

    return schema.attributes.filter((attr) => {
      // Skip system fields
      if (systemFields.has(attr.name)) return false
      // Skip primary key
      if (attr.name === primaryKey) return false
      // Relations can't be edited inline — hide them in edit mode
      if (isEditing && (attr.kind === 'relatedEntity' || attr.kind === 'relatedEntities'))
        return false
      // Include image and blob (upload in edit mode)
      // Hide readonly fields in edit mode
      if (isEditing && attr.readOnly) return false
      return true
    })
  }, [schema, isEditing])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <ErrorList error={error} title={t('common.somethingWentWrong')} variant="centered" />
      </div>
    )
  }

  if (!schema || displayableAttributes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">
          {schema ? t('entity.noFieldsAvailable') : t('entity.schemaNotAvailable')}
        </p>
      </div>
    )
  }

  // Helper component for field label with icons
  const FieldLabel = ({
    htmlFor,
    children,
    attr,
  }: {
    htmlFor: string
    children: React.ReactNode
    attr: (typeof displayableAttributes)[0]
  }) => (
    <Label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm">
      <span>{children}</span>
      <div className="flex items-center gap-1">
        {attr.readOnly && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>{t('entity.readOnlyField')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {attr.kind === 'calculated' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Calculator className="h-3 w-3 shrink-0 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>{t('entity.computedField')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </Label>
  )

  const renderField = (attr: (typeof displayableAttributes)[0]) => {
    const value = entity[attr.name]
    const isReadonly = attr.readOnly || readonlyMode || !isEditing
    const fieldId = `field-${attr.name}`

    // Loadable relation (related entity or entity set) — render an inline loader
    // card instead of raw JSON. Detected by value so alias relations are caught too.
    const deferredRel = getDeferredRelation(value)
    if (deferredRel) {
      const relKind =
        attr.kind === 'relatedEntities'
          ? 'relatedEntities'
          : attr.kind === 'relatedEntity'
            ? 'relatedEntity'
            : deferredRel.key != null
              ? 'relatedEntity'
              : 'relatedEntities'
      return (
        <DeferredRelation
          key={attr.name}
          name={attr.name}
          uri={deferredRel.uri}
          kind={relKind}
          relatedDataclass={typeof attr.type === 'string' ? attr.type : undefined}
          displayMode="form"
        />
      )
    }

    // Null / missing relatedEntity — show relation chrome + schema metadata
    // instead of falling through to a JSON `null` object tree.
    if (isRelationAttribute(attr) && (value === null || value === undefined)) {
      return (
        <NullRelatedEntityCard
          key={attr.name}
          attr={attr}
          foreignKeyValue={attr.foreignKey ? entity[attr.foreignKey] : undefined}
        />
      )
    }

    // Boolean fields
    if (attr.type === 'bool') {
      return (
        <div key={attr.name} className="grid grid-cols-[minmax(180px,auto)_1fr] items-center gap-3">
          <div />
          <div className="flex items-center gap-2">
            <Checkbox
              id={fieldId}
              checked={value === true}
              onCheckedChange={(checked) => onFieldChange(attr.name, checked === true)}
              disabled={isReadonly}
            />
            <FieldLabel htmlFor={fieldId} attr={attr}>
              {attr.name}
            </FieldLabel>
          </div>
        </div>
      )
    }

    // Number fields
    if (
      ['number', 'long', 'long64', 'word', 'byte'].includes(attr.type) ||
      (typeof attr.type === 'string' && attr.type.startsWith('number'))
    ) {
      return (
        <div key={attr.name} className="grid grid-cols-[minmax(180px,auto)_1fr] items-center gap-3">
          <FieldLabel htmlFor={fieldId} attr={attr}>
            {attr.name}
          </FieldLabel>
          <Input
            id={fieldId}
            type="number"
            value={value != null ? String(value) : ''}
            onChange={(e) => {
              const numValue = e.target.value === '' ? null : Number(e.target.value)
              onFieldChange(attr.name, numValue)
            }}
            readOnly={isReadonly}
            disabled={isReadonly}
          />
        </div>
      )
    }

    // Date fields
    if (attr.type === 'date') {
      return (
        <div key={attr.name} className="grid grid-cols-[minmax(180px,auto)_1fr] items-center gap-3">
          <FieldLabel htmlFor={fieldId} attr={attr}>
            {attr.name}
          </FieldLabel>
          <Input
            id={fieldId}
            type="date"
            value={dateValueToInputValue(value)}
            onChange={(e) => onFieldChange(attr.name, e.target.value || null)}
            readOnly={isReadonly}
            disabled={isReadonly}
          />
        </div>
      )
    }

    // Duration fields
    if (attr.type === 'duration') {
      return (
        <div key={attr.name} className="grid grid-cols-[minmax(180px,auto)_1fr] items-center gap-3">
          <FieldLabel htmlFor={fieldId} attr={attr}>
            {attr.name}
          </FieldLabel>
          <FormViewDurationField
            attr={attr}
            value={value}
            onFieldChange={onFieldChange}
            fieldId={fieldId}
            isReadonly={isReadonly}
          />
        </div>
      )
    }

    // Image fields
    if (attr.type === 'image') {
      return (
        <ImageField
          key={attr.name}
          attr={attr}
          entity={entity}
          dataclassName={dataclassName}
          entityId={entityId}
          isEditing={isEditing}
          isReadonly={isReadonly}
          onFieldChange={onFieldChange}
        />
      )
    }

    // Blob fields (generic file upload)
    if (attr.type === 'blob') {
      return (
        <BlobField
          key={attr.name}
          attr={attr}
          entity={entity}
          isEditing={isEditing}
          isReadonly={isReadonly}
          onFieldChange={onFieldChange}
        />
      )
    }

    // String fields (check if multiline)
    if (attr.type === 'string' || attr.type === 'uuid') {
      const isMultiline = typeof value === 'string' && value.length > 100

      if (isMultiline) {
        return (
          <div key={attr.name} className="space-y-2">
            <FieldLabel htmlFor={fieldId} attr={attr}>
              {attr.name}
            </FieldLabel>
            <Textarea
              id={fieldId}
              value={value != null ? String(value) : ''}
              onChange={(e) => onFieldChange(attr.name, e.target.value || null)}
              readOnly={isReadonly}
              disabled={isReadonly}
              rows={6}
            />
          </div>
        )
      }

      return (
        <div key={attr.name} className="grid grid-cols-[minmax(180px,auto)_1fr] items-center gap-3">
          <FieldLabel htmlFor={fieldId} attr={attr}>
            {attr.name}
          </FieldLabel>
          <Input
            id={fieldId}
            type="text"
            value={value != null ? String(value) : ''}
            onChange={(e) => onFieldChange(attr.name, e.target.value || null)}
            readOnly={isReadonly}
            disabled={isReadonly}
          />
        </div>
      )
    }

    // 4D private binary object (blob/picture serialised as base64)
    if (isPrivateBinaryObject(value)) {
      return (
        <div key={attr.name} className="space-y-2">
          <FieldLabel htmlFor={fieldId} attr={attr}>
            {attr.name}
          </FieldLabel>
          <BinaryObjectViewer base64={value[PRIVATE_BINARY_OBJECT_KEY]} name={attr.name} />
        </div>
      )
    }

    // Object/unknown types — console JSON tree in view mode; code editor when editing.
    return (
      <div key={attr.name} className="space-y-2">
        <FieldLabel htmlFor={fieldId} attr={attr}>
          {attr.name}
        </FieldLabel>
        <ObjectCodeField
          key={`${entityId ?? 'new'}-${attr.name}-${isReadonly}`}
          value={value}
          isReadonly={isReadonly}
          onChange={(next) => onFieldChange(attr.name, next)}
          labels={editorLabels}
          editorPrefs={codeEditorPrefs}
          onEditorPrefsChange={updateCodeEditorPrefs}
        />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">{displayableAttributes.map((attr) => renderField(attr))}</div>
    </ScrollArea>
  )
}

export type EntityViewerProps =
  | { tabId: string; entity?: undefined; dataclassName?: undefined }
  | {
      tabId?: undefined
      entity: Record<string, unknown>
      dataclassName?: string | null
    }

export function EntityViewer(props: EntityViewerProps) {
  const { t } = useTranslation()
  const editorLabels = useEditorLabels()
  const codeEditorPrefs = useCodeEditorPrefs()
  const updateCodeEditorPrefs = useUpdateCodeEditorPrefs()
  const { updateEntity, deleteEntity, selectEntity, fetchEntities } = useDataExplorerStore()
  const isStandalone = props.entity !== undefined
  const tabId = props.tabId ?? ''
  const sourceEntity = props.entity ?? null
  const [standaloneEntity, setStandaloneEntity] = useState<Record<string, unknown> | null>(
    sourceEntity
  )

  useEffect(() => {
    if (isStandalone) setStandaloneEntity(sourceEntity)
  }, [isStandalone, sourceEntity])

  // This viewer renders a specific tab (kept mounted across tab switches), so it
  // reads its own tab and cached entity slice rather than the active-tab mirror.
  const activeDataclassTab = useTabsStore((s) => {
    const tab = s.tabs.find((t) => t.id === tabId)
    return tab && isDataclassTab(tab) ? tab : null
  })
  const selectedDataclass = isStandalone
    ? (props.dataclassName ??
      (typeof standaloneEntity?.__DATACLASS === 'string'
        ? standaloneEntity.__DATACLASS
        : typeof standaloneEntity?.__entityModel === 'string'
          ? standaloneEntity.__entityModel
          : null))
    : (activeDataclassTab?.dataclassName ?? null)
  const view = useDataExplorerStore((s) => s.tabData[tabId])
  const storeSelectedEntity = view?.selectedEntity ?? null
  const storeSelectedEntityId = view?.selectedEntityId ?? null
  const selectedEntityId = isStandalone
    ? String(standaloneEntity?.__KEY ?? standaloneEntity?.id ?? '') || null
    : (storeSelectedEntityId ?? activeDataclassTab?.selectedEntityId ?? null)
  const entities = isStandalone ? EMPTY_ENTITIES : (view?.entities ?? EMPTY_ENTITIES)
  const pagination = isStandalone ? null : (view?.pagination ?? null)

  // When a field selection ($attributes/select) is active, the entities loaded
  // in the list are partial (only the selected columns). The details view must
  // always show ALL attributes, so fetch the full entity by key when a selection
  // is active and use it in place of the partial list entity. A selection can
  // come from the FieldManager (per-tab fieldConfig) or the advanced query
  // builder (queryOptions.select).
  const querySelect = activeDataclassTab?.queryOptions.select
  const selectActive =
    !isStandalone &&
    ((activeDataclassTab?.fieldConfig?.table.length ?? 0) > 0 ||
      (activeDataclassTab?.fieldConfig?.cards.length ?? 0) > 0 ||
      (querySelect?.trim().length ?? 0) > 0)
  const [fullEntity, setFullEntity] = useState<Entity | null>(null)
  // True while the full entity for the newly selected id is being fetched. While
  // loading we keep displaying the previously loaded full entity (instead of an
  // empty/partial panel) to avoid flickering, and disable the panel controls.
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const selectedEntity = isStandalone
    ? standaloneEntity
    : fullEntity && fullEntity.id === selectedEntityId
      ? fullEntity
      : isLoadingDetails && fullEntity
        ? fullEntity
        : storeSelectedEntity

  // setSelectedEntityId for syncing with EntityList
  const setSelectedEntityId = useTabsStore((s) => s.setSelectedEntityId)

  // Get focused entity index for syncing with EntityList
  const { setFocusedEntityIndex } = useKeyboardShortcutsContext()

  // Readonly mode
  const settingsReadonlyMode = useReadonlyMode()
  const readonlyMode = isStandalone || settingsReadonlyMode

  // Get default entity view mode from settings
  const defaultEntityViewMode = useDefaultEntityViewMode()

  // Get default edit mode from settings
  const defaultEditMode = useDefaultEditMode()

  const highlightInGraph = useHighlightInGraph()

  const pageFirstShortcut = useShortcut('page-first')
  const navPrevShortcut = useShortcut('nav-prev')
  const navNextShortcut = useShortcut('nav-next')
  const pageLastShortcut = useShortcut('page-last')
  const editEntityShortcut = useShortcut('edit-entity')
  const saveEntityShortcut = useShortcut('save-entity')
  const cancelEditShortcut = useShortcut('cancel-edit')
  const deleteEntityShortcut = useShortcut('delete-entity')
  const openStructureShortcut = useShortcut('open-structure')

  const [activeTab, setActiveTab] = useState<'tree' | 'json' | 'form'>(
    defaultEntityViewMode === 'tree' ? 'tree' : defaultEntityViewMode === 'json' ? 'json' : 'form'
  )
  const [previousTab, setPreviousTab] = useState<'tree' | 'json' | 'form'>(
    defaultEntityViewMode === 'tree' ? 'tree' : defaultEntityViewMode === 'json' ? 'json' : 'form'
  )
  const activeTabRef = useRef(activeTab)

  // Sync with settings when default entity view mode changes
  useEffect(() => {
    const tab =
      defaultEntityViewMode === 'tree' ? 'tree' : defaultEntityViewMode === 'json' ? 'json' : 'form'
    setActiveTab(tab)
    setPreviousTab(tab)
    activeTabRef.current = tab
  }, [defaultEntityViewMode])

  // Keep ref in sync with state
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])
  const [isEditing, setIsEditing] = useState(false)
  const [editedEntity, setEditedEntity] = useState('')
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  // Update editor content when selected entity changes
  useEffect(() => {
    if (selectedEntity) {
      setEditedEntity(JSON.stringify(selectedEntity, null, 2))
      setFormData(selectedEntity)
      setIsEditing(false)
      setExpandAll(undefined) // Reset expand state for new entity
    }
  }, [selectedEntity])

  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccessAt, setSaveSuccessAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined)

  // Hydrate entity details when we have a selected id but no in-memory entity
  // (e.g. after reload: tab persists selectedEntityId, entity payload does not),
  // or when a field selection means the list row is only a partial projection.
  useEffect(() => {
    if (isStandalone || !selectedDataclass || !selectedEntityId) {
      setFullEntity(null)
      setIsLoadingDetails(false)
      return
    }

    const hasMatchingStoreEntity = storeSelectedEntity?.id === selectedEntityId
    if (hasMatchingStoreEntity && !selectActive) {
      setFullEntity(null)
      setIsLoadingDetails(false)
      return
    }

    let cancelled = false
    setIsLoadingDetails(true)
    api
      .getEntity(selectedDataclass, selectedEntityId)
      .then((res) => {
        if (!cancelled) setFullEntity(res.entity as Entity)
      })
      .catch(() => {
        if (!cancelled) setFullEntity(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetails(false)
      })
    return () => {
      cancelled = true
    }
  }, [isStandalone, selectActive, selectedDataclass, selectedEntityId, storeSelectedEntity?.id])

  useEffect(() => {
    if (saveSuccessAt === null) return
    const t = setTimeout(() => setSaveSuccessAt(null), 2000)
    return () => clearTimeout(t)
  }, [saveSuccessAt])

  useEffect(() => {
    if (!isEditing) setError(null)
  }, [isEditing])

  const { confirm, ConfirmDialog } = useConfirm()
  const toast = useToast()
  const formRef = useRef<EntityFormHandle>(null)

  // Save from EntityForm (form tab when editing)
  const handleSaveFromForm = useCallback(
    async (data: Record<string, unknown>) => {
      if (isStandalone || !selectedEntityId || !selectedDataclass) return

      setError(null)
      try {
        let dataToSave: Record<string, unknown> = { ...data }
        if (selectedEntity && '__STAMP' in selectedEntity) {
          dataToSave.__STAMP = selectedEntity.__STAMP
        }
        const sanitized = await sanitizeForEditing(dataToSave, selectedDataclass)
        dataToSave = sanitized
        if (selectedEntity && '__STAMP' in selectedEntity) {
          dataToSave.__STAMP = selectedEntity.__STAMP
        }
        try {
          const schema = await api.getDataclassSchema(selectedDataclass)
          for (const attr of schema.attributes) {
            if (attr.type !== 'blob' && attr.type !== 'image') continue
            const value = data[attr.name]
            if (
              value &&
              typeof value === 'object' &&
              'ID' in value &&
              typeof (value as { ID: string }).ID === 'string'
            ) {
              dataToSave[attr.name] = value
            }
          }
        } catch {
          // If schema fetch fails, skip preserving image/blob fields
        }
        await updateEntity(selectedEntityId, dataToSave)
        setIsEditing(false)
        setFullEntity(null)
        setSaveSuccessAt(Date.now())
      } catch (err) {
        setError(err instanceof Error ? err.message : t('entity.failedToSaveEntity'))
        throw err
      }
    },
    [isStandalone, selectedEntityId, selectedDataclass, selectedEntity, updateEntity, t]
  )

  // Save from JSON tab (CodeEditor)
  const handleSave = useCallback(async () => {
    if (isStandalone || !selectedEntityId) return
    if (activeTab !== 'json') return

    setError(null)
    setIsSaving(true)
    try {
      if (!editedEntity) return
      const dataToSave = JSON.parse(editedEntity) as Record<string, unknown>
      if (selectedEntity && '__STAMP' in selectedEntity && !('__STAMP' in dataToSave)) {
        dataToSave.__STAMP = selectedEntity.__STAMP
      }
      await updateEntity(selectedEntityId, dataToSave)
      setIsEditing(false)
      setFullEntity(null)
      setSaveSuccessAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('entity.failedToSaveEntity'))
    } finally {
      setIsSaving(false)
    }
  }, [isStandalone, selectedEntityId, activeTab, editedEntity, selectedEntity, updateEntity, t])

  const handleDelete = useCallback(async () => {
    if (isStandalone || !selectedEntityId || !selectedDataclass) return

    const confirmed = await confirm({
      title: t('entity.deleteEntityTitle'),
      description: (
        <div className="space-y-4">
          <p>{t('entity.deleteConfirmDescription')}</p>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-muted-foreground text-sm">
              <strong>{t('entity.keyLabel')}</strong> {selectedEntityId}
            </p>
          </div>
        </div>
      ),
      confirmText: t('entity.delete'),
      variant: 'destructive',
      icon: <Trash2 className="h-5 w-5 text-destructive" />,
    })

    if (!confirmed) return

    try {
      await deleteEntity(selectedEntityId)
    } catch (err) {
      const reason = formatThrownError(err, t('entity.failedToDeleteEntity'))
      toast.error(
        t('entity.deleteEntityErrorTitle', {
          dataclass: selectedDataclass ?? '',
          key: selectedEntityId,
        }),
        { description: t('entity.actionErrorReason', { reason }) }
      )
    }
  }, [isStandalone, selectedEntityId, selectedDataclass, deleteEntity, confirm, t, toast])

  // Handle entering edit mode with optional mode override
  const handleEnterEditMode = useCallback(
    async (editMode?: EditMode) => {
      if (isStandalone || !selectedEntity || !selectedDataclass) return

      // Store current tab before switching
      setPreviousTab(activeTabRef.current)

      // Use provided mode, or default from settings
      const targetMode = editMode ?? defaultEditMode
      setActiveTab(targetMode)
      setIsEditing(true)

      // Filter entity before setting it in the editor
      const filtered = await sanitizeForEditing(selectedEntity, selectedDataclass)
      setEditedEntity(JSON.stringify(filtered, null, 2))
      setFormData(filtered)
    },
    [isStandalone, selectedEntity, selectedDataclass, defaultEditMode]
  )

  // Handle form field changes (used by FormView in read-only form tab)
  const handleFormFieldChange = useCallback((field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setIsEditing(true)
  }, [])

  // Reload the currently selected entity from the server, refreshing all of its
  // attributes (including deferred BLOBs/relations, which are keyed off the
  // freshly fetched value). No-op while editing to avoid discarding local edits.
  const [isReloadingEntity, setIsReloadingEntity] = useState(false)
  const handleReloadEntity = useCallback(async () => {
    if (!selectedDataclass || !selectedEntityId || isEditing) return
    setIsReloadingEntity(true)
    setError(null)
    try {
      const res = await api.getEntity(selectedDataclass, selectedEntityId)
      const entity = res.entity as Entity
      if (isStandalone) {
        setStandaloneEntity(entity)
        return
      }
      // Keep the full-attribute details view in sync when a field selection is
      // active; otherwise the shared/store selection drives the display.
      if (selectActive) {
        setFullEntity(entity)
      }
      selectEntity(entity)
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, entity.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('entity.failedToReloadEntity'))
    } finally {
      setIsReloadingEntity(false)
    }
  }, [
    selectedDataclass,
    selectedEntityId,
    isEditing,
    isStandalone,
    selectActive,
    selectEntity,
    activeDataclassTab,
    setSelectedEntityId,
    t,
  ])

  // Listen for keyboard shortcut events
  useEffect(() => {
    if (isStandalone) return
    const subscriptions = [
      eventBus.on('edit-entity', () => {
        if (selectedEntityId && !isEditing) {
          handleEnterEditMode()
        }
      }),
      eventBus.on('save-entity', () => {
        if (isEditing && !isSaving) {
          if (activeTab === 'form') {
            formRef.current?.submit()
          } else {
            void handleSave()
          }
        }
      }),
    ]

    return () => {
      for (const sub of subscriptions) {
        sub.unsubscribe()
      }
    }
  }, [
    isStandalone,
    selectedEntityId,
    isEditing,
    isSaving,
    activeTab,
    handleSave,
    handleEnterEditMode,
  ])

  // Navigation handlers
  const currentEntityIndex = useMemo(() => {
    if (!selectedEntityId || !entities.length) return -1
    return entities.findIndex((e) => e.id === selectedEntityId)
  }, [selectedEntityId, entities])

  const handleNavigateFirst = useCallback(() => {
    if (entities.length === 0) return
    if (pagination && pagination.page !== 1) {
      // Navigate to first page
      fetchEntities(1).then(() => {
        // After fetching, select the first entity
        const state = useDataExplorerStore.getState()
        if (state.entities.length > 0) {
          selectEntity(state.entities[0])
          setFocusedEntityIndex(0)
          // Also update per-tab selected entity ID
          if (activeDataclassTab) {
            setSelectedEntityId(activeDataclassTab.id, state.entities[0].id)
          }
        }
      })
    } else if (entities.length > 0) {
      // Select first entity on current page
      selectEntity(entities[0])
      setFocusedEntityIndex(0)
      // Also update per-tab selected entity ID
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, entities[0].id)
      }
    }
  }, [
    entities,
    pagination,
    fetchEntities,
    selectEntity,
    activeDataclassTab,
    setSelectedEntityId,
    setFocusedEntityIndex,
  ])

  const handleNavigatePrev = useCallback(() => {
    if (entities.length === 0) return
    // No selection on this page (e.g. after pager change) — select last row.
    if (currentEntityIndex < 0) {
      const lastIndex = entities.length - 1
      const last = entities[lastIndex]
      selectEntity(last)
      setFocusedEntityIndex(lastIndex)
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, last.id)
      }
      return
    }
    if (currentEntityIndex > 0) {
      // Navigate to previous entity on current page
      const newIndex = currentEntityIndex - 1
      const prevEntity = entities[newIndex]
      selectEntity(prevEntity)
      setFocusedEntityIndex(newIndex)
      // Also update per-tab selected entity ID
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, prevEntity.id)
      }
    } else if (pagination?.hasPrev) {
      // Navigate to last entity on previous page
      fetchEntities(pagination.page - 1).then(() => {
        // After fetching, select the last entity
        const state = useDataExplorerStore.getState()
        if (state.entities.length > 0) {
          const lastIndex = state.entities.length - 1
          const lastEntity = state.entities[lastIndex]
          selectEntity(lastEntity)
          setFocusedEntityIndex(lastIndex)
          // Also update per-tab selected entity ID
          if (activeDataclassTab) {
            setSelectedEntityId(activeDataclassTab.id, lastEntity.id)
          }
        }
      })
    }
  }, [
    currentEntityIndex,
    entities,
    pagination,
    fetchEntities,
    selectEntity,
    activeDataclassTab,
    setSelectedEntityId,
    setFocusedEntityIndex,
  ])

  const handleNavigateNext = useCallback(() => {
    if (entities.length === 0) return
    // No selection on this page (e.g. after pager change) — select first row.
    if (currentEntityIndex < 0) {
      const first = entities[0]
      selectEntity(first)
      setFocusedEntityIndex(0)
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, first.id)
      }
      return
    }
    if (currentEntityIndex < entities.length - 1) {
      // Navigate to next entity on current page
      const newIndex = currentEntityIndex + 1
      const nextEntity = entities[newIndex]
      selectEntity(nextEntity)
      setFocusedEntityIndex(newIndex)
      // Also update per-tab selected entity ID
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, nextEntity.id)
      }
    } else if (pagination?.hasNext) {
      // Navigate to first entity on next page
      fetchEntities(pagination.page + 1).then(() => {
        // After fetching, select the first entity
        const state = useDataExplorerStore.getState()
        if (state.entities.length > 0) {
          const firstEntity = state.entities[0]
          selectEntity(firstEntity)
          setFocusedEntityIndex(0)
          // Also update per-tab selected entity ID
          if (activeDataclassTab) {
            setSelectedEntityId(activeDataclassTab.id, firstEntity.id)
          }
        }
      })
    }
  }, [
    currentEntityIndex,
    entities,
    pagination,
    fetchEntities,
    selectEntity,
    activeDataclassTab,
    setSelectedEntityId,
    setFocusedEntityIndex,
  ])

  const handleNavigateLast = useCallback(() => {
    if (entities.length === 0) return
    if (pagination && pagination.page !== pagination.totalPages) {
      // Navigate to last page
      fetchEntities(pagination.totalPages).then(() => {
        // After fetching, select the last entity
        const state = useDataExplorerStore.getState()
        if (state.entities.length > 0) {
          const lastIndex = state.entities.length - 1
          const lastEntity = state.entities[lastIndex]
          selectEntity(lastEntity)
          setFocusedEntityIndex(lastIndex)
          // Also update per-tab selected entity ID
          if (activeDataclassTab) {
            setSelectedEntityId(activeDataclassTab.id, lastEntity.id)
          }
        }
      })
    } else if (entities.length > 0) {
      // Select last entity on current page
      const lastIndex = entities.length - 1
      const lastEntity = entities[lastIndex]
      selectEntity(lastEntity)
      setFocusedEntityIndex(lastIndex)
      // Also update per-tab selected entity ID
      if (activeDataclassTab) {
        setSelectedEntityId(activeDataclassTab.id, lastEntity.id)
      }
    }
  }, [
    entities,
    pagination,
    fetchEntities,
    selectEntity,
    activeDataclassTab,
    setSelectedEntityId,
    setFocusedEntityIndex,
  ])

  // Listen for navigation events from keyboard shortcuts. Only the active tab
  // may handle these — dataclass tabs stay mounted (display:none), and
  // selectEntity/fetchEntities always write the active tab slice, so inactive
  // viewers would otherwise race and jump/clear the visible selection.
  useEffect(() => {
    if (isStandalone) return
    const isActiveTab = () => useTabsStore.getState().activeTabId === tabId
    const subscriptions = [
      eventBus.on('nav-prev', () => {
        if (!isActiveTab() || isEditing) return
        handleNavigatePrev()
      }),
      eventBus.on('nav-next', () => {
        if (!isActiveTab() || isEditing) return
        handleNavigateNext()
      }),
      eventBus.on('page-first', () => {
        if (!isActiveTab() || isEditing) return
        handleNavigateFirst()
      }),
      eventBus.on('page-last', () => {
        if (!isActiveTab() || isEditing) return
        handleNavigateLast()
      }),
    ]

    return () => {
      for (const sub of subscriptions) {
        sub.unsubscribe()
      }
    }
  }, [
    isStandalone,
    isEditing,
    tabId,
    handleNavigatePrev,
    handleNavigateNext,
    handleNavigateFirst,
    handleNavigateLast,
  ])

  if (!selectedEntity) {
    return (
      <EmptyPanel
        icon={FileJson}
        badgeIcon={MousePointerClick}
        badgeTone="primary"
        title={t('entity.noEntitySelected')}
        description={t('entity.noEntitySelectedHint')}
        ghost="cards"
        size="lg"
        className="h-full min-h-0"
      />
    )
  }

  const entityMethods =
    selectedDataclass && selectedEntityId ? (
      <MethodListPopover
        dataClass={selectedDataclass}
        scopes={['entity']}
        entityKey={selectedEntityId}
        compact
      />
    ) : null

  return (
    <div className="@container/entity-viewer flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-x-2 gap-y-1.5 border-b bg-background px-2 py-1.5">
        <div className="min-w-0 flex-1 basis-28">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {selectedEntityId ? (
              <ClickToCopy
                as="code"
                value={String(selectedEntityId)}
                tooltipLabel={t('common.clickToCopy')}
                tooltipCopiedLabel={t('common.copied')}
                className="truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-none"
              >
                {selectedEntityId}
              </ClickToCopy>
            ) : (
              <code
                className="truncate rounded-sm border border-muted-foreground/35 border-dashed bg-transparent px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground italic leading-none"
                title={t('entity.noKeyHint')}
              >
                {t('entity.noKey')}
              </code>
            )}
            <ClickToCopy
              value={JSON.stringify(selectedEntity, null, 2)}
              tooltipLabel={t('entity.copyJson')}
              tooltipCopiedLabel={t('common.copied')}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Copy className="h-3 w-3" />
            </ClickToCopy>
            {selectedDataclass && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-6 gap-1 @[32rem]/entity-viewer:px-2 px-1.5"
                      onClick={() => highlightInGraph(selectedDataclass)}
                      disabled={isLoadingDetails}
                    >
                      <Network className="h-3.5 w-3.5" />
                      <span className="@[32rem]/entity-viewer:inline hidden">
                        {t('entity.showInStructure')}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('entity.highlightDataclassInGraph')}
                    {openStructureShortcut?.enabled && (
                      <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                        {formatShortcut(openStructureShortcut)}
                      </kbd>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="mt-1">
            <EntityStats entity={selectedEntity} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
          {isLoadingDetails && (
            <Loader2
              className="mr-1 h-4 w-4 shrink-0 animate-spin text-muted-foreground"
              aria-label={t('entity.loading')}
            />
          )}
          {isEditing ? (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-6 gap-1 @[32rem]/entity-viewer:px-2 px-1.5"
                      onClick={() => {
                        setEditedEntity(JSON.stringify(selectedEntity, null, 2))
                        setFormData(selectedEntity ?? {})
                        setIsEditing(false)
                        setActiveTab(previousTab)
                        setError(null)
                      }}
                      disabled={isSaving}
                    >
                      <X className="h-3.5 w-3.5" />
                      <span className="@[28rem]/entity-viewer:inline hidden">
                        {t('entity.cancel')}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('entity.cancelEdit')}
                    {cancelEditShortcut?.enabled && (
                      <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                        {formatShortcut(cancelEditShortcut)}
                      </kbd>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="xs"
                      className="h-6 gap-1 @[32rem]/entity-viewer:px-2 px-1.5"
                      onClick={() => {
                        if (activeTab === 'form') {
                          formRef.current?.submit()
                        } else {
                          void handleSave()
                        }
                      }}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      <span className="@[28rem]/entity-viewer:inline hidden">
                        {t('entity.save')}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('entity.saveEntity')}
                    {saveEntityShortcut?.enabled && (
                      <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                        {formatShortcut(saveEntityShortcut)}
                      </kbd>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <>
              {saveSuccessAt !== null && (
                <output
                  className="flex h-6 items-center gap-1 rounded-sm border border-primary/30 bg-primary/10 px-2 font-medium text-primary text-xs"
                  aria-live="polite"
                >
                  <Check className="h-4 w-4 shrink-0" />
                  <span className="@[24rem]/entity-viewer:inline hidden">{t('entity.saved')}</span>
                </output>
              )}
              {entityMethods}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-6 gap-1 @[32rem]/entity-viewer:px-2 px-1.5"
                      onClick={() => void handleReloadEntity()}
                      disabled={
                        !selectedDataclass ||
                        !selectedEntityId ||
                        isReloadingEntity ||
                        isLoadingDetails
                      }
                    >
                      <RefreshCw
                        className={cn('h-3.5 w-3.5', isReloadingEntity && 'animate-spin')}
                      />
                      <span className="@[36rem]/entity-viewer:inline hidden">
                        {t('entity.reloadEntity')}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('entity.reloadEntity')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {!isStandalone ? (
                <>
                  <div className="flex items-center rounded-sm border">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-6 gap-1 rounded-r-none border-0 @[36rem]/entity-viewer:px-2 px-1.5"
                            onClick={() => handleEnterEditMode()}
                            disabled={readonlyMode || isLoadingDetails}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span className="@[36rem]/entity-viewer:inline hidden">
                              {defaultEditMode === 'json'
                                ? t('entity.editAsJson')
                                : t('entity.editAsForm')}
                            </span>
                          </Button>
                        </TooltipTrigger>
                        {readonlyMode ? (
                          <TooltipContent>{t('entity.disabledInReadonlyMode')}</TooltipContent>
                        ) : (
                          <TooltipContent>
                            {t('entity.editEntity')}
                            {editEntityShortcut?.enabled ? (
                              <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                                {formatShortcut(editEntityShortcut)}
                              </kbd>
                            ) : null}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 w-5 rounded-l-none border-0 border-l px-0"
                          disabled={readonlyMode || isLoadingDetails}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEnterEditMode('form')}>
                          <FileText className="mr-2 h-4 w-4" />
                          {t('entity.editAsForm')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEnterEditMode('json')}>
                          <Braces className="mr-2 h-4 w-4" />
                          {t('entity.editAsJson')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="xs"
                          className={cn(
                            'h-6 gap-1 @[32rem]/entity-viewer:px-2 px-1.5',
                            readonlyMode ? 'cursor-not-allowed opacity-50' : 'text-destructive'
                          )}
                          onClick={() => !readonlyMode && handleDelete()}
                          disabled={readonlyMode || isLoadingDetails}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="@[32rem]/entity-viewer:inline hidden">
                            {t('entity.delete')}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {readonlyMode
                          ? t('entity.disabledInReadonlyMode')
                          : t('entity.deleteEntityTitle')}
                        {!readonlyMode && deleteEntityShortcut?.enabled ? (
                          <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                            {formatShortcut(deleteEntityShortcut)}
                          </kbd>
                        ) : null}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <ErrorList error={error} variant="banner" onDismiss={() => setError(null)} />}

      {/* Content with tabs */}
      <Tabs
        value={isEditing && activeTab !== 'form' ? 'json' : activeTab}
        onValueChange={(v) => {
          if (isEditing && v !== 'form') {
            // When editing, only allow switching to form or staying in json
            if (v === 'tree') return
          }
          setActiveTab(v as 'tree' | 'json' | 'form')
          if (!isEditing) {
            setPreviousTab(v as 'tree' | 'json' | 'form')
          }
        }}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex h-8 items-center overflow-x-auto border-b bg-muted/30 px-2">
          <TabsList className="h-6 bg-transparent p-0">
            <TabsTrigger
              value="form"
              disabled={(isEditing && activeTab !== 'form') || isLoadingDetails}
              className="relative h-6 gap-1 @[28rem]/entity-viewer:px-2 px-1.5 text-xs after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:after:bg-primary"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="@[22rem]/entity-viewer:inline hidden">
                {t('entity.formTab')} {isEditing && activeTab === 'form' && t('entity.formEditing')}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="tree"
              disabled={isEditing || isLoadingDetails}
              className="relative h-6 gap-1 @[28rem]/entity-viewer:px-2 px-1.5 text-xs after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:after:bg-primary"
            >
              <TreePine className="h-3.5 w-3.5" />
              <span className="@[22rem]/entity-viewer:inline hidden">{t('entity.treeView')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="json"
              disabled={isLoadingDetails}
              className="relative h-6 gap-1 @[28rem]/entity-viewer:px-2 px-1.5 text-xs after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:after:bg-primary"
            >
              <Braces className="h-3.5 w-3.5" />
              <span className="@[22rem]/entity-viewer:inline hidden">
                {t('entity.jsonTab')} {isEditing && activeTab === 'json' && t('entity.formEditing')}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tree" className="mt-0 flex-1 overflow-hidden">
          <div className="flex h-full flex-col">
            {/* Tree controls */}
            <div className="flex items-center justify-end gap-1 border-b bg-muted/20 px-3 py-1.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs"
                      onClick={() => setExpandAll(true)}
                      disabled={isLoadingDetails}
                    >
                      <ChevronsUpDown className="h-3.5 w-3.5" />
                      {t('entity.expandAll')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('entity.expandAllNodes')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs"
                      onClick={() => setExpandAll(false)}
                      disabled={isLoadingDetails}
                    >
                      <ChevronsDownUp className="h-3.5 w-3.5" />
                      {t('entity.collapseAll')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('entity.collapseAllNodes')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                <MetadataPanel
                  entries={Object.entries(selectedEntity).filter(([key]) =>
                    isInternalAttribute(key)
                  )}
                  expandAll={expandAll}
                />
                {Object.entries(selectedEntity)
                  .filter(([key]) => !isInternalAttribute(key))
                  .map(([key, value]) => (
                    <TreeNode key={key} keyName={key} value={value} expandAll={expandAll} />
                  ))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="form" className="mt-0 flex-1 overflow-hidden">
          {isEditing && selectedDataclass ? (
            <div className="flex h-full min-h-0 flex-col p-4">
              <EntityForm
                ref={formRef}
                dataclassName={selectedDataclass}
                initialData={formData}
                mode="edit"
                entityId={selectedEntityId}
                onSubmit={handleSaveFromForm}
                scrollHeight="100%"
                fieldIdPrefix="entity-viewer-edit"
                onSubmittingChange={setIsSaving}
                showError={false}
                autoFocusFirstField
              />
            </div>
          ) : (
            <FormView
              entity={selectedEntity ?? {}}
              dataclassName={selectedDataclass}
              isEditing={false}
              readonlyMode={readonlyMode}
              onFieldChange={handleFormFieldChange}
              entityId={selectedEntityId}
            />
          )}
        </TabsContent>

        <TabsContent value="json" className="mt-0 flex-1 overflow-hidden p-3">
          <CodeEditor
            value={editedEntity}
            onChange={setEditedEntity}
            readOnly={!isEditing}
            showLineNumbers
            highlightActiveLine={isEditing}
            error={!!error}
            height="100%"
            toolbar={isEditing}
            labels={editorLabels}
            editorPrefs={codeEditorPrefs}
            onEditorPrefsChange={updateCodeEditorPrefs}
          />
        </TabsContent>
      </Tabs>

      {/* Navigation Bar */}
      {!isStandalone && entities.length > 0 ? (
        <div className="flex h-9 shrink-0 items-center justify-between border-t bg-muted/30 px-2">
          <div className="min-w-0 truncate text-muted-foreground text-xs">
            {currentEntityIndex >= 0 && (
              <>
                {t('entity.entityOfTotal', {
                  current: currentEntityIndex + 1,
                  total: entities.length,
                })}
                {pagination && (
                  <>
                    {' '}
                    <span className="mx-1 text-muted-foreground/50">•</span>{' '}
                    {t('entity.pageOf', {
                      page: pagination.page,
                      total: pagination.totalPages,
                    })}
                  </>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleNavigateFirst}
                    disabled={
                      (currentEntityIndex <= 0 && (!pagination || pagination.page === 1)) ||
                      isEditing ||
                      isLoadingDetails
                    }
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  First entity
                  {pageFirstShortcut?.enabled && (
                    <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                      {formatShortcut(pageFirstShortcut)}
                    </kbd>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleNavigatePrev}
                    disabled={
                      (currentEntityIndex <= 0 && !pagination?.hasPrev) ||
                      isEditing ||
                      isLoadingDetails
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Previous entity
                  {navPrevShortcut?.enabled && (
                    <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                      {formatShortcut(navPrevShortcut)}
                    </kbd>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleNavigateNext}
                    disabled={
                      (currentEntityIndex >= entities.length - 1 && !pagination?.hasNext) ||
                      isEditing ||
                      isLoadingDetails
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Next entity
                  {navNextShortcut?.enabled && (
                    <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                      {formatShortcut(navNextShortcut)}
                    </kbd>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleNavigateLast}
                    disabled={
                      (currentEntityIndex >= entities.length - 1 &&
                        (!pagination || pagination.page === pagination.totalPages)) ||
                      isEditing ||
                      isLoadingDetails
                    }
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Last entity
                  {pageLastShortcut?.enabled && (
                    <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                      {formatShortcut(pageLastShortcut)}
                    </kbd>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      ) : null}

      {!isStandalone ? <ConfirmDialog /> : null}
    </div>
  )
}
