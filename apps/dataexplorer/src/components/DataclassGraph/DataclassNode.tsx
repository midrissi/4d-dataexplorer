import type { DataClassAttribute } from '@4d/rest'
import { Button, cn, Tooltip, TooltipContent, TooltipTrigger } from '@4d/ui'
import { Handle, Position } from '@xyflow/react'
import {
  Code2,
  Database,
  Eye,
  EyeOff,
  Globe,
  GlobeLock,
  Key,
  List,
  Lock,
  Play,
  Settings,
} from 'lucide-react'
import { useState } from 'react'
import { AiActionsMenu } from '~/components/AiActions'
import { useTranslation } from '~/i18n'
import { isAssistantExposedMethod } from '~/lib/assistant-exposed-method'
import { estimateCardDimensions } from '~/lib/dataclass-graph/estimate-card-dimensions'
import {
  getMethodParamsText,
  getMethodReactKey,
  methodScope,
} from '~/lib/dataclass-graph/method-meta'
import { useGraphInteractionStore } from '~/store/graph-interaction'
import { useTabsStore } from '~/store/tabs'
import { DataclassIcon, getDataclassColorClasses } from '../DataclassCustomizeModal'
import { highlightMethodSignature } from './highlight-method-signature'
import type { DataclassNodeData } from './types'

export function DataclassNode({
  id,
  data,
  width,
  height,
}: {
  id: string
  data: DataclassNodeData
  width?: number
  height?: number
}) {
  const {
    dataclass,
    customization,
    foreignKeys,
    primaryKeyTargets,
    onCustomizeClick,
    onViewDataClick,
  } = data
  const isSelected = useGraphInteractionStore((state) => state.selectedNodeId === id)
  const overview = useGraphInteractionStore((state) => state.overview)
  const overviewEdgesVisible = useGraphInteractionStore((state) => state.overviewEdgesVisible)
  const highlightedSourceHandle = useGraphInteractionStore((state) =>
    state.hoveredEdge?.source === id ? state.hoveredEdge.sourceHandle : undefined
  )
  const highlightedTargetHandle = useGraphInteractionStore((state) =>
    state.hoveredEdge?.target === id ? state.hoveredEdge.targetHandle : undefined
  )
  const { t } = useTranslation()
  const openMethodExecutorTab = useTabsStore((state) => state.openMethodExecutorTab)
  const colorClasses = getDataclassColorClasses(customization)
  const [isIconHovered, setIsIconHovered] = useState(false)

  // Separate attributes by type
  const storageAttrs = dataclass.attributes.filter((a) => a.kind === 'storage')
  const calculatedAttrs = dataclass.attributes.filter(
    (a) => a.kind === 'calculated' || a.kind === 'alias'
  )
  const methods = dataclass.methods || []

  // Find primary key
  const primaryKey = dataclass.key?.[0]?.name

  if (overview) {
    const sourceHandles = overviewEdgesVisible ? [...(data.usedSourceHandles ?? [])] : []
    const targetHandles = overviewEdgesVisible ? [...(data.usedTargetHandles ?? [])] : []
    const renderHandles = (handles: string[], type: 'source' | 'target') =>
      handles.map((handleId, index) => {
        const position = handleId.endsWith('-left') ? Position.Left : Position.Right
        return (
          <Handle
            key={`${type}-${handleId}`}
            type={type}
            position={position}
            id={handleId}
            className="h-2! w-2! bg-amber-500!"
            style={{ top: `${((index + 1) / (handles.length + 1)) * 100}%` }}
          />
        )
      })

    return (
      <div
        style={{
          ...colorClasses.style,
          width: width ?? estimateCardDimensions(dataclass).width,
          height: height ?? estimateCardDimensions(dataclass).height,
        }}
        className={cn(
          'dataclass-node-card relative overflow-hidden rounded-lg border bg-card shadow-sm',
          isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
        )}
      >
        <div className={cn('flex w-full items-center gap-1.5 px-2 py-1.5', colorClasses.bg)}>
          <DataclassIcon
            customization={customization}
            className={cn('h-4 w-4 shrink-0', colorClasses.headerText)}
          />
          <div className="min-w-0 flex-1 text-center">
            <h3 className={cn('truncate font-semibold text-sm', colorClasses.headerText)}>
              {dataclass.name}
            </h3>
            <p className={cn('truncate text-[10px]', colorClasses.headerTextMuted)}>
              {t('dataclassGraph.attrsAndMethodsSummary', {
                attrs: storageAttrs.length + calculatedAttrs.length,
                methods: methods.length,
              })}
            </p>
          </div>
        </div>
        {renderHandles(sourceHandles, 'source')}
        {renderHandles(targetHandles, 'target')}
      </div>
    )
  }

  const getTypeColor = (attr: DataClassAttribute) => {
    switch (attr.type) {
      case 'string':
        return 'text-green-500'
      case 'number':
      case 'long':
      case 'long64':
      case 'word':
      case 'byte':
        return 'text-blue-500'
      case 'bool':
        return 'text-purple-500'
      case 'date':
      case 'duration':
        return 'text-orange-500'
      case 'blob':
      case 'image':
        return 'text-pink-500'
      case 'object':
        return 'text-cyan-500'
      default:
        return 'text-amber-500'
    }
  }

  return (
    <div
      style={colorClasses.style}
      className={cn(
        'dataclass-node-card relative min-w-55 max-w-[320px] rounded-lg border bg-card shadow-lg transition-all',
        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      {/* Header */}
      <div
        className={cn('flex w-full items-center gap-1.5 rounded-t-lg px-2 py-1.5', colorClasses.bg)}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="iconXs"
              data-graph-node-action
              onClick={(e) => {
                e.stopPropagation()
                onCustomizeClick?.(dataclass.name)
              }}
              onMouseEnter={() => setIsIconHovered(true)}
              onMouseLeave={() => setIsIconHovered(false)}
              className={cn(
                'h-6! w-6! shrink-0 rounded-md transition-colors',
                colorClasses.headerText === 'text-white'
                  ? 'bg-white/20 hover:bg-white/30'
                  : 'bg-black/10 hover:bg-black/20'
              )}
            >
              {isIconHovered ? (
                <Settings className={cn('h-3.5 w-3.5', colorClasses.headerText)} />
              ) : (
                <DataclassIcon
                  customization={customization}
                  className={cn('h-3.5 w-3.5', colorClasses.headerText)}
                />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('sidebar.customizeDataclass')}</TooltipContent>
        </Tooltip>
        <div className="min-w-0 flex-1 text-center">
          <h3 className={cn('truncate font-semibold text-sm', colorClasses.headerText)}>
            {dataclass.name}
          </h3>
          <p className={cn('truncate text-[10px]', colorClasses.headerTextMuted)}>
            {t('dataclassGraph.attrsAndMethodsSummary', {
              attrs: storageAttrs.length + calculatedAttrs.length,
              methods: methods.length,
            })}
          </p>
        </div>
        {onViewDataClick && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="iconXs"
                data-graph-node-action
                onClick={(e) => {
                  e.stopPropagation()
                  onViewDataClick(dataclass.name)
                }}
                className={cn(
                  'h-6! w-6! shrink-0 rounded-md transition-colors',
                  colorClasses.headerText === 'text-white'
                    ? 'bg-white/20 hover:bg-white/30'
                    : 'bg-black/10 hover:bg-black/20'
                )}
                title={t('commandPalette.viewData')}
              >
                <List className={cn('h-3.5 w-3.5', colorClasses.headerText)} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('commandPalette.viewData')}</TooltipContent>
          </Tooltip>
        )}
        <div
          data-graph-node-action
          className={cn(
            'nodrag nopan shrink-0',
            colorClasses.headerText === 'text-white' && '[&_button]:text-white'
          )}
        >
          <AiActionsMenu
            dataclassName={dataclass.name}
            variant="icon"
            className={cn(
              colorClasses.headerText === 'text-white'
                ? 'bg-white/20! text-white! hover:bg-white/30!'
                : 'bg-black/10! hover:bg-black/20!'
            )}
          />
        </div>
      </div>

      {/* Content */}
      <div className="dataclass-node-detail">
        {/* Storage Attributes */}
        {storageAttrs.length > 0 && (
          <div className="border-b p-2">
            <div className="mb-1 flex items-center gap-1 font-medium text-[10px] text-muted-foreground uppercase">
              <Database className="h-3 w-3" />
              {t('dataclassGraph.storage')} ({storageAttrs.length})
            </div>
            <div className="space-y-0.5">
              {storageAttrs.map((attr) => {
                const isForeignKey = foreignKeys.has(attr.name)
                const isPrimaryKeyTarget =
                  attr.name === primaryKey && primaryKeyTargets.has(attr.name)
                const attrAny = attr as DataClassAttribute & Record<string, unknown>
                const exposed = attrAny.exposed === true
                const tooltipLines = [
                  `name: ${attr.name}`,
                  `kind: ${attr.kind}`,
                  `type: ${attr.type}`,
                  attrAny.exposed != null ? `exposed: ${attrAny.exposed}` : null,
                  attr.scope != null ? `scope: ${attr.scope}` : null,
                  attr.indexed != null ? `indexed: ${attr.indexed}` : null,
                  attr.unique != null ? `unique: ${attr.unique}` : null,
                  attr.autosequence != null ? `autosequence: ${attr.autosequence}` : null,
                  attr.readOnly != null ? `readOnly: ${attr.readOnly}` : null,
                  attr.identifying != null ? `identifying: ${attr.identifying}` : null,
                  attr.path != null ? `path: ${attr.path}` : null,
                  attr.foreignKey != null ? `foreignKey: ${attr.foreignKey}` : null,
                  attr.inverseName != null ? `inverseName: ${attr.inverseName}` : null,
                  attr.multiLine != null ? `multiLine: ${attr.multiLine}` : null,
                  attrAny.defaultFormat?.format != null
                    ? `defaultFormat: ${String(attrAny.defaultFormat.format)}`
                    : null,
                ].filter(Boolean) as string[]

                return (
                  <Tooltip key={`storage-${attr.name}`}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'relative flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/50',
                          (isForeignKey || isPrimaryKeyTarget) && 'bg-amber-500/10'
                        )}
                      >
                        {/* Target handles for primary key (always render both so edges can attach) */}
                        {isPrimaryKeyTarget && (
                          <>
                            <Handle
                              type="target"
                              position={Position.Left}
                              id={`pk-${attr.name}-left`}
                              className={cn(
                                '-left-1.5! h-2! w-2! bg-amber-500! transition-shadow',
                                highlightedTargetHandle === `pk-${attr.name}-left` &&
                                  'ring-2! ring-amber-300! ring-offset-1! ring-offset-background!'
                              )}
                              style={{ top: '50%', transform: 'translateY(-50%)' }}
                            />
                            <Handle
                              type="target"
                              position={Position.Right}
                              id={`pk-${attr.name}-right`}
                              className={cn(
                                '-right-1.5! h-2! w-2! bg-amber-500! transition-shadow',
                                highlightedTargetHandle === `pk-${attr.name}-right` &&
                                  'ring-2! ring-amber-300! ring-offset-1! ring-offset-background!'
                              )}
                              style={{ top: '50%', transform: 'translateY(-50%)' }}
                            />
                          </>
                        )}
                        {attr.name === primaryKey && (
                          <Key className="h-3 w-3 shrink-0 text-amber-500" />
                        )}
                        {attr.readOnly && (
                          <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        {exposed ? (
                          <Eye
                            className="h-3 w-3 shrink-0 text-muted-foreground"
                            aria-label="Exposed"
                          />
                        ) : (
                          <EyeOff
                            className="h-3 w-3 shrink-0 text-muted-foreground"
                            aria-label="Not exposed"
                          />
                        )}
                        <span className="flex-1 truncate font-medium">{attr.name}</span>
                        <span className={cn('shrink-0 text-[10px]', getTypeColor(attr))}>
                          {attr.type}
                        </span>
                        {attr.indexed && (
                          <span className="rounded bg-blue-500/10 px-1 text-[9px] text-blue-500">
                            {t('dataclassGraph.indexed')}
                          </span>
                        )}
                        {/* Source handles for foreign key (always render both so edges can attach) */}
                        {isForeignKey && (
                          <>
                            <Handle
                              type="source"
                              position={Position.Left}
                              id={`fk-${attr.name}-left`}
                              className={cn(
                                '-left-1.5! h-2! w-2! bg-amber-500! transition-shadow',
                                highlightedSourceHandle === `fk-${attr.name}-left` &&
                                  'ring-2! ring-amber-300! ring-offset-1! ring-offset-background!'
                              )}
                              style={{ top: '50%', transform: 'translateY(-50%)' }}
                            />
                            <Handle
                              type="source"
                              position={Position.Right}
                              id={`fk-${attr.name}-right`}
                              className={cn(
                                '-right-1.5! h-2! w-2! bg-amber-500! transition-shadow',
                                highlightedSourceHandle === `fk-${attr.name}-right` &&
                                  'ring-2! ring-amber-300! ring-offset-1! ring-offset-background!'
                              )}
                              style={{ top: '50%', transform: 'translateY(-50%)' }}
                            />
                          </>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-sm font-mono text-xs">
                      <div className="space-y-0.5">
                        {tooltipLines.map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        )}

        {/* Calculated/Alias Attributes */}
        {calculatedAttrs.length > 0 && (
          <div className={cn('p-2', methods.length > 0 && 'border-b')}>
            <div className="mb-1 flex items-center gap-1 font-medium text-[10px] text-muted-foreground uppercase">
              <Code2 className="h-3 w-3" />
              {t('dataclassGraph.calculated')} ({calculatedAttrs.length})
            </div>
            <div className="space-y-0.5">
              {calculatedAttrs.map((attr) => {
                const attrAny = attr as DataClassAttribute & Record<string, unknown>
                const exposed = attrAny.exposed === true
                const tooltipLines = [
                  `name: ${attr.name}`,
                  `kind: ${attr.kind}`,
                  `type: ${attr.type}`,
                  attrAny.exposed != null ? `exposed: ${attrAny.exposed}` : null,
                  attr.scope != null ? `scope: ${attr.scope}` : null,
                  attr.readOnly != null ? `readOnly: ${attr.readOnly}` : null,
                  attr.path != null ? `path: ${attr.path}` : null,
                  attr.foreignKey != null ? `foreignKey: ${attr.foreignKey}` : null,
                  attr.inverseName != null ? `inverseName: ${attr.inverseName}` : null,
                  attrAny.defaultFormat?.format != null
                    ? `defaultFormat: ${String(attrAny.defaultFormat.format)}`
                    : null,
                ].filter(Boolean) as string[]

                return (
                  <Tooltip key={`${attr.kind}-${attr.name}`}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/50">
                        {attr.readOnly && (
                          <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        {exposed ? (
                          <Eye
                            className="h-3 w-3 shrink-0 text-muted-foreground"
                            aria-label="Exposed"
                          />
                        ) : (
                          <EyeOff
                            className="h-3 w-3 shrink-0 text-muted-foreground"
                            aria-label="Not exposed"
                          />
                        )}
                        <span className="flex-1 truncate font-medium">{attr.name}</span>
                        <span className={cn('shrink-0 text-[10px]', getTypeColor(attr))}>
                          {attr.type}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-sm font-mono text-xs">
                      <div className="space-y-0.5">
                        {tooltipLines.map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        )}

        {/* Methods */}
        {methods.length > 0 && (
          <div className="p-2">
            <div className="mb-1 flex items-center gap-1 font-medium text-[10px] text-muted-foreground uppercase">
              <Code2 className="h-3 w-3" />
              {t('dataclassGraph.methods')} ({methods.length})
            </div>
            <div className="space-y-0.5">
              {methods.map((method, index) => {
                const exposed = isAssistantExposedMethod(method)
                const allowedGet = method.allowedOnHTTPGET === true
                const methodAny = method as unknown as Record<string, unknown>
                const paramsText = getMethodParamsText(methodAny)
                // Full signature: name + paramsText (e.g. "agencyStats() : Collection")
                const fullSignature =
                  method.name != null
                    ? paramsText != null
                      ? `${method.name}${paramsText}`
                      : `${method.name}()`
                    : (paramsText ?? null)
                const filePath = methodAny.filePath != null ? String(methodAny.filePath) : null
                const startLine = methodAny.startingLine
                const endLine = methodAny.endingLine
                const fileLine =
                  filePath != null
                    ? startLine != null && endLine != null
                      ? `${filePath}#L${startLine}-${endLine}`
                      : filePath
                    : null
                const metaLines: string[] = [
                  `name: ${method.name}`,
                  method.applyTo != null ? `applyTo: ${method.applyTo}` : null,
                  `exposed: ${exposed}`,
                  `allowedOnHTTPGET: ${allowedGet}`,
                  fileLine != null ? `file: ${fileLine}` : null,
                  methodAny.scope != null ? `scope: ${String(methodAny.scope)}` : null,
                  methodAny.from != null ? `from: ${String(methodAny.from)}` : null,
                ].filter(Boolean) as string[]

                return (
                  <Tooltip key={getMethodReactKey(method, index, paramsText)}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/50">
                        {exposed ? (
                          <Eye className="h-3 w-3 shrink-0 text-green-600" aria-label="Exposed" />
                        ) : (
                          <EyeOff
                            className="h-3 w-3 shrink-0 text-muted-foreground"
                            aria-label="Not exposed"
                          />
                        )}
                        <span className="flex-1 truncate font-mono text-purple-500">
                          {fullSignature ?? `${method.name}()`}
                        </span>
                        <span
                          className="flex shrink-0 items-center gap-0.5"
                          title={`Exposed: ${exposed ? 'yes' : 'no'} · GET allowed: ${allowedGet ? 'yes' : 'no'}`}
                        >
                          {allowedGet ? (
                            <Globe
                              className="h-3 w-3 text-green-600"
                              aria-label="Allowed on HTTP GET"
                            />
                          ) : (
                            <GlobeLock
                              className="h-3 w-3 text-muted-foreground"
                              aria-label="Not allowed on HTTP GET"
                            />
                          )}
                        </span>
                        {method.applyTo && (
                          <span className="shrink-0 rounded bg-purple-500/10 px-1 text-[9px] text-purple-500">
                            {method.applyTo}
                          </span>
                        )}
                        {exposed ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            title="Execute method"
                            onClick={(event) => {
                              event.stopPropagation()
                              openMethodExecutorTab({
                                scope: methodScope(method.applyTo),
                                methodName: method.name,
                                dataClass: dataclass.name,
                                paramsText: paramsText ?? undefined,
                                allowedOnHTTPGET: allowedGet,
                              })
                            }}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        ) : null}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs font-mono text-[10px]">
                      <div className="space-y-0.5">
                        {fullSignature != null && (
                          <div className="mb-1">
                            <span className="text-muted-foreground">signature:</span>
                            <code className="mt-0.5 block rounded bg-muted/50 px-1 py-0.5 font-mono text-[10px]">
                              {paramsText != null
                                ? highlightMethodSignature(fullSignature)
                                : fullSignature}
                            </code>
                          </div>
                        )}
                        {metaLines.map((line) =>
                          line.startsWith('file: ') ? (
                            <div key={line}>
                              <span className="text-muted-foreground">file: </span>
                              <code className="rounded bg-muted/50 px-1 font-mono text-[10px] text-blue-600 dark:text-blue-400">
                                {line.slice(6)}
                              </code>
                            </div>
                          ) : (
                            <div key={line}>{line}</div>
                          )
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
