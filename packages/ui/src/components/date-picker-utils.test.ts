import { describe, expect, it } from 'bun:test'
import {
  clampDay,
  daysInMonth,
  formatDateOnly,
  getMonthDayMatrix,
  parseDateOnly,
  shiftMonth,
  yearRange,
} from './date-picker-utils'

describe('parseDateOnly / formatDateOnly', () => {
  it('round-trips valid dates', () => {
    expect(parseDateOnly('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 })
    expect(formatDateOnly({ year: 2024, month: 2, day: 29 })).toBe('2024-02-29')
  })

  it('rejects invalid dates', () => {
    expect(parseDateOnly('2023-02-29')).toBeNull()
    expect(parseDateOnly('not-a-date')).toBeNull()
    expect(parseDateOnly('')).toBeNull()
  })
})

describe('month grid', () => {
  it('pads February 2024 starting Sunday', () => {
    const matrix = getMonthDayMatrix(2024, 2, 0)
    expect(matrix[0]?.[0]).toBeNull()
    expect(matrix[0]?.[4]).toBe(1) // Thu
    expect(matrix.flat().filter((d) => d != null)).toHaveLength(29)
  })

  it('computes days in month and clamp', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(clampDay(2023, 2, 31)).toBe(28)
  })

  it('shifts months across year boundaries', () => {
    expect(shiftMonth({ year: 2024, month: 1 }, -1)).toEqual({ year: 2023, month: 12, day: 1 })
    expect(shiftMonth({ year: 2023, month: 12 }, 1)).toEqual({ year: 2024, month: 1, day: 1 })
  })
})

describe('yearRange', () => {
  it('lists descending for quick recent pick', () => {
    expect(yearRange(2023, 2025)).toEqual([2025, 2024, 2023])
  })
})
