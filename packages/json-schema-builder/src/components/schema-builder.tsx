import {
  Button,
  Tabs,
  TabsContent,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { BookOpen, Braces, Pencil } from 'lucide-react'
import * as React from 'react'
import { getT } from '../i18n'
import { getDefs, getRootSchema, setAtPath as setAtPathUtil } from '../lib/schema-utils'
import type { JSONSchema, JSONSchemaRoot, SchemaBuilderPlugin } from '../types'
import { DEFAULT_SCHEMA_DRAFT_URL } from '../types'
import { CheckboxButton } from './checkbox-button'
import { DefinitionsView } from './definitions-view'
import { SchemaNodeEditor } from './schema-node-editor'

const TAB_EDITOR = 'editor'
const TAB_DEFINITIONS = 'definitions'

export type SchemaBuilderT = ReturnType<typeof getT>

const SchemaBuilderI18nContext = React.createContext<SchemaBuilderT | null>(null)

export function useSchemaBuilderI18n(): SchemaBuilderT {
  const t = React.useContext(SchemaBuilderI18nContext)
  if (!t) return getT('en')
  return t
}

export interface SchemaBuilderContextValue {
  root: JSONSchemaRoot
  schema: JSONSchema
  path: string[]
  onChange: (value: JSONSchemaRoot) => void
  setAtPath: (path: string[], value: JSONSchema) => void
  definitions: Record<string, JSONSchema>
  onOpenDefinitions?: () => void
  /** When true, add $schema to generated/copied JSON. */
  includeSchemaAttr: boolean
  /** Root with $schema added when includeSchemaAttr is true; use for copy/export. */
  getRootForOutput: () => JSONSchemaRoot
  /** Get persisted data for a plugin (e.g. form state). Survives tab switches. */
  getPluginData: (pluginId: string) => Record<string, unknown>
  /** Persist data for a plugin. Call when plugin state changes so it survives tab switches. */
  setPluginData: (pluginId: string, data: Record<string, unknown>) => void
  /** Code editor prefs (from host app profile when provided). */
  editorPrefs?: import('@4d/ui').EditorPrefs
  /** Called when user changes editor prefs. */
  onEditorPrefsChange?: (partial: Partial<import('@4d/ui').EditorPrefs>) => void
}

const SchemaBuilderContext = React.createContext<SchemaBuilderContextValue | null>(null)

export function useSchemaBuilderContext(): SchemaBuilderContextValue {
  const ctx = React.useContext(SchemaBuilderContext)
  if (!ctx) throw new Error('useSchemaBuilderContext must be used within SchemaBuilder')
  return ctx
}

export interface SchemaBuilderProps {
  value: JSONSchemaRoot | JSONSchema
  onChange: (value: JSONSchemaRoot | JSONSchema) => void
  plugins?: SchemaBuilderPlugin[]
  /** When true, show the definitions sidebar by default */
  showDefinitions?: boolean
  /** When true (default), add $schema to generated/copied JSON. */
  includeSchemaAttr?: boolean
  /** UI language: locale code or object with optional base + partial overrides. Defaults to 'en'. */
  lang?: import('../i18n').SchemaBuilderLangOrOverrides
  /** When provided, code editors use these prefs (e.g. from app profile). */
  editorPrefs?: import('@4d/ui').EditorPrefs
  /** Called when user changes editor prefs. */
  onEditorPrefsChange?: (partial: Partial<import('@4d/ui').EditorPrefs>) => void
}

export function SchemaBuilder({
  value,
  onChange,
  plugins = [],
  showDefinitions = false,
  includeSchemaAttr: includeSchemaAttrProp,
  lang = 'en',
  editorPrefs,
  onEditorPrefsChange,
}: SchemaBuilderProps) {
  const defaultTab = showDefinitions ? TAB_DEFINITIONS : TAB_EDITOR
  const [activeTab, setActiveTab] = React.useState(defaultTab)
  const [includeSchemaAttr, setIncludeSchemaAttr] = React.useState(
    () => includeSchemaAttrProp ?? true
  )
  const t = React.useMemo(() => getT(lang), [lang])
  const [pluginData, setPluginDataState] = React.useState<Record<string, Record<string, unknown>>>(
    {}
  )

  // Only sync from prop when parent explicitly controls this (controlled mode)
  React.useEffect(() => {
    if (includeSchemaAttrProp !== undefined) {
      setIncludeSchemaAttr(includeSchemaAttrProp)
    }
  }, [includeSchemaAttrProp])

  const getPluginData = React.useCallback(
    (pluginId: string) => {
      return pluginData[pluginId] ?? {}
    },
    [pluginData]
  )

  const setPluginData = React.useCallback((pluginId: string, data: Record<string, unknown>) => {
    setPluginDataState((prev) => ({ ...prev, [pluginId]: data }))
  }, [])

  const root = React.useMemo(() => getRootSchema(value), [value])
  const definitions = React.useMemo(() => getDefs(root), [root])
  const schema = React.useMemo(() => {
    if (
      root &&
      !('type' in root) &&
      !('$ref' in root) &&
      !('oneOf' in root) &&
      !('anyOf' in root) &&
      !('allOf' in root)
    ) {
      return { type: 'object' as const, properties: {} }
    }
    return (root as unknown as JSONSchema) ?? { type: 'object' as const, properties: {} }
  }, [root])

  const setAtPath = React.useCallback(
    (path: string[], newValue: JSONSchema) => {
      const next = setAtPathUtil(root, path, newValue)
      onChange(next)
    },
    [root, onChange]
  )

  const handleRootSchemaChange = React.useCallback(
    (newSchema: JSONSchema) => {
      // Replace root schema content but preserve $defs/definitions so type changes (e.g. oneOf → string) work
      const next: JSONSchemaRoot = { ...newSchema } as JSONSchemaRoot
      if (root?.$defs !== undefined) next.$defs = root.$defs
      if (root?.definitions !== undefined) next.definitions = root.definitions
      onChange(next)
    },
    [root, onChange]
  )

  const getRootForOutput = React.useCallback(() => {
    if (!root) return root
    if (!includeSchemaAttr) return root
    const { $schema, ...rest } = root
    return { $schema: $schema ?? DEFAULT_SCHEMA_DRAFT_URL, ...rest }
  }, [root, includeSchemaAttr])

  const ctx: SchemaBuilderContextValue = React.useMemo(
    () => ({
      root,
      schema,
      path: [],
      onChange: (newRoot: JSONSchemaRoot) => onChange(newRoot),
      setAtPath,
      definitions,
      onOpenDefinitions: () => setActiveTab(TAB_DEFINITIONS),
      includeSchemaAttr,
      getRootForOutput,
      getPluginData,
      setPluginData,
      editorPrefs,
      onEditorPrefsChange,
    }),
    [
      root,
      schema,
      onChange,
      setAtPath,
      definitions,
      includeSchemaAttr,
      getRootForOutput,
      getPluginData,
      setPluginData,
      editorPrefs,
      onEditorPrefsChange,
    ]
  )

  return (
    <SchemaBuilderI18nContext.Provider value={t}>
      <SchemaBuilderContext.Provider value={ctx}>
        <TooltipProvider delayDuration={300}>
          <div className="flex min-h-0 flex-1 flex-col">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="sticky top-0 z-10 flex h-9 w-full shrink-0 flex-row flex-nowrap items-center gap-1.5 border-b bg-card px-2">
                <div
                  className="inline-flex h-6 shrink-0 rounded-sm border border-border bg-background"
                  role="tablist"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant={activeTab === TAB_EDITOR ? 'secondary' : 'ghost'}
                        size="iconXs"
                        onClick={() => setActiveTab(TAB_EDITOR)}
                        className="h-6! w-6! rounded-r-none border-border border-r"
                        aria-selected={activeTab === TAB_EDITOR}
                        role="tab"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t('tabsEditor')}</TooltipContent>
                  </Tooltip>
                  {plugins
                    .filter((p) => p.tabContent)
                    .map((p) => {
                      const isActive = activeTab === p.id
                      const pluginTabLabelKey =
                        p.id === 'view-json'
                          ? 'pluginViewJson'
                          : p.id === 'test-schema'
                            ? 'pluginTestSchema'
                            : null
                      const tabLabel = pluginTabLabelKey
                        ? t(pluginTabLabelKey)
                        : (p.tabLabel ?? p.id)
                      return (
                        <Tooltip key={p.id}>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant={isActive ? 'secondary' : 'ghost'}
                              size="iconXs"
                              onClick={() => setActiveTab(p.id)}
                              className="h-6! w-6! rounded-none border-border border-r"
                              aria-selected={isActive}
                              role="tab"
                            >
                              <Braces className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">{tabLabel}</TooltipContent>
                        </Tooltip>
                      )
                    })}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant={activeTab === TAB_DEFINITIONS ? 'secondary' : 'ghost'}
                        size="iconXs"
                        onClick={() => setActiveTab(TAB_DEFINITIONS)}
                        className="h-6! w-6! rounded-l-none"
                        aria-selected={activeTab === TAB_DEFINITIONS}
                        role="tab"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t('tabsDefinitions')}</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex min-w-0 flex-1 justify-center">
                  <div className="flex shrink-0 cursor-pointer items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground">
                    <CheckboxButton
                      checked={includeSchemaAttr}
                      onCheckedChange={setIncludeSchemaAttr}
                      ariaLabel={t('includeSchemaAttrLabel')}
                      tooltip={t('includeSchemaAttrLabel')}
                    />
                    <button
                      type="button"
                      className="whitespace-nowrap bg-transparent p-0 text-left text-inherit hover:underline"
                      onClick={() => setIncludeSchemaAttr((prev) => !prev)}
                      aria-label={t('includeSchemaAttrLabel')}
                    >
                      {t('includeSchemaAttrLabel')}
                    </button>
                  </div>
                </div>
                <div className="flex shrink-0 flex-row flex-nowrap items-center gap-2">
                  <span className="hidden shrink-0 whitespace-nowrap text-muted-foreground text-xs sm:inline">
                    {t('jsonSchemaDraftNotice')}
                  </span>
                  {/* Toolbar spot: plugins that provide toolbar render here */}
                  <div className="flex shrink-0 flex-row flex-nowrap items-center gap-1">
                    {plugins
                      .filter(
                        (
                          p
                        ): p is SchemaBuilderPlugin & {
                          toolbar: NonNullable<SchemaBuilderPlugin['toolbar']>
                        } => Boolean(p.toolbar)
                      )
                      .map((p) => {
                        const ToolbarComponent = p.toolbar
                        return (
                          <ToolbarComponent
                            key={p.id}
                            schema={schema}
                            definitions={definitions}
                            path={[]}
                            pluginId={p.id}
                            editorPrefs={editorPrefs}
                            onEditorPrefsChange={onEditorPrefsChange}
                          />
                        )
                      })}
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <TabsContent
                  value={TAB_EDITOR}
                  className="mt-0 min-h-0 p-1.5 data-[state=inactive]:hidden"
                >
                  <div className="rounded-sm bg-muted/20 p-1.5">
                    <SchemaNodeEditor
                      value={schema}
                      path={[]}
                      onChange={handleRootSchemaChange}
                      isRoot
                    />
                  </div>
                </TabsContent>
                {plugins
                  .filter(
                    (
                      p
                    ): p is SchemaBuilderPlugin & {
                      tabContent: NonNullable<SchemaBuilderPlugin['tabContent']>
                    } => Boolean(p.tabContent)
                  )
                  .map((p) => {
                    const TabComponent = p.tabContent
                    return (
                      <TabsContent
                        key={p.id}
                        value={p.id}
                        className="mt-0 min-h-0 p-1.5 data-[state=inactive]:hidden"
                      >
                        <div className="min-h-50 rounded-sm bg-card p-1.5">
                          <TabComponent
                            schema={schema}
                            definitions={definitions}
                            path={[]}
                            pluginId={p.id}
                            editorPrefs={editorPrefs}
                            onEditorPrefsChange={onEditorPrefsChange}
                          />
                        </div>
                      </TabsContent>
                    )
                  })}
                <TabsContent
                  value={TAB_DEFINITIONS}
                  className="mt-0 min-h-0 p-1.5 data-[state=inactive]:hidden"
                >
                  <div className="flex min-h-50 flex-1 flex-col rounded-sm bg-card">
                    <DefinitionsView variant="inline" />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </TooltipProvider>
      </SchemaBuilderContext.Provider>
    </SchemaBuilderI18nContext.Provider>
  )
}
