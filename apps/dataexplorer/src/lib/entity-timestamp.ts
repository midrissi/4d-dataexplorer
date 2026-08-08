import { EMPTY_VALUE, formatDate } from '@4d/rest'
import type { Entity } from '~/store'

/** Common timestamp field names to look for */
export const TIMESTAMP_FIELDS = [
  '__TIMESTAMP',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
  'timestamp',
  'dateCreated',
  'dateModified',
  'modifiedAt',
  'modified_at',
]

export function formatTimestamp(value: unknown, locale?: string): string | null {
  if (!value) return null
  const formatted = formatDate(value, undefined, locale)
  return formatted === EMPTY_VALUE ? null : formatted
}

export function getEntityTimestamp(
  entity: Entity,
  locale?: string
): { field: string; value: string } | null {
  for (const field of TIMESTAMP_FIELDS) {
    const value = entity[field]
    if (value) {
      const formatted = formatTimestamp(value, locale)
      if (formatted) {
        return { field, value: formatted }
      }
    }
  }
  return null
}
