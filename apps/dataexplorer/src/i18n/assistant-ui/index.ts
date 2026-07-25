import type { AssistantLabelOverrides } from '@4djs/assistant'
import type { Locale } from '../labels'
import { esAssistantLabels } from './es'
import { frAssistantLabels } from './fr'

export function getAssistantLabelOverrides(locale: Locale): AssistantLabelOverrides {
  if (locale === 'fr') return frAssistantLabels
  if (locale === 'es') return esAssistantLabels
  return {}
}
