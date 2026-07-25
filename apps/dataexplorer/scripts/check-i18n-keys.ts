/**
 * Check that fr and es have the same flat keys as en.
 * Run from apps/dataexplorer: bun scripts/check-i18n-keys.ts
 */

import { en } from '../src/i18n/en'
import { es } from '../src/i18n/es'
import { fr } from '../src/i18n/fr'

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flatten(value as Record<string, unknown>, fullKey))
    } else if (typeof value === 'string') {
      result[fullKey] = value
    }
  }
  return result
}

const enFlat = flatten(en as unknown as Record<string, unknown>)
const frFlat = flatten(fr as unknown as Record<string, unknown>)
const esFlat = flatten(es as unknown as Record<string, unknown>)

const enKeys = new Set(Object.keys(enFlat))
const frKeys = new Set(Object.keys(frFlat))
const esKeys = new Set(Object.keys(esFlat))

const missingInFr = [...enKeys].filter((k) => !frKeys.has(k)).sort()
const missingInEs = [...enKeys].filter((k) => !esKeys.has(k)).sort()

if (missingInFr.length > 0) {
  console.error('Keys in en missing in fr:', missingInFr.length)
  console.error(missingInFr.join('\n'))
}
if (missingInEs.length > 0) {
  console.error('Keys in en missing in es:', missingInEs.length)
  console.error(missingInEs.join('\n'))
}

if (missingInFr.length === 0 && missingInEs.length === 0) {
  console.log('OK: fr and es have all en keys.')
} else {
  process.exit(1)
}
