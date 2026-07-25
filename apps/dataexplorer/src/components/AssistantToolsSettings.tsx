import { Button, Checkbox, cn, Switch } from '@4d/ui'
import {
  BookText,
  Bot,
  ChevronDown,
  Command,
  Database,
  Eye,
  HelpCircle,
  Layers,
  LayoutGrid,
  type LucideIcon,
  Navigation,
  Palette,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type DynamicMethodToolMeta,
  getDynamicMethodTools,
  refreshAssistantMethodTools,
} from '~/assistant/method-tools'
import { syncAssistantToolPrefs } from '~/assistant/sync-tool-prefs'
import {
  ASSISTANT_TOOL_CATALOG,
  ASSISTANT_TOOL_NAMESPACES,
  type AssistantToolNamespace,
  type AssistantToolPrefs,
  getToolsByNamespace,
  isToolEnabled,
} from '~/assistant/tool-catalog'
import { dataExplorerToolRegistry } from '~/assistant/tool-registry'
import { useTranslation } from '~/i18n'
import { useSettingsStore } from '~/store/settings'
import { useActiveSettingsTab, useTabsStore } from '~/store/tabs'

const NAMESPACE_CONFIG: Record<
  AssistantToolNamespace,
  { icon: LucideIcon; iconColor: string; bgColor: string }
> = {
  datastore: { icon: Database, iconColor: 'text-blue-400', bgColor: 'bg-blue-500/15' },
  dataclass: { icon: Layers, iconColor: 'text-teal-400', bgColor: 'bg-teal-500/15' },
  commands: { icon: Command, iconColor: 'text-violet-400', bgColor: 'bg-violet-500/15' },
  navigation: { icon: Navigation, iconColor: 'text-emerald-400', bgColor: 'bg-emerald-500/15' },
  appearance: { icon: Palette, iconColor: 'text-pink-400', bgColor: 'bg-pink-500/15' },
  view: { icon: Eye, iconColor: 'text-sky-400', bgColor: 'bg-sky-500/15' },
  entities: { icon: Layers, iconColor: 'text-amber-400', bgColor: 'bg-amber-500/15' },
  query: { icon: Search, iconColor: 'text-cyan-400', bgColor: 'bg-cyan-500/15' },
  graph: { icon: Sparkles, iconColor: 'text-indigo-400', bgColor: 'bg-indigo-500/15' },
  metadata: { icon: BookText, iconColor: 'text-fuchsia-400', bgColor: 'bg-fuchsia-500/15' },
  settings: { icon: Settings, iconColor: 'text-orange-400', bgColor: 'bg-orange-500/15' },
  widgets: { icon: LayoutGrid, iconColor: 'text-indigo-400', bgColor: 'bg-indigo-500/15' },
  help: { icon: HelpCircle, iconColor: 'text-slate-400', bgColor: 'bg-slate-500/15' },
}

function getToolsCheckState(enabledFlags: boolean[]): boolean | 'indeterminate' {
  const enabledCount = enabledFlags.filter(Boolean).length
  if (enabledCount === 0) return false
  if (enabledCount === enabledFlags.length) return true
  return 'indeterminate'
}

function ToolRow({
  name,
  description,
  enabled,
  onEnabledChange,
}: {
  name: string
  description: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Switch checked={enabled} onCheckedChange={onEnabledChange} className="shrink-0 scale-75" />
        <div className="min-w-0">
          <span
            className={cn('block truncate font-mono text-xs', !enabled && 'text-muted-foreground')}
          >
            {name}
          </span>
          <span className="block truncate text-muted-foreground text-xs">{description}</span>
        </div>
      </div>
    </div>
  )
}

export function AssistantToolsSettings() {
  const { t } = useTranslation()
  const settingsTab = useActiveSettingsTab()
  const { setSettingsAssistantToolsExpanded } = useTabsStore()
  const expanded = settingsTab?.assistantToolsExpanded ?? false
  const setExpanded = (next: boolean) => {
    if (settingsTab) {
      setSettingsAssistantToolsExpanded(settingsTab.id, next)
    }
  }
  const assistantDisabledNamespaces = useSettingsStore((s) => s.assistantDisabledNamespaces)
  const assistantDisabledTools = useSettingsStore((s) => s.assistantDisabledTools)
  const prefs = useMemo(
    (): AssistantToolPrefs => ({ assistantDisabledNamespaces, assistantDisabledTools }),
    [assistantDisabledNamespaces, assistantDisabledTools]
  )
  const setAssistantToolEnabled = useSettingsStore((s) => s.setAssistantToolEnabled)
  const setAssistantNamespaceToolsEnabled = useSettingsStore(
    (s) => s.setAssistantNamespaceToolsEnabled
  )
  const setAllAssistantToolsEnabled = useSettingsStore((s) => s.setAllAssistantToolsEnabled)
  const [dynamicMethodTools, setDynamicMethodTools] = useState<DynamicMethodToolMeta[]>(() =>
    getDynamicMethodTools()
  )
  const listRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef(new Map<AssistantToolNamespace, HTMLElement>())
  const [activeNamespace, setActiveNamespace] = useState<AssistantToolNamespace | null>(null)

  useEffect(() => {
    if (!expanded) return

    let cancelled = false
    void refreshAssistantMethodTools(dataExplorerToolRegistry).then(() => {
      if (cancelled) return
      setDynamicMethodTools(getDynamicMethodTools())
    })

    return () => {
      cancelled = true
    }
  }, [expanded])

  function syncTools() {
    syncAssistantToolPrefs(dataExplorerToolRegistry)
  }

  const toolStates = useMemo(
    () =>
      ASSISTANT_TOOL_CATALOG.map((tool) => ({
        ...tool,
        enabled: isToolEnabled(tool.name, prefs),
      })),
    [prefs]
  )

  const visibleNamespaces = useMemo(() => {
    return ASSISTANT_TOOL_NAMESPACES.filter((namespace) => {
      const tools = getToolsByNamespace(namespace)
      const dynamicTools = dynamicMethodTools.filter((tool) => tool.namespace === namespace)
      return tools.length > 0 || dynamicTools.length > 0
    })
  }, [dynamicMethodTools])

  useEffect(() => {
    if (!expanded || visibleNamespaces.length === 0) {
      setActiveNamespace(null)
      return
    }
    setActiveNamespace((current) =>
      current && visibleNamespaces.includes(current) ? current : (visibleNamespaces[0] ?? null)
    )
  }, [expanded, visibleNamespaces])

  useEffect(() => {
    if (!expanded) return
    const root = listRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]
        const namespace = top?.target.getAttribute(
          'data-namespace'
        ) as AssistantToolNamespace | null
        if (namespace) setActiveNamespace(namespace)
      },
      { root, rootMargin: '-8% 0px -70% 0px', threshold: [0.1, 0.35, 0.6] }
    )

    for (const namespace of visibleNamespaces) {
      const el = sectionRefs.current.get(namespace)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [expanded, visibleNamespaces])

  const scrollToNamespace = (namespace: AssistantToolNamespace) => {
    const container = listRef.current
    const section = sectionRefs.current.get(namespace)
    if (!container || !section) return
    setActiveNamespace(namespace)
    const containerRect = container.getBoundingClientRect()
    const sectionRect = section.getBoundingClientRect()
    container.scrollTo({
      top: container.scrollTop + sectionRect.top - containerRect.top - 4,
      behavior: 'smooth',
    })
  }

  const setSectionRef = (namespace: AssistantToolNamespace, node: HTMLDivElement | null) => {
    if (node) sectionRefs.current.set(namespace, node)
    else sectionRefs.current.delete(namespace)
  }

  const enabledCount =
    toolStates.filter((tool) => tool.enabled).length +
    dynamicMethodTools.filter((tool) => isToolEnabled(tool.name, prefs)).length
  const totalCount = ASSISTANT_TOOL_CATALOG.length + dynamicMethodTools.length

  return (
    <div className="mb-4 rounded-lg border bg-card p-4">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setExpanded(!expanded)}
        className="flex h-auto w-full items-center justify-between rounded-none px-0 py-0 hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <h2 className="font-semibold text-sm">{t('settings.assistantTools')}</h2>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </Button>

      {expanded && (
        <div className="mt-3">
          <p className="mb-3 pl-1 text-muted-foreground text-xs">
            {t('settings.assistantToolsDescription')}
          </p>

          <div className="mb-3 flex items-center justify-between rounded-md bg-muted/50 px-2 py-2">
            <span className="pl-1 font-medium text-sm">
              {t('settings.enableAllAssistantTools')}
            </span>
            <Checkbox
              checked={getToolsCheckState([
                ...toolStates.map((tool) => tool.enabled),
                ...dynamicMethodTools.map((tool) => isToolEnabled(tool.name, prefs)),
              ])}
              onCheckedChange={() => {
                const allEnabled = enabledCount === totalCount
                setAllAssistantToolsEnabled(!allEnabled)
                syncTools()
              }}
            />
          </div>

          {visibleNamespaces.length > 1 ? (
            <div className="mb-3">
              <p className="mb-1.5 pl-1 text-muted-foreground text-xs">
                {t('settings.jumpToSection')}
              </p>
              <nav
                className="flex gap-1.5 overflow-x-auto pb-1"
                aria-label={t('settings.jumpToSection')}
              >
                {visibleNamespaces.map((namespace) => {
                  const config = NAMESPACE_CONFIG[namespace]
                  const Icon = config.icon
                  const active = activeNamespace === namespace
                  return (
                    <Button
                      key={namespace}
                      type="button"
                      variant={active ? 'secondary' : 'ghost'}
                      size="sm"
                      className={cn(
                        'h-7 shrink-0 gap-1.5 px-2 font-mono text-xs',
                        active && 'bg-muted'
                      )}
                      onClick={() => scrollToNamespace(namespace)}
                      aria-current={active ? 'true' : undefined}
                    >
                      <Icon className={cn('h-3 w-3', config.iconColor)} />@{namespace}
                    </Button>
                  )
                })}
              </nav>
            </div>
          ) : null}

          <div ref={listRef} className="max-h-102.5 space-y-3 overflow-y-auto pr-1">
            {visibleNamespaces.map((namespace) => {
              const namespaceTools = toolStates.filter((tool) => tool.namespace === namespace)
              const dynamicTools = dynamicMethodTools.filter((tool) => tool.namespace === namespace)
              const config = NAMESPACE_CONFIG[namespace]
              const Icon = config.icon
              const namespaceDisabled = prefs.assistantDisabledNamespaces.includes(namespace)
              const namespaceEnabledFlags = [
                ...namespaceTools.map((tool) => tool.enabled),
                ...dynamicTools.map((tool) => isToolEnabled(tool.name, prefs)),
              ]

              return (
                <div
                  key={namespace}
                  ref={(node) => setSectionRef(namespace, node)}
                  data-namespace={namespace}
                  id={`assistant-tools-${namespace}`}
                  className={cn('rounded-lg border bg-card/30', namespaceDisabled && 'opacity-70')}
                >
                  <div className="flex items-center gap-2.5 border-border/50 border-b px-4 py-2.5">
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                        config.bgColor
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5', config.iconColor)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm">
                        @{namespace}
                        <span className="text-muted-foreground">/*</span>
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        {t(`assistantToolNamespace.${namespace}`)}
                      </p>
                    </div>
                    <Checkbox
                      checked={
                        namespaceEnabledFlags.length > 0
                          ? getToolsCheckState(namespaceEnabledFlags)
                          : !namespaceDisabled
                      }
                      onCheckedChange={() => {
                        const allEnabled =
                          namespaceEnabledFlags.length > 0
                            ? namespaceEnabledFlags.every(Boolean)
                            : !namespaceDisabled
                        setAssistantNamespaceToolsEnabled(namespace, !allEnabled)
                        syncTools()
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-x-2 p-2 lg:grid-cols-2">
                    {namespaceTools.map((tool) => (
                      <ToolRow
                        key={tool.name}
                        name={tool.name}
                        description={t(tool.labelKey)}
                        enabled={tool.enabled}
                        onEnabledChange={(enabled) => {
                          setAssistantToolEnabled(tool.name, enabled)
                          syncTools()
                        }}
                      />
                    ))}
                    {dynamicTools.map((tool) => (
                      <ToolRow
                        key={tool.name}
                        name={tool.name}
                        description={tool.description}
                        enabled={isToolEnabled(tool.name, prefs)}
                        onEnabledChange={(enabled) => {
                          setAssistantToolEnabled(tool.name, enabled)
                          syncTools()
                        }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!expanded && (
        <p className="mt-2 text-muted-foreground text-xs">
          {t('settings.assistantToolsEnabledCount', {
            enabled: enabledCount,
            total: totalCount,
          })}
        </p>
      )}
    </div>
  )
}
