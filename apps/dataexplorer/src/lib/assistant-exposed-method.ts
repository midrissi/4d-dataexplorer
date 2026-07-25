/**
 * Whether a catalog method should be documented for the AI assistant.
 * Mirrors REST exposure rules: exclude publicOnServer and other non-public methods.
 */
export type AssistantMethodVisibility = {
  exposed?: boolean
  scope?: string
}

const REST_SCOPES = new Set(['public'])

export function isAssistantExposedMethod(method: AssistantMethodVisibility): boolean {
  if (method.exposed === true) return true
  if (method.exposed === false) return false

  const scope = typeof method.scope === 'string' ? method.scope.trim() : ''
  if (scope === 'publicOnServer') return false
  if (REST_SCOPES.has(scope)) return true

  return false
}

export function filterAssistantExposedMethods<T extends AssistantMethodVisibility>(
  methods: T[] | undefined
): T[] {
  if (!methods?.length) return []
  return methods.filter((method) => isAssistantExposedMethod(method))
}
