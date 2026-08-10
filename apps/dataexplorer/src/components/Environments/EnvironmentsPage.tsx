import {
  Button,
  Checkbox,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  PasswordInput,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useConfirm,
} from '@4d/ui'
import {
  Check,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  Variable,
} from 'lucide-react'
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyPanel as AppEmptyPanel } from '~/components/EmptyPanel'
import { SavedListBadge } from '~/components/SavedListPanel'
import { useTranslation } from '~/i18n'
import {
  cloneEnvironment,
  createEmptyEnvironment,
  createEmptyVariable,
  ENVIRONMENT_COLORS,
  type Environment,
  type EnvVariable,
  nextNewEnvironmentName,
  parseEnvironmentsImport,
} from '~/lib/env'
import { getCurrentBaseId } from '~/lib/storage'
import { useEnvironmentsStore } from '~/store/environments'
import {
  type EnvironmentsScope,
  useActiveEnvironmentsTab,
  useTabsStore,
} from '~/store/tabs'

type ScopeTab = EnvironmentsScope

type EnvVarField = 'key' | 'initial' | 'current'

function EnvironmentColorPicker({
  color,
  onChange,
  align = 'start',
  triggerClassName,
}: {
  color?: string
  onChange: (color: string) => void
  align?: 'start' | 'center' | 'end'
  triggerClassName?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn('shrink-0 rounded-full p-0.5 hover:bg-muted', triggerClassName)}
          onClick={(event) => event.stopPropagation()}
          aria-label={t('environments.color')}
          title={t('environments.color')}
        >
          <span
            className="block size-2.5 rounded-full border border-border"
            style={{ backgroundColor: color || '#94a3b8' }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-46 p-1.5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid grid-cols-6 gap-1">
          {ENVIRONMENT_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={cn(
                'size-3.5 rounded-full border border-border transition-transform hover:scale-110',
                color === swatch && 'ring-1 ring-ring ring-offset-1 ring-offset-background'
              )}
              style={{ backgroundColor: swatch }}
              onClick={() => {
                onChange(swatch)
                setOpen(false)
              }}
              aria-label={swatch}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function focusAdjacentEnvVarRow(event: KeyboardEvent<HTMLInputElement>, field: EnvVarField) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  const row = event.currentTarget.closest('[data-env-var-row]')
  const list = row?.parentElement
  if (!row || !list) return
  const rows = [...list.querySelectorAll<HTMLElement>(':scope > [data-env-var-row]')]
  const index = rows.indexOf(row as HTMLElement)
  if (index < 0) return
  const next = rows[event.key === 'ArrowUp' ? index - 1 : index + 1]
  if (!next) return
  const target = next.querySelector<HTMLInputElement>(`[data-env-var-field="${field}"]`)
  if (!target) return
  event.preventDefault()
  target.focus()
  const len = target.value.length
  try {
    target.setSelectionRange(len, len)
  } catch {
    // Some input types (e.g. password in older engines) may not support selection.
  }
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function VariableRow({
  row,
  onChange,
  onRemove,
}: {
  row: EnvVariable
  onChange: (patch: Partial<EnvVariable>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const ValueInput = row.type === 'secret' ? PasswordInput : Input

  return (
    <div
      data-env-var-row
      className={cn(
        'group grid grid-cols-[1.5rem_minmax(7rem,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem_1.75rem] items-center gap-1 border-border/50 border-b px-2 py-1',
        'hover:bg-muted/30',
        !row.enabled && 'opacity-55'
      )}
    >
      <Checkbox
        checked={row.enabled}
        onCheckedChange={(checked) => onChange({ enabled: checked === true })}
        aria-label={t('environments.enabled')}
      />
      <Input
        value={row.key}
        onChange={(e) => onChange({ key: e.target.value })}
        onKeyDown={(e) => focusAdjacentEnvVarRow(e, 'key')}
        data-env-var-field="key"
        placeholder={t('environments.variablePlaceholder')}
        className="h-6 rounded-none border-0 bg-transparent px-1.5 font-mono text-xs shadow-none focus-visible:ring-0"
      />
      <ValueInput
        value={row.initialValue ?? ''}
        onChange={(e) => {
          const initialValue = e.target.value
          // Keep Current linked to Initial until the user edits Current on its own.
          const previousInitial = row.initialValue ?? ''
          const syncCurrent = row.value === previousInitial
          onChange(syncCurrent ? { initialValue, value: initialValue } : { initialValue })
        }}
        onKeyDown={(e) => focusAdjacentEnvVarRow(e, 'initial')}
        data-env-var-field="initial"
        placeholder={t('environments.initialValue')}
        className="h-6 rounded-none border-0 bg-transparent px-1.5 font-mono text-xs shadow-none focus-visible:ring-0"
      />
      <ValueInput
        value={row.value}
        onChange={(e) => onChange({ value: e.target.value })}
        onKeyDown={(e) => focusAdjacentEnvVarRow(e, 'current')}
        data-env-var-field="current"
        placeholder={t('environments.currentValue')}
        className="h-6 rounded-none border-0 bg-transparent px-1.5 font-mono text-xs shadow-none focus-visible:ring-0"
      />
      <Select
        value={row.type}
        onValueChange={(type) => onChange({ type: type === 'secret' ? 'secret' : 'default' })}
      >
        <SelectTrigger className="h-6 border-0 bg-transparent px-1 text-[10px] shadow-none focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">{t('environments.typeDefault')}</SelectItem>
          <SelectItem value="secret">{t('environments.typeSecret')}</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-focus-within:opacity-100 group-hover:opacity-100"
        onClick={onRemove}
        aria-label={t('environments.removeVariable')}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}

function VariablesList({
  variables,
  onChange,
  emptyTitle,
  emptyDescription,
}: {
  variables: EnvVariable[]
  onChange: (next: EnvVariable[]) => void
  emptyTitle: string
  emptyDescription: string
}) {
  const { t } = useTranslation()

  const updateRow = (index: number, patch: Partial<EnvVariable>) => {
    onChange(variables.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  if (variables.length === 0) {
    return (
      <div className="p-2">
        <AppEmptyPanel
          icon={Variable}
          badgeTone="muted"
          title={emptyTitle}
          description={emptyDescription}
          ghost="rows"
          bordered
          size="sm"
        />
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background/40">
      <div className="sticky top-0 z-10 grid grid-cols-[1.5rem_minmax(7rem,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem_1.75rem] gap-1 border-border/60 border-b bg-muted/25 px-2 py-1 text-[10px] text-muted-foreground">
        <span />
        <span>{t('environments.variable')}</span>
        <span>{t('environments.initialValue')}</span>
        <span>{t('environments.currentValue')}</span>
        <span>{t('environments.type')}</span>
        <span />
      </div>
      {variables.map((row, index) => (
        <VariableRow
          key={row.id}
          row={row}
          onChange={(patch) => updateRow(index, patch)}
          onRemove={() => onChange(variables.filter((_, i) => i !== index))}
        />
      ))}
      <div className="border-border/50 border-t px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] text-muted-foreground"
          onClick={() => onChange([...variables, createEmptyVariable()])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('environments.addVariable')}
        </Button>
      </div>
    </div>
  )
}

function EnvironmentListRow({
  env,
  isActive,
  isSelected,
  enabledCount,
  onSelect,
  onRename,
  onColorChange,
  onDuplicate,
  onToggleActive,
  onDelete,
}: {
  env: Environment
  isActive: boolean
  isSelected: boolean
  enabledCount: number
  onSelect: () => void
  onRename: (name: string) => void
  onColorChange: (color: string) => void
  onDuplicate: () => void
  onToggleActive: () => void
  onDelete: () => void | Promise<void>
}) {
  const { t } = useTranslation()
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(env.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!renaming) setDraftName(env.name)
  }, [env.name, renaming])

  useEffect(() => {
    if (!renaming) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [renaming])

  const commitRename = () => {
    const trimmed = draftName.trim()
    onRename(trimmed || env.name.trim() || t('environments.newEnvironment'))
    setRenaming(false)
  }

  // Keep label and rename input on the same box so the row doesn't jump.
  const nameFieldClassName =
    'box-border h-6 min-w-0 flex-1 truncate border-0 bg-transparent px-1 py-0 font-medium text-xs leading-6 shadow-none'

  return (
    <li
      aria-current={isSelected ? 'true' : undefined}
      className={cn(
        'group relative flex h-8 items-center gap-1 border-border/40 border-b border-l-2 px-1.5 transition-colors',
        isSelected
          ? 'border-l-primary bg-accent text-accent-foreground'
          : 'border-l-transparent hover:bg-muted/50'
      )}
    >
      <EnvironmentColorPicker color={env.color} onChange={onColorChange} />

      {renaming ? (
        <Input
          ref={inputRef}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitRename()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setDraftName(env.name)
              setRenaming(false)
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className={cn(nameFieldClassName, 'rounded-none focus-visible:ring-0')}
          aria-label={t('environments.name')}
        />
      ) : (
        <button
          type="button"
          className={cn(nameFieldClassName, 'text-left', isSelected && 'font-semibold')}
          onClick={onSelect}
          onDoubleClick={(e) => {
            e.preventDefault()
            setDraftName(env.name)
            setRenaming(true)
          }}
        >
          {env.name}
        </button>
      )}

      {isActive ? (
        <SavedListBadge className="shrink-0 border-primary/30 bg-primary/10 text-primary normal-case group-hover:hidden">
          {t('environments.active')}
        </SavedListBadge>
      ) : (
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums group-hover:hidden">
          {enabledCount}
        </span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label={t('environments.listActions')}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onToggleActive}>
            <Check className="mr-2 h-3.5 w-3.5" />
            {isActive ? t('environments.unsetActive') : t('environments.setActive')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setDraftName(env.name)
              setRenaming(true)
            }}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            {t('environments.rename')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            {t('environments.duplicate')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            {t('environments.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

function EnvironmentsEditor({
  environments,
  activeEnvironmentId,
  onChange,
  emptyHint,
}: {
  environments: Environment[]
  activeEnvironmentId: string | null
  onChange: (block: { environments: Environment[]; activeEnvironmentId: string | null }) => void
  emptyHint: string
}) {
  const { t } = useTranslation()
  const { confirm, ConfirmDialog } = useConfirm()
  const [selectedId, setSelectedId] = useState<string | null>(
    activeEnvironmentId ?? environments[0]?.id ?? null
  )
  const selected = environments.find((e) => e.id === selectedId) ?? environments[0] ?? null

  const updateEnvironment = (id: string, patch: Partial<Environment>) => {
    onChange({
      environments: environments.map((env) => (env.id === id ? { ...env, ...patch } : env)),
      activeEnvironmentId,
    })
  }

  const updateSelected = (patch: Partial<Environment>) => {
    if (!selected) return
    updateEnvironment(selected.id, patch)
  }

  const addEnvironment = () => {
    const env = createEmptyEnvironment(
      nextNewEnvironmentName(
        environments.map((item) => item.name),
        t('environments.newEnvironment')
      ),
      environments.map((item) => item.color)
    )
    onChange({
      environments: [...environments, env],
      activeEnvironmentId,
    })
    setSelectedId(env.id)
  }

  const duplicateEnvironment = (env: Environment) => {
    const copy = cloneEnvironment(
      env,
      undefined,
      environments.map((item) => item.color)
    )
    onChange({
      environments: [...environments, copy],
      activeEnvironmentId,
    })
    setSelectedId(copy.id)
  }

  const removeEnvironmentById = (id: string) => {
    const next = environments.filter((e) => e.id !== id)
    onChange({
      environments: next,
      activeEnvironmentId: activeEnvironmentId === id ? null : activeEnvironmentId,
    })
    setSelectedId((current) => (current === id ? (next[0]?.id ?? null) : current))
  }

  const deleteEnvironment = async (id: string) => {
    const env = environments.find((item) => item.id === id)
    if (!env) return
    const hasVariables = env.variables.some((variable) => variable.key.trim())
    if (hasVariables) {
      const ok = await confirm({
        title: t('environments.deleteConfirmTitle'),
        description: t('environments.deleteConfirmDescription', { name: env.name }),
        confirmText: t('environments.delete'),
        cancelText: t('common.cancel'),
        variant: 'destructive',
      })
      if (!ok) return
    }
    removeEnvironmentById(id)
  }

  if (environments.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ConfirmDialog />
        <div className="p-2">
          <AppEmptyPanel
            icon={Variable}
            badgeTone="muted"
            title={emptyHint}
            description={t('environments.addEnvironmentHint')}
            ghost="rows"
            bordered
            size="sm"
          />
        </div>
        <div className="border-border/50 border-t px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-muted-foreground"
            onClick={addEnvironment}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('environments.add')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1">
      <ConfirmDialog />
      <div className="flex w-52 shrink-0 flex-col border-border/60 border-r bg-muted/10">
        <div className="flex items-center justify-between border-border/60 border-b px-2 py-1">
          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
            {t('environments.list')}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground"
            onClick={addEnvironment}
            aria-label={t('environments.add')}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {environments.map((env) => {
            const isActive = env.id === activeEnvironmentId
            const isSelected = env.id === selected?.id
            const enabledCount = env.variables.filter((v) => v.enabled && v.key.trim()).length
            return (
              <EnvironmentListRow
                key={env.id}
                env={env}
                isActive={isActive}
                isSelected={isSelected}
                enabledCount={enabledCount}
                onSelect={() => setSelectedId(env.id)}
                onRename={(name) => updateEnvironment(env.id, { name })}
                onColorChange={(color) => updateEnvironment(env.id, { color })}
                onDuplicate={() => duplicateEnvironment(env)}
                onToggleActive={() =>
                  onChange({
                    environments,
                    activeEnvironmentId: env.id === activeEnvironmentId ? null : env.id,
                  })
                }
                onDelete={() => deleteEnvironment(env.id)}
              />
            )
          })}
        </ul>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5 border-border/60 border-b bg-muted/15 px-2 py-1">
              <Input
                value={selected.name}
                onChange={(e) => updateSelected({ name: e.target.value })}
                onBlur={(e) => {
                  const trimmed = e.target.value.trim()
                  if (trimmed && trimmed !== selected.name) {
                    updateSelected({ name: trimmed })
                  } else if (!trimmed) {
                    updateSelected({
                      name: selected.name.trim() || t('environments.newEnvironment'),
                    })
                  }
                }}
                className="h-6 max-w-48 border-0 bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-0"
                aria-label={t('environments.name')}
              />
              <EnvironmentColorPicker
                color={selected.color}
                onChange={(color) => updateSelected({ color })}
              />
              <div className="ml-auto flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground"
                  onClick={() =>
                    onChange({
                      environments,
                      activeEnvironmentId: selected.id === activeEnvironmentId ? null : selected.id,
                    })
                  }
                >
                  {selected.id === activeEnvironmentId ? (
                    <>
                      <Check className="h-3 w-3 text-primary" />
                      {t('environments.unsetActive')}
                    </>
                  ) : (
                    t('environments.setActive')
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground"
                  onClick={() => duplicateEnvironment(selected)}
                  aria-label={t('environments.duplicate')}
                  title={t('environments.duplicate')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground"
                  onClick={() =>
                    updateSelected({
                      variables: selected.variables.map((v) => ({
                        ...v,
                        value: v.initialValue ?? v.value,
                      })),
                    })
                  }
                  aria-label={t('environments.resetToInitial')}
                  title={t('environments.resetToInitial')}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteEnvironment(selected.id)}
                  aria-label={t('environments.delete')}
                  title={t('environments.delete')}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <VariablesList
              variables={selected.variables}
              onChange={(variables) => updateSelected({ variables })}
              emptyTitle={t('environments.noVariablesTitle')}
              emptyDescription={t('environments.noVariablesDescription')}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}

export function EnvironmentsPage() {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const tab = useActiveEnvironmentsTab()
  const setEnvironmentsScope = useTabsStore((s) => s.setEnvironmentsScope)
  const globals = useEnvironmentsStore((s) => s.globals)
  const setGlobals = useEnvironmentsStore((s) => s.setGlobals)
  const revision = useEnvironmentsStore((s) => s.revision)
  const getProfileBlock = useEnvironmentsStore((s) => s.getProfileBlock)
  const setProfileBlock = useEnvironmentsStore((s) => s.setProfileBlock)
  const getBaseBlock = useEnvironmentsStore((s) => s.getBaseBlock)
  const setBaseBlock = useEnvironmentsStore((s) => s.setBaseBlock)
  void revision

  const profileBlock = getProfileBlock()
  const baseBlock = getBaseBlock()
  const hasBase = Boolean(getCurrentBaseId())

  const storedScope: ScopeTab =
    tab?.scope === 'profile' || tab?.scope === 'base' || tab?.scope === 'globals'
      ? tab.scope
      : 'globals'
  const scope: ScopeTab = storedScope === 'base' && !hasBase ? 'globals' : storedScope

  const setScope = (value: ScopeTab) => {
    if (!tab) return
    setEnvironmentsScope(tab.id, value)
  }

  const count = useMemo(() => {
    if (scope === 'globals') return globals.filter((v) => v.key.trim()).length
    if (scope === 'profile') return profileBlock.environments.length
    return baseBlock.environments.length
  }, [scope, globals, profileBlock.environments.length, baseBlock.environments.length])

  const scopeHint =
    scope === 'globals'
      ? t('environments.globalsHint')
      : scope === 'profile'
        ? t('environments.profileHint')
        : t('environments.baseHint')

  const exportAll = () => {
    downloadJson('dataexplorer-environments.json', {
      version: 1,
      globals,
      profile: profileBlock,
      base: hasBase ? baseBlock : undefined,
    })
  }

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const record =
        parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
      if (!record) return

      const asExport = parseEnvironmentsImport(parsed)
      if (asExport?.globals) setGlobals(asExport.globals)
      if (asExport?.environments) {
        const block = {
          environments: asExport.environments,
          activeEnvironmentId: asExport.activeEnvironmentId ?? null,
        }
        if (asExport.scope === 'base' && hasBase) setBaseBlock(block)
        else setProfileBlock(block)
      }

      if (Array.isArray(record.globals)) {
        const g = parseEnvironmentsImport({ version: 1, globals: record.globals })
        if (g?.globals) setGlobals(g.globals)
      }
      if (record.profile && typeof record.profile === 'object') {
        const p = record.profile as {
          environments?: unknown
          activeEnvironmentId?: string | null
        }
        if (Array.isArray(p.environments)) {
          setProfileBlock({
            environments: (parseEnvironmentsImport({
              version: 1,
              environments: p.environments,
            })?.environments ?? []) as Environment[],
            activeEnvironmentId: p.activeEnvironmentId ?? null,
          })
        }
      }
      if (hasBase && record.base && typeof record.base === 'object') {
        const b = record.base as {
          environments?: unknown
          activeEnvironmentId?: string | null
        }
        if (Array.isArray(b.environments)) {
          setBaseBlock({
            environments: (parseEnvironmentsImport({
              version: 1,
              environments: b.environments,
            })?.environments ?? []) as Environment[],
            activeEnvironmentId: b.activeEnvironmentId ?? null,
          })
        }
      }
    } catch {
      // ignore invalid files
    }
  }

  const scopeOptions = [
    { value: 'globals' as const, label: t('environments.globals') },
    { value: 'profile' as const, label: t('environments.profile') },
    {
      value: 'base' as const,
      label: t('environments.base'),
    },
  ].filter((opt) => opt.value !== 'base' || hasBase)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/70 bg-muted/10 shadow-xs">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-border/60 border-b bg-muted/25 px-2 py-1">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Variable className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="font-medium text-xs">{t('environments.title')}</p>
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
              <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
              {t('environments.export')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1 h-3.5 w-3.5" aria-hidden />
              {t('environments.import')}
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
            onValueChange={(value) => setScope(value)}
            aria-label={t('environments.title')}
            size="sm"
          />
          <p className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{scopeHint}</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {scope === 'globals' ? (
            <VariablesList
              variables={globals}
              onChange={setGlobals}
              emptyTitle={t('environments.noVariablesTitle')}
              emptyDescription={t('environments.globalsHint')}
            />
          ) : null}
          {scope === 'profile' ? (
            <EnvironmentsEditor
              environments={profileBlock.environments}
              activeEnvironmentId={profileBlock.activeEnvironmentId}
              onChange={setProfileBlock}
              emptyHint={t('environments.emptyProfile')}
            />
          ) : null}
          {scope === 'base' && hasBase ? (
            <EnvironmentsEditor
              environments={baseBlock.environments}
              activeEnvironmentId={baseBlock.activeEnvironmentId}
              onChange={setBaseBlock}
              emptyHint={t('environments.emptyBase')}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
