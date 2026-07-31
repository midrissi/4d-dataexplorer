import {
  Button,
  Checkbox,
  CodeEditor,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  useConfirm,
} from '@4d/ui'
import {
  AlertTriangle,
  Braces,
  Check,
  ChevronDown,
  ChevronDown as ChevronDownIcon,
  Copy,
  Database,
  Dices,
  Download,
  Eye,
  FileText,
  Keyboard,
  LayoutGrid,
  LayoutTemplate,
  Moon,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Sun,
  Table2,
  Trash2,
  TreeDeciduous,
  Upload,
  UserCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditorLabels, useTranslation } from '~/i18n'
import { downloadBytes } from '~/lib/download-bytes'
import { resolveLucideIcon } from '~/lib/lucide-icon'
import {
  mobileFullscreenDialogClass,
  mobileMenuCollisionProps,
  mobileMenuContentClass,
  mobileMenuHeaderClass,
  mobileMenuItemClass,
} from '~/lib/mobile-menu'
import { isDesktop, isMobileShell } from '~/lib/platform'
import { shortcutMatchesRecordedCombo, shortcutMatchesText } from '~/lib/shortcut-search'
import { useTheme, useThemeName } from '~/providers/ThemeProvider'
import { useDataExplorerStore } from '~/store'
import {
  COLOR_PRESETS,
  type ColorPreset,
  DEFAULT_PROFILE_ID,
  DEFAULT_PROFILE_NAME_KEY,
  formatKeyCombo,
  formatShortcut,
  ICON_PRESETS,
  type KeyboardShortcut,
  type KeyCombo,
  type Profile,
  SHORTCUT_PRESETS,
  type ShortcutCategory,
  type ShortcutPresetId,
  useCodeEditorPrefs,
  useCurrentProfileId,
  useProfiles,
  useSettingsStore,
  useUpdateCodeEditorPrefs,
} from '~/store/settings'
import { useActiveSettingsTab, useTabsStore } from '~/store/tabs'
import { AssistantLlmSettingsPanel } from './AssistantLlmSettingsPanel'
import { AssistantToolsSettings } from './AssistantToolsSettings'
import { DatabaseIdentityPanel } from './DatabaseIdentityPanel'
import {
  DataclassCustomizeModal,
  DataclassIcon,
  getDataclassColorClasses,
} from './DataclassCustomizeModal'
import { CATEGORY_CONFIG, CATEGORY_ORDER } from './KeyboardShortcutsModal'
import { ProfileAppearancePopover } from './ProfileAppearancePopover'
import { ServerConnectionSettings } from './ServerConnectionSettings'
import { SettingsField } from './SettingsField'
import { SettingsSegmentedField } from './SettingsSegmentedField'
import { ShortcutFinder } from './ShortcutFinder'
import { ShortcutRecordModal } from './ShortcutRecordModal'
import { WidgetSettings } from './WidgetSettings'

const CODE_EDITOR_PREVIEW_JSON = `{
  "name": "Example",
  "items": [1, 2, 3],
  "active": true
}`

export function SettingsPage() {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const { theme, setTheme } = useTheme()
  const { themeName, setThemeName, availableThemes } = useThemeName()
  const {
    readonlyMode,
    setReadonlyMode,
    confirmDisconnect,
    setConfirmDisconnect,
    defaultViewMode,
    setDefaultViewMode,
    defaultEntityViewMode,
    setDefaultEntityViewMode,
    defaultEditMode,
    setDefaultEditMode,
    sidebarViewMode,
    setSidebarViewMode,
    pageSize,
    setPageSize,
    defaultQueryRunMode,
    setDefaultQueryRunMode,
    shortcuts,
    activeShortcutPreset,
    updateShortcut,
    setAllShortcutsEnabled,
    setCategoryShortcutsEnabled,
    applyShortcutPreset,
    resetShortcuts,
    syncShortcutsWithDefaults,
    resetAllSettings,
    exportSettings,
    exportProfiles,
    importProfiles,
    parseImportProfiles,
    importProfilesByIds,
    addProfile,
    duplicateProfile,
    removeProfile,
    renameProfile,
    updateProfileAppearance,
    switchProfile,
    dataclassCustomizations,
    setDataclassCustomization,
    removeDataclassCustomization,
    resetDataclassCustomizations,
  } = useSettingsStore()

  const profiles = useProfiles()
  const currentProfileId = useCurrentProfileId()
  const codeEditorPrefs = useCodeEditorPrefs()
  const updateCodeEditorPrefs = useUpdateCodeEditorPrefs()
  const editorLabels = useEditorLabels()
  const { dataclasses } = useDataExplorerStore()

  // Get settings tab state from tabs store
  const settingsTab = useActiveSettingsTab()
  const { setSettingsShortcutsExpanded, setSettingsDataclassesExpanded } = useTabsStore()

  // Use tab state for expanded sections (with fallback for safety)
  const shortcutsExpanded = settingsTab?.shortcutsExpanded ?? false
  const dataclassesExpanded = settingsTab?.dataclassesExpanded ?? false

  const setShortcutsExpanded = (expanded: boolean) => {
    if (settingsTab) {
      setSettingsShortcutsExpanded(settingsTab.id, expanded)
    }
  }

  const setDataclassesExpanded = (expanded: boolean) => {
    if (settingsTab) {
      setSettingsDataclassesExpanded(settingsTab.id, expanded)
    }
  }

  // Randomly assign icons/colors to dataclasses without customization
  const randomizeUncustomizedDataclasses = useCallback(() => {
    const colorKeys = Object.keys(COLOR_PRESETS).filter((key) => key !== 'default')

    for (const dataclass of dataclasses) {
      const existing = dataclassCustomizations[dataclass.name]
      // Skip if already has both icon and color
      if (existing?.icon && existing?.color) continue

      // Random icon (only if not set)
      const randomIcon =
        existing?.icon || ICON_PRESETS[Math.floor(Math.random() * ICON_PRESETS.length)]
      // Random color (only if not set)
      const randomColor = existing?.color || colorKeys[Math.floor(Math.random() * colorKeys.length)]

      setDataclassCustomization(dataclass.name, {
        ...existing,
        icon: randomIcon,
        color: randomColor,
      })
    }
  }, [dataclasses, dataclassCustomizations, setDataclassCustomization])

  // Count how many dataclasses are missing customization
  const uncustomizedCount = useMemo(() => {
    return dataclasses.filter((dc) => {
      const customization = dataclassCustomizations[dc.name]
      return !customization?.icon || !customization?.color
    }).length
  }, [dataclasses, dataclassCustomizations])

  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importPendingContent, setImportPendingContent] = useState<string | null>(null)
  const [importPendingProfiles, setImportPendingProfiles] = useState<Array<{
    id: string
    name: string
    willOverwrite: boolean
  }> | null>(null)
  const [importSelectedIds, setImportSelectedIds] = useState<Set<string>>(new Set())

  const [newProfileName, setNewProfileName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [appearancePopoverId, setAppearancePopoverId] = useState<string | null>(null)

  function ProfileBadge({ profile, className }: { profile: Profile; className?: string }) {
    const iconName = profile.icon || 'UserCircle'
    const IconComponent = resolveLucideIcon(iconName) ?? UserCircle
    const colorPreset =
      profile.color && profile.color in COLOR_PRESETS
        ? COLOR_PRESETS[profile.color as ColorPreset]
        : null
    const bgClass = colorPreset?.bg ?? 'bg-primary'
    return (
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          bgClass,
          className
        )}
      >
        <IconComponent className="h-3.5 w-3.5 text-white" />
      </div>
    )
  }
  const [renamingName, setRenamingName] = useState('')
  const [exportSelectOpen, setExportSelectOpen] = useState(false)
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(new Set())
  const [profilesListExpanded, setProfilesListExpanded] = useState(false)

  const { confirm, ConfirmDialog } = useConfirm()

  // Keyboard shortcut recording state (modal opens when recordingShortcutId is set)
  const [recordingShortcutId, setRecordingShortcutId] = useState<string | null>(null)
  const [recordAsChord, setRecordAsChord] = useState(false)
  const [recordingConflict, setRecordingConflict] = useState<string | null>(null)
  const [shortcutSearchQuery, setShortcutSearchQuery] = useState('')
  const [shortcutSearchCombo, setShortcutSearchCombo] = useState<KeyCombo | null>(null)
  const shortcutsListRef = useRef<HTMLDivElement>(null)
  const shortcutSectionRefs = useRef<Map<ShortcutCategory, HTMLDivElement>>(new Map())
  const [activeShortcutCategory, setActiveShortcutCategory] = useState<ShortcutCategory | null>(
    null
  )

  const filteredShortcuts = useMemo(() => {
    if (shortcutSearchCombo) {
      return shortcuts.filter((shortcut) =>
        shortcutMatchesRecordedCombo(shortcut, shortcutSearchCombo)
      )
    }
    return shortcuts.filter((shortcut) =>
      shortcutMatchesText(
        shortcut,
        t(`shortcut.${shortcut.id}`) || shortcut.label,
        formatShortcut(shortcut),
        shortcutSearchQuery
      )
    )
  }, [shortcutSearchCombo, shortcutSearchQuery, shortcuts, t])

  const visibleShortcutCategories = useMemo(
    () =>
      CATEGORY_ORDER.filter((category) =>
        filteredShortcuts.some((shortcut) => shortcut.category === category)
      ),
    [filteredShortcuts]
  )

  const handleShortcutSearchTextChange = useCallback((value: string) => {
    setShortcutSearchQuery(value)
    setShortcutSearchCombo(null)
  }, [])

  const handleShortcutSearchRecord = useCallback((combo: KeyCombo, displayValue: string) => {
    setShortcutSearchCombo(combo)
    setShortcutSearchQuery(displayValue)
  }, [])

  const clearShortcutSearch = useCallback(() => {
    setShortcutSearchQuery('')
    setShortcutSearchCombo(null)
  }, [])

  // Pull in newly registered shortcuts (e.g. Toggle Terminal) after app updates.
  useEffect(() => {
    syncShortcutsWithDefaults()
  }, [syncShortcutsWithDefaults])

  useEffect(() => {
    if (!shortcutsExpanded || visibleShortcutCategories.length === 0) return
    const root = shortcutsListRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]?.target
        if (!(top instanceof HTMLElement)) return
        const category = top.dataset.shortcutCategory as ShortcutCategory | undefined
        if (category) setActiveShortcutCategory(category)
      },
      { root, rootMargin: '-8% 0px -70% 0px', threshold: [0.1, 0.35, 0.6] }
    )

    for (const category of visibleShortcutCategories) {
      const el = shortcutSectionRefs.current.get(category)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [shortcutsExpanded, visibleShortcutCategories])

  const scrollToShortcutCategory = (category: ShortcutCategory) => {
    const container = shortcutsListRef.current
    const section = shortcutSectionRefs.current.get(category)
    if (!container || !section) return
    setActiveShortcutCategory(category)
    const containerRect = container.getBoundingClientRect()
    const sectionRect = section.getBoundingClientRect()
    container.scrollTo({
      top: container.scrollTop + sectionRect.top - containerRect.top - 4,
      behavior: 'smooth',
    })
  }

  const setShortcutSectionRef = (category: ShortcutCategory, node: HTMLDivElement | null) => {
    if (node) shortcutSectionRefs.current.set(category, node)
    else shortcutSectionRefs.current.delete(category)
  }

  // Check if a key combo conflicts with another shortcut (single key or chord part)
  const findConflict = useCallback(
    (combo: KeyCombo, excludeId: string): KeyboardShortcut | undefined => {
      return shortcuts.find((s) => {
        if (s.id === excludeId) return false
        const keyMatch =
          s.key === combo.key ||
          (s.key === 'Space' && combo.key === ' ') ||
          (combo.key === 'Space' && s.key === ' ')
        const modMatch =
          !!s.modifiers.meta === !!combo.modifiers.meta &&
          !!s.modifiers.ctrl === !!combo.modifiers.ctrl &&
          !!s.modifiers.shift === !!combo.modifiers.shift &&
          !!s.modifiers.alt === !!combo.modifiers.alt
        if (keyMatch && modMatch) return true
        if (s.chord?.length === 2) {
          const [a, b] = s.chord
          const matchA =
            a.key === combo.key &&
            !!a.modifiers.meta === !!combo.modifiers.meta &&
            !!a.modifiers.ctrl === !!combo.modifiers.ctrl &&
            !!a.modifiers.shift === !!combo.modifiers.shift &&
            !!a.modifiers.alt === !!combo.modifiers.alt
          const matchB =
            b.key === combo.key &&
            !!b.modifiers.meta === !!combo.modifiers.meta &&
            !!b.modifiers.ctrl === !!combo.modifiers.ctrl &&
            !!b.modifiers.shift === !!combo.modifiers.shift &&
            !!b.modifiers.alt === !!combo.modifiers.alt
          if (matchA || matchB) return true
        }
        return false
      })
    },
    [shortcuts]
  )

  const handleSaveShortcut = useCallback(
    (combo: KeyCombo) => {
      if (!recordingShortcutId) return false
      const conflict = findConflict(combo, recordingShortcutId)
      if (conflict) {
        setRecordingConflict(t('settings.conflictWith', { label: conflict.label }))
        setTimeout(() => setRecordingConflict(null), 3000)
        return false
      }
      updateShortcut(recordingShortcutId, {
        key: combo.key,
        modifiers: combo.modifiers,
        chord: undefined,
        enabled: true,
      })
      setRecordingShortcutId(null)
      setRecordingConflict(null)
      return true
    },
    [recordingShortcutId, findConflict, updateShortcut, t]
  )

  const handleSaveChord = useCallback(
    (first: KeyCombo, second: KeyCombo) => {
      if (!recordingShortcutId) return false
      const conflict1 = findConflict(first, recordingShortcutId)
      const conflict2 = findConflict(second, recordingShortcutId)
      if (conflict1 || conflict2) {
        setRecordingConflict(
          t('settings.conflictWith', { label: conflict1?.label ?? conflict2?.label ?? '' })
        )
        setTimeout(() => setRecordingConflict(null), 3000)
        return false
      }
      updateShortcut(recordingShortcutId, {
        chord: [first, second],
        key: first.key,
        modifiers: first.modifiers,
        enabled: true,
      })
      setRecordingShortcutId(null)
      setRecordingConflict(null)
      return true
    },
    [recordingShortcutId, findConflict, updateShortcut, t]
  )

  const handleCancelRecording = useCallback(() => {
    setRecordingShortcutId(null)
    setRecordingConflict(null)
  }, [])

  // Dataclass customization modal state
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false)
  const [customizeDataclass, setCustomizeDataclass] = useState<string | null>(null)

  const downloadJson = async (json: string, filename: string) => {
    await downloadBytes({
      filename,
      bytes: new TextEncoder().encode(json),
      mime: 'application/json',
    })
  }

  const handleExportCurrent = () => {
    void downloadJson(exportSettings(), 'dataexplorer-settings.json')
  }

  const handleExportAll = () => {
    void downloadJson(exportProfiles(), 'dataexplorer-profiles.json')
  }

  const handleExportSelected = () => {
    if (exportSelectedIds.size === 0) return
    void downloadJson(exportProfiles([...exportSelectedIds]), 'dataexplorer-profiles.json')
    setExportSelectOpen(false)
    setExportSelectedIds(new Set())
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const parsed = parseImportProfiles(content)
      if (!parsed.ok) {
        setImportError(t('settings.invalidSettingsFile'))
        setImportSuccess(false)
        return
      }
      if ('legacy' in parsed && parsed.legacy) {
        const result = importProfiles(content)
        if (result.ok) {
          setImportSuccess(true)
          setImportError(null)
          setTimeout(() => setImportSuccess(false), 3000)
        } else {
          setImportError(t('settings.invalidSettingsFile'))
          setImportSuccess(false)
        }
        return
      }
      if ('profiles' in parsed) {
        if (parsed.profiles.length === 0) {
          setImportError(t('settings.noProfilesInFile'))
          setImportSuccess(false)
          return
        }
        setImportError(null)
        setImportPendingContent(content)
        setImportPendingProfiles(parsed.profiles)
        setImportSelectedIds(new Set(parsed.profiles.map((p) => p.id)))
        setImportModalOpen(true)
        return
      }
      setImportError(t('settings.invalidSettingsFile'))
      setImportSuccess(false)
    }
    reader.readAsText(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImportModalConfirm = () => {
    if (!importPendingContent || !importPendingProfiles) return
    const ids = [...importSelectedIds]
    const result = importProfilesByIds(importPendingContent, ids)
    setImportModalOpen(false)
    setImportPendingContent(null)
    setImportPendingProfiles(null)
    setImportSelectedIds(new Set())
    if (result.ok) {
      setImportSuccess(true)
      setImportError(null)
      setTimeout(() => setImportSuccess(false), 3000)
    } else {
      setImportError(t('settings.importFailed'))
      setImportSuccess(false)
    }
  }

  const handleImportModalCancel = () => {
    setImportModalOpen(false)
    setImportPendingContent(null)
    setImportPendingProfiles(null)
    setImportSelectedIds(new Set())
  }

  const toggleImportProfile = (id: string) => {
    setImportSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const setImportSelectAll = (checked: boolean) => {
    if (!importPendingProfiles) return
    setImportSelectedIds(checked ? new Set(importPendingProfiles.map((p) => p.id)) : new Set())
  }

  const handleAddProfile = () => {
    const name = newProfileName.trim() || t('settings.unnamed')
    addProfile(name)
    setNewProfileName('')
  }

  const handleRenameProfile = (id: string) => {
    const trimmed = renamingName.trim()
    if (trimmed) {
      renameProfile(id, trimmed)
      setRenamingId(null)
      setRenamingName('')
    }
  }

  const handleRemoveProfile = async (id: string, name: string) => {
    const ok = await confirm({
      title: t('settings.removeProfileTitle'),
      description: <span>{t('settings.removeProfileDescription', { name })}</span>,
      confirmText: t('settings.remove'),
      cancelText: t('settings.cancel'),
      variant: 'destructive',
    })
    if (ok) removeProfile(id)
  }

  const handleResetAllSettings = async () => {
    const ok = await confirm({
      title: t('settings.resetAllTitle'),
      description: <span>{t('settings.resetAllDescription')}</span>,
      confirmText: t('settings.reset'),
      cancelText: t('settings.cancel'),
      variant: 'destructive',
    })
    if (ok) resetAllSettings()
  }

  const recordingShortcut = recordingShortcutId
    ? shortcuts.find((s) => s.id === recordingShortcutId)
    : null

  return (
    <ScrollArea className="h-full">
      <ConfirmDialog />
      <ShortcutRecordModal
        open={!!recordingShortcutId}
        onOpenChange={(open) => {
          if (!open) handleCancelRecording()
        }}
        shortcutLabel={recordingShortcut?.label ?? ''}
        isChord={recordAsChord}
        onRecordAsChordChange={setRecordAsChord}
        conflictMessage={recordingConflict}
        onSave={handleSaveShortcut}
        onSaveChord={handleSaveChord}
        onCancel={handleCancelRecording}
      />
      <Dialog open={importModalOpen} onOpenChange={(open) => !open && handleImportModalCancel()}>
        <DialogContent className="flex max-h-[85vh] max-w-md flex-col">
          <DialogHeader>
            <DialogTitle>{t('settings.importProfiles')}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">{t('settings.importProfilesHelp')}</p>
          {importPendingProfiles && importPendingProfiles.length > 0 && (
            <>
              <div className="flex items-center gap-2 border-b pb-2">
                <Checkbox
                  id="import-select-all"
                  checked={
                    importSelectedIds.size === importPendingProfiles.length &&
                    importPendingProfiles.length > 0
                  }
                  onCheckedChange={(c) => setImportSelectAll(c === true)}
                />
                <label htmlFor="import-select-all" className="cursor-pointer font-medium text-sm">
                  {t('settings.selectAll')}
                </label>
              </div>
              <ScrollArea className="min-h-0 flex-1 rounded-md border">
                <div className="space-y-1 p-2">
                  {importPendingProfiles.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`import-${p.id}`}
                        checked={importSelectedIds.has(p.id)}
                        onCheckedChange={() => toggleImportProfile(p.id)}
                      />
                      <label
                        htmlFor={`import-${p.id}`}
                        className="min-w-0 flex-1 cursor-pointer text-sm"
                      >
                        <span className="block truncate font-medium">
                          {p.id === DEFAULT_PROFILE_ID ? t(DEFAULT_PROFILE_NAME_KEY) : p.name}
                        </span>
                        {p.willOverwrite && (
                          <span className="mt-0.5 flex items-center gap-1 text-destructive text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            {t('settings.willReplaceProfile')}
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleImportModalCancel}>
              {t('settings.cancel')}
            </Button>
            <Button
              onClick={handleImportModalConfirm}
              disabled={!importPendingContent || importSelectedIds.size === 0}
            >
              {t('settings.import')}{' '}
              {importSelectedIds.size > 0 ? `(${importSelectedIds.size})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className={cn('mx-auto max-w-7xl', mobile ? 'flex flex-col gap-3 p-4 pb-6' : 'p-3')}>
        {/* Compact Header */}
        <div className={cn('flex items-center justify-between gap-3', !mobile && 'mb-3')}>
          <h1 className={cn('font-bold', mobile ? 'text-xl tracking-tight' : 'text-lg')}>
            {t('settings.title')}
          </h1>
          {mobile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 gap-2 px-3.5 text-sm"
                  aria-label={t('settings.manage')}
                  aria-haspopup="menu"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                  {t('settings.manage')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                className={mobileMenuContentClass('min-w-[min(calc(100vw-2rem),18rem)]')}
                {...mobileMenuCollisionProps}
              >
                <DropdownMenuLabel className={mobileMenuHeaderClass('text-sm')}>
                  {t('settings.exportProfiles')}
                </DropdownMenuLabel>
                <DropdownMenuItem className={mobileMenuItemClass()} onClick={handleExportCurrent}>
                  <Download className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {t('settings.currentProfile')}
                </DropdownMenuItem>
                <DropdownMenuItem className={mobileMenuItemClass()} onClick={handleExportAll}>
                  <Download className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {t('settings.allProfiles')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={mobileMenuItemClass()}
                  onClick={() => setExportSelectOpen(true)}
                >
                  <UserCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {t('settings.selectProfiles')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={mobileMenuItemClass()}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {t('settings.import')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={mobileMenuItemClass(
                    'text-destructive focus:bg-destructive/10 focus:text-destructive'
                  )}
                  onClick={() => void handleResetAllSettings()}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  {t('settings.resetAllTitle')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex flex-nowrap items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="xs" className="h-6 gap-1 px-2 text-xs">
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    {t('settings.export')}
                    <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCurrent}>
                    {t('settings.currentProfile')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportAll}>
                    {t('settings.allProfiles')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setExportSelectOpen(true)}>
                    {t('settings.selectProfiles')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="xs"
                onClick={() => fileInputRef.current?.click()}
                className="h-6 gap-1 px-2 text-xs"
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
                {t('settings.import')}
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={handleResetAllSettings}
                className="h-6 gap-1 border-destructive px-2 text-destructive text-xs hover:bg-destructive/10 hover:text-destructive"
              >
                {t('settings.resetAllTitle')}
              </Button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
        {(importSuccess || importError) && (
          <p
            className={cn(
              'text-xs',
              importSuccess ? 'text-success' : 'text-destructive',
              mobile && 'text-sm'
            )}
            role={importError ? 'alert' : undefined}
          >
            {importSuccess ? t('settings.imported') : importError}
          </p>
        )}

        {/* Top row: Profiles | Dataclass Appearance */}
        <div className={cn('mb-3 grid items-start gap-3 lg:grid-cols-2', mobile && 'order-3 mb-0')}>
          <Card className="mb-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setProfilesListExpanded(!profilesListExpanded)}
              className={cn(
                'flex h-auto w-full items-center justify-between rounded-none px-0 py-0 hover:bg-transparent',
                mobile && 'min-h-11'
              )}
            >
              <CardHeader
                icon={<UserCircle className="h-4 w-4" />}
                title={t('settings.profiles')}
              />
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  profilesListExpanded && 'rotate-180'
                )}
              />
            </Button>
            {profilesListExpanded && (
              <div className="mt-3 space-y-3">
                <p className="text-muted-foreground text-xs">{t('settings.profilesHelpFull')}</p>
                <div
                  className={cn(
                    'flex flex-wrap items-center gap-2',
                    mobile && 'flex-col items-stretch'
                  )}
                >
                  <Input
                    placeholder={t('settings.newProfileName')}
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddProfile()
                    }}
                    className={cn(mobile ? 'h-11 w-full text-sm' : 'h-6 w-52 text-xs')}
                  />
                  <Button
                    variant="outline"
                    size="xs"
                    className={cn(mobile ? 'h-11 w-full gap-1.5 px-3 text-sm' : 'h-6 gap-1 px-2')}
                    onClick={handleAddProfile}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('settings.add')}
                  </Button>
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-2">
                  {profiles.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      {renamingId === p.id ? (
                        <div className="flex min-w-0 flex-1 items-center gap-1">
                          <Input
                            value={renamingName}
                            onChange={(e) => setRenamingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameProfile(p.id)
                              if (e.key === 'Escape') {
                                setRenamingId(null)
                                setRenamingName('')
                              }
                            }}
                            className="h-6 flex-1 text-xs"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-6 px-1.5 text-xs"
                            onClick={() => handleRenameProfile(p.id)}
                          >
                            {t('settings.save')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-6 px-1.5 text-xs"
                            onClick={() => {
                              setRenamingId(null)
                              setRenamingName('')
                            }}
                          >
                            {t('settings.cancel')}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <ProfileBadge profile={p} />
                          <button
                            type="button"
                            className="min-w-0 flex-1 cursor-pointer select-text truncate rounded text-left font-medium text-xs hover:underline focus:outline-none focus:ring-1 focus:ring-ring"
                            onDoubleClick={() => {
                              setRenamingId(p.id)
                              setRenamingName(p.name)
                            }}
                            title={t('settings.doubleClickToRename')}
                          >
                            {p.id === DEFAULT_PROFILE_ID ? t(DEFAULT_PROFILE_NAME_KEY) : p.name}
                            {p.id === DEFAULT_PROFILE_ID && (
                              <span className="ml-1 text-muted-foreground">
                                {t('settings.default')}
                              </span>
                            )}
                            {p.id === currentProfileId && (
                              <span className="ml-1 font-semibold text-primary">
                                {t('settings.current')}
                              </span>
                            )}
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <ProfileAppearancePopover
                              profile={p}
                              open={appearancePopoverId === p.id}
                              onOpenChange={(open) => setAppearancePopoverId(open ? p.id : null)}
                              onUpdateAppearance={(updates) =>
                                updateProfileAppearance(p.id, updates)
                              }
                            />
                            {p.id === currentProfileId ? (
                              <span className="text-[10px] text-muted-foreground">
                                {t('settings.current')}
                              </span>
                            ) : (
                              <Button
                                variant="outline"
                                size="xs"
                                className="h-6 px-1.5 text-[10px]"
                                onClick={() => switchProfile(p.id)}
                                title={t('settings.useProfile')}
                              >
                                {t('settings.useButton')}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="xs"
                              className="h-6 w-6 p-0 text-muted-foreground"
                              onClick={() => {
                                setRenamingId(p.id)
                                setRenamingName(p.name)
                              }}
                              title={t('settings.rename')}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="h-6 w-6 p-0 text-muted-foreground"
                              onClick={() => duplicateProfile(p.id)}
                              title={t('settings.duplicateProfile')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="h-6 w-6 p-0 text-muted-foreground"
                              disabled={p.id === DEFAULT_PROFILE_ID || p.id === currentProfileId}
                              onClick={() => handleRemoveProfile(p.id, p.name)}
                              title={
                                p.id === DEFAULT_PROFILE_ID
                                  ? t('settings.defaultProfileCannotRemove')
                                  : p.id === currentProfileId
                                    ? t('settings.currentProfileCannotRemove')
                                    : t('settings.removeProfile')
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!profilesListExpanded && (
              <p className="mt-2 text-muted-foreground text-xs">
                {profiles.length === 1
                  ? t('settings.profileCount', { count: profiles.length })
                  : t('settings.profilesCount', { count: profiles.length })}
              </p>
            )}
          </Card>

          {/* Dataclass Appearance Card */}
          <Card className="mb-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDataclassesExpanded(!dataclassesExpanded)}
              className={cn(
                'flex h-auto w-full items-center justify-between rounded-none px-0 py-0 hover:bg-transparent',
                mobile && 'min-h-11'
              )}
            >
              <CardHeader
                icon={<Database className="h-4 w-4" />}
                title={t('settings.dataclassAppearance')}
              />
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  dataclassesExpanded && 'rotate-180'
                )}
              />
            </Button>
            {dataclassesExpanded && dataclasses.length > 0 && (
              <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                {dataclasses.map((dataclass) => {
                  const customization = dataclassCustomizations[dataclass.name]
                  const colorClasses = getDataclassColorClasses(customization)
                  const hasCustomization = !!customization

                  return (
                    <div
                      key={dataclass.name}
                      style={colorClasses.style}
                      className={cn(
                        'group flex items-center justify-between rounded-md px-2 hover:bg-muted/50',
                        mobile ? 'min-h-12 py-2' : 'py-1.5'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded',
                            hasCustomization ? colorClasses.bg : 'bg-muted'
                          )}
                        >
                          <DataclassIcon
                            customization={customization}
                            className={cn(
                              'h-3.5 w-3.5',
                              hasCustomization ? 'text-white' : colorClasses.text
                            )}
                          />
                        </div>
                        <span className="text-xs">{dataclass.name}</span>
                      </div>
                      <div
                        className={cn(
                          'flex items-center gap-1 transition-opacity',
                          mobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        )}
                      >
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            setCustomizeDataclass(dataclass.name)
                            setCustomizeModalOpen(true)
                          }}
                        >
                          {t('settings.edit')}
                        </Button>
                        {hasCustomization && (
                          <Button
                            variant="ghost"
                            size="iconXs"
                            className="h-6 w-6 text-muted-foreground"
                            onClick={() => removeDataclassCustomization(dataclass.name)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {dataclassesExpanded && dataclasses.length > 0 && (
              <div className="mt-2 flex justify-end gap-2 border-t pt-2">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={randomizeUncustomizedDataclasses}
                  className="h-6 gap-1 text-xs"
                  disabled={uncustomizedCount === 0}
                >
                  <Dices className="h-3 w-3" />
                  {t('settings.randomize')} ({uncustomizedCount})
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={resetDataclassCustomizations}
                  className="h-6 gap-1 text-xs"
                  disabled={Object.keys(dataclassCustomizations).length === 0}
                >
                  <RefreshCw className="h-3 w-3" />
                  {t('settings.resetAll')}
                </Button>
              </div>
            )}
            {dataclassesExpanded && dataclasses.length === 0 && (
              <p className="mt-2 text-muted-foreground text-xs">
                {t('settings.noDataclassesLoaded')}
              </p>
            )}
            {!dataclassesExpanded && (
              <p className="mt-2 text-muted-foreground text-xs">
                {t('settings.customized', { count: Object.keys(dataclassCustomizations).length })}
              </p>
            )}
          </Card>
        </div>

        {/* Export Select Profiles Dialog */}
        <Dialog open={exportSelectOpen} onOpenChange={setExportSelectOpen}>
          <DialogContent
            className={cn(
              mobile ? mobileFullscreenDialogClass('gap-0 bg-background p-0') : 'sm:max-w-md'
            )}
          >
            <DialogHeader className={cn(mobile && 'shrink-0 border-b px-4 py-3')}>
              <DialogTitle className={cn(mobile && 'text-base')}>
                {t('settings.exportProfilesTitle')}
              </DialogTitle>
            </DialogHeader>
            <div
              className={cn(
                'space-y-1 py-2',
                mobile && 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-2'
              )}
            >
              {profiles.map((p) => (
                <label
                  key={p.id}
                  htmlFor={`export-profile-${p.id}`}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-muted/50',
                    mobile ? 'min-h-12 gap-3 px-3 py-3' : 'py-1.5'
                  )}
                >
                  <Checkbox
                    id={`export-profile-${p.id}`}
                    checked={exportSelectedIds.has(p.id)}
                    onCheckedChange={(checked) => {
                      setExportSelectedIds((prev) => {
                        const next = new Set(prev)
                        if (checked) next.add(p.id)
                        else next.delete(p.id)
                        return next
                      })
                    }}
                  />
                  <span className={cn(mobile ? 'text-sm' : 'text-sm')}>
                    {p.id === DEFAULT_PROFILE_ID ? t(DEFAULT_PROFILE_NAME_KEY) : p.name}
                  </span>
                </label>
              ))}
            </div>
            <DialogFooter className={cn(mobile && 'shrink-0 gap-2 border-t px-4 py-3 sm:flex-col')}>
              <Button
                variant="outline"
                className={cn(mobile && 'h-11 w-full')}
                onClick={() => {
                  setExportSelectOpen(false)
                  setExportSelectedIds(new Set())
                }}
              >
                {t('settings.cancel')}
              </Button>
              <Button
                className={cn(mobile && 'h-11 w-full')}
                onClick={handleExportSelected}
                disabled={exportSelectedIds.size === 0}
              >
                {t('settings.export')}{' '}
                {exportSelectedIds.size > 0 ? `(${exportSelectedIds.size})` : ''}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Keyboard shortcuts - full width (desktop only; recording shortcuts needs a physical keyboard) */}
        {!mobile && (
          <Card className="mb-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShortcutsExpanded(!shortcutsExpanded)}
              className="flex h-auto w-full items-center justify-between rounded-none px-0 py-0 hover:bg-transparent"
            >
              <CardHeader
                icon={<Keyboard className="h-4 w-4" />}
                title={t('settings.keyboardShortcuts')}
              />
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  shortcutsExpanded && 'rotate-180'
                )}
              />
            </Button>
            {shortcutsExpanded && (
              <div className="mt-3">
                {/* Preset Selector */}
                <div className="mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="pl-1 font-medium text-sm">{t('settings.preset')}</span>
                    <Select
                      value={activeShortcutPreset}
                      onValueChange={(value) => {
                        if (value !== 'custom') {
                          applyShortcutPreset(value as ShortcutPresetId)
                        }
                      }}
                    >
                      <SelectTrigger className="h-6 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHORTCUT_PRESETS.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {t(preset.nameKey)}
                          </SelectItem>
                        ))}
                        {activeShortcutPreset === 'custom' && (
                          <SelectItem value="custom" disabled>
                            {t('preset.custom')}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="pl-1 text-[10px] text-muted-foreground">
                    {activeShortcutPreset === 'custom'
                      ? t('settings.usingCustomShortcuts')
                      : t(
                          SHORTCUT_PRESETS.find((p) => p.id === activeShortcutPreset)
                            ?.descriptionKey ?? 'preset.defaultDescription'
                        )}
                  </p>
                </div>

                {/* Master toggle */}
                <div className="mb-3 flex items-center justify-between rounded-md bg-muted/50 px-2 py-2">
                  <span className="pl-1 font-medium text-sm">
                    {t('settings.enableAllShortcuts')}
                  </span>
                  <div className="mr-3 flex min-w-[70px] justify-end">
                    <Checkbox
                      checked={getShortcutsCheckState(shortcuts)}
                      onCheckedChange={() => {
                        const state = getShortcutsCheckState(shortcuts)
                        setAllShortcutsEnabled(state !== true)
                      }}
                    />
                  </div>
                </div>

                <ShortcutFinder
                  query={shortcutSearchQuery}
                  recordedCombo={shortcutSearchCombo}
                  resultCount={filteredShortcuts.length}
                  totalCount={shortcuts.length}
                  onTextChange={handleShortcutSearchTextChange}
                  onRecord={handleShortcutSearchRecord}
                  onClear={clearShortcutSearch}
                />

                {visibleShortcutCategories.length > 1 ? (
                  <div className="mb-3">
                    <p className="mb-1.5 pl-1 text-muted-foreground text-xs">
                      {t('settings.jumpToSection')}
                    </p>
                    <nav
                      className="flex gap-1.5 overflow-x-auto pb-1"
                      aria-label={t('settings.jumpToSection')}
                    >
                      {visibleShortcutCategories.map((category) => {
                        const config = CATEGORY_CONFIG[category]
                        const Icon = config.icon
                        const active = activeShortcutCategory === category
                        return (
                          <Button
                            key={category}
                            type="button"
                            variant={active ? 'secondary' : 'ghost'}
                            size="xs"
                            className={cn('h-6 shrink-0 gap-1 px-2 text-xs', active && 'bg-muted')}
                            onClick={() => scrollToShortcutCategory(category)}
                            aria-current={active ? 'true' : undefined}
                          >
                            <Icon className={cn('h-3 w-3', config.iconColor)} />
                            {t(`category.${category}`)}
                          </Button>
                        )
                      })}
                    </nav>
                  </div>
                ) : null}

                {/* Shortcuts by category (same layout as Keyboard Shortcuts modal) */}
                <div
                  ref={shortcutsListRef}
                  className="max-h-[410px] space-y-3 overflow-y-auto pr-1"
                >
                  {CATEGORY_ORDER.map((category) => {
                    const groupShortcuts = filteredShortcuts.filter(
                      (shortcut) => shortcut.category === category
                    )
                    if (groupShortcuts.length === 0) return null

                    const config = CATEGORY_CONFIG[category]
                    const Icon = config.icon

                    return (
                      <div
                        key={category}
                        ref={(node) => setShortcutSectionRef(category, node)}
                        data-shortcut-category={category}
                        className="rounded-md border border-border bg-card/30"
                      >
                        {/* Category Header */}
                        <div className="flex items-center gap-2 border-border/50 border-b px-3 py-2">
                          <div
                            className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-sm',
                              config.bgColor
                            )}
                          >
                            <Icon className={cn('h-3.5 w-3.5', config.iconColor)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-sm">{t(`category.${category}`)}</h3>
                            <p className="text-muted-foreground text-xs">
                              {t(`categoryDesc.${category}`)}
                            </p>
                          </div>
                          <div className="shrink-0">
                            <Checkbox
                              checked={getShortcutsCheckState(groupShortcuts)}
                              onCheckedChange={() => {
                                const state = getShortcutsCheckState(groupShortcuts)
                                setCategoryShortcutsEnabled(category, state !== true)
                              }}
                            />
                          </div>
                        </div>

                        {/* Shortcuts List */}
                        <div className="grid grid-cols-2 gap-x-2 p-2">
                          {groupShortcuts.map((shortcut) => {
                            const isModalOpen = recordingShortcutId === shortcut.id
                            return (
                              <div
                                key={shortcut.id}
                                className={cn(
                                  'flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50',
                                  isModalOpen && 'bg-primary/10 ring-1 ring-primary'
                                )}
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <Switch
                                    checked={shortcut.enabled}
                                    onCheckedChange={(enabled) =>
                                      updateShortcut(shortcut.id, { enabled })
                                    }
                                    className="shrink-0"
                                    disabled={isModalOpen}
                                  />
                                  <span
                                    className={cn(
                                      'min-w-0 truncate text-sm',
                                      !shortcut.enabled && 'text-muted-foreground'
                                    )}
                                  >
                                    {t(`shortcut.${shortcut.id}`) || shortcut.label}
                                    {shortcut.chord && shortcut.chord.length === 2 && (
                                      <span className="ml-1.5 text-muted-foreground/70 text-xs">
                                        {t('settings.twoStep')}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => {
                                    setRecordingShortcutId(shortcut.id)
                                    setRecordingConflict(null)
                                  }}
                                  className={cn(
                                    'h-auto min-h-6 shrink-0 px-2 py-1 text-end font-mono text-xs transition-all',
                                    isModalOpen && 'animate-pulse ring-2 ring-primary ring-inset',
                                    !shortcut.enabled && 'opacity-70'
                                  )}
                                  title={t('settings.clickToChangeShortcut')}
                                >
                                  {shortcut.chord && shortcut.chord.length === 2 ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px]">
                                        {formatKeyCombo(shortcut.chord[0])}
                                      </kbd>
                                      <span className="text-[10px] text-muted-foreground/80">
                                        {t('settings.shortcutThen')}
                                      </span>
                                      <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px]">
                                        {formatKeyCombo(shortcut.chord[1])}
                                      </kbd>
                                    </span>
                                  ) : (
                                    formatShortcut(shortcut)
                                  )}
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  {filteredShortcuts.length === 0 ? (
                    <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-border border-dashed bg-muted/10 px-6 text-center">
                      <Keyboard className="mb-2 h-6 w-6 text-muted-foreground/70" aria-hidden />
                      <p className="font-medium text-sm">{t('settings.shortcutFinderNoResults')}</p>
                      <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                        {t('settings.shortcutFinderNoResultsHint')}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="mt-2"
                        onClick={clearShortcutSearch}
                      >
                        {t('settings.shortcutFinderClear')}
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                  <p className="text-[10px] text-muted-foreground">
                    {t('settings.clickShortcutToChange')}
                  </p>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={resetShortcuts}
                    className="h-6 gap-1 text-xs"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t('settings.reset')}
                  </Button>
                </div>
              </div>
            )}
            {!shortcutsExpanded && (
              <p className="mt-2 text-muted-foreground text-xs">
                {t('settings.shortcutsEnabledCount', {
                  enabled: shortcuts.filter((s) => s.enabled).length,
                  total: shortcuts.length,
                })}
              </p>
            )}
          </Card>
        )}

        {mobile ? (
          <div className="order-2">
            <AssistantLlmSettingsPanel />
          </div>
        ) : null}

        {!mobile && <AssistantToolsSettings />}

        {!mobile && <WidgetSettings />}

        {/* Appearance | Default Views — first on mobile for quick prefs */}
        <div
          className={cn(
            'mb-3 grid items-start gap-3 lg:grid-cols-2',
            mobile && 'order-1 mb-0 gap-3'
          )}
        >
          {/* Appearance Card */}
          <Card>
            <CardHeader icon={<Palette className="h-4 w-4" />} title={t('settings.appearance')} />
            <div className={cn('space-y-3', mobile && 'mt-3 space-y-4')}>
              <SettingsSegmentedField
                label={t('settings.mode')}
                value={theme}
                onValueChange={setTheme}
                options={[
                  { value: 'light', label: t('settings.light'), icon: Sun },
                  { value: 'dark', label: t('settings.dark'), icon: Moon },
                ]}
              />

              {/* Color Theme */}
              <SettingsField label={t('settings.colorTheme')}>
                <div className={cn('grid gap-1.5', mobile ? 'grid-cols-3' : 'grid-cols-4')}>
                  {Object.entries(availableThemes).map(([key, themeOption]) => (
                    <Button
                      type="button"
                      key={key}
                      variant="outline"
                      size="xs"
                      onClick={() => setThemeName(key as typeof themeName)}
                      className={cn(
                        'relative h-auto flex-col gap-1 rounded-md border transition-all',
                        mobile ? 'min-h-16 gap-1.5 p-2.5' : 'p-1.5',
                        themeName === key
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border'
                      )}
                    >
                      <div
                        className={cn('rounded-full shadow-inner', mobile ? 'h-7 w-7' : 'h-6 w-6')}
                        style={{
                          background:
                            key === 'slate'
                              ? '#334155'
                              : key === 'tangerine'
                                ? '#ea580c'
                                : key === 'violet-bloom'
                                  ? '#7c3aed'
                                  : key === 'aurora'
                                    ? '#06b6d4'
                                    : key === 'graphite'
                                      ? '#3f3f46'
                                      : '#171717',
                        }}
                        aria-hidden
                      />
                      <span className={cn(mobile ? 'text-xs' : 'text-xs')}>{themeOption.name}</span>
                      {themeName === key && (
                        <Check className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary p-0.5 text-primary-foreground" />
                      )}
                    </Button>
                  ))}
                </div>
              </SettingsField>

              {/* Code editor — live preview with JSON example; toolbar controls persist to profile */}
              <div className="border-border border-t pt-3">
                <span className={cn('font-medium', mobile ? 'text-sm' : 'text-sm')}>
                  {t('settings.codeEditor')}
                </span>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {t('settings.codeEditorPreviewHint')}
                </p>
                <div className="mt-2 overflow-hidden rounded-md border border-border bg-background">
                  <CodeEditor
                    defaultValue={CODE_EDITOR_PREVIEW_JSON}
                    language="json"
                    toolbar
                    height={mobile ? 128 : 160}
                    readOnly
                    showLineNumbers
                    editorPrefs={codeEditorPrefs}
                    onEditorPrefsChange={updateCodeEditorPrefs}
                    labels={editorLabels}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Default Views Card */}
          <Card>
            <CardHeader
              icon={<LayoutGrid className="h-4 w-4" />}
              title={t('settings.defaultViews')}
            />
            <div className={cn('grid gap-2.5', mobile ? 'mt-3 grid-cols-1 gap-4' : 'grid-cols-2')}>
              <SettingsSegmentedField
                label={t('settings.listView')}
                value={defaultViewMode}
                onValueChange={setDefaultViewMode}
                options={[
                  { value: 'cards', label: t('settings.cards'), icon: LayoutGrid },
                  { value: 'table', label: t('settings.table'), icon: Table2 },
                ]}
              />

              <SettingsSegmentedField
                label={t('settings.entityView')}
                value={defaultEntityViewMode}
                onValueChange={setDefaultEntityViewMode}
                options={[
                  { value: 'tree', label: t('settings.tree'), icon: TreeDeciduous },
                  { value: 'form', label: t('settings.form'), icon: FileText },
                  { value: 'json', label: t('createEntity.json'), icon: Braces },
                ]}
              />

              <SettingsSegmentedField
                label={t('settings.defaultEditMode')}
                value={defaultEditMode}
                onValueChange={setDefaultEditMode}
                options={[
                  { value: 'form', label: t('settings.form'), icon: FileText },
                  { value: 'json', label: t('createEntity.json'), icon: Braces },
                ]}
              />

              <SettingsSegmentedField
                label={t('settings.defaultSidebarView')}
                description={t('settings.defaultSidebarViewHelp')}
                value={sidebarViewMode}
                onValueChange={setSidebarViewMode}
                options={[
                  { value: 'cards', label: t('settings.cards'), icon: LayoutGrid },
                  { value: 'tables', label: t('settings.tables'), icon: Table2 },
                  { value: 'icons', label: t('settings.icons'), icon: LayoutTemplate },
                ]}
              />

              <SettingsField label={t('settings.pageSize')}>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className={cn(mobile ? 'h-11' : 'h-6')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>

              <SettingsField
                label={t('settings.defaultQueryRunMode')}
                description={t('settings.defaultQueryRunModeHelp')}
              >
                <Select
                  value={defaultQueryRunMode}
                  onValueChange={(v) => setDefaultQueryRunMode(v as 'run' | 'runAsSelection')}
                >
                  <SelectTrigger className={cn(mobile ? 'h-11' : 'h-6')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="run">{t('query.run')}</SelectItem>
                    <SelectItem value="runAsSelection">{t('query.runAsSelection')}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>

              {/* Read-Only Mode */}
              <SettingsField label={t('settings.editMode')}>
                <div
                  className={cn(
                    'flex items-center justify-between rounded-md border border-border px-3',
                    mobile ? 'min-h-11' : 'h-6 px-2',
                    readonlyMode && 'border-amber-500/50 bg-amber-500/10'
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {readonlyMode ? (
                      <Eye className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                    ) : (
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    )}
                    <span className={cn(mobile ? 'text-sm' : 'text-xs')}>
                      {readonlyMode ? t('settings.readOnly') : t('settings.edit')}
                    </span>
                  </div>
                  <Switch
                    checked={readonlyMode}
                    onCheckedChange={setReadonlyMode}
                    aria-label={t('settings.editMode')}
                  />
                </div>
              </SettingsField>
            </div>
          </Card>
        </div>

        {/* Database identity + Server Connection */}
        <div className={cn('space-y-3', mobile && 'order-4')}>
          <DatabaseIdentityPanel className="rounded-md" />
          <ServerConnectionSettings />
          {isDesktop() ? (
            <div className="rounded-md border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium text-sm">{t('settings.confirmDisconnect')}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {t('settings.confirmDisconnectHelp')}
                  </p>
                </div>
                <Switch
                  checked={confirmDisconnect}
                  onCheckedChange={setConfirmDisconnect}
                  className="shrink-0"
                  aria-label={t('settings.confirmDisconnect')}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {customizeDataclass && (
        <DataclassCustomizeModal
          open={customizeModalOpen}
          onOpenChange={setCustomizeModalOpen}
          dataclassName={customizeDataclass}
          currentCustomization={dataclassCustomizations[customizeDataclass]}
        />
      )}
    </ScrollArea>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  const mobile = isMobileShell()
  return (
    <div
      className={cn('rounded-md border border-border bg-card', mobile ? 'p-4' : 'p-3', className)}
    >
      {children}
    </div>
  )
}

function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  const mobile = isMobileShell()
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex items-center justify-center rounded-sm bg-muted text-muted-foreground',
          mobile ? 'h-8 w-8' : 'h-6 w-6'
        )}
        aria-hidden
      >
        {icon}
      </div>
      <h2 className={cn('font-semibold', mobile ? 'text-base' : 'text-sm')}>{title}</h2>
    </div>
  )
}

/**
 * Calculate checkbox state for a list of shortcuts.
 * Returns true (all enabled), false (none enabled), or 'indeterminate' (some enabled).
 */
function getShortcutsCheckState(shortcuts: KeyboardShortcut[]): boolean | 'indeterminate' {
  const enabledCount = shortcuts.filter((s) => s.enabled).length
  if (enabledCount === 0) return false
  if (enabledCount === shortcuts.length) return true
  return 'indeterminate'
}
