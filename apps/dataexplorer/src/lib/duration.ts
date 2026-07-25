/**
 * Duration parsing and formatting using parse-duration.
 * Used for duration attribute inputs in entity forms/viewers.
 */

import parse from 'parse-duration'

/**
 * Parse a human-readable duration string to milliseconds.
 * Uses parse-duration (supports e.g. "1h 30m", "90m", "1:30", "5400s").
 *
 * @param input - Duration string
 * @returns Milliseconds or null if unparseable/empty
 */
export function parseDurationInput(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  const ms = parse(trimmed)
  return ms != null && Number.isFinite(ms) ? ms : null
}

/**
 * Format duration in milliseconds as hh:mm:ss for input display.
 *
 * @param value - Duration in ms (number, null, or undefined)
 * @returns "HH:MM:SS" or empty string for empty value
 */
export function durationValueToInputValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const ms = Number(value)
  if (Number.isNaN(ms) || ms < 0) return ''
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}
