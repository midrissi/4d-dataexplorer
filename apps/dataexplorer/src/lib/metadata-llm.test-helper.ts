import { mock } from 'bun:test'

const LLM_SETTINGS_STORAGE_KEY = 'dataexplorer-llm-settings'

/** Configure localStorage so `isAssistantLlmConfigured()` returns true in tests. */
export function configureTestLlm(): void {
  localStorage.setItem(
    LLM_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      model: 'gpt-4o-mini',
    })
  )
}

/** Remove the stored LLM settings so the assistant is considered unconfigured. */
export function unconfigureTestLlm(): void {
  localStorage.removeItem(LLM_SETTINGS_STORAGE_KEY)
}

export type LlmFetchCall = { url: string; body: unknown }

/**
 * Replace global fetch with a mock that returns a chat-completion style payload.
 * `content` is the assistant message content. Pass a function to compute per-call.
 * Returns the recorded calls array and a restore function.
 */
export function mockLlmFetch(content: string | ((call: LlmFetchCall) => string)): {
  calls: LlmFetchCall[]
  restore: () => void
} {
  const calls: LlmFetchCall[] = []
  const original = globalThis.fetch
  ;(globalThis as { fetch: typeof fetch }).fetch = mock((url: string, init?: RequestInit) => {
    let body: unknown
    try {
      body = init?.body ? JSON.parse(String(init.body)) : undefined
    } catch {
      body = init?.body
    }
    const call: LlmFetchCall = { url: String(url), body }
    calls.push(call)
    const text = typeof content === 'function' ? content(call) : content
    const payload = {
      choices: [{ message: { content: text } }],
      model: 'gpt-4o-mini',
    }
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  }) as unknown as typeof fetch
  return {
    calls,
    restore: () => {
      ;(globalThis as { fetch: typeof fetch }).fetch = original
    },
  }
}
