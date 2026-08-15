import type { SuggestInputSuggestion } from '~/components/SuggestInput'
import { listDynamicEnvVarKeys, listFakerModules, proposeFieldTemplateKeys } from '~/lib/env'

/** Faker `$faker.module.method` catalog for anonymize field autocomplete. */
export function listAnonymizeFakerSuggestions(): SuggestInputSuggestion[] {
  return listDynamicEnvVarKeys()
    .filter((key) => key.startsWith('$faker.'))
    .map((key) => {
      const moduleName = key.split('.')[1] ?? 'faker'
      return { value: key, group: moduleName }
    })
}

export function anonymizeFakerGroupLabels(fieldGroupLabel: string): Record<string, string> {
  const labels: Record<string, string> = { field: fieldGroupLabel }
  for (const moduleName of listFakerModules()) {
    labels[moduleName] = moduleName
  }
  return labels
}

/** Prefer field-name matches, then the full Faker catalog. */
export function suggestionsForAnonymizeField(
  fieldName: string,
  catalog: readonly SuggestInputSuggestion[]
): SuggestInputSuggestion[] {
  const preferred = proposeFieldTemplateKeys({ name: fieldName }).filter((key) =>
    key.startsWith('$faker.')
  )
  if (preferred.length === 0) return [...catalog]

  const claimed = new Set(preferred)
  return [
    ...preferred.map((value) => ({ value, group: 'field' })),
    ...catalog.filter((item) => {
      const value = typeof item === 'string' ? item : item.value
      return !claimed.has(value)
    }),
  ]
}
