import {
  ChatAbortedError,
  type ChatActivityStep,
  LlmNotConfiguredError,
  resolveInteractiveToolResult,
  runLlmAgent,
} from '@4djs/assistant/core'
import { dataExplorerToolRegistry } from '~/assistant/tool-registry'
import {
  AI_ASK_ALLOWED_TOOLS,
  AI_ASK_WRITE_TOOLS,
  AI_GENERATE_ALLOWED_TOOLS,
  AI_QUERY_ALLOWED_TOOLS,
  buildAskUserMessage,
  buildGenerateQueryUserMessage,
  buildGenerateUserMessage,
  GENERATE_QUERY_SET_OPTIONS_FOLLOW_UP,
} from '~/lib/ai-actions'
import { client } from '~/lib/api'
import {
  CLOUD_LLM_OFFLINE_ERROR,
  isAssistantLlmConfigured,
  isCloudLlmOffline,
} from '~/lib/assistant-llm-configured'
import { eventBus } from '~/lib/eventBus'
import {
  type AiAskInput,
  type AiGenerateInput,
  type AiQueryInput,
  type AiTaskKind,
  createAiTaskId,
  useAiTasksStore,
} from '~/store/ai-tasks'
import { useSettingsStore } from '~/store/settings'

const abortControllers = new Map<string, AbortController>()

function summarizeDataclassSchema(
  dataclassName: string,
  catalog: Awaited<ReturnType<typeof client.catalog.getAllWithMetadataCached>>,
  options?: {
    omitVectorAttributes?: boolean
    /** Entity counts keyed by dataclass name (for plan-first relation analysis). */
    entityCounts?: Record<string, number>
  }
): string {
  const dc = catalog.dataClasses?.find((item) => item.name === dataclassName)
  if (!dc) {
    return `(Dataclass "${dataclassName}" not found in catalog.)`
  }

  const attrs = (dc.attributes ?? [])
    .filter(
      (attr) =>
        attr.kind === 'storage' ||
        attr.kind === 'calculated' ||
        attr.kind === 'relatedEntity' ||
        attr.kind === 'relatedEntities' ||
        !attr.kind
    )
    .filter((attr) => !(options?.omitVectorAttributes && isVectorAttribute(attr)))
    .slice(0, 80)
    .map((attr) => formatSchemaAttribute(attr, catalog, options?.entityCounts))

  const keyNames = (dc.key ?? []).map((k) => k.name).filter(Boolean)
  const keyLine = keyNames.length > 0 ? `Primary key: ${keyNames.join(', ')}\n` : ''
  const selfCount = options?.entityCounts?.[dataclassName]
  const countLine = typeof selfCount === 'number' ? `Entity count: ${selfCount}\n` : ''

  const relatedNames = listRelatedDataclassNames(dc)
  const relatedCountLines = relatedNames
    .map((name) => {
      const count = options?.entityCounts?.[name]
      return typeof count === 'number' ? `- ${name}: ${count} entities` : null
    })
    .filter((line): line is string => line != null)
  const relatedCountsBlock =
    relatedCountLines.length > 0
      ? `Related dataclass counts (use to pick the smaller side before fetching):\n${relatedCountLines.join('\n')}\n`
      : ''

  return `${keyLine}${countLine}${relatedCountsBlock}Attributes:\n${attrs.length > 0 ? attrs.join('\n') : '(no attributes)'}`
}

/** Related dataclass names from relatedEntity / relatedEntities attributes. */
function listRelatedDataclassNames(dc: {
  attributes?: Array<{ kind?: string; type?: string; path?: string }>
}): string[] {
  const names = new Set<string>()
  for (const attr of dc.attributes ?? []) {
    if (attr.kind !== 'relatedEntity' && attr.kind !== 'relatedEntities') continue
    const relatedName = (attr.type || attr.path || '').trim()
    if (relatedName) names.add(relatedName)
  }
  return [...names]
}

async function fetchEntityCounts(names: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(names.filter(Boolean))]
  const entries = await Promise.all(
    unique.map(async (name) => {
      try {
        const count = await client.dataclass(name).count()
        return [name, count] as const
      } catch {
        return null
      }
    })
  )
  const out: Record<string, number> = {}
  for (const entry of entries) {
    if (entry) out[entry[0]] = entry[1]
  }
  return out
}

function formatSchemaAttribute(
  attr: {
    name?: string
    type?: string
    kind?: string
    readOnly?: boolean
    foreignKey?: string
    path?: string
  },
  catalog: Awaited<ReturnType<typeof client.catalog.getAllWithMetadataCached>>,
  entityCounts?: Record<string, number>
): string {
  const name = attr.name ?? '?'
  const kind = attr.kind ?? 'storage'

  if (kind === 'relatedEntity' || kind === 'relatedEntities') {
    const relatedName = (attr.type || attr.path || 'unknown').trim()
    const bits = [`${name}: ${kind} → ${relatedName}`]
    if (attr.foreignKey) bits.push(`FK ${attr.foreignKey}`)
    const relatedCount = entityCounts?.[relatedName]
    if (typeof relatedCount === 'number') bits.push(`${relatedCount} entities`)
    const relatedFields = listRelatedFilterFields(relatedName, catalog)
    if (relatedFields.length > 0) {
      bits.push(`dotted filters: ${relatedFields.map((f) => `${name}.${f}`).join(', ')}`)
    }
    return `- ${bits.join('; ')}`
  }

  const bits = [`${name}: ${attr.type ?? 'unknown'}`]
  if (kind !== 'storage') bits.push(`kind=${kind}`)
  if (attr.readOnly) bits.push('readOnly')
  return `- ${bits.join(', ')}`
}

/** Scalar fields on a related dataclass for dotted-path filter hints. */
function listRelatedFilterFields(
  relatedName: string,
  catalog: Awaited<ReturnType<typeof client.catalog.getAllWithMetadataCached>>
): string[] {
  const related = catalog.dataClasses?.find((item) => item.name === relatedName)
  if (!related?.attributes?.length) return []

  const preferNameLike = (n: string) => {
    const lower = n.toLowerCase()
    return (
      lower.includes('name') ||
      lower.includes('nom') ||
      lower === 'title' ||
      lower === 'label' ||
      lower === 'code'
    )
  }

  const scalars = related.attributes
    .filter((a) => a.kind === 'storage' || a.kind === 'calculated' || !a.kind)
    .filter((a) => {
      const t = (a.type ?? '').toLowerCase()
      return (
        t === 'string' ||
        t === 'long' ||
        t === 'long64' ||
        t === 'number' ||
        t === 'bool' ||
        t === 'date'
      )
    })
    .map((a) => a.name)
    .filter((n): n is string => Boolean(n))

  const named = scalars.filter(preferNameLike)
  const rest = scalars.filter((n) => !preferNameLike(n))
  return [...named, ...rest].slice(0, 6)
}

/** 4D embedding fields typed as object + classID `4D.Vector` (or type `vector`). */
function isVectorAttribute(attr: {
  name?: string
  type?: string
  classID?: string
  class?: string
}): boolean {
  const classId = (attr.classID ?? attr.class ?? '').trim().toLowerCase()
  if (classId === '4d.vector' || classId.endsWith('.vector')) return true
  const type = (attr.type ?? '').trim().toLowerCase()
  return type === 'vector'
}

function allowedToolsForKind(kind: AiTaskKind, readonlyMode: boolean): Set<string> {
  if (kind === 'generate') return AI_GENERATE_ALLOWED_TOOLS
  if (kind === 'query') return AI_QUERY_ALLOWED_TOOLS
  if (!readonlyMode) return AI_ASK_ALLOWED_TOOLS
  return new Set([...AI_ASK_ALLOWED_TOOLS].filter((name) => !AI_ASK_WRITE_TOOLS.has(name)))
}

/**
 * Temporarily activate allowlisted tools that are registered but inactive
 * (e.g. widgets namespace disabled in chat prefs) so Ask tasks can still use
 * `@widgets/render` from their explicit allowlist.
 */
function activateAllowlistedTools(allowed: Set<string>): () => void {
  const toRestore: string[] = []
  for (const name of allowed) {
    if (!dataExplorerToolRegistry.has(name)) continue
    if (dataExplorerToolRegistry.isActive(name)) continue
    dataExplorerToolRegistry.activate(name)
    toRestore.push(name)
  }
  return () => {
    for (const name of toRestore) {
      dataExplorerToolRegistry.deactivate(name)
    }
  }
}

function activityMutatedData(activity: ChatActivityStep[]): boolean {
  return activity.some(
    (step) =>
      step.status === 'done' &&
      (step.name.includes('/create') ||
        step.name.includes('/update') ||
        step.name.includes('/delete'))
  )
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

/** Max nesting for compacted containers (primitives are never depth-truncated). */
const COMPACT_MAX_DEPTH = 8
/** Keep enough array items for chart/widget series; still cap huge entity dumps. */
const COMPACT_ARRAY_LIMIT = 40
/** Skip compaction when the full JSON fits — preserves widget labels/values. */
const FULL_RESULT_SUMMARY_MAX_CHARS = 12_000

/** Shrink large tool results into valid, tree-friendly JSON. */
export function compactResultValue(value: unknown, depth = 0): unknown {
  // Primitives first — depth must not turn numbers/labels into "…"
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 120) return `${value.slice(0, 120)}…`
    return value
  }
  if (depth > COMPACT_MAX_DEPTH) return '…'
  if (Array.isArray(value)) {
    const items = value
      .slice(0, COMPACT_ARRAY_LIMIT)
      .map((item) => compactResultValue(item, depth + 1))
    if (value.length > COMPACT_ARRAY_LIMIT) {
      items.push(`… +${value.length - COMPACT_ARRAY_LIMIT} more`)
    }
    return items
  }
  const entries = Object.entries(value as Record<string, unknown>)
  const out: Record<string, unknown> = {}
  const limit = depth === 0 ? 20 : 12
  for (const [key, item] of entries.slice(0, limit)) {
    out[key] = compactResultValue(item, depth + 1)
  }
  if (entries.length > limit) out['…'] = `+${entries.length - limit} more`
  return out
}

export function formatToolResultSummary(result: unknown): string | undefined {
  const parsed = parseMaybeJson(result)
  if (parsed !== null && typeof parsed === 'object') {
    try {
      const full = JSON.stringify(parsed)
      // Small payloads (widgets, counts, open-tab) keep full values for the Result tree.
      if (full.length <= FULL_RESULT_SUMMARY_MAX_CHARS) return full
      return JSON.stringify(compactResultValue(parsed))
    } catch {
      /* fall through */
    }
  }
  try {
    const raw = typeof result === 'string' ? result : JSON.stringify(result)
    return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw
  } catch {
    return String(result)
  }
}

/** Pick the primary tool result for a finished task (full value, not compacted). */
export function resolveAiTaskResultValue(
  kind: AiTaskKind,
  activity: ChatActivityStep[],
  content: string
): unknown | undefined {
  if (kind === 'generate') {
    const createStep = [...activity]
      .reverse()
      .find((step) => step.name.includes('create') && step.status === 'done')
    if (createStep?.result !== undefined) return createStep.result
  }
  if (kind === 'ask') {
    const openStep = [...activity]
      .reverse()
      .find(
        (step) =>
          (step.name.includes('open-tab') || step.name.includes('open-filtered-tab')) &&
          step.status === 'done'
      )
    if (openStep) {
      return openStep.result !== undefined ? openStep.result : 'Opened results in a tab'
    }
    const deleteStep = [...activity]
      .reverse()
      .find((step) => step.name.includes('/delete') && step.status === 'done')
    if (deleteStep) {
      return deleteStep.result !== undefined ? deleteStep.result : 'Deleted records'
    }
    const toolWithResult = [...activity]
      .reverse()
      .find((step) => step.status === 'done' && step.result !== undefined)
    if (toolWithResult?.result !== undefined) return toolWithResult.result
  }
  if (kind === 'query') {
    const setOptionsStep = [...activity]
      .reverse()
      .find((step) => step.name.includes('set-options') && step.status === 'done')
    if (setOptionsStep?.result !== undefined) return setOptionsStep.result
    const toolWithResult = [...activity]
      .reverse()
      .find((step) => step.status === 'done' && step.result !== undefined)
    if (toolWithResult?.result !== undefined) return toolWithResult.result
  }
  const trimmed = content.trim()
  return trimmed || undefined
}

function resultSummaryFromActivity(
  kind: AiTaskKind,
  activity: ChatActivityStep[],
  content: string
): string | undefined {
  const value = resolveAiTaskResultValue(kind, activity, content)
  if (value === undefined) return undefined
  if (typeof value === 'string') {
    return value.length > 200 ? `${value.slice(0, 200)}…` : value
  }
  return formatToolResultSummary(value)
}

async function runTask(params: {
  kind: AiTaskKind
  dataclassName: string
  input: AiGenerateInput | AiAskInput | AiQueryInput
  userMessage: string
}): Promise<string> {
  if (!isAssistantLlmConfigured()) {
    throw new LlmNotConfiguredError('LLM is not configured')
  }
  if (isCloudLlmOffline()) {
    throw new Error(CLOUD_LLM_OFFLINE_ERROR)
  }

  const store = useAiTasksStore.getState()
  const taskId = createAiTaskId()
  const controller = new AbortController()
  abortControllers.set(taskId, controller)

  store.addTask({
    id: taskId,
    kind: params.kind,
    dataclassName: params.dataclassName,
    status: 'running',
    createdAt: Date.now(),
    input: params.input,
    content: '',
    activity: [],
  })

  void executeTask(taskId, controller, params)

  return taskId
}

function activityAppliedQueryOptions(activity: ChatActivityStep[]): boolean {
  return activity.some((step) => step.name.includes('set-options') && step.status === 'done')
}

async function executeTask(
  taskId: string,
  controller: AbortController,
  params: {
    kind: AiTaskKind
    dataclassName: string
    input: AiGenerateInput | AiAskInput | AiQueryInput
    userMessage: string
  }
): Promise<void> {
  const readonlyMode = useSettingsStore.getState().readonlyMode
  const allowed = allowedToolsForKind(params.kind, readonlyMode)
  const restoreToolActivation = activateAllowlistedTools(allowed)

  try {
    const allTools = await dataExplorerToolRegistry.listTools()
    const tools = allTools.filter((tool) => allowed.has(tool.name))

    const agentInput = {
      tools,
      signal: controller.signal,
      stream: {
        turnId: taskId,
        onUpdate: (content: string) => {
          useAiTasksStore.getState().setTaskContent(taskId, content)
        },
      },
      toolHandlers: {
        onStart: (step: {
          id: string
          name: string
          args: Record<string, unknown>
          callId: string
          thoughtSignature?: string
        }) => {
          useAiTasksStore.getState().appendActivityStart(taskId, step)
        },
        onFinish: (
          stepId: string,
          update: {
            status: 'done' | 'error'
            result?: unknown
            error?: string
            durationMs?: number
          }
        ) => {
          useAiTasksStore.getState().finishActivityStep(taskId, stepId, update)
        },
      },
      invokeTool: (name: string, args: Record<string, unknown>) =>
        dataExplorerToolRegistry.invokeTool(name, args),
    }

    let result = await runLlmAgent({
      ...agentInput,
      userMessage: params.userMessage,
      history: [],
    })

    // Query tasks must apply options to the builder; nudge once if the model stopped early.
    if (
      params.kind === 'query' &&
      !controller.signal.aborted &&
      !activityAppliedQueryOptions(
        useAiTasksStore.getState().tasks.find((task) => task.id === taskId)?.activity ?? []
      )
    ) {
      result = await runLlmAgent({
        ...agentInput,
        userMessage: GENERATE_QUERY_SET_OPTIONS_FOLLOW_UP,
        history: result.apiMessages,
      })
    }

    const finalContent =
      result.assistantMessages
        .map((message) => message.content)
        .filter(Boolean)
        .join('\n')
        .trim() ||
      useAiTasksStore.getState().tasks.find((task) => task.id === taskId)?.content ||
      ''

    const activity =
      useAiTasksStore.getState().tasks.find((task) => task.id === taskId)?.activity ?? []

    const current = useAiTasksStore.getState().tasks.find((task) => task.id === taskId)
    if (current?.status === 'cancelled' || controller.signal.aborted) {
      markAiTaskCancelled(taskId)
      return
    }

    useAiTasksStore.getState().updateTask(taskId, {
      status: 'done',
      content: finalContent,
      resultSummary: resultSummaryFromActivity(params.kind, activity, finalContent),
    })

    if (params.kind === 'generate' || activityMutatedData(activity)) {
      eventBus.emit('refresh-view')
    }
  } catch (error) {
    const aborted =
      error instanceof ChatAbortedError ||
      (error instanceof Error && error.name === 'AbortError') ||
      controller.signal.aborted

    if (aborted) {
      markAiTaskCancelled(taskId)
    } else {
      const message = error instanceof Error ? error.message : String(error)
      useAiTasksStore.getState().updateTask(taskId, {
        status: 'error',
        error: message,
      })
    }
  } finally {
    restoreToolActivation()
    abortControllers.delete(taskId)
  }
}

function markAiTaskCancelled(taskId: string): void {
  const task = useAiTasksStore.getState().tasks.find((item) => item.id === taskId)
  if (!task) return

  useAiTasksStore.getState().updateTask(taskId, {
    status: 'cancelled',
    error: 'Cancelled',
    activity: task.activity.map((step) =>
      step.status === 'active' ? { ...step, status: 'error' as const, error: 'Cancelled' } : step
    ),
  })
}

function releaseInteractiveWaitersForTask(taskId: string): void {
  const task = useAiTasksStore.getState().tasks.find((item) => item.id === taskId)
  if (!task) return
  for (const step of task.activity) {
    if (step.status !== 'active' || !step.callId) continue
    resolveInteractiveToolResult(step.callId, {
      confirmed: false,
      cancelled: true,
      selected: [],
    })
  }
}

export async function startGenerateAiTask(input: {
  dataclassName: string
  count: number
  prompt: string
  styles: AiGenerateInput['styles']
}): Promise<string> {
  const catalog = await client.catalog.getAllWithMetadataCached()
  const schemaSummary = summarizeDataclassSchema(input.dataclassName, catalog, {
    omitVectorAttributes: true,
  })
  const generateInput: AiGenerateInput = {
    count: input.count,
    prompt: input.prompt,
    styles: input.styles,
  }

  return runTask({
    kind: 'generate',
    dataclassName: input.dataclassName,
    input: generateInput,
    userMessage: buildGenerateUserMessage({
      dataclassName: input.dataclassName,
      schemaSummary,
      count: input.count,
      prompt: input.prompt,
      styles: input.styles,
    }),
  })
}

export async function startAskAiTask(input: {
  dataclassName: string
  prompt: string
}): Promise<string> {
  const catalog = await client.catalog.getAllWithMetadataCached()
  const dc = catalog.dataClasses?.find((item) => item.name === input.dataclassName)
  const relatedNames = dc ? listRelatedDataclassNames(dc) : []
  const entityCounts = await fetchEntityCounts([input.dataclassName, ...relatedNames])
  const schemaSummary = summarizeDataclassSchema(input.dataclassName, catalog, { entityCounts })
  const askInput: AiAskInput = { prompt: input.prompt }
  const readonlyMode = useSettingsStore.getState().readonlyMode

  return runTask({
    kind: 'ask',
    dataclassName: input.dataclassName,
    input: askInput,
    userMessage: buildAskUserMessage({
      dataclassName: input.dataclassName,
      schemaSummary,
      prompt: input.prompt,
      readonlyMode,
    }),
  })
}

export async function startGenerateQueryAiTask(input: {
  dataclassName: string
  prompt: string
}): Promise<string> {
  const catalog = await client.catalog.getAllWithMetadataCached()
  const schemaSummary = summarizeDataclassSchema(input.dataclassName, catalog)
  const queryInput: AiQueryInput = { prompt: input.prompt }

  return runTask({
    kind: 'query',
    dataclassName: input.dataclassName,
    input: queryInput,
    userMessage: buildGenerateQueryUserMessage({
      dataclassName: input.dataclassName,
      schemaSummary,
      prompt: input.prompt,
    }),
  })
}

/** @deprecated Use startAskAiTask */
export const startSearchAiTask = startAskAiTask

export function cancelAiTask(taskId: string): void {
  const controller = abortControllers.get(taskId)
  // Abort first so the agent loop stops even if a waiter is resolved below.
  controller?.abort()
  // Unblock request_confirmation / request_choices waiters for this task.
  releaseInteractiveWaitersForTask(taskId)
  markAiTaskCancelled(taskId)
}

export function cancelAllAiTasks(): void {
  const runningIds = useAiTasksStore
    .getState()
    .tasks.filter((task) => task.status === 'running')
    .map((task) => task.id)

  for (const taskId of runningIds) {
    cancelAiTask(taskId)
  }
}
