import { Button, Checkbox, cn, Input, Switch } from '@4d/ui'
import { listBuiltinWidgets } from '@4djs/ai-widgets'
import { ChevronDown, LayoutGrid, RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { dataExplorerToolRegistry } from '~/assistant/tool-registry'
import { refreshWidgetTools } from '~/assistant/ui-tools/widgets'
import { useTranslation } from '~/i18n'
import { useSettingsStore } from '~/store/settings'
import { useActiveSettingsTab, useTabsStore } from '~/store/tabs'

function getCheckState(enabledFlags: boolean[]): boolean | 'indeterminate' {
  const enabledCount = enabledFlags.filter(Boolean).length
  if (enabledCount === 0) return false
  if (enabledCount === enabledFlags.length) return true
  return 'indeterminate'
}

export function WidgetSettings() {
  const { t } = useTranslation()
  const settingsTab = useActiveSettingsTab()
  const { setSettingsWidgetsExpanded } = useTabsStore()
  const expanded = settingsTab?.widgetsExpanded ?? false
  const setExpanded = (next: boolean) => {
    if (settingsTab) {
      setSettingsWidgetsExpanded(settingsTab.id, next)
    }
  }

  const disabledWidgetTypes = useSettingsStore((s) => s.disabledWidgetTypes)
  const setWidgetTypeEnabled = useSettingsStore((s) => s.setWidgetTypeEnabled)
  const setAllWidgetTypesEnabled = useSettingsStore((s) => s.setAllWidgetTypesEnabled)
  const restoreBuiltinWidgets = useSettingsStore((s) => s.restoreBuiltinWidgets)
  const [query, setQuery] = useState('')

  const builtins = useMemo(() => listBuiltinWidgets(), [])
  const allTypes = useMemo(() => builtins.map((w) => w.type), [builtins])
  const disabledSet = useMemo(() => new Set(disabledWidgetTypes), [disabledWidgetTypes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return builtins
    return builtins.filter(
      (w) =>
        w.type.toLowerCase().includes(q) ||
        w.label.toLowerCase().includes(q) ||
        (w.description?.toLowerCase().includes(q) ?? false)
    )
  }, [builtins, query])

  const enabledFlags = allTypes.map((type) => !disabledSet.has(type))
  const enabledCount = enabledFlags.filter(Boolean).length

  function syncTools() {
    refreshWidgetTools(dataExplorerToolRegistry)
  }

  return (
    <div className="mb-4 rounded-lg border bg-card p-4">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setExpanded(!expanded)}
        className="flex h-auto w-full items-center justify-between rounded-none px-0 py-0 hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-indigo-500/15 text-indigo-400">
            <LayoutGrid className="h-3.5 w-3.5" />
          </div>
          <h2 className="font-semibold text-sm">{t('settings.widgets')}</h2>
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
            {t('settings.widgetsDescription')}
          </p>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-2">
            <span className="pl-1 font-medium text-sm">{t('settings.enableAllWidgets')}</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 gap-1 text-xs"
                onClick={() => {
                  restoreBuiltinWidgets()
                  syncTools()
                }}
                disabled={disabledWidgetTypes.length === 0}
              >
                <RefreshCw className="h-3 w-3" />
                {t('settings.restoreBuiltinWidgets')}
              </Button>
              <Checkbox
                checked={getCheckState(enabledFlags)}
                onCheckedChange={() => {
                  const allEnabled = enabledCount === allTypes.length
                  setAllWidgetTypesEnabled(!allEnabled, allTypes)
                  syncTools()
                }}
              />
            </div>
          </div>

          <div className="relative mb-3">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('settings.searchWidgets')}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="max-h-102.5 space-y-1 overflow-y-auto pr-1">
            {filtered.map((widget) => {
              const enabled = !disabledSet.has(widget.type)
              return (
                <div
                  key={widget.type}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Switch
                      checked={enabled}
                      onCheckedChange={(next) => {
                        setWidgetTypeEnabled(widget.type, next)
                        syncTools()
                      }}
                      className="shrink-0 scale-75"
                    />
                    <div className="min-w-0">
                      <span
                        className={cn(
                          'block truncate font-medium text-xs',
                          !enabled && 'text-muted-foreground'
                        )}
                      >
                        {widget.label}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {widget.type}
                        {widget.description ? ` · ${widget.description}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-muted-foreground text-xs">
                {t('settings.noWidgetsMatch')}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {!expanded && (
        <p className="mt-2 text-muted-foreground text-xs">
          {t('settings.widgetsEnabledCount', {
            enabled: enabledCount,
            total: allTypes.length,
          })}
        </p>
      )}
    </div>
  )
}
