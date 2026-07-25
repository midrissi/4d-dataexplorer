import type { AssistantToolDefinition } from '@4djs/assistant'
import { parseSuggestedPromptsResponse, requestLlmCompletion } from '@4djs/assistant/core'
import { client } from '~/lib/api'
import { dataExplorerToolRegistry } from './tool-registry'

const SUGGESTIONS_SYSTEM_PROMPT = `You generate starter prompt suggestions for a datastore REST assistant.

Return ONLY valid JSON with this shape:
{
  "prompts": [
    {
      "id": "unique-id",
      "label": "Short action title (3-6 words)",
      "description": "One-line hint about what this does",
      "prompt": "Exact message the user would send to the assistant",
      "icon": "database|search|terminal|wrench|sparkles|table|code|layers|zap"
    }
  ]
}

Rules:
- Generate exactly 5 diverse, actionable prompts tailored to the datastore catalog JSON provided by the user.
- Use only dataclass names, attributes, and methods that appear in the catalog. Never invent names.
- Mix reads, exploration, and safe operations. Avoid destructive actions in starters.
- Keep labels concise; prompts should be natural language the user would type.
- Pick icons that match each suggestion's intent.`

function summarizeTools(tools: AssistantToolDefinition[]): string {
  return tools.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n')
}

function parseContent(content: string | null) {
  if (!content?.trim()) {
    throw new Error('LLM returned empty suggestions')
  }

  const trimmed = content.trim()
  const jsonText = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed

  const parsed = JSON.parse(jsonText) as unknown
  const prompts = parseSuggestedPromptsResponse(parsed)
  if (!prompts.length) {
    throw new Error('LLM returned no valid suggestions')
  }
  return prompts
}

export async function fetchDataExplorerSuggestedPrompts(input: {
  tools: AssistantToolDefinition[]
  model?: string | null
  signal?: AbortSignal
}) {
  const catalog = await client.catalog.getAllWithMetadataCached()
  const tools = await dataExplorerToolRegistry.listTools()

  if (!catalog.dataClasses?.length && !tools.length) {
    return []
  }

  const completion = await requestLlmCompletion({
    messages: [
      {
        role: 'user',
        content: [
          'Datastore catalog (full JSON):',
          JSON.stringify(catalog),
          '',
          'Available REST tools:',
          summarizeTools(tools.length ? tools : input.tools),
          '',
          'Generate 5 starter prompts for this datastore assistant.',
        ].join('\n'),
      },
    ],
    tools: [],
    model: input.model ?? undefined,
    systemPrompt: SUGGESTIONS_SYSTEM_PROMPT,
    responseFormat: { type: 'json_object' },
    signal: input.signal,
  })

  return parseContent(completion.content)
}
