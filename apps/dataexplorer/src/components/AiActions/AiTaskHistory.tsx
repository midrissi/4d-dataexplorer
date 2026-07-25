import { Button, ClickToCopy, cn, ScrollArea, useConfirm, useEscapeToDismiss } from '@4d/ui'
import { getWidgetRenderPropsFromResult, type WidgetMode, WidgetRenderer } from '@4djs/ai-widgets'
import { AssistantProvider, ChatActivity } from '@4djs/assistant'
import type { ChatActivityStep } from '@4djs/assistant/core'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleX,
  Copy,
  Database,
  Filter,
  History,
  Loader2,
  MessageCircle,
  StopCircle,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { dataExplorerToolRegistry } from '~/assistant/tool-registry'
import { ObjectTree } from '~/components/Console/ObjectTree'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { getAssistantLabelOverrides } from '~/i18n/assistant-ui'
import { cancelAiTask, cancelAllAiTasks, resolveAiTaskResultValue } from '~/lib/ai-task-runner'
import {
  type AiAskInput,
  type AiGenerateInput,
  type AiQueryInput,
  type AiTask,
  type AiTaskKind,
  type AiTaskStatus,
  useAiTasksStore,
} from '~/store/ai-tasks'
import { usePendingAiInteraction } from './AiTaskInteractiveHost'
import { AiTaskMarkdown } from './AiTaskMarkdown'
import './ai-actions.css'
import '@4djs/ai-widgets/styles.css'

function resolveHostWidgetMode(): WidgetMode {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function tryParseJsonValue(raw: string): unknown | undefined {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

function AiTaskResultSummary({ value }: { value: unknown }) {
  // Prefer the live/full tool result so Console ObjectTree copy is not a compacted preview.
  if (value !== null && typeof value === 'object') {
    return (
      <div className="ai-task-result-tree max-h-64 overflow-auto rounded-md border bg-muted/20 px-2 py-1.5">
        <div className="w-max min-w-full">
          <ObjectTree value={value} />
        </div>
      </div>
    )
  }
  if (typeof value === 'string') {
    const parsed = tryParseJsonValue(value)
    if (parsed !== undefined && typeof parsed === 'object') {
      return (
        <div className="ai-task-result-tree max-h-64 overflow-auto rounded-md border bg-muted/20 px-2 py-1.5">
          <div className="w-max min-w-full">
            <ObjectTree value={parsed} />
          </div>
        </div>
      )
    }
    return <p className="whitespace-pre-wrap text-sm">{value}</p>
  }
  if (value === undefined || value === null) return null
  return <p className="whitespace-pre-wrap text-sm">{String(value)}</p>
}

function collectTaskWidgets(steps: ChatActivityStep[]) {
  const widgets: Array<
    NonNullable<ReturnType<typeof getWidgetRenderPropsFromResult>> & { key: string }
  > = []
  for (const step of steps) {
    if (step.error || step.status === 'active') continue
    const props = getWidgetRenderPropsFromResult(step.result)
    if (!props) continue
    widgets.push({
      ...props,
      mode: props.mode ?? resolveHostWidgetMode(),
      key: step.id,
    })
  }
  return widgets
}

function statusIcon(status: AiTaskStatus) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
    case 'done':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
    case 'error':
      return <XCircle className="h-3.5 w-3.5 text-destructive" />
    case 'cancelled':
      return <CircleX className="h-3.5 w-3.5 text-muted-foreground" />
  }
}

function formatRelativeTime(
  timestamp: number,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  const delta = Date.now() - timestamp
  const seconds = Math.floor(delta / 1000)
  if (seconds < 60) return t('aiActions.justNow')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('aiActions.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('aiActions.hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  return t('aiActions.daysAgo', { count: days })
}

function taskKindLabel(
  kind: AiTaskKind,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (kind === 'generate') return t('aiActions.generate')
  if (kind === 'query') return t('aiActions.query')
  return t('aiActions.ask')
}

function taskKindIcon(kind: AiTaskKind) {
  if (kind === 'generate') return Database
  if (kind === 'query') return Filter
  return MessageCircle
}

function taskInputSummary(
  task: AiTask,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (task.kind === 'generate') {
    const input = task.input as AiGenerateInput
    return t('aiActions.generateSummary', { count: input.count })
  }
  const input = task.input as AiAskInput | AiQueryInput
  const prompt = input.prompt.trim()
  return prompt.length > 80 ? `${prompt.slice(0, 80)}…` : prompt
}

/** Plain text for the Input section copy control. */
function taskInputCopyText(task: AiTask): string {
  if (task.kind === 'generate') {
    const input = task.input as AiGenerateInput
    const lines = [`count: ${input.count}`]
    if (input.styles.length > 0) lines.push(`styles: ${input.styles.join(', ')}`)
    if (input.prompt.trim()) lines.push(input.prompt.trim())
    return lines.join('\n')
  }
  return (task.input as AiAskInput | AiQueryInput).prompt.trim()
}

function AiTaskChatActivity({
  steps,
  streaming,
}: {
  steps: ChatActivityStep[]
  streaming?: boolean
}) {
  const { language } = useTranslation()
  const config = useMemo(
    () => ({
      toolRegistry: dataExplorerToolRegistry,
      storageKeys: {
        history: 'dataexplorer-ai-task-activity-ui',
        llmSettings: 'dataexplorer-llm-settings',
      },
      labels: getAssistantLabelOverrides(language),
      autoLoadLlmStatus: false as const,
      welcomeMessage: () => ({
        id: 'ai-task-activity',
        role: 'assistant' as const,
        content: '',
        timestamp: Date.now(),
      }),
    }),
    [language]
  )

  if (steps.length === 0) return null

  return (
    <AssistantProvider config={config}>
      <ChatActivity steps={steps} streaming={streaming} />
    </AssistantProvider>
  )
}

function AiTaskWidgets({ steps }: { steps: ChatActivityStep[] }) {
  const widgets = collectTaskWidgets(steps)
  if (widgets.length === 0) return null

  return (
    <div className="ai-task-widgets space-y-3">
      {widgets.map((widget) => (
        <WidgetRenderer
          key={widget.key}
          widgetId={widget.widgetId}
          title={widget.title}
          mode={widget.mode}
          theme={widget.theme}
          data={widget.data}
          options={widget.options}
        />
      ))}
    </div>
  )
}

/** Live provider stream during the thinking / pre-tool phase — light grey, expandable. */
function AiThinkingStream({ content, streaming }: { content: string; streaming: boolean }) {
  const { t } = useTranslation()
  const trimmed = content.trim()
  const hasContent = trimmed.length > 0
  const [expanded, setExpanded] = useState(false)

  const preview = hasContent
    ? (() => {
        const plain = trimmed
          .replace(/\|/g, ' ')
          .replace(/^#{1,6}\s+/gm, '')
          .replace(/[*_`#>[\]]+/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        return plain.length > 72 ? `${plain.slice(0, 72)}…` : plain
      })()
    : null

  return (
    <section className="overflow-hidden rounded-md border border-border/60 bg-muted/10 text-xs">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/30"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-90'
          )}
        />
        {streaming ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <MessageCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="shrink-0 font-medium text-muted-foreground">
          {t('aiActions.thinking')}
        </span>
        {!expanded && preview ? (
          <span className="min-w-0 flex-1 truncate text-muted-foreground/70">{preview}</span>
        ) : (
          <span className="flex-1" />
        )}
      </button>
      {expanded ? (
        <div className="border-border/50 border-t px-3 py-2.5">
          {hasContent ? (
            <div className="ai-task-thinking-stream max-h-64 overflow-x-auto overflow-y-auto">
              <AiTaskMarkdown
                content={content}
                streaming={streaming}
                className="ai-task-markdown ai-task-thinking-markdown min-w-0 max-w-full"
              />
            </div>
          ) : (
            <p className="text-muted-foreground/70 text-xs">{t('aiActions.thinkingEmpty')}</p>
          )}
        </div>
      ) : null}
    </section>
  )
}

function AiTaskDetailView({ task }: { task: AiTask }) {
  const { t } = useTranslation()
  const clearSelectedTask = useAiTasksStore((state) => state.clearSelectedTask)
  const inputCopyText = taskInputCopyText(task)
  const showMarkdown = Boolean(task.content.trim()) && task.status !== 'running'
  const showResponse = collectTaskWidgets(task.activity).length > 0 || showMarkdown
  const resultValue =
    task.status === 'done'
      ? (resolveAiTaskResultValue(task.kind, task.activity, task.content) ?? task.resultSummary)
      : undefined
  const hasResult = resultValue !== undefined && resultValue !== null && resultValue !== ''

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <Button type="button" variant="ghost" size="iconXs" onClick={clearSelectedTask}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {statusIcon(task.status)}
            <h3 className="truncate font-medium text-sm">
              {taskKindLabel(task.kind, t)}
              <span className="text-muted-foreground"> · {task.dataclassName}</span>
            </h3>
          </div>
          <p className="truncate text-muted-foreground text-xs">{taskInputSummary(task, t)}</p>
        </div>
        {task.status === 'running' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1"
            onClick={() => cancelAiTask(task.id)}
          >
            <StopCircle className="h-3.5 w-3.5" />
            {t('aiActions.cancel')}
          </Button>
        ) : null}
      </div>

      <ScrollArea className="ai-task-detail-scroll min-h-0 w-full min-w-0 flex-1">
        <div className="box-border w-full max-w-full space-y-4 p-4">
          <section className="min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {t('aiActions.input')}
              </h4>
              {inputCopyText ? (
                <ClickToCopy
                  value={inputCopyText}
                  tooltipLabel={t('aiActions.copyPrompt')}
                  tooltipCopiedLabel={t('aiActions.copyTraceSuccess')}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={t('aiActions.copyPrompt')}
                >
                  <Copy className="h-3 w-3" />
                </ClickToCopy>
              ) : null}
            </div>
            <div className="min-w-0 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {task.kind === 'generate' ? (
                <dl className="space-y-1 text-xs">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">{t('aiActions.count')}</dt>
                    <dd>{(task.input as AiGenerateInput).count}</dd>
                  </div>
                  {(task.input as AiGenerateInput).styles.length > 0 ? (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">{t('aiActions.styles')}</dt>
                      <dd className="wrap-break-word min-w-0">
                        {(task.input as AiGenerateInput).styles.join(', ')}
                      </dd>
                    </div>
                  ) : null}
                  {(task.input as AiGenerateInput).prompt.trim() ? (
                    <div className="min-w-0">
                      <dt className="mb-0.5 text-muted-foreground">
                        {t('aiActions.additionalPrompt')}
                      </dt>
                      <dd className="wrap-break-word whitespace-pre-wrap">
                        {(task.input as AiGenerateInput).prompt}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="wrap-break-word whitespace-pre-wrap text-xs">
                  {(task.input as AiAskInput).prompt}
                </p>
              )}
            </div>
          </section>

          {task.status === 'running' ? <AiThinkingStream content={task.content} streaming /> : null}

          {showResponse ? (
            <section className="min-w-0 space-y-1.5">
              <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {t('aiActions.response')}
              </h4>
              <div className="min-w-0 max-w-full space-y-2 overflow-x-auto rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs">
                <AiTaskWidgets steps={task.activity} />
                {showMarkdown ? (
                  <AiTaskMarkdown
                    content={task.content}
                    streaming={false}
                    className="ai-task-markdown min-w-0 max-w-full"
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          {task.activity.length > 0 ? (
            <AiTaskChatActivity steps={task.activity} streaming={task.status === 'running'} />
          ) : null}

          {task.error ? (
            <section className="wrap-break-word min-w-0 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm">
              {task.error}
            </section>
          ) : null}

          {hasResult ? (
            <section className="min-w-0 space-y-1.5">
              <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {t('aiActions.result')}
              </h4>
              <AiTaskResultSummary value={resultValue} />
            </section>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}

function AiTaskList() {
  const { t } = useTranslation()
  const { confirm, ConfirmDialog } = useConfirm()
  const tasks = useAiTasksStore((state) => state.tasks)
  const openTask = useAiTasksStore((state) => state.openTask)
  const removeTask = useAiTasksStore((state) => state.removeTask)
  const clearTasks = useAiTasksStore((state) => state.clearTasks)
  const runningCount = tasks.filter((task) => task.status === 'running').length

  if (tasks.length === 0) {
    return (
      <EmptyPanel
        icon={History}
        title={t('aiActions.historyEmptyTitle')}
        description={t('aiActions.historyEmptyDescription')}
        ghost="none"
        size="sm"
        className="min-h-0 flex-1"
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConfirmDialog />
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <p className="text-muted-foreground text-xs">
          {t('aiActions.historyCount', { count: tasks.length })}
        </p>
        <div className="flex items-center gap-1">
          {runningCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-destructive"
              onClick={() => cancelAllAiTasks()}
            >
              <StopCircle className="h-3.5 w-3.5" />
              {t('aiActions.cancelAll')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-muted-foreground"
            onClick={async () => {
              const ok = await confirm({
                title: t('aiActions.clearHistoryTitle'),
                description: t('aiActions.clearHistoryDescription'),
                confirmText: t('common.clear'),
                cancelText: t('common.cancel'),
              })
              if (ok) clearTasks()
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('aiActions.clearHistory')}
          </Button>
        </div>
      </div>
      <ScrollArea className="ai-task-history-scroll min-h-0 min-w-0 flex-1">
        <ul className="w-full min-w-0 divide-y pr-1">
          {tasks.map((task) => {
            const KindIcon = taskKindIcon(task.kind)
            return (
              <li
                key={task.id}
                className="group flex w-full min-w-0 items-stretch transition-colors hover:bg-muted/50"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-3 py-3 pr-2 pl-4 text-left"
                  onClick={() => openTask(task.id)}
                >
                  <span className="mt-0.5 shrink-0">{statusIcon(task.status)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <KindIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-sm">{taskKindLabel(task.kind, t)}</span>
                      <span className="truncate text-muted-foreground text-xs">
                        {task.dataclassName}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-muted-foreground text-xs">
                      {taskInputSummary(task, t)}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground/80">
                      {formatRelativeTime(task.createdAt, t)}
                      {' · '}
                      {t(`aiActions.status.${task.status}`)}
                    </span>
                  </span>
                </button>
                <div className="flex w-9 shrink-0 items-start justify-center pt-2.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  {task.status === 'running' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="iconXs"
                      className="text-destructive"
                      onClick={(event) => {
                        event.stopPropagation()
                        cancelAiTask(task.id)
                      }}
                      aria-label={t('aiActions.cancel')}
                    >
                      <StopCircle className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="iconXs"
                      className="text-muted-foreground"
                      onClick={(event) => {
                        event.stopPropagation()
                        removeTask(task.id)
                      }}
                      aria-label={t('aiActions.removeTask')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}

const AI_TASK_HISTORY_SIZE_KEY = 'dataexplorer.ai-task-history-size'
const MIN_WIDTH_PX = 360
const MIN_HEIGHT_PX = 320
const DEFAULT_WIDTH_PX = 512
const DEFAULT_HEIGHT_PX = 560

type AiTaskHistorySize = { width: number; height: number }
type AiTaskHistoryResizeAxis = 'width' | 'height' | 'both'

function maxWidthPx(): number {
  return Math.max(MIN_WIDTH_PX, Math.round(window.innerWidth * 0.96))
}

function maxHeightPx(): number {
  return Math.max(MIN_HEIGHT_PX, Math.round(window.innerHeight * 0.9))
}

function clampSize(size: AiTaskHistorySize): AiTaskHistorySize {
  return {
    width: Math.min(maxWidthPx(), Math.max(MIN_WIDTH_PX, Math.round(size.width))),
    height: Math.min(maxHeightPx(), Math.max(MIN_HEIGHT_PX, Math.round(size.height))),
  }
}

function readStoredSize(): AiTaskHistorySize | null {
  try {
    const raw = localStorage.getItem(AI_TASK_HISTORY_SIZE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AiTaskHistorySize>
    if (
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number' ||
      !Number.isFinite(parsed.width) ||
      !Number.isFinite(parsed.height)
    ) {
      return null
    }
    return clampSize({ width: parsed.width, height: parsed.height })
  } catch {
    return null
  }
}

function writeStoredSize(size: AiTaskHistorySize): void {
  try {
    localStorage.setItem(AI_TASK_HISTORY_SIZE_KEY, JSON.stringify(clampSize(size)))
  } catch {
    // ignore quota / private mode
  }
}

function clearStoredSize(): void {
  try {
    localStorage.removeItem(AI_TASK_HISTORY_SIZE_KEY)
  } catch {
    // ignore
  }
}

export function AiTaskHistoryDialog() {
  const { t } = useTranslation()
  const historyOpen = useAiTasksStore((state) => state.historyOpen)
  const setHistoryOpen = useAiTasksStore((state) => state.setHistoryOpen)
  const selectedTaskId = useAiTasksStore((state) => state.selectedTaskId)
  const selectedTask = useAiTasksStore((state) =>
    state.selectedTaskId ? state.tasks.find((task) => task.id === state.selectedTaskId) : undefined
  )
  const pending = usePendingAiInteraction()
  const waitingForInput = pending !== null

  const dismissHistory = useCallback(() => {
    // Read fresh store state so rapid Escapes can pop detail then close the panel.
    const {
      selectedTaskId: selectedId,
      clearSelectedTask,
      setHistoryOpen: setOpen,
    } = useAiTasksStore.getState()
    if (selectedId) {
      clearSelectedTask()
      return
    }
    setOpen(false)
  }, [])

  useEscapeToDismiss(historyOpen, dismissHistory, { enabled: !waitingForInput })

  const panelRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<AiTaskHistorySize | null>(() => readStoredSize())
  const [resizeAxis, setResizeAxis] = useState<AiTaskHistoryResizeAxis | null>(null)
  const startPointerRef = useRef({ x: 0, y: 0, width: 0, height: 0 })

  const applySize = useCallback((next: AiTaskHistorySize) => {
    const clamped = clampSize(next)
    writeStoredSize(clamped)
    setSize(clamped)
  }, [])

  const resetSize = useCallback(() => {
    setSize(null)
    clearStoredSize()
  }, [])

  const beginResize = useCallback((axis: AiTaskHistoryResizeAxis, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = panelRef.current?.getBoundingClientRect()
    startPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      width: rect?.width ?? DEFAULT_WIDTH_PX,
      height: rect?.height ?? DEFAULT_HEIGHT_PX,
    }
    setResizeAxis(axis)
  }, [])

  useEffect(() => {
    if (!resizeAxis) return

    const handleMouseMove = (event: MouseEvent) => {
      const start = startPointerRef.current
      const deltaX = event.clientX - start.x
      const deltaY = event.clientY - start.y
      applySize({
        width: resizeAxis === 'height' ? start.width : start.width + deltaX,
        height: resizeAxis === 'width' ? start.height : start.height + deltaY,
      })
    }
    const handleMouseUp = () => setResizeAxis(null)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor =
      resizeAxis === 'width' ? 'ew-resize' : resizeAxis === 'height' ? 'ns-resize' : 'nwse-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizeAxis, applySize])

  useEffect(() => {
    const onWindowResize = () => {
      setSize((current) => (current == null ? current : clampSize(current)))
    }
    window.addEventListener('resize', onWindowResize)
    return () => window.removeEventListener('resize', onWindowResize)
  }, [])

  if (!historyOpen) return null

  const panelStyle =
    size != null
      ? {
          width: `min(${size.width}px, 96vw)`,
          height: `min(${size.height}px, 90vh)`,
          maxWidth: '96vw',
          maxHeight: '90vh',
        }
      : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label={t('common.close')}
        onClick={() => setHistoryOpen(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('aiActions.historyTitle')}
        className={cn(
          'ai-task-history-dialog relative z-10 flex w-full min-w-0 flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-xl sm:rounded-2xl',
          size == null && 'h-[min(560px,85vh)] max-w-lg',
          resizeAxis && 'ai-task-history-dialog--resizing'
        )}
        style={panelStyle}
      >
        <div className="flex items-center justify-between border-border border-b px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
              <History className="h-4 w-4 text-primary" />
              {waitingForInput ? (
                <span
                  className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_2px] shadow-background"
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-sm tracking-tight">
                {t('aiActions.historyTitle')}
              </h2>
              {waitingForInput ? (
                <p className="truncate text-[11px] text-muted-foreground">
                  {t('aiActions.tasksWaiting')}
                </p>
              ) : null}
            </div>
          </div>
          <Button type="button" variant="ghost" size="iconXs" onClick={() => setHistoryOpen(false)}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
        {selectedTaskId && selectedTask ? (
          <AiTaskDetailView task={selectedTask} />
        ) : selectedTaskId && !selectedTask ? (
          <EmptyPanel
            icon={History}
            title={t('aiActions.taskNotFound')}
            ghost="none"
            size="sm"
            className="min-h-0 flex-1"
          />
        ) : (
          <AiTaskList />
        )}

        <button
          type="button"
          className={cn(
            'ai-task-history-dialog__resize-edge ai-task-history-dialog__resize-edge--right',
            resizeAxis === 'width' && 'ai-task-history-dialog__resize-edge--active'
          )}
          onMouseDown={(event) => beginResize('width', event)}
          onDoubleClick={resetSize}
          aria-label={t('aiActions.resizeWidthAria')}
          title={t('aiActions.resizeHint')}
        />
        <button
          type="button"
          className={cn(
            'ai-task-history-dialog__resize-edge ai-task-history-dialog__resize-edge--bottom',
            resizeAxis === 'height' && 'ai-task-history-dialog__resize-edge--active'
          )}
          onMouseDown={(event) => beginResize('height', event)}
          onDoubleClick={resetSize}
          aria-label={t('aiActions.resizeHeightAria')}
          title={t('aiActions.resizeHint')}
        />
        <button
          type="button"
          className={cn(
            'ai-task-history-dialog__resize-corner',
            resizeAxis === 'both' && 'ai-task-history-dialog__resize-corner--active'
          )}
          onMouseDown={(event) => beginResize('both', event)}
          onDoubleClick={resetSize}
          aria-label={t('aiActions.resizeAria')}
          title={t('aiActions.resizeHint')}
        />
      </div>
    </div>
  )
}
