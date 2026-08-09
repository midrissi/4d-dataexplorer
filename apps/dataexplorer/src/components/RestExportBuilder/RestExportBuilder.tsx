import { Button, cn, SegmentedControl, useToast } from '@4d/ui'
import { ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { downloadBytes } from '~/lib/download-bytes'
import { getBaseUrl, getConnectionStoreAPI, isMobileShell } from '~/lib/platform'
import { serializePostmanCollection } from '~/lib/postman'
import {
  buildToolkitInventory,
  dataClassesWithMemberFunctions,
  emitOpenApiDocument,
  emitPostmanCollection,
  memberFunctionCount,
  type RestExportType,
  restExportOpenApiFilename,
  restExportPostmanFilename,
  serializeOpenApiDocument,
  type ToolkitCatalogInput,
  type ToolkitConfig,
  type ToolkitVariables,
} from '~/lib/rest-export'
import { useRestExportBuilderStore } from '~/store/rest-export-builder'
import { RestExportCategoriesPanel } from './RestExportCategoriesPanel'
import { RestExportPreviewPanel } from './RestExportPreviewPanel'
import { RestExportSelectionPanel } from './RestExportSelectionPanel'
import { type RestExportStep, RestExportStepIndicator } from './RestExportStepIndicator'
import { RestExportVariablesPanel } from './RestExportVariablesPanel'

const STEP_IDS = ['selection', 'categories', 'variables', 'preview'] as const
type BuilderStepId = (typeof STEP_IDS)[number]

async function loadConnectionVariables(): Promise<Omit<ToolkitVariables, 'includeAccessKeyLogin'>> {
  const baseUrl = getBaseUrl().replace(/\/$/, '') || ''
  const defaults = { baseUrl, accessKey: '', username: '', password: '' }
  const connectionApi = getConnectionStoreAPI()
  if (!connectionApi) return defaults
  try {
    const connection = await connectionApi.getActiveConnection()
    if (!connection) return defaults
    return {
      baseUrl: (connection.baseUrl || baseUrl).replace(/\/$/, ''),
      accessKey: connection.accessKey ?? '',
      username: connection.username ?? '',
      password: '',
    }
  } catch {
    return defaults
  }
}

function resolveSelected(persisted: string[] | null, available: string[]): string[] {
  if (persisted === null) return available
  const availableSet = new Set(available)
  return persisted.filter((name) => availableSet.has(name))
}

function mergeVisibleSelection(
  persisted: string[] | null,
  allNames: string[],
  visibleNames: string[],
  nextVisibleSelected: string[]
): string[] {
  const current = resolveSelected(persisted, allNames)
  const visibleSet = new Set(visibleNames)
  return [...current.filter((name) => !visibleSet.has(name)), ...nextVisibleSelected]
}

export function RestExportBuilder() {
  const { t } = useTranslation()
  const toast = useToast()
  const mobile = isMobileShell()

  const name = useRestExportBuilderStore((s) => s.name)
  const description = useRestExportBuilderStore((s) => s.description)
  const persistedDataClasses = useRestExportBuilderStore((s) => s.selectedDataClasses)
  const persistedSingletons = useRestExportBuilderStore((s) => s.selectedSingletons)
  const categories = useRestExportBuilderStore((s) => s.categories)
  const exportType = useRestExportBuilderStore((s) => s.exportType)
  const includeAccessKeyLogin = useRestExportBuilderStore((s) => s.includeAccessKeyLogin)
  const includeDocs = useRestExportBuilderStore((s) => s.includeDocs)
  const dataclassMode = useRestExportBuilderStore((s) => s.dataclassMode)
  const emoji = useRestExportBuilderStore((s) => s.emoji)
  const setName = useRestExportBuilderStore((s) => s.setName)
  const setDescription = useRestExportBuilderStore((s) => s.setDescription)
  const setSelectedDataClasses = useRestExportBuilderStore((s) => s.setSelectedDataClasses)
  const setSelectedSingletons = useRestExportBuilderStore((s) => s.setSelectedSingletons)
  const setCategory = useRestExportBuilderStore((s) => s.setCategory)
  const patchCategories = useRestExportBuilderStore((s) => s.patchCategories)
  const setExportType = useRestExportBuilderStore((s) => s.setExportType)
  const setIncludeAccessKeyLogin = useRestExportBuilderStore((s) => s.setIncludeAccessKeyLogin)
  const setIncludeDocs = useRestExportBuilderStore((s) => s.setIncludeDocs)
  const setDataclassMode = useRestExportBuilderStore((s) => s.setDataclassMode)
  const setEmojiEnabled = useRestExportBuilderStore((s) => s.setEmojiEnabled)
  const setDataclassFolderEmoji = useRestExportBuilderStore((s) => s.setDataclassFolderEmoji)
  const setCustomEmoji = useRestExportBuilderStore((s) => s.setCustomEmoji)

  const [stepIndex, setStepIndex] = useState(0)
  const [catalog, setCatalog] = useState<ToolkitCatalogInput | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [variables, setVariables] = useState<Omit<ToolkitVariables, 'includeAccessKeyLogin'>>({
    baseUrl: '',
    accessKey: '',
    username: '',
    password: '',
  })

  useEffect(() => {
    let cancelled = false
    void loadConnectionVariables().then((next) => {
      if (!cancelled) {
        setVariables(next)
        if (next.accessKey.trim()) setIncludeAccessKeyLogin(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [setIncludeAccessKeyLogin])

  useEffect(() => {
    let cancelled = false
    async function loadCatalog() {
      setLoading(true)
      setError(null)
      try {
        if (reloadToken > 0) api.clearCatalogCache()
        const next = await api.getCatalog()
        if (cancelled) return
        setCatalog(next)
      } catch (reason) {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : t('restExportBuilder.catalogError'))
        setCatalog(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadCatalog()
    return () => {
      cancelled = true
    }
  }, [reloadToken, t])

  const allDataClassNames = catalog?.dataClasses.map((dc) => dc.name) ?? []
  const functionDataClasses = dataClassesWithMemberFunctions(
    catalog?.dataClasses ?? [],
    categories.includeNonExposed
  )
  const visibleDataClassNames =
    dataclassMode === 'collectionVar' ? functionDataClasses.map((dc) => dc.name) : allDataClassNames
  const dataClassFunctionCounts =
    dataclassMode === 'collectionVar'
      ? Object.fromEntries(
          functionDataClasses.map((dc) => [
            dc.name,
            memberFunctionCount(dc, categories.includeNonExposed),
          ])
        )
      : undefined
  const singletonNames = (catalog?.singletons ?? []).map((singleton) => singleton.name)
  const selectedDataClasses = resolveSelected(persistedDataClasses, visibleDataClassNames)
  const selectedSingletons = resolveSelected(persistedSingletons, singletonNames)

  const toolkitVariables: ToolkitVariables = {
    ...variables,
    includeAccessKeyLogin,
    ...(dataclassMode === 'collectionVar' ? { dataclass: selectedDataClasses[0] ?? '' } : {}),
  }

  const config: ToolkitConfig = {
    name,
    description,
    selectedDataClasses,
    selectedSingletons,
    categories,
    variables: toolkitVariables,
    exportType,
    emoji,
    includeDocs,
    dataclassMode,
  }

  const inventory = catalog ? buildToolkitInventory(catalog, config) : { nodes: [] }
  const exportName = name.trim() || t('restExportBuilder.collectionNamePlaceholder')
  const steps: RestExportStep[] = [
    { id: 'selection', label: t('restExportBuilder.sectionSelection') },
    { id: 'categories', label: t('restExportBuilder.sectionCategories') },
    { id: 'variables', label: t('restExportBuilder.sectionVariables') },
    { id: 'preview', label: t('restExportBuilder.sectionPreview') },
  ]
  const stepId: BuilderStepId = STEP_IDS[stepIndex] ?? 'selection'
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === STEP_IDS.length - 1

  async function handleExport() {
    if (!catalog || inventory.nodes.length === 0) return
    setExporting(true)
    try {
      if (exportType === 'openapi') {
        const document = emitOpenApiDocument({
          inventory,
          name: exportName,
          description,
          variables: toolkitVariables,
        })
        const json = serializeOpenApiDocument(document)
        await downloadBytes({
          filename: restExportOpenApiFilename(exportName),
          bytes: new TextEncoder().encode(json),
          mime: 'application/json',
        })
      } else {
        const collection = emitPostmanCollection({
          inventory,
          name: exportName,
          description,
          variables: toolkitVariables,
        })
        const json = serializePostmanCollection(collection)
        await downloadBytes({
          filename: restExportPostmanFilename(exportName),
          bytes: new TextEncoder().encode(json),
          mime: 'application/json',
        })
      }
    } catch (reason) {
      toast.error(t('restExportBuilder.exportFailed'), {
        description: reason instanceof Error ? reason.message : undefined,
      })
    } finally {
      setExporting(false)
    }
  }

  const iconBtn = mobile ? 'h-9 w-9' : 'h-7 w-7'
  const footerBtn = mobile ? 'h-9 px-3' : 'h-7 px-2.5 text-xs'

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div
        className={cn('flex shrink-0 items-center gap-2 border-b px-3', mobile ? 'h-12' : 'h-9')}
      >
        <h1 className="min-w-0 truncate font-medium text-sm">{t('restExportBuilder.title')}</h1>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={iconBtn}
            onClick={() => setReloadToken((token) => token + 1)}
            aria-label={t('restExportBuilder.refreshCatalog')}
            title={t('restExportBuilder.refreshCatalog')}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <RestExportStepIndicator steps={steps} currentIndex={stepIndex} onSelect={setStepIndex} />

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {error ? (
          <div className="space-y-1">
            <p className="font-medium text-sm">{t('restExportBuilder.catalogError')}</p>
            <p className="text-muted-foreground text-xs">{error}</p>
          </div>
        ) : loading && !catalog ? (
          <p className="text-muted-foreground text-xs">{t('common.loading')}</p>
        ) : !catalog ? (
          <p className="text-muted-foreground text-xs">{t('restExportBuilder.emptyCatalog')}</p>
        ) : stepId === 'selection' ? (
          <RestExportSelectionPanel
            dataClassNames={visibleDataClassNames}
            singletonNames={singletonNames}
            selectedDataClasses={selectedDataClasses}
            selectedSingletons={selectedSingletons}
            dataclassMode={dataclassMode}
            dataClassFunctionCounts={dataClassFunctionCounts}
            omittedWithoutFunctions={
              dataclassMode === 'collectionVar'
                ? allDataClassNames.length - visibleDataClassNames.length
                : 0
            }
            onDataclassModeChange={setDataclassMode}
            onToggleDataClass={(itemName, checked) => {
              const nextVisible = checked
                ? [...selectedDataClasses, itemName]
                : selectedDataClasses.filter((dcName) => dcName !== itemName)
              setSelectedDataClasses(
                mergeVisibleSelection(
                  persistedDataClasses,
                  allDataClassNames,
                  visibleDataClassNames,
                  nextVisible
                )
              )
            }}
            onToggleSingleton={(itemName, checked) => {
              const next = checked
                ? [...selectedSingletons, itemName]
                : selectedSingletons.filter((singletonName) => singletonName !== itemName)
              setSelectedSingletons(next)
            }}
            onSelectAllDataClasses={() =>
              setSelectedDataClasses(
                mergeVisibleSelection(
                  persistedDataClasses,
                  allDataClassNames,
                  visibleDataClassNames,
                  visibleDataClassNames
                )
              )
            }
            onSelectNoneDataClasses={() =>
              setSelectedDataClasses(
                mergeVisibleSelection(
                  persistedDataClasses,
                  allDataClassNames,
                  visibleDataClassNames,
                  []
                )
              )
            }
            onSelectAllSingletons={() => setSelectedSingletons(singletonNames)}
            onSelectNoneSingletons={() => setSelectedSingletons([])}
          />
        ) : stepId === 'categories' ? (
          <RestExportCategoriesPanel
            categories={categories}
            onChange={setCategory}
            onPatch={patchCategories}
          />
        ) : stepId === 'variables' ? (
          <RestExportVariablesPanel
            name={name}
            description={description}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            variables={toolkitVariables}
            onVariablesChange={setVariables}
            includeAccessKeyLogin={includeAccessKeyLogin}
            onIncludeAccessKeyLoginChange={setIncludeAccessKeyLogin}
            dataclassMode={dataclassMode}
          />
        ) : (
          <RestExportPreviewPanel
            inventory={inventory}
            emoji={emoji}
            includeDocs={includeDocs}
            onEmojiEnabledChange={setEmojiEnabled}
            onDataclassFolderEmojiChange={setDataclassFolderEmoji}
            onIncludeDocsChange={setIncludeDocs}
            onCustomEmojiChange={setCustomEmoji}
          />
        )}
      </div>

      <div
        className={cn('flex shrink-0 items-center gap-2 border-t px-3', mobile ? 'h-12' : 'h-10')}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('gap-1', footerBtn)}
          disabled={isFirstStep}
          onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t('common.back')}
        </Button>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {isLastStep ? (
            <>
              <SegmentedControl
                aria-label={t('restExportBuilder.exportTypeAria')}
                value={exportType}
                onValueChange={(value) => setExportType(value as RestExportType)}
                options={[
                  { value: 'postman', label: t('restExportBuilder.exportPostman') },
                  { value: 'openapi', label: t('restExportBuilder.exportOpenApi') },
                ]}
              />
              <Button
                type="button"
                size="sm"
                className={cn('gap-1', footerBtn)}
                disabled={loading || exporting || !catalog}
                onClick={() => void handleExport()}
              >
                <Download className="h-3.5 w-3.5" />
                {exporting ? t('restExportBuilder.exporting') : t('restExportBuilder.export')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              className={cn('gap-1', footerBtn)}
              onClick={() => setStepIndex((index) => Math.min(STEP_IDS.length - 1, index + 1))}
            >
              {t('common.next')}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
