/**
 * Value formatting utilities for 4D data types
 *
 * These utilities provide consistent formatting for dates, durations, and numbers
 * across the application.
 */

// Empty value placeholder
export const EMPTY_VALUE = '—'

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
}

const DEFAULT_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

/**
 * Format a date value to a human-readable string
 *
 * Supports:
 * - 4D date format: dd!mm!yyyy
 * - 4D date format: !!yyyy-mm-dd!! (null if 0000-00-00)
 * - 4D null date: 0!0!0
 * - ISO date format: yyyy-mm-dd or yyyy-mm-ddThh:mm:ss
 *
 * @param value - The date value to format (string, Date, or number timestamp)
 * @param options - Optional Intl.DateTimeFormat options
 * @param locale - Optional BCP 47 locale (e.g. 'en', 'fr', 'es') for language-specific formatting
 * @returns Formatted date string or empty placeholder
 */
export function formatDate(
  value: unknown,
  options?: Intl.DateTimeFormatOptions,
  locale?: string
): string {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE

  const locales = locale ?? undefined

  try {
    const strValue = String(value)

    // 0!0!0 means null date (4D compact form)
    if (strValue === '0!0!0') return EMPTY_VALUE

    // Check if it's in 4D !!yyyy-mm-dd!! format
    const date4DMatch = strValue.match(/^!!(\d{4})-(\d{2})-(\d{2})!!$/)
    if (date4DMatch) {
      const [, year, month, day] = date4DMatch
      // !!0000-00-00!! means null date
      if (year === '0000' && month === '00' && day === '00') {
        return EMPTY_VALUE
      }
      // Parse and format the date
      const date = new Date(Number(year), Number(month) - 1, Number(day))
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString(locales, options ?? DEFAULT_DATE_OPTIONS)
      }
    }

    // Check if it's in 4D dd!mm!yyyy format
    const dateMatch = strValue.match(/^(\d{1,2})!(\d{1,2})!(\d{4})$/)
    if (dateMatch) {
      const [, day, month, year] = dateMatch
      const date = new Date(Number(year), Number(month) - 1, Number(day))
      if (!Number.isNaN(date.getTime()) && locales) {
        return date.toLocaleDateString(locales, options ?? DEFAULT_DATE_OPTIONS)
      }
      // Fallback: format as dd/mm/yyyy with zero-padding (locale-agnostic)
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
    }

    // Try parsing as Date
    const date = value instanceof Date ? value : new Date(value as string | number)
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString(locales, options ?? DEFAULT_DATETIME_OPTIONS)
    }

    return String(value)
  } catch {
    return String(value)
  }
}

/**
 * Convert a date value to HTML date input value (yyyy-mm-dd).
 * Returns empty string for null/undefined or unparseable values.
 *
 * Supports:
 * - 4D date format: dd!mm!yyyy
 * - 4D date format: !!yyyy-mm-dd!! (null if 0000-00-00)
 * - 4D null date: 0!0!0
 * - ISO date format: yyyy-mm-dd or yyyy-mm-ddThh:mm:ss
 *
 * @param value - The date value to convert
 * @returns yyyy-mm-dd string or ''
 */
export function dateValueToInputValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''

  try {
    const strValue = String(value)

    // 0!0!0 means null date (4D compact form)
    if (strValue === '0!0!0') return ''

    // 4D !!yyyy-mm-dd!! format
    const date4DMatch = strValue.match(/^!!(\d{4})-(\d{2})-(\d{2})!!$/)
    if (date4DMatch) {
      const [, year, month, day] = date4DMatch
      if (year === '0000' && month === '00' && day === '00') return ''
      return `${year}-${month}-${day}`
    }

    // 4D dd!mm!yyyy format
    const dateMatch = strValue.match(/^(\d{1,2})!(\d{1,2})!(\d{4})$/)
    if (dateMatch) {
      const [, day, month, year] = dateMatch
      const d = day.padStart(2, '0')
      const m = month.padStart(2, '0')
      return `${year}-${m}-${d}`
    }

    // ISO or Date
    const date = value instanceof Date ? value : new Date(value as string | number)
    if (Number.isNaN(date.getTime())) return ''
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  } catch {
    return ''
  }
}

/**
 * Format a date value to a short date string (without time)
 *
 * @param value - The date value to format
 * @param locale - Optional BCP 47 locale for language-specific formatting
 * @returns Formatted date string or empty placeholder
 */
export function formatDateShort(value: unknown, locale?: string): string {
  return formatDate(value, DEFAULT_DATE_OPTIONS, locale)
}

/**
 * Format a duration value from milliseconds to hh:mm:ss.ms or Xms
 *
 * - If duration < 1s: returns amount of ms (e.g. "100ms", "0ms")
 * - If duration >= 1s: returns hh:mm:ss.mmm (e.g. "00:00:01.500")
 *
 * @param value - Duration in milliseconds
 * @returns Formatted duration string or empty placeholder
 */
export function formatDuration(value: unknown): string {
  if (value === null || value === undefined) return EMPTY_VALUE

  try {
    const ms = Number(value)
    if (Number.isNaN(ms) || ms < 0) return String(value)

    if (ms < 1000) return `${Math.round(ms)}ms`

    const totalSeconds = Math.floor(ms / 1000)
    const millis = Math.floor(ms % 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const msPart = millis.toString().padStart(3, '0')
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${msPart}`
  } catch {
    return String(value)
  }
}

/**
 * Format a duration value with human-readable units
 *
 * @param value - Duration in milliseconds
 * @returns Human-readable duration string (e.g., "2h 30m 15s")
 */
export function formatDurationHuman(value: unknown): string {
  if (value === null || value === undefined) return EMPTY_VALUE

  try {
    const ms = Number(value)
    if (Number.isNaN(ms) || ms < 0) return String(value)

    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const parts: string[] = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

    return parts.join(' ')
  } catch {
    return String(value)
  }
}

/**
 * Format a number with thousand separators and optional decimal places
 *
 * @param value - The number to format
 * @param options - Optional Intl.NumberFormat options
 * @returns Formatted number string or empty placeholder
 */
export function formatNumber(value: unknown, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined) return EMPTY_VALUE

  try {
    const num = Number(value)
    if (Number.isNaN(num)) return String(value)

    return num.toLocaleString(
      undefined,
      options ?? {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )
  } catch {
    return String(value)
  }
}

/**
 * Format a number as an integer (no decimal places)
 *
 * @param value - The number to format
 * @returns Formatted integer string or empty placeholder
 */
export function formatInteger(value: unknown): string {
  return formatNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/**
 * Format a number as currency
 *
 * @param value - The number to format
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted currency string or empty placeholder
 */
export function formatCurrency(value: unknown, currency = 'USD'): string {
  if (value === null || value === undefined) return EMPTY_VALUE

  try {
    const num = Number(value)
    if (Number.isNaN(num)) return String(value)

    return num.toLocaleString(undefined, {
      style: 'currency',
      currency,
    })
  } catch {
    return String(value)
  }
}

/**
 * Format a number as a percentage
 *
 * @param value - The number to format (0.5 = 50%)
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted percentage string or empty placeholder
 */
export function formatPercent(value: unknown, decimals = 0): string {
  if (value === null || value === undefined) return EMPTY_VALUE

  try {
    const num = Number(value)
    if (Number.isNaN(num)) return String(value)

    return num.toLocaleString(undefined, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  } catch {
    return String(value)
  }
}

/**
 * Format a value based on its detected type
 *
 * @param value - The value to format
 * @param locale - Optional BCP 47 locale for date formatting
 * @returns Formatted string or empty placeholder
 */
export function formatValue(value: unknown, locale?: string): string {
  if (value === null || value === undefined) return EMPTY_VALUE

  // Boolean
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  // Number
  if (typeof value === 'number') {
    return formatNumber(value)
  }

  // Object/Array
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `[${value.length} items]`
    }
    return '{...}'
  }

  // String - check for date patterns
  if (typeof value === 'string') {
    // 4D date format: !!yyyy-mm-dd!! (null if 0000-00-00)
    if (/^!!\d{4}-\d{2}-\d{2}!!$/.test(value)) {
      return formatDate(value, undefined, locale)
    }
    // 4D date format: dd!mm!yyyy
    if (/^\d{1,2}!\d{1,2}!\d{4}$/.test(value)) {
      return formatDate(value, undefined, locale)
    }
    // ISO date format
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) {
        return formatDate(value, undefined, locale)
      }
    }
  }

  return String(value)
}
