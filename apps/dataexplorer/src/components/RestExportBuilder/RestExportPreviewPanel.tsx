import { ChevronsDownUp, ChevronsUpDown, Minus } from 'lucide-react'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import {
  collectFolderIds,
  inventorySummary,
  reconcileCollapsedFolderIds,
  type ToolkitEmojiConfig,
  type ToolkitEmojiKey,
  type ToolkitInventory,
  triState,
} from '~/lib/rest-export'
import { RestExportEmojiToolbar } from './RestExportEmojiToolbar'
import { RestExportPreviewNode } from './RestExportPreviewNode'
import { RestExportTriStateIconButton } from './RestExportTriStateIconButton'

export function RestExportPreviewPanel({
  inventory,
  emoji,
  includeDocs,
  onEmojiEnabledChange,
  onDataclassFolderEmojiChange,
  onIncludeDocsChange,
  onCustomEmojiChange,
}: {
  inventory: ToolkitInventory
  emoji: ToolkitEmojiConfig
  includeDocs: boolean
  onEmojiEnabledChange: (enabled: boolean) => void
  onDataclassFolderEmojiChange: (value: boolean) => void
  onIncludeDocsChange: (includeDocs: boolean) => void
  onCustomEmojiChange: (
    key: ToolkitEmojiKey,
    next: string,
    options?: { category?: boolean }
  ) => void
}) {
  const { t } = useTranslation()
  const summary = inventorySummary(inventory)
  const folderIds = useMemo(() => collectFolderIds(inventory.nodes), [inventory.nodes])
  const knownFolderIdsRef = useRef<ReadonlySet<string>>(new Set(folderIds))
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set(folderIds))
  const expandState = triState(folderIds.length - collapsedIds.size, folderIds.length)

  useLayoutEffect(() => {
    setCollapsedIds((current) => {
      const next = reconcileCollapsedFolderIds(current, folderIds, knownFolderIdsRef.current)
      knownFolderIdsRef.current = next.knownIds
      if (current.size === next.collapsedIds.size) {
        let same = true
        for (const id of current) {
          if (!next.collapsedIds.has(id)) {
            same = false
            break
          }
        }
        if (same) return current
      }
      return next.collapsedIds
    })
  }, [folderIds])

  const toggleFolder = useCallback((id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className="space-y-3">
      <RestExportEmojiToolbar
        emoji={emoji}
        includeDocs={includeDocs}
        onEnabledChange={onEmojiEnabledChange}
        onDataclassFolderEmojiChange={onDataclassFolderEmojiChange}
        onIncludeDocsChange={onIncludeDocsChange}
      />
      {summary.requests === 0 ? (
        <p className="text-muted-foreground text-xs">{t('restExportBuilder.previewEmpty')}</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-[11px] text-muted-foreground">
              {t('restExportBuilder.previewSummary', {
                folders: summary.folders,
                requests: summary.requests,
              })}
            </p>
            <RestExportTriStateIconButton
              appearance="icon"
              state={expandState}
              icons={{
                false: ChevronsUpDown,
                indeterminate: Minus,
                true: ChevronsDownUp,
              }}
              labels={{
                false: t('restExportBuilder.expandAll'),
                indeterminate: t('restExportBuilder.expandSome'),
                true: t('restExportBuilder.collapseAll'),
              }}
              disabled={folderIds.length === 0}
              onToggle={(expandAll) => setCollapsedIds(expandAll ? new Set() : new Set(folderIds))}
            />
          </div>
          <div className="max-h-[min(28rem,60vh)] overflow-auto rounded-md border bg-muted/20 p-2">
            {inventory.nodes.map((node) => (
              <RestExportPreviewNode
                key={node.type === 'folder' ? node.id : node.operation.id}
                node={node}
                depth={0}
                emoji={emoji}
                collapsedIds={collapsedIds}
                onToggleFolder={toggleFolder}
                onEmojiChange={onCustomEmojiChange}
              />
            ))}
          </div>
          {emoji.enabled ? (
            <p className="text-[11px] text-muted-foreground">{t('restExportBuilder.emojiHint')}</p>
          ) : null}
          {includeDocs ? (
            <p className="text-[11px] text-muted-foreground">{t('restExportBuilder.docsHint')}</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
