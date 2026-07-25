import type { CatalogWithMetadataExpanded, DataClass, DataClassAttribute } from '@4d/rest'
import {
  Button,
  cn,
  Input,
  ScrollArea,
  SegmentedControl,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import {
  Boxes,
  Database,
  Download,
  Filter,
  ListTree,
  Loader2,
  MousePointerClick,
  Search,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { refreshAssistantMethodTools } from '~/assistant/method-tools'
import { dataExplorerToolRegistry } from '~/assistant/tool-registry'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { client } from '~/lib/api'
import {
  filterAssistantExposedMethods,
  isAssistantExposedMethod,
} from '~/lib/assistant-exposed-method'
import { isAssistantLlmConfigured } from '~/lib/assistant-llm-configured'
import type { AssistantMetadataSchema } from '~/lib/assistant-metadata-schema'
import { mergeCatalogIntoMetadata, touchMetadata } from '~/lib/assistant-metadata-schema'
import { isOptionalAttributeDescription } from '~/lib/description-task-filter'
import { eventBus } from '~/lib/eventBus'
import { downloadMetadataSchema } from '~/lib/export-metadata-schema'
import {
  countMissingDescriptions as countTotalMissingDescriptions,
  type GenerateAllDescriptionsProgress,
  generateAllMetadataDescriptions,
} from '~/lib/generate-all-metadata-descriptions'
import {
  generateAttributeDescription,
  generateDataclassDescription,
  generateMethodArguments,
  generateMethodDescription,
  generateSingletonDescription,
} from '~/lib/generate-metadata-description'
import { getAssistantMetadataSchema, saveAssistantMetadataSchema } from '~/lib/storage'
import { AiInputField } from './AiFieldChrome'
import { DescriptionField } from './DescriptionField'
import { GenerateAllProgress } from './GenerateAllProgress'
import { MetadataJsonView } from './MetadataJsonView'
import { MethodEditor } from './MethodEditor'
import { isMissingDescription, MissingBadge } from './MissingBadge'

type Section = 'dataclasses' | 'singletons' | 'catalogMethods'

const SECTION_ICONS = {
  dataclasses: Boxes,
  singletons: Sparkles,
  catalogMethods: Database,
} as const

type SaveState = 'idle' | 'saving' | 'saved'

type ActiveGeneration =
  | { kind: 'bulk'; progress: GenerateAllDescriptionsProgress | null }
  | { kind: 'field'; label: string }

function methodSchemaLabel(owner: string, method: string) {
  return `${owner}.${method} · schema`
}

function uniqueCatalogNames(names: (string | undefined | null)[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const name of names) {
    if (!name || seen.has(name)) continue
    seen.add(name)
    unique.push(name)
  }
  return unique
}

function methodRowKey(method: { name?: string; paramsText?: string }, index: number): string {
  return `${method.name ?? 'method'}-${method.paramsText ?? index}`
}

function isAttributeMissingDescription(
  attribute: DataClassAttribute,
  dataclass: DataClass,
  description: string | undefined
): boolean {
  if (isOptionalAttributeDescription(attribute, dataclass)) return false
  return isMissingDescription(description)
}

function countItemMissingDescriptions(
  metadata: AssistantMetadataSchema,
  catalog: CatalogWithMetadataExpanded | null,
  section: Section,
  itemName: string
): number {
  if (!catalog) return 0
  let missing = 0

  if (section === 'dataclasses') {
    const dc = metadata.dataClasses[itemName]
    if (!dc?.description?.trim()) missing++
    const catalogDc = catalog.dataClasses.find((d) => d.name === itemName)
    for (const attr of catalogDc?.attributes ?? []) {
      if (catalogDc && isOptionalAttributeDescription(attr, catalogDc)) continue
      if (!dc?.attributes?.[attr.name]?.description?.trim()) missing++
    }
    for (const method of filterAssistantExposedMethods(catalogDc?.methods)) {
      if (!method.name) continue
      if (!dc?.methods?.[method.name]?.description?.trim()) missing++
    }
  } else if (section === 'singletons') {
    const s = metadata.singletons[itemName]
    if (!s?.description?.trim()) missing++
    const catalogS = catalog.singletons?.find((x) => x.name === itemName)
    for (const method of filterAssistantExposedMethods(catalogS?.methods)) {
      if (!method.name) continue
      if (!s?.methods?.[method.name]?.description?.trim()) missing++
    }
  } else {
    if (!metadata.catalogMethods[itemName]?.description?.trim()) missing++
  }

  return missing
}

export function AssistantMetadataEditor() {
  const { t } = useTranslation()
  const [catalog, setCatalog] = useState<CatalogWithMetadataExpanded | null>(null)
  const [loading, setLoading] = useState(true)
  const [metadata, setMetadata] = useState<AssistantMetadataSchema | null>(null)
  const [section, setSection] = useState<Section>('dataclasses')
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)
  const [viewTab, setViewTab] = useState<'editor' | 'json'>('editor')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [activeGeneration, setActiveGeneration] = useState<ActiveGeneration | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const generationAbortRef = useRef<AbortController | null>(null)
  const activeGenerationRef = useRef<ActiveGeneration | null>(null)
  const detailsPanelRef = useRef<HTMLDivElement>(null)
  const editorSavedUpdatedAtRef = useRef<string | null>(null)
  const aiEnabled = isAssistantLlmConfigured()

  const setGeneration = useCallback((next: ActiveGeneration | null) => {
    activeGenerationRef.current = next
    setActiveGeneration(next)
  }, [])

  const isGenerating = activeGeneration !== null

  const isGeneratingLabel = useCallback(
    (label: string) => activeGeneration?.kind === 'field' && activeGeneration.label === label,
    [activeGeneration]
  )

  useEffect(() => {
    let cancelled = false

    async function loadCatalog() {
      setLoading(true)
      try {
        const fetchedCatalog = await client.catalog.getAllWithMetadataCached()
        if (cancelled) return
        const existing = getAssistantMetadataSchema()
        const merged = mergeCatalogIntoMetadata(fetchedCatalog, existing)
        setCatalog(fetchedCatalog)
        setMetadata(merged)
        saveAssistantMetadataSchema(merged)
        setSelectedName((current) => current ?? fetchedCatalog.dataClasses[0]?.name ?? null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCatalog()
    const subscription = eventBus.on('catalog-reloaded', () => {
      void loadCatalog()
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const subscription = eventBus.on('assistant-metadata-changed', ({ updatedAt }) => {
      if (updatedAt === editorSavedUpdatedAtRef.current) {
        editorSavedUpdatedAtRef.current = null
        return
      }

      setMetadata((current) => {
        if (!current || current.updatedAt === updatedAt) return current
        const stored = getAssistantMetadataSchema()
        if (!stored || stored.updatedAt !== updatedAt) return current
        return catalog ? mergeCatalogIntoMetadata(catalog, stored) : stored
      })
    })

    return () => subscription.unsubscribe()
  }, [catalog])

  const scheduleSave = useCallback((next: AssistantMetadataSchema) => {
    setSaveState('saving')
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = window.setTimeout(() => {
      const touched = touchMetadata(next)
      editorSavedUpdatedAtRef.current = touched.updatedAt
      saveAssistantMetadataSchema(touched)
      void refreshAssistantMethodTools(dataExplorerToolRegistry)
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 1500)
    }, 400)
  }, [])

  const updateMetadata = useCallback(
    (updater: (prev: AssistantMetadataSchema) => AssistantMetadataSchema) => {
      setMetadata((prev) => {
        if (!prev) return prev
        const next = touchMetadata(updater(prev))
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave]
  )

  const sectionItems = useMemo(() => {
    if (!catalog) return []
    if (section === 'dataclasses') {
      return uniqueCatalogNames(catalog.dataClasses.map((dc) => dc.name))
    }
    if (section === 'singletons') {
      return uniqueCatalogNames((catalog.singletons ?? []).map((s) => s.name))
    }
    return uniqueCatalogNames(filterAssistantExposedMethods(catalog.methods).map((m) => m.name))
  }, [catalog, section])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    let items = sectionItems
    if (missingOnly && metadata && catalog) {
      items = items.filter(
        (name) => countItemMissingDescriptions(metadata, catalog, section, name) > 0
      )
    }
    if (!q) return items
    return items.filter((name) => name.toLowerCase().includes(q))
  }, [catalog, metadata, missingOnly, search, section, sectionItems])

  useEffect(() => {
    if (!selectedName || !missingOnly) return
    requestAnimationFrame(() => {
      const firstMissing = detailsPanelRef.current?.querySelector('[data-metadata-missing]')
      firstMissing?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [missingOnly, selectedName])

  useEffect(() => {
    if (selectedName && filteredItems.includes(selectedName)) return
    setSelectedName(filteredItems[0] ?? null)
  }, [filteredItems, selectedName])

  const selectedCatalogDc = useMemo(
    () => catalog?.dataClasses.find((d) => d.name === selectedName) ?? null,
    [catalog, selectedName]
  )

  const missingDescriptionCount = useMemo(
    () =>
      catalog && metadata
        ? countTotalMissingDescriptions(catalog, metadata, {
            excludeAttributes: { idLike: true },
          })
        : 0,
    [catalog, metadata]
  )

  const handleExport = () => {
    if (!metadata) return
    downloadMetadataSchema(metadata, catalog?.__NAME ?? metadata.databaseName)
  }

  const handleCancelGeneration = useCallback(() => {
    generationAbortRef.current?.abort()
  }, [])

  const runFieldGeneration = useCallback(
    async (label: string, work: (signal: AbortSignal) => Promise<void>) => {
      if (activeGenerationRef.current) return
      const abort = new AbortController()
      generationAbortRef.current = abort
      setGeneration({ kind: 'field', label })
      try {
        await work(abort.signal)
      } finally {
        if (generationAbortRef.current === abort) {
          generationAbortRef.current = null
          setGeneration(null)
        }
      }
    },
    [setGeneration]
  )

  const handleGenerateAllDescriptions = useCallback(async () => {
    if (!catalog || !metadata || !aiEnabled || activeGenerationRef.current) return

    const abort = new AbortController()
    generationAbortRef.current = abort
    setGeneration({ kind: 'bulk', progress: null })

    try {
      const result = await generateAllMetadataDescriptions({
        catalog,
        metadata,
        onlyMissing: true,
        signal: abort.signal,
        onProgress: (progress) => setGeneration({ kind: 'bulk', progress }),
        onMetadataUpdate: (next) => {
          setMetadata(next)
        },
      })

      const finalMetadata = touchMetadata(result.metadata)
      editorSavedUpdatedAtRef.current = finalMetadata.updatedAt
      setMetadata(finalMetadata)
      saveAssistantMetadataSchema(finalMetadata)
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 1500)
    } finally {
      generationAbortRef.current = null
      setGeneration(null)
    }
  }, [aiEnabled, catalog, metadata, setGeneration])

  useEffect(
    () => () => {
      generationAbortRef.current?.abort()
    },
    []
  )

  if (loading || !metadata || !catalog) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const renderDataclassPanel = () => {
    if (!selectedName || !selectedCatalogDc) {
      return (
        <EmptyPanel
          icon={ListTree}
          badgeIcon={MousePointerClick}
          badgeTone="primary"
          title={t('assistantMetadata.selectItem')}
          ghost="cards"
          size="md"
          className="h-full min-h-0"
        />
      )
    }

    const dcMeta = metadata.dataClasses[selectedName] ?? {}
    const exposedMethods = filterAssistantExposedMethods(selectedCatalogDc.methods)
    const visibleMethods = exposedMethods.filter((method) => {
      if (!method.name) return false
      if (missingOnly && !isMissingDescription(dcMeta.methods?.[method.name]?.description)) {
        return false
      }
      return true
    })
    const visibleAttributes = (selectedCatalogDc.attributes ?? []).filter((attr) => {
      if (
        missingOnly &&
        !isAttributeMissingDescription(
          attr,
          selectedCatalogDc,
          dcMeta.attributes?.[attr.name]?.description
        )
      ) {
        return false
      }
      return true
    })
    const missingMethodCount = exposedMethods.filter(
      (method) => method.name && isMissingDescription(dcMeta.methods?.[method.name]?.description)
    ).length
    const missingAttributeCount = (selectedCatalogDc.attributes ?? []).filter((attr) =>
      isAttributeMissingDescription(
        attr,
        selectedCatalogDc,
        dcMeta.attributes?.[attr.name]?.description
      )
    ).length
    const showDataclassDescription = !missingOnly || isMissingDescription(dcMeta.description)
    const hasVisibleContent =
      showDataclassDescription || visibleAttributes.length > 0 || visibleMethods.length > 0

    if (!hasVisibleContent) {
      return (
        <EmptyPanel
          icon={Sparkles}
          title={t('assistantMetadata.noMissingFields')}
          ghost="none"
          size="sm"
          bordered
        />
      )
    }

    return (
      <div className="space-y-4">
        {showDataclassDescription ? (
          <div data-metadata-missing={isMissingDescription(dcMeta.description) || undefined}>
            <DescriptionField
              id={`dc-desc-${selectedName}`}
              label={t('assistantMetadata.dataclassDescription')}
              value={dcMeta.description ?? ''}
              onChange={(description) =>
                updateMetadata((prev) => ({
                  ...prev,
                  dataClasses: {
                    ...prev.dataClasses,
                    [selectedName]: { ...dcMeta, description },
                  },
                }))
              }
              aiEnabled={aiEnabled && !isGenerating}
              generating={isGeneratingLabel(selectedName)}
              onGenerate={() =>
                runFieldGeneration(selectedName, async (signal) => {
                  const description = await generateDataclassDescription({
                    catalog,
                    dataclassName: selectedName,
                    signal,
                  })
                  updateMetadata((prev) => ({
                    ...prev,
                    dataClasses: {
                      ...prev.dataClasses,
                      [selectedName]: {
                        ...prev.dataClasses[selectedName],
                        description,
                      },
                    },
                  }))
                })
              }
            />
          </div>
        ) : null}

        {visibleAttributes.length > 0 ? (
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 font-medium text-sm">
              {t('assistantMetadata.attributes')}
              {missingAttributeCount > 0 ? (
                <span className="font-normal text-muted-foreground text-xs">
                  ({t('assistantMetadata.sectionMissingCount', { count: missingAttributeCount })})
                </span>
              ) : null}
            </h3>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-muted-foreground text-xs">
                  <tr>
                    <th className="px-3 py-2">{t('assistantMetadata.colName')}</th>
                    <th className="px-3 py-2">{t('assistantMetadata.colType')}</th>
                    <th className="px-3 py-2">{t('assistantMetadata.colDescription')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAttributes.map((attr) => {
                    const attrMeta = dcMeta.attributes?.[attr.name]
                    const attrMissing = isAttributeMissingDescription(
                      attr,
                      selectedCatalogDc,
                      attrMeta?.description
                    )
                    const attrLabel = `${selectedName}.${attr.name}`
                    return (
                      <tr
                        key={attr.name}
                        className="border-t"
                        data-metadata-missing={attrMissing || undefined}
                      >
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2 font-mono text-xs">
                            {attrMissing ? <MissingBadge /> : null}
                            {attr.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {attr.type} · {attr.kind}
                        </td>
                        <td className="px-3 py-2">
                          <AiInputField
                            value={attrMeta?.description ?? ''}
                            onChange={(e) =>
                              updateMetadata((prev) => ({
                                ...prev,
                                dataClasses: {
                                  ...prev.dataClasses,
                                  [selectedName]: {
                                    ...prev.dataClasses[selectedName],
                                    attributes: {
                                      ...prev.dataClasses[selectedName]?.attributes,
                                      [attr.name]: { description: e.target.value },
                                    },
                                  },
                                },
                              }))
                            }
                            placeholder={t('assistantMetadata.attributePlaceholder')}
                            aiEnabled={aiEnabled && !isGenerating}
                            generating={isGeneratingLabel(attrLabel)}
                            onGenerate={() =>
                              void runFieldGeneration(attrLabel, async (signal) => {
                                const description = await generateAttributeDescription({
                                  catalog,
                                  dataclassName: selectedName,
                                  attributeName: attr.name,
                                  signal,
                                })
                                updateMetadata((prev) => ({
                                  ...prev,
                                  dataClasses: {
                                    ...prev.dataClasses,
                                    [selectedName]: {
                                      ...prev.dataClasses[selectedName],
                                      attributes: {
                                        ...prev.dataClasses[selectedName]?.attributes,
                                        [attr.name]: { description },
                                      },
                                    },
                                  },
                                }))
                              })
                            }
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {visibleMethods.length > 0 ? (
          <div className="space-y-2" data-metadata-missing={missingMethodCount > 0 || undefined}>
            <h3 className="flex items-center gap-2 font-medium text-sm">
              {t('assistantMetadata.methods')}
              {missingMethodCount > 0 ? (
                <span className="font-normal text-muted-foreground text-xs">
                  ({t('assistantMetadata.sectionMissingCount', { count: missingMethodCount })})
                </span>
              ) : null}
            </h3>
            <div className="space-y-2">
              {visibleMethods.map((method, methodIndex) => {
                if (!method.name) return null
                const methodMeta = dcMeta.methods?.[method.name] ?? {}
                const methodLabel = `${selectedName}.${method.name}`
                const schemaLabel = methodSchemaLabel(selectedName, method.name)
                return (
                  <MethodEditor
                    key={methodRowKey(method, methodIndex)}
                    methodName={method.name}
                    signature={method.paramsText ?? `${method.name}()`}
                    applyTo={method.applyTo}
                    metadata={methodMeta}
                    aiEnabled={aiEnabled && !isGenerating}
                    generatingDescription={isGeneratingLabel(methodLabel)}
                    generatingArguments={isGeneratingLabel(schemaLabel)}
                    onChange={(next) =>
                      updateMetadata((prev) => ({
                        ...prev,
                        dataClasses: {
                          ...prev.dataClasses,
                          [selectedName]: {
                            ...prev.dataClasses[selectedName],
                            methods: {
                              ...prev.dataClasses[selectedName]?.methods,
                              [method.name]: next,
                            },
                          },
                        },
                      }))
                    }
                    onGenerateDescription={() =>
                      void runFieldGeneration(methodLabel, async (signal) => {
                        const description = await generateMethodDescription({
                          catalog,
                          context: 'dataclass',
                          ownerName: selectedName,
                          methodName: method.name,
                          signal,
                        })
                        updateMetadata((prev) => ({
                          ...prev,
                          dataClasses: {
                            ...prev.dataClasses,
                            [selectedName]: {
                              ...prev.dataClasses[selectedName],
                              methods: {
                                ...prev.dataClasses[selectedName]?.methods,
                                [method.name]: {
                                  ...prev.dataClasses[selectedName]?.methods?.[method.name],
                                  description,
                                },
                              },
                            },
                          },
                        }))
                      })
                    }
                    onGenerateArguments={() =>
                      void runFieldGeneration(schemaLabel, async (signal) => {
                        const arguments_ = await generateMethodArguments({
                          catalog,
                          context: 'dataclass',
                          ownerName: selectedName,
                          methodName: method.name,
                          signal,
                        })
                        updateMetadata((prev) => ({
                          ...prev,
                          dataClasses: {
                            ...prev.dataClasses,
                            [selectedName]: {
                              ...prev.dataClasses[selectedName],
                              methods: {
                                ...prev.dataClasses[selectedName]?.methods,
                                [method.name]: {
                                  ...prev.dataClasses[selectedName]?.methods?.[method.name],
                                  arguments: arguments_,
                                },
                              },
                            },
                          },
                        }))
                      })
                    }
                  />
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  const renderSingletonPanel = () => {
    if (!selectedName) {
      return (
        <EmptyPanel
          icon={ListTree}
          badgeIcon={MousePointerClick}
          badgeTone="primary"
          title={t('assistantMetadata.selectItem')}
          ghost="cards"
          size="md"
          className="h-full min-h-0"
        />
      )
    }

    const singleton = catalog.singletons?.find((s) => s.name === selectedName)
    const sMeta = metadata.singletons[selectedName] ?? {}

    if (!singleton) return null

    const exposedMethods = filterAssistantExposedMethods(singleton.methods)
    const visibleMethods = exposedMethods.filter((method) => {
      if (!method.name) return false
      if (missingOnly && !isMissingDescription(sMeta.methods?.[method.name]?.description)) {
        return false
      }
      return true
    })
    const missingMethodCount = exposedMethods.filter(
      (method) => method.name && isMissingDescription(sMeta.methods?.[method.name]?.description)
    ).length
    const showSingletonDescription = !missingOnly || isMissingDescription(sMeta.description)
    const hasVisibleContent = showSingletonDescription || visibleMethods.length > 0

    if (!hasVisibleContent) {
      return (
        <EmptyPanel
          icon={Sparkles}
          title={t('assistantMetadata.noMissingFields')}
          ghost="none"
          size="sm"
          bordered
        />
      )
    }

    return (
      <div className="space-y-4">
        {showSingletonDescription ? (
          <div data-metadata-missing={isMissingDescription(sMeta.description) || undefined}>
            <DescriptionField
              id={`singleton-desc-${selectedName}`}
              label={t('assistantMetadata.singletonDescription')}
              value={sMeta.description ?? ''}
              onChange={(description) =>
                updateMetadata((prev) => ({
                  ...prev,
                  singletons: {
                    ...prev.singletons,
                    [selectedName]: { ...sMeta, description },
                  },
                }))
              }
              aiEnabled={aiEnabled && !isGenerating}
              generating={isGeneratingLabel(selectedName)}
              onGenerate={() =>
                runFieldGeneration(selectedName, async (signal) => {
                  const description = await generateSingletonDescription({
                    catalog,
                    singletonName: selectedName,
                    signal,
                  })
                  updateMetadata((prev) => ({
                    ...prev,
                    singletons: {
                      ...prev.singletons,
                      [selectedName]: { ...prev.singletons[selectedName], description },
                    },
                  }))
                })
              }
            />
          </div>
        ) : null}

        {visibleMethods.length > 0 ? (
          <div className="space-y-2" data-metadata-missing={missingMethodCount > 0 || undefined}>
            <h3 className="flex items-center gap-2 font-medium text-sm">
              {t('assistantMetadata.methods')}
              {missingMethodCount > 0 ? (
                <span className="font-normal text-muted-foreground text-xs">
                  ({t('assistantMetadata.sectionMissingCount', { count: missingMethodCount })})
                </span>
              ) : null}
            </h3>
            <div className="space-y-2">
              {visibleMethods.map((method, methodIndex) => {
                if (!method.name) return null
                const methodMeta = sMeta.methods?.[method.name] ?? {}
                const methodLabel = `${selectedName}.${method.name}`
                const schemaLabel = methodSchemaLabel(selectedName, method.name)
                return (
                  <MethodEditor
                    key={methodRowKey(method, methodIndex)}
                    methodName={method.name}
                    signature={method.paramsText ?? `${method.name}()`}
                    metadata={methodMeta}
                    aiEnabled={aiEnabled && !isGenerating}
                    generatingDescription={isGeneratingLabel(methodLabel)}
                    generatingArguments={isGeneratingLabel(schemaLabel)}
                    onChange={(next) =>
                      updateMetadata((prev) => ({
                        ...prev,
                        singletons: {
                          ...prev.singletons,
                          [selectedName]: {
                            ...prev.singletons[selectedName],
                            methods: {
                              ...prev.singletons[selectedName]?.methods,
                              [method.name]: next,
                            },
                          },
                        },
                      }))
                    }
                    onGenerateDescription={() =>
                      void runFieldGeneration(methodLabel, async (signal) => {
                        const description = await generateMethodDescription({
                          catalog,
                          context: 'singleton',
                          ownerName: selectedName,
                          methodName: method.name,
                          signal,
                        })
                        updateMetadata((prev) => ({
                          ...prev,
                          singletons: {
                            ...prev.singletons,
                            [selectedName]: {
                              ...prev.singletons[selectedName],
                              methods: {
                                ...prev.singletons[selectedName]?.methods,
                                [method.name]: {
                                  ...prev.singletons[selectedName]?.methods?.[method.name],
                                  description,
                                },
                              },
                            },
                          },
                        }))
                      })
                    }
                    onGenerateArguments={() =>
                      void runFieldGeneration(schemaLabel, async (signal) => {
                        const arguments_ = await generateMethodArguments({
                          catalog,
                          context: 'singleton',
                          ownerName: selectedName,
                          methodName: method.name,
                          signal,
                        })
                        updateMetadata((prev) => ({
                          ...prev,
                          singletons: {
                            ...prev.singletons,
                            [selectedName]: {
                              ...prev.singletons[selectedName],
                              methods: {
                                ...prev.singletons[selectedName]?.methods,
                                [method.name]: {
                                  ...prev.singletons[selectedName]?.methods?.[method.name],
                                  arguments: arguments_,
                                },
                              },
                            },
                          },
                        }))
                      })
                    }
                  />
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  const renderCatalogMethodPanel = () => {
    if (!selectedName) {
      return (
        <EmptyPanel
          icon={ListTree}
          badgeIcon={MousePointerClick}
          badgeTone="primary"
          title={t('assistantMetadata.selectItem')}
          ghost="cards"
          size="md"
          className="h-full min-h-0"
        />
      )
    }

    const method = catalog.methods?.find(
      (m) => m.name === selectedName && isAssistantExposedMethod(m)
    )
    const methodMeta = metadata.catalogMethods[selectedName] ?? {}

    if (!method) return null

    if (missingOnly && !isMissingDescription(methodMeta.description)) {
      return (
        <EmptyPanel
          icon={Sparkles}
          title={t('assistantMetadata.noMissingFields')}
          ghost="none"
          size="sm"
          bordered
        />
      )
    }

    return (
      <div
        className="space-y-4"
        data-metadata-missing={isMissingDescription(methodMeta.description) || undefined}
      >
        <MethodEditor
          methodName={selectedName}
          signature={method.paramsText ?? `${selectedName}()`}
          applyTo={method.applyTo}
          metadata={methodMeta}
          aiEnabled={aiEnabled && !isGenerating}
          generatingDescription={isGeneratingLabel(selectedName)}
          generatingArguments={isGeneratingLabel(`${selectedName} · schema`)}
          onChange={(next) =>
            updateMetadata((prev) => ({
              ...prev,
              catalogMethods: {
                ...prev.catalogMethods,
                [selectedName]: next,
              },
            }))
          }
          onGenerateDescription={() =>
            void runFieldGeneration(selectedName, async (signal) => {
              const description = await generateMethodDescription({
                catalog,
                context: 'catalog',
                ownerName: selectedName,
                methodName: selectedName,
                signal,
              })
              updateMetadata((prev) => ({
                ...prev,
                catalogMethods: {
                  ...prev.catalogMethods,
                  [selectedName]: {
                    ...prev.catalogMethods[selectedName],
                    description,
                  },
                },
              }))
            })
          }
          onGenerateArguments={() =>
            void runFieldGeneration(`${selectedName} · schema`, async (signal) => {
              const arguments_ = await generateMethodArguments({
                catalog,
                context: 'catalog',
                ownerName: selectedName,
                methodName: selectedName,
                signal,
              })
              updateMetadata((prev) => ({
                ...prev,
                catalogMethods: {
                  ...prev.catalogMethods,
                  [selectedName]: {
                    ...prev.catalogMethods[selectedName],
                    arguments: arguments_,
                  },
                },
              }))
            })
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-border/60 border-b px-4 py-3">
        <div>
          <h1 className="font-semibold text-lg">{t('assistantMetadata.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('assistantMetadata.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeGeneration ? (
            <GenerateAllProgress
              bulkProgress={
                activeGeneration.kind === 'bulk' ? activeGeneration.progress : undefined
              }
              fieldLabel={activeGeneration.kind === 'field' ? activeGeneration.label : undefined}
              onCancel={handleCancelGeneration}
            />
          ) : (
            <span className="text-muted-foreground text-xs">
              {saveState === 'saving' ? (
                t('assistantMetadata.saving')
              ) : saveState === 'saved' ? (
                t('assistantMetadata.saved')
              ) : missingDescriptionCount > 0 ? (
                <button
                  type="button"
                  className="text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => setMissingOnly(true)}
                >
                  {t('assistantMetadata.missingCount', { count: missingDescriptionCount })}
                </button>
              ) : null}
            </span>
          )}
          {!isGenerating ? (
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!aiEnabled || missingDescriptionCount === 0}
                      onClick={() => void handleGenerateAllDescriptions()}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t('assistantMetadata.generateAllDescriptions')}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[16rem] text-xs">
                  {!aiEnabled
                    ? t('assistantMetadata.aiNotConfigured')
                    : missingDescriptionCount === 0
                      ? t('assistantMetadata.generateAllNothing')
                      : t('assistantMetadata.generateAllDescriptionsHint', {
                          count: missingDescriptionCount,
                        })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isGenerating}
          >
            <Download className="mr-2 h-4 w-4" />
            {t('assistantMetadata.export')}
          </Button>
        </div>
      </div>

      <Tabs
        value={viewTab}
        onValueChange={(v) => setViewTab(v as 'editor' | 'json')}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="border-border/60 border-b px-4">
          <TabsList className="h-6 bg-transparent p-0">
            <TabsTrigger
              value="editor"
              className="h-6 rounded-none border-transparent border-b-2 px-2 text-xs data-[state=active]:border-primary"
            >
              {t('assistantMetadata.tabEditor')}
            </TabsTrigger>
            <TabsTrigger
              value="json"
              className="h-6 rounded-none border-transparent border-b-2 px-2 text-xs data-[state=active]:border-primary"
            >
              {t('assistantMetadata.tabJson')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="editor" className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
          <div className="grid h-full min-h-0 grid-cols-[240px_1fr]">
            <div className="flex min-h-0 flex-col border-border/60 border-r">
              <div className="border-border/60 border-b p-1.5">
                <SegmentedControl
                  aria-label="Sections"
                  fullWidth
                  value={section}
                  onValueChange={(s) => {
                    setSection(s)
                    setSearch('')
                  }}
                  options={(['dataclasses', 'singletons', 'catalogMethods'] as const).map((s) => ({
                    value: s,
                    label: t(`assistantMetadata.section.${s}`),
                    icon: SECTION_ICONS[s],
                  }))}
                />
              </div>
              <div className="space-y-1.5 p-1.5">
                <div className="relative">
                  <Search className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('assistantMetadata.searchPlaceholder')}
                    className="h-6 pl-7 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMissingOnly((value) => !value)}
                  className={cn(
                    'flex h-6 w-full items-center justify-center gap-1 rounded-sm px-2 text-[11px] transition-colors',
                    missingOnly
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  )}
                >
                  <Filter className="h-3 w-3" />
                  {t('assistantMetadata.showMissingOnly')}
                </button>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-0.5 p-2 pt-0">
                  {filteredItems.map((name) => {
                    const missing = countItemMissingDescriptions(metadata, catalog, section, name)
                    return (
                      <button
                        key={`${section}-${name}`}
                        type="button"
                        onClick={() => setSelectedName(name)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                          selectedName === name ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
                        )}
                      >
                        <span className="truncate font-mono text-xs">{name}</span>
                        {missing > 0 ? (
                          <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                            {missing}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                  {filteredItems.length === 0 ? (
                    <EmptyPanel
                      icon={Search}
                      title={t('assistantMetadata.noItems')}
                      ghost="none"
                      size="sm"
                    />
                  ) : null}
                </div>
              </ScrollArea>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="p-4" ref={detailsPanelRef}>
                {section === 'dataclasses' && renderDataclassPanel()}
                {section === 'singletons' && renderSingletonPanel()}
                {section === 'catalogMethods' && renderCatalogMethodPanel()}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="json" className="mt-0 min-h-0 flex-1 p-4 data-[state=inactive]:hidden">
          <MetadataJsonView
            metadata={metadata}
            onChange={(next) => {
              setMetadata(next)
              scheduleSave(next)
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
