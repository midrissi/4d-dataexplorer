import { cn } from '@4d/ui'
import { ChevronRight, ExternalLink } from 'lucide-react'
import { useTranslation } from '~/i18n'
import {
  emojiForKey,
  type ToolkitEmojiConfig,
  type ToolkitEmojiKey,
  type ToolkitNode,
} from '~/lib/rest-export'
import { RestExportEmojiPicker } from './RestExportEmojiPicker'

export function RestExportPreviewNode({
  node,
  depth,
  emoji,
  collapsedIds,
  onToggleFolder,
  onEmojiChange,
}: {
  node: ToolkitNode
  depth: number
  emoji: ToolkitEmojiConfig
  collapsedIds: ReadonlySet<string>
  onToggleFolder: (id: string) => void
  onEmojiChange: (key: ToolkitEmojiKey, next: string, options?: { category?: boolean }) => void
}) {
  const { t } = useTranslation()
  const indent = { paddingLeft: depth * 16 }
  if (node.type === 'folder') {
    const currentEmoji = node.emojiKey && emoji.enabled ? emojiForKey(node.emojiKey, emoji) : ''
    const open = !collapsedIds.has(node.id)
    return (
      <div>
        <div
          className={cn('flex items-center gap-0.5 py-px', depth === 0 && 'text-foreground')}
          style={indent}
        >
          <button
            type="button"
            className={cn(
              'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground',
              'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
            aria-expanded={open}
            aria-label={
              open ? t('restExportBuilder.collapseFolder') : t('restExportBuilder.expandFolder')
            }
            onClick={() => onToggleFolder(node.id)}
          >
            <ChevronRight
              className={cn('h-3 w-3 transition-transform duration-fast', open && 'rotate-90')}
              aria-hidden
            />
          </button>
          {emoji.enabled && node.emojiKey ? (
            <RestExportEmojiPicker
              emojiKey={node.emojiKey}
              emoji={emoji}
              onChange={onEmojiChange}
            />
          ) : null}
          <button
            type="button"
            className="min-w-0 truncate text-left font-medium text-xs hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onToggleFolder(node.id)}
          >
            {displayTitle(node.name, currentEmoji)}
          </button>
        </div>
        {open
          ? node.children.map((child, index) => (
              <RestExportPreviewNode
                key={child.type === 'folder' ? child.id : child.operation.id || index}
                node={child}
                depth={depth + 1}
                emoji={emoji}
                collapsedIds={collapsedIds}
                onToggleFolder={onToggleFolder}
                onEmojiChange={onEmojiChange}
              />
            ))
          : null}
      </div>
    )
  }

  const currentEmoji =
    node.operation.emojiKey && emoji.enabled ? emojiForKey(node.operation.emojiKey, emoji) : ''
  const docsUrl = node.operation.docsUrl

  return (
    <div className="flex items-center gap-0.5 py-px" style={indent}>
      {emoji.enabled && node.operation.emojiKey ? (
        <RestExportEmojiPicker
          emojiKey={node.operation.emojiKey}
          emoji={emoji}
          onChange={onEmojiChange}
        />
      ) : null}
      <p
        className="min-w-0 truncate font-mono text-[11px] text-muted-foreground"
        title={
          node.operation.description
            ? `${node.operation.method} ${node.operation.path}\n${node.operation.description}`
            : `${node.operation.method} ${node.operation.path}`
        }
      >
        <span className="mr-1.5 font-sans font-semibold text-[10px] text-foreground/70 uppercase">
          {node.operation.method}
        </span>
        {displayTitle(node.operation.label, currentEmoji)}
      </p>
      {docsUrl ? (
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground',
            'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          aria-label={t('restExportBuilder.openDocs')}
          title={t('restExportBuilder.openDocs')}
        >
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      ) : null}
    </div>
  )
}

function displayTitle(title: string, currentEmoji: string): string {
  if (currentEmoji && title.startsWith(`${currentEmoji} `)) {
    return title.slice(currentEmoji.length + 1)
  }
  return title
}
