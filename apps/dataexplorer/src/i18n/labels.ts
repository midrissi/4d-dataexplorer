/**
 * Single source of truth for all user-facing labels in the app.
 * English is the default language; French and Spanish are supported.
 * Keys use dot notation (e.g. app.title, loading.connecting).
 * Each language is defined in its own file: en.ts, fr.ts, es.ts.
 */

import { en } from './en'
import { es } from './es'
import { fr } from './fr'

export type Locale = 'en' | 'fr' | 'es'

/** BCP 47 locale for Intl (Date, Number, etc.). Use when formatting dates/numbers in the chosen language. */
export function getIntlLocale(locale: Locale): string {
  return locale
}

export type Labels = Record<string, string>

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

export const LABELS: Record<Locale, Labels> = {
  en: enFlat,
  fr: frFlat,
  es: esFlat,
}

/** Default (English) labels - single list of all keys used in the app */
export const DEFAULT_LABELS: Labels = enFlat

/** Get label by key; supports optional interpolation e.g. t('command.theme', { name: 'Graphite' }) */
export function getLabel(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const labels = LABELS[locale] ?? LABELS.en
  let value = labels[key] ?? (LABELS.en as Labels)[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return value
}
