import { EMPTY_VALUE, formatDate } from '@4d/rest'
import {
  Boxes,
  Clock,
  Database,
  Fingerprint,
  Hash,
  History,
  Info,
  type LucideIcon,
} from 'lucide-react'

export function getMetadataIcon(key: string): LucideIcon {
  const k = key.replace(/^_+/, '').toLowerCase()
  if (k === 'key' || k.endsWith('key')) return Fingerprint
  if (k === 'timestamp' || k.includes('time')) return Clock
  if (k === 'stamp' || k.includes('stamp')) return History
  if (k.includes('dataclass')) return Database
  if (k.includes('entitymodel') || k.includes('model')) return Boxes
  if (k === 'global' || k.includes('global')) return Hash
  return Info
}

export function prettyMetadataLabel(key: string): string {
  return key.replace(/^_+/, '')
}

export function formatMetadataValue(value: unknown, locale: string): string {
  if (value === null || value === undefined) return EMPTY_VALUE
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const formatted = formatDate(value, undefined, locale)
      if (formatted !== value && formatted !== EMPTY_VALUE) return formatted
    }
    return value
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
