import { Button, cn, Input, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import { Download, FileCode2, Plus, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import {
  buildSnippetPack,
  decodeSnippetPack,
  defaultSnippetPackFilename,
  downloadSnippetPackBytes,
  encodeSnippetPack,
  SNIPPET_PACK_EXTENSION,
  SNIPPET_PACK_MIME,
} from '~/lib/terminal/snippet-pack'
import {
  isValidSnippetName,
  type TerminalSnippet,
  useTerminalSnippetsStore,
} from '~/store/terminal-snippets'

export function snippetFileName(name: string): string {
  return `${name}.js`
}

type TerminalSnippetsFilesProps = {
  activeSnippetId: string | null
  /** Increment to open the inline “new file” name field (e.g. from empty state). */
  startCreateRequest?: number
  /** Native mobile shell — larger tabs and actions. */
  mobile?: boolean
  onOpenSnippet: (snippet: TerminalSnippet) => void
  onCloseSnippet: () => void
  onCreated: (snippet: TerminalSnippet) => void
  /** Optional status line for export/import feedback (parent may append to terminal). */
  onStatus?: (message: string) => void
}

/**
 * Inline snippet file tabs (name.js) — open / create / export / import without a modal.
 */
export function TerminalSnippetsFiles({
  activeSnippetId,
  startCreateRequest = 0,
  mobile = false,
  onOpenSnippet,
  onCloseSnippet,
  onCreated,
  onStatus,
}: TerminalSnippetsFilesProps) {
  const { t } = useTranslation()
  const snippets = useTerminalSnippetsStore((s) => s.snippets)
  const addSnippet = useTerminalSnippetsStore((s) => s.addSnippet)
  const importSnippets = useTerminalSnippetsStore((s) => s.importSnippets)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creating) {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }
  }, [creating])

  const startCreate = useCallback(() => {
    setCreating(true)
    setNewName('')
    setCreateError(null)
  }, [])

  useEffect(() => {
    if (startCreateRequest > 0) startCreate()
  }, [startCreateRequest, startCreate])

  const cancelCreate = () => {
    setCreating(false)
    setNewName('')
    setCreateError(null)
  }

  const commitCreate = () => {
    const trimmed = newName.trim()
    if (!isValidSnippetName(trimmed)) {
      setCreateError(t('terminal.snippets.invalidName'))
      return
    }
    const created = addSnippet({
      name: trimmed,
      code: '// ORDA snippet\n',
    })
    if (!created) {
      setCreateError(t('terminal.snippets.saveFailed'))
      return
    }
    cancelCreate()
    onCreated(created)
  }

  const handleExport = async () => {
    if (snippets.length === 0 || busy) return
    setBusy(true)
    setCreateError(null)
    try {
      const pack = buildSnippetPack(snippets)
      const bytes = await encodeSnippetPack(pack)
      await downloadSnippetPackBytes(bytes, defaultSnippetPackFilename())
      onStatus?.(t('terminal.snippets.exportDone', { count: snippets.length }))
    } catch {
      setCreateError(t('terminal.snippets.exportFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleImportFile = async (file: File | null) => {
    if (!file || busy) return
    setBusy(true)
    setCreateError(null)
    try {
      const buffer = await file.arrayBuffer()
      const decoded = await decodeSnippetPack(new Uint8Array(buffer))
      if (!decoded.ok) {
        setCreateError(t('terminal.snippets.importInvalid'))
        onStatus?.(decoded.error)
        return
      }
      const result = importSnippets(decoded.pack.snippets)
      onStatus?.(
        t('terminal.snippets.importDone', {
          added: result.added,
          skipped: result.skipped,
          failed: result.failed,
        })
      )
      if (result.added === 0 && result.skipped === 0 && result.failed > 0) {
        setCreateError(t('terminal.snippets.importFailed'))
      }
    } catch {
      setCreateError(t('terminal.snippets.importFailed'))
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', mobile ? 'shrink-0' : 'flex-1')}>
      <div
        className={cn(
          'flex min-w-0 items-center gap-1',
          mobile
            ? 'overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'overflow-x-auto'
        )}
      >
        {!mobile ? (
          <span className="mr-0.5 shrink-0 font-mono text-[9px] text-muted-foreground uppercase tracking-wide">
            {t('terminal.snippets.files')}
          </span>
        ) : null}
        {snippets.map((snippet) => {
          const active = snippet.id === activeSnippetId
          return (
            <div
              key={snippet.id}
              className={cn(
                'group inline-flex shrink-0 touch-manipulation items-center gap-0.5 rounded-md border font-mono transition-colors',
                mobile ? 'h-9 max-w-48 text-xs' : 'h-6 max-w-44 text-[10px]',
                active
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border/70 bg-background/60 text-muted-foreground hover:border-primary/35 hover:bg-primary/5 hover:text-foreground'
              )}
            >
              <button
                type="button"
                title={snippet.code.split('\n')[0] ?? snippet.name}
                onClick={() => onOpenSnippet(snippet)}
                className={cn(
                  'inline-flex min-w-0 flex-1 items-center gap-1 text-left',
                  mobile ? 'px-2.5 py-1.5' : 'px-1.5 py-0.5'
                )}
              >
                <FileCode2
                  className={cn('shrink-0 opacity-70', mobile ? 'h-3.5 w-3.5' : 'h-3 w-3')}
                  aria-hidden
                />
                <span className="truncate">{snippetFileName(snippet.name)}</span>
              </button>
              {active ? (
                <button
                  type="button"
                  className={cn(
                    'touch-manipulation rounded text-muted-foreground hover:bg-muted hover:text-foreground',
                    mobile ? 'mr-1 p-1.5' : 'mr-0.5 p-0.5'
                  )}
                  aria-label={t('terminal.snippets.closeFile')}
                  onClick={onCloseSnippet}
                >
                  <X className={mobile ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'} aria-hidden />
                </button>
              ) : null}
            </div>
          )
        })}

        {creating ? (
          <div
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-primary/35 bg-primary/5',
              mobile ? 'h-9 px-1.5' : 'h-6 px-1'
            )}
          >
            <FileCode2
              className={cn('shrink-0 text-primary/70', mobile ? 'h-3.5 w-3.5' : 'h-3 w-3')}
              aria-hidden
            />
            <Input
              ref={nameInputRef}
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                setCreateError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitCreate()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelCreate()
                }
              }}
              placeholder={t('terminal.snippets.namePlaceholder')}
              aria-label={t('terminal.snippets.name')}
              className={cn(
                'border-0 bg-transparent font-mono shadow-none focus-visible:ring-0',
                mobile ? 'h-8 w-32 px-1 py-0 text-xs' : 'h-5 w-24 px-0.5 py-0 text-[10px]'
              )}
            />
            <span
              className={cn(
                'pr-0.5 font-mono text-muted-foreground',
                mobile ? 'text-xs' : 'text-[10px]'
              )}
            >
              .js
            </span>
            <Button
              size={mobile ? 'sm' : 'xs'}
              variant="ghost"
              className={cn(mobile ? 'h-8 px-2 text-xs' : 'h-5 px-1 text-[10px]')}
              onClick={commitCreate}
            >
              {t('terminal.snippets.create')}
            </Button>
            <Button
              size={mobile ? 'sm' : 'xs'}
              variant="ghost"
              className={cn(mobile ? 'h-8 w-8 p-0' : 'h-5 w-5 p-0')}
              aria-label={t('terminal.snippets.cancel')}
              onClick={cancelCreate}
            >
              <X className={mobile ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
            </Button>
          </div>
        ) : (
          <Button
            size={mobile ? 'sm' : 'xs'}
            variant="outline"
            className={cn(
              'shrink-0 touch-manipulation gap-1 border-border/70 bg-background/60 text-muted-foreground hover:border-primary/35 hover:bg-primary/5 hover:text-foreground',
              mobile ? 'h-9 px-2.5 text-xs' : 'h-6 px-1.5 text-[10px]'
            )}
            onClick={startCreate}
          >
            <Plus className={mobile ? 'h-3.5 w-3.5' : 'h-3 w-3'} aria-hidden />
            {t('terminal.snippets.newFile')}
          </Button>
        )}

        <TooltipProvider>
          <div
            className={cn(
              'ml-0.5 flex shrink-0 items-center border-border/50 border-l',
              mobile ? 'gap-0.5 pl-1.5' : 'gap-0.5 pl-1'
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size={mobile ? 'sm' : 'xs'}
                  variant="ghost"
                  className={cn(
                    'touch-manipulation text-muted-foreground',
                    mobile ? 'h-9 w-9 p-0' : 'h-6 w-6 p-0'
                  )}
                  aria-label={t('terminal.snippets.export')}
                  disabled={snippets.length === 0 || busy}
                  onClick={() => void handleExport()}
                >
                  <Download className={mobile ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('terminal.snippets.export')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size={mobile ? 'sm' : 'xs'}
                  variant="ghost"
                  className={cn(
                    'touch-manipulation text-muted-foreground',
                    mobile ? 'h-9 w-9 p-0' : 'h-6 w-6 p-0'
                  )}
                  aria-label={t('terminal.snippets.import')}
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className={mobile ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('terminal.snippets.import')}</TooltipContent>
            </Tooltip>
            {/* Native file input — no @4d/ui FilePicker for gzip pack pick */}
            <input
              ref={fileInputRef}
              type="file"
              accept={`${SNIPPET_PACK_EXTENSION},.gz,${SNIPPET_PACK_MIME},application/octet-stream`}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                void handleImportFile(e.target.files?.[0] ?? null)
              }}
            />
          </div>
        </TooltipProvider>
      </div>
      {createError ? (
        <p className={cn('text-destructive', mobile ? 'text-xs' : 'text-[10px]')} role="alert">
          {createError}
        </p>
      ) : null}
    </div>
  )
}
