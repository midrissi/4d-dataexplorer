/** Calendar helpers for DatePicker — date-only (`YYYY-MM-DD`), local timezone. */

export type DateParts = { year: number; month: number; day: number }

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseDateOnly(value: string | null | undefined): DateParts | null {
  if (!value) return null
  const match = DATE_ONLY_RE.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return { year, month, day }
}

export function formatDateOnly(parts: DateParts): string {
  const y = String(parts.year).padStart(4, '0')
  const m = String(parts.month).padStart(2, '0')
  const d = String(parts.day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayParts(now = new Date()): DateParts {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month))
}

/** 0 = Sunday … 6 = Saturday. Prefer locale week info when available. */
export function getWeekStartsOn(locale?: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  try {
    if (!locale) return 0
    const localeObj = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: { firstDay?: number }
    }
    const first = localeObj.weekInfo?.firstDay
    if (typeof first === 'number' && first >= 1 && first <= 7) {
      // Intl: 1 = Monday … 7 = Sunday
      return (first === 7 ? 0 : first) as 0 | 1 | 2 | 3 | 4 | 5 | 6
    }
  } catch {
    // fall through
  }
  return 0
}

/**
 * Build a 6×7 matrix of day numbers (or null for padding) for the given month.
 * `weekStartsOn`: 0 Sunday … 6 Saturday.
 */
export function getMonthDayMatrix(
  year: number,
  month: number,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0
): (number | null)[][] {
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const leading = (firstWeekday - weekStartsOn + 7) % 7
  const totalDays = daysInMonth(year, month)
  const cells: (number | null)[] = []
  for (let i = 0; i < leading; i++) cells.push(null)
  for (let day = 1; day <= totalDays; day++) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  while (cells.length < 42) cells.push(null)

  const rows: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7))
  }
  return rows
}

export type CalendarCell = {
  day: number | null
  /** Stable React key for this cell in the month grid. */
  key: string
}

/** Flat 42-cell calendar for a month (6 weeks × 7 days). */
export function getMonthDayCells(
  year: number,
  month: number,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0
): CalendarCell[] {
  const matrix = getMonthDayMatrix(year, month, weekStartsOn)
  const cells: CalendarCell[] = []
  let pad = 0
  for (const row of matrix) {
    for (const day of row) {
      if (day == null) {
        pad += 1
        cells.push({ day: null, key: `${year}-${month}-pad-${pad}` })
      } else {
        cells.push({ day, key: `${year}-${month}-day-${day}` })
      }
    }
  }
  return cells
}

export function shiftMonth(parts: Pick<DateParts, 'year' | 'month'>, delta: number): DateParts {
  const date = new Date(parts.year, parts.month - 1 + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: 1 }
}

export function formatDisplayDate(value: string, locale?: string): string {
  const parts = parseDateOnly(value)
  if (!parts) return value
  try {
    return new Intl.DateTimeFormat(locale || undefined, { dateStyle: 'medium' }).format(
      new Date(parts.year, parts.month - 1, parts.day)
    )
  } catch {
    return value
  }
}

export function getMonthLabels(locale?: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale || undefined, { month: 'long' })
  return Array.from({ length: 12 }, (_, index) => {
    return formatter.format(new Date(2020, index, 1))
  })
}

export function getWeekdayLabels(
  locale: string | undefined,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
): string[] {
  const formatter = new Intl.DateTimeFormat(locale || undefined, { weekday: 'short' })
  // 2020-01-05 is a Sunday
  const sunday = new Date(2020, 0, 5)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sunday)
    day.setDate(sunday.getDate() + ((weekStartsOn + index) % 7))
    return formatter.format(day)
  })
}

export function yearRange(fromYear: number, toYear: number): number[] {
  const start = Math.min(fromYear, toYear)
  const end = Math.max(fromYear, toYear)
  const years: number[] = []
  for (let year = end; year >= start; year--) years.push(year)
  return years
}
