import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SegmentedControl,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@4d/ui'
import { Download, FolderTree, KeyRound, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import { downloadBytes } from '~/lib/download-bytes'
import { mobileFullscreenDialogClass } from '~/lib/mobile-menu'
import { getBaseUrl, getConnectionStoreAPI, isMobileShell } from '~/lib/platform'
import {
  buildPostmanCollection,
  emitOpenApiFromPostmanItems,
  openApiDocumentFilename,
  type PostmanExportItemInput,
  type PostmanExportVariableValues,
  type PostmanFolderMode,
  postmanCollectionFilename,
  type RestCollectionExportType,
  serializeOpenApiDocument,
  serializePostmanCollection,
} from '~/lib/postman'
import { PostmanExportCollectionForm } from './PostmanExportCollectionForm'
import { PostmanExportItemList } from './PostmanExportItemList'
import { PostmanExportVariablesForm } from './PostmanExportVariablesForm'

type PostmanExportTab = 'items' | 'collection' | 'variables'

async function loadDefaultVariables(): Promise<PostmanExportVariableValues> {
  const baseUrl = getBaseUrl().replace(/\/$/, '') || ''
  const defaults: PostmanExportVariableValues = {
    baseUrl,
    accessKey: '',
    username: '',
    password: '',
  }
  const api = getConnectionStoreAPI()
  if (!api) return defaults
  try {
    const connection = await api.getActiveConnection()
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

export function PostmanExportModal({
  open,
  onOpenChange,
  items,
  defaultCollectionName,
  signatureLabel,
  itemsSectionLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: PostmanExportItemInput[]
  defaultCollectionName: string
  /** Accessible label for the signature/path info control (matches Favourites list). */
  signatureLabel?: string
  itemsSectionLabel?: string
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const mobile = isMobileShell()
  const resolvedSignatureLabel = signatureLabel ?? t('favouriteMeta.viewSignature')
  const resolvedItemsSection = itemsSectionLabel ?? t('postmanExport.itemsSection')

  const [tab, setTab] = useState<PostmanExportTab>('items')
  const [exportType, setExportType] = useState<RestCollectionExportType>('postman')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [collectionName, setCollectionName] = useState(defaultCollectionName)
  const [collectionDescription, setCollectionDescription] = useState('')
  const [folderMode, setFolderMode] = useState<PostmanFolderMode>('flat')
  const [variables, setVariables] = useState<PostmanExportVariableValues>({
    baseUrl: '',
    accessKey: '',
    username: '',
    password: '',
  })
  const [includeAccessKeyLogin, setIncludeAccessKeyLogin] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!open) return
    setTab('items')
    setExportType('postman')
    setSelectedIds(new Set(items.map((item) => item.id)))
    setCollectionName(defaultCollectionName)
    setCollectionDescription('')
    setFolderMode('flat')
    let cancelled = false
    void loadDefaultVariables().then((next) => {
      if (cancelled) return
      setVariables(next)
      setIncludeAccessKeyLogin(Boolean(next.accessKey.trim()))
    })
    return () => {
      cancelled = true
    }
  }, [open, items, defaultCollectionName])

  const selectableItems = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        displayName: item.displayName,
        detail: item.listDetail ?? item.name,
        badgeLabel: item.badgeLabel,
        badgeClassName: item.badgeClassName,
        tags: item.tags,
        signatureLabel: resolvedSignatureLabel,
      })),
    [items, resolvedSignatureLabel]
  )

  const handleExport = async () => {
    if (selectedIds.size === 0 || exporting) return
    const selectedItems = items.filter((item) => selectedIds.has(item.id))
    if (selectedItems.length === 0) return

    setExporting(true)
    try {
      const name = collectionName.trim() || defaultCollectionName
      if (exportType === 'openapi') {
        const document = emitOpenApiFromPostmanItems({
          name,
          description: collectionDescription,
          variables,
          includeAccessKeyLogin,
          items: selectedItems,
        })
        const json = serializeOpenApiDocument(document)
        await downloadBytes({
          filename: openApiDocumentFilename(name),
          bytes: new TextEncoder().encode(json),
          mime: 'application/json',
        })
      } else {
        const collection = buildPostmanCollection({
          name,
          description: collectionDescription,
          variables,
          includeAccessKeyLogin,
          folderMode,
          items: selectedItems,
          untaggedFolderName: t('postmanExport.untaggedFolder'),
        })
        const json = serializePostmanCollection(collection)
        await downloadBytes({
          filename: postmanCollectionFilename(collection.info.name),
          bytes: new TextEncoder().encode(json),
          mime: 'application/json',
        })
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(t('postmanExport.exportFailed'), {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setExporting(false)
    }
  }

  const tabTriggerClass = cn(
    'group min-w-0 flex-1 gap-1 data-[state=active]:shadow-xs',
    mobile ? 'h-8 px-1.5 text-[11px]' : 'h-6 px-2 text-[11px]'
  )

  const footerName = collectionName.trim() || defaultCollectionName

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          mobile
            ? mobileFullscreenDialogClass('gap-0 bg-background p-0')
            : 'flex h-[min(32rem,90vh)] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl'
        )}
      >
        <DialogHeader
          className={cn(
            'shrink-0 border-b bg-gradient-to-br from-primary/8 via-muted/30 to-background px-3 py-2 pr-10',
            mobile && 'pt-[max(0.75rem,var(--app-safe-top))]'
          )}
        >
          <div className="flex items-start gap-2">
            <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Download className="h-3.5 w-3.5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm leading-none tracking-tight">
                {t('postmanExport.title')}
              </DialogTitle>
              <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground leading-snug">
                {t('postmanExport.help')}
              </p>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as PostmanExportTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="shrink-0 border-b bg-muted/20 px-3 py-1.5">
            <TabsList className="flex h-auto w-full gap-0.5 rounded-md bg-muted/50 p-0.5">
              <TabsTrigger
                value="items"
                className={cn(
                  tabTriggerClass,
                  'data-[state=active]:bg-background data-[state=active]:text-foreground'
                )}
              >
                <Star
                  className="size-3 shrink-0 text-muted-foreground group-data-[state=active]:text-primary"
                  aria-hidden
                />
                <span className="truncate">{resolvedItemsSection}</span>
                <Badge
                  variant="secondary"
                  className="ml-0.5 h-3.5 min-w-3.5 justify-center border-0 bg-muted/80 px-1 font-mono text-[9px] tabular-nums group-data-[state=active]:bg-primary/15 group-data-[state=active]:text-primary"
                >
                  {selectedIds.size}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="collection"
                className={cn(
                  tabTriggerClass,
                  'data-[state=active]:bg-background data-[state=active]:text-foreground'
                )}
              >
                <FolderTree
                  className="size-3 shrink-0 text-muted-foreground group-data-[state=active]:text-sky-600 dark:group-data-[state=active]:text-sky-400"
                  aria-hidden
                />
                <span className="truncate">{t('postmanExport.collectionSection')}</span>
              </TabsTrigger>
              <TabsTrigger
                value="variables"
                className={cn(
                  tabTriggerClass,
                  'data-[state=active]:bg-background data-[state=active]:text-foreground'
                )}
              >
                <KeyRound
                  className="size-3 shrink-0 text-muted-foreground group-data-[state=active]:text-amber-600 dark:group-data-[state=active]:text-amber-400"
                  aria-hidden
                />
                <span className="truncate">{t('postmanExport.variablesTab')}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-1.5">
            <TabsContent
              value="items"
              className="fade-in-0 slide-in-from-bottom-1 mt-0 h-full animate-in outline-none duration-150"
            >
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {t('postmanExport.itemsSectionHelp')}
                </p>
                <PostmanExportItemList
                  items={selectableItems}
                  selectedIds={selectedIds}
                  onSelectedIdsChange={setSelectedIds}
                />
              </div>
            </TabsContent>

            <TabsContent
              value="collection"
              className="fade-in-0 slide-in-from-bottom-1 mt-0 h-full animate-in outline-none duration-150"
            >
              <PostmanExportCollectionForm
                collectionName={collectionName}
                onCollectionNameChange={setCollectionName}
                collectionDescription={collectionDescription}
                onCollectionDescriptionChange={setCollectionDescription}
                folderMode={folderMode}
                onFolderModeChange={setFolderMode}
                showFolderMode={exportType === 'postman'}
              />
            </TabsContent>

            <TabsContent
              value="variables"
              className="fade-in-0 slide-in-from-bottom-1 mt-0 h-full animate-in outline-none duration-150"
            >
              <PostmanExportVariablesForm
                variables={variables}
                onVariablesChange={setVariables}
                includeAccessKeyLogin={includeAccessKeyLogin}
                onIncludeAccessKeyLoginChange={setIncludeAccessKeyLogin}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter
          className={cn(
            'shrink-0 gap-2 border-t bg-muted/25 px-3 py-1.5 sm:flex-row sm:items-center sm:justify-between',
            mobile && 'flex-col pb-[max(0.5rem,var(--app-safe-bottom))] sm:flex-col'
          )}
        >
          <p className="hidden min-w-0 flex-1 truncate text-[11px] text-muted-foreground sm:block">
            {t('postmanExport.footerSummary', {
              count: selectedIds.size,
              name: footerName,
            })}
          </p>
          <div className={cn('flex flex-wrap items-center gap-1.5', mobile && 'w-full flex-col')}>
            <SegmentedControl
              aria-label={t('postmanExport.formatAria')}
              value={exportType}
              onValueChange={(value) => setExportType(value as RestCollectionExportType)}
              options={[
                { value: 'postman', label: t('postmanExport.formatPostman') },
                { value: 'openapi', label: t('postmanExport.formatOpenApi') },
              ]}
            />
            <Button
              variant="outline"
              size="sm"
              className={cn(mobile && 'h-11 w-full')}
              onClick={() => onOpenChange(false)}
              disabled={exporting}
            >
              {t('postmanExport.cancel')}
            </Button>
            <Button
              size="sm"
              className={cn('gap-1.5', mobile && 'h-11 w-full')}
              onClick={() => void handleExport()}
              disabled={selectedIds.size === 0 || exporting}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {t('postmanExport.export')}
              {selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
