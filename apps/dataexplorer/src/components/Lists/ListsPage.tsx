import { Button, SegmentedControl } from '@4d/ui'
import { Download, List, Upload } from 'lucide-react'
import { useRef } from 'react'
import { ListsEditor } from '~/components/Lists/ListsEditor'
import { useTranslation } from '~/i18n'
import { applyListsImport, type ListsExport, type PickListScope } from '~/lib/env'
import { getCurrentBaseId } from '~/lib/storage'
import { useListsStore } from '~/store/lists'
import { type ListsScope, useActiveListsTab, useTabsStore } from '~/store/tabs'

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ListsPage() {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const tab = useActiveListsTab()
  const setListsScope = useTabsStore((s) => s.setListsScope)
  const revision = useListsStore((s) => s.revision)
  const getLists = useListsStore((s) => s.getLists)
  const setLists = useListsStore((s) => s.setLists)
  const getScopedLists = useListsStore((s) => s.getScopedLists)
  void revision

  const hasBase = Boolean(getCurrentBaseId())
  const storedScope: ListsScope =
    tab?.scope === 'profile' || tab?.scope === 'base' || tab?.scope === 'globals'
      ? tab.scope
      : 'globals'
  const scope: ListsScope = storedScope === 'base' && !hasBase ? 'globals' : storedScope

  const setScope = (value: ListsScope) => {
    if (!tab) return
    setListsScope(tab.id, value)
  }

  const count = getLists(scope).filter((entry) => entry.name.trim()).length

  const scopeHint =
    scope === 'globals'
      ? t('lists.globalsHint')
      : scope === 'profile'
        ? t('lists.profileHint')
        : t('lists.baseHint')

  const exportAll = () => {
    const scoped = getScopedLists()
    const payload: ListsExport = {
      version: 1,
      globals: scoped.globals,
      profile: scoped.profile,
      ...(hasBase ? { base: scoped.base } : {}),
    }
    downloadJson('dataexplorer-lists.json', payload)
  }

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const imported = applyListsImport(parsed, { hasBase })
      if (!imported) return
      if (imported.globals) setLists('globals', imported.globals)
      if (imported.profile) setLists('profile', imported.profile)
      if (imported.base) setLists('base', imported.base)
    } catch {
      // ignore invalid files
    }
  }

  const scopeOptions = [
    { value: 'globals' as const, label: t('lists.globals') },
    { value: 'profile' as const, label: t('lists.profile') },
    { value: 'base' as const, label: t('lists.base') },
  ].filter((opt) => opt.value !== 'base' || hasBase)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/70 bg-muted/10 shadow-xs">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-border/60 border-b bg-muted/25 px-2 py-1">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <List className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="font-medium text-xs">{t('lists.title')}</p>
            {count > 0 ? (
              <span className="rounded-full border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                {count}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground"
              onClick={exportAll}
            >
              <Upload className="mr-1 h-3.5 w-3.5" aria-hidden />
              {t('lists.export')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground"
              onClick={() => fileRef.current?.click()}
            >
              <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
              {t('lists.import')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onImportFile(file)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-border/50 border-b px-2 py-1.5">
          <SegmentedControl
            value={scope}
            options={scopeOptions}
            onValueChange={(value) => setScope(value as PickListScope)}
            aria-label={t('lists.title')}
            size="sm"
          />
          <p className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{scopeHint}</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ListsEditor scope={scope} onMovedTo={setScope} />
        </div>
      </div>
    </div>
  )
}
