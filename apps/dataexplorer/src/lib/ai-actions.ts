import type { AiGenerateStyle, AiTaskKind } from '~/store/ai-tasks'

export type AiActionId = AiTaskKind

export type AiActionDefinition = {
  id: AiActionId
  labelKey: string
  descriptionKey: string
  /** When true, action is unavailable in readonly mode */
  mutates: boolean
}

/** Registry of dataclass-scoped AI actions. Add entries here for future actions. */
export const AI_ACTIONS: AiActionDefinition[] = [
  {
    id: 'generate',
    labelKey: 'aiActions.generate',
    descriptionKey: 'aiActions.generateDescription',
    mutates: true,
  },
  {
    id: 'ask',
    labelKey: 'aiActions.ask',
    descriptionKey: 'aiActions.askDescription',
    // Available in readonly; write tools are stripped when readonly is on.
    mutates: false,
  },
  {
    id: 'query',
    labelKey: 'aiActions.query',
    descriptionKey: 'aiActions.queryDescription',
    mutates: false,
  },
]

export const AI_GENERATE_STYLES: {
  id: AiGenerateStyle
  labelKey: string
  descriptionKey: string
}[] = [
  {
    id: 'realistic',
    labelKey: 'aiActions.styleRealistic',
    descriptionKey: 'aiActions.styleRealisticHint',
  },
  {
    id: 'edge-cases',
    labelKey: 'aiActions.styleEdgeCases',
    descriptionKey: 'aiActions.styleEdgeCasesHint',
  },
  {
    id: 'minimal',
    labelKey: 'aiActions.styleMinimal',
    descriptionKey: 'aiActions.styleMinimalHint',
  },
]

const GENERATE_STYLE_INSTRUCTIONS: Record<AiGenerateStyle, string> = {
  realistic: 'Use realistic, plausible values that look like production data.',
  'edge-cases':
    'Include edge cases: empty strings where allowed, boundary numbers, unusual unicode, long values.',
  minimal: 'Fill only required / commonly used fields; leave optional fields unset when possible.',
}

export function buildGenerateUserMessage(input: {
  dataclassName: string
  schemaSummary: string
  count: number
  prompt: string
  styles: AiGenerateStyle[]
}): string {
  const styleLines =
    input.styles.length > 0
      ? input.styles.map((style) => `- ${GENERATE_STYLE_INSTRUCTIONS[style]}`).join('\n')
      : '- Use realistic, plausible values.'

  const extra = input.prompt.trim()
    ? `\nAdditional instructions from the user:\n${input.prompt.trim()}\n`
    : ''

  return `You are helping generate sample entities for the dataclass "${input.dataclassName}".

Schema (attributes):
${input.schemaSummary}

Task:
1. Create exactly ${input.count} new entit${input.count === 1 ? 'y' : 'ies'} using @datastore/create.
2. Prefer a single @datastore/create call with an \`entities\` array when creating multiple records.
3. Only use attributes that exist on this dataclass. Do not invent fields.
4. Do not set vector / embedding attributes (4D.Vector object fields). Leave them unset.
5. Do not update or delete existing records.
6. After creating, briefly summarize what you created (count and a couple of example field values).

Style guidelines:
${styleLines}
${extra}
Proceed now.`
}

export function buildAskUserMessage(input: {
  dataclassName: string
  schemaSummary: string
  prompt: string
  readonlyMode: boolean
}): string {
  const readonlyNote = input.readonlyMode
    ? `\nReadonly mode is ON: do not create, update, or delete entities. Answer with queries, catalog info, and filtered tabs only.\n`
    : ''

  return `You are helping the user interact with the dataclass "${input.dataclassName}" in Data Explorer.

Schema (attributes):
${input.schemaSummary}
${readonlyNote}
User request:
${input.prompt.trim()}

Guidelines:
1. Scope actions to this dataclass and its direct relations when needed for the request. Do not invent fields.
2. Filtering / finding / showing records:
   - Prefer @query/open-filtered-tab, or @datastore/create-entityset then @navigation/open-tab, so results open in a browser tab.
   - You may use @datastore/query first to inspect samples or validate a filter.
3. Table info (schema, counts, samples, relationships):
   - Use @datastore/catalog, @datastore/query, and @datastore/server-info as needed, then answer clearly.
4. Charts / distributions / aggregates across relations (REQUIRED plan-first):
   a. Identify related dataclasses from the schema (e.g. Car → user → User).
   b. Get entity counts for both sides first (schema counts, catalog entityCount, or @datastore/query with top=0). Do not scan the large table.
   c. Choose the path with the fewest / cheapest requests: start from the side with fewer records; use @datastore/query-related with top=0 for per-parent counts when the parent is small.
   d. Example — "cars distribution over users as pie chart": if User << Car, query Users then query-related(cars, top:0) per user; aggregate → @widgets/render (pie/donut). Never query all Cars with a huge top.
   e. Briefly state the chosen plan in one sentence, then execute. Call @widgets/render before prose when a chart is requested.
5. Creating / updating / deleting (when not in readonly):
   - Create with @datastore/create; update with @datastore/update using __KEY/__STAMP from query results.
   - Delete with @datastore/delete using a filter (or entitySetId). Omit the filter only when the user clearly asks to delete ALL records in this dataclass.
6. When done, briefly summarize what you did (filter used, tab opened, counts, mutations, chart).

Proceed now.`
}

export function buildGenerateQueryUserMessage(input: {
  dataclassName: string
  schemaSummary: string
  prompt: string
}): string {
  return `You are filling the Query builder for the active "${input.dataclassName}" tab in Data Explorer.

Schema (attributes):
${input.schemaSummary}

User request:
${input.prompt.trim()}

## Success criteria (REQUIRED — the task is incomplete until all are done)
1. Produce a valid 4D filter (and optional sort/order/select) for "${input.dataclassName}".
2. Validate it with @datastore/query top=0 until that call succeeds.
3. Immediately call @query/set-options with that validated filter/filterParams (and sort/order/select if any).
4. Call @query/toggle-panel with expanded=true.
5. Briefly summarize what you applied.

Do NOT finish with only exploratory @datastore/query / @datastore/get / @datastore/validate-path calls. If top=0 validation already succeeded, your NEXT tool call must be @query/set-options — no more lookups.

## Hard rules
1. SQL is NOT supported anywhere — not in filter, and NOT in filterParams values.
   - NEVER write SELECT/FROM/WHERE/JOIN or subqueries like "(SELECT ID FROM Color WHERE name = 'Red')".
   - filterParams values must be plain scalars only: "12", "A@", "true", "2024-01-01".
2. Only use attributes from the schema. Do not invent fields.
3. Prefer placeholders :1, :2, … with typed filterParams when values come from the user or from looked-up data.
4. Wildcard "@" belongs INSIDE string values with "=" — never as an operator.
   - Starts with A → filter "name = :1" (or closest string attr) with value "A@".
5. Related entities (PREFERRED for "managed by X", "whose company is Y", "color is Red", etc.):
   - When a relatedEntity exists (including nested paths like agency.manager), filter THROUGH the relation with a dotted path.
   - RIGHT: filter "manager.lastname = :1" with filterParams [{ "type": "string", "value": "FOREY" }]
   - RIGHT: nested "agency.manager.lastname = :1" or "agency.ID_manager = :1" when manager lives on the related agency.
   - WRONG: invent root FKs like "ID_manager" on Car when the schema only has agency → Agency.
   - WRONG: put SQL or another query string inside filterParams.
   - Call @datastore/validate-path on each dotted path before using it. If invalid, fix using the error's available attributes.
6. Multi-step / dependent filters ("same manager as the first car", "same color as …"):
   a. Load the reference entity with @datastore/query (e.g. top=1) and/or @datastore/get.
   b. Read the needed scalar (use expand/select or follow relations — e.g. first car → agency → ID_manager / manager key).
   c. Build the filter on "${input.dataclassName}" with that scalar via a valid path (prefer nested relation/FK paths).
   d. Validate with top=0, then IMMEDIATELY @query/set-options — do not query other dataclasses afterward "to confirm".
   Example: first car's agency has ID_manager=965 → filter "agency.ID_manager = :1" with filterParams [{ "type": "number", "value": "965" }].
7. Validate BEFORE applying to the tab:
   a. @datastore/query on "${input.dataclassName}" with the final filter/filterParams and top=0.
   b. On error, fix and retry top=0 until success.
   c. Then @query/set-options (never pass top=0 into set-options unless the user asked for it).
   d. @query/toggle-panel expanded=true. Optionally @query/run after setting options.
8. Do not open new tabs. Do not create/update/delete entities.
9. When done, briefly summarize the filter/params/sort/select you applied (and that it was validated).

Proceed now.`
}

/** Nudge when a query AI task ends without applying options to the builder. */
export const GENERATE_QUERY_SET_OPTIONS_FOLLOW_UP =
  'Incomplete: you never called @query/set-options. Using the filter/filterParams from your last successful @datastore/query with top=0 on this dataclass, call @query/set-options NOW (omit top), then @query/toggle-panel with expanded=true. Do not run more exploratory queries or validate-path calls.'

export const AI_GENERATE_ALLOWED_TOOLS = new Set([
  '@datastore/catalog',
  '@datastore/query',
  '@datastore/validate-path',
  '@datastore/get',
  '@datastore/create',
])

export const AI_ASK_ALLOWED_TOOLS = new Set([
  '@datastore/catalog',
  '@datastore/server-info',
  '@datastore/query',
  '@datastore/validate-path',
  '@datastore/query-related',
  '@datastore/get',
  '@datastore/create',
  '@datastore/update',
  '@datastore/delete',
  '@datastore/create-entityset',
  '@datastore/combine-entityset',
  '@datastore/release-entityset',
  '@navigation/open-tab',
  '@navigation/state',
  '@navigation/switch-tab',
  '@navigation/highlight-dataclass',
  '@query/set-options',
  '@query/run',
  '@query/reset',
  '@query/open-filtered-tab',
  '@query/toggle-panel',
  '@view/entity-list',
  '@view/entity',
  '@widgets/render',
])

export const AI_ASK_WRITE_TOOLS = new Set([
  '@datastore/create',
  '@datastore/update',
  '@datastore/delete',
])

/** Tools for Query-builder AI generation (no mutations, no new tabs). */
export const AI_QUERY_ALLOWED_TOOLS = new Set([
  '@datastore/catalog',
  '@datastore/server-info',
  '@datastore/query',
  '@datastore/validate-path',
  '@datastore/query-related',
  '@datastore/get',
  '@query/set-options',
  '@query/run',
  '@query/reset',
  '@query/toggle-panel',
])
