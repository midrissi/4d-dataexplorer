import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import * as React from 'react'
import { cn } from '../lib/utils'
import { Button } from './button'
import {
  clampDay,
  type DateParts,
  formatDateOnly,
  formatDisplayDate,
  getMonthDayCells,
  getMonthLabels,
  getWeekdayLabels,
  getWeekStartsOn,
  parseDateOnly,
  shiftMonth,
  todayParts,
  yearRange,
} from './date-picker-utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

export type DatePickerLabels = {
  placeholder: string
  clear: string
  today: string
  previousMonth: string
  nextMonth: string
  month: string
  year: string
  openCalendar: string
}

export const DEFAULT_DATE_PICKER_LABELS: DatePickerLabels = {
  placeholder: 'Pick a date',
  clear: 'Clear',
  today: 'Today',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  month: 'Month',
  year: 'Year',
  openCalendar: 'Open calendar',
}

export type DatePickerProps = {
  /** Date-only value as `YYYY-MM-DD`, or empty/null. */
  value?: string | null
  onChange: (value: string | null) => void
  /** BCP 47 locale for month/weekday labels and display formatting. */
  locale?: string
  id?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  contentClassName?: string
  /** Inclusive lower bound for the year dropdown (default 1900). */
  fromYear?: number
  /** Inclusive upper bound for the year dropdown (default current year + 25). */
  toYear?: number
  labels?: Partial<DatePickerLabels>
  'aria-label'?: string
}

function partsEqual(a: DateParts | null, b: DateParts | null): boolean {
  if (!a || !b) return a === b
  return a.year === b.year && a.month === b.month && a.day === b.day
}

export function DatePicker({
  value = null,
  onChange,
  locale,
  id,
  disabled,
  placeholder,
  className,
  contentClassName,
  fromYear = 1900,
  toYear,
  labels: labelsProp,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const labels = React.useMemo(
    () => ({ ...DEFAULT_DATE_PICKER_LABELS, ...labelsProp }),
    [labelsProp]
  )
  const selected = parseDateOnly(value)
  const today = todayParts()
  const maxYear = toYear ?? today.year + 25
  const years = React.useMemo(() => yearRange(fromYear, maxYear), [fromYear, maxYear])

  const [open, setOpen] = React.useState(false)
  const [view, setView] = React.useState<Pick<DateParts, 'year' | 'month'>>(() => ({
    year: selected?.year ?? today.year,
    month: selected?.month ?? today.month,
  }))

  React.useEffect(() => {
    if (!open) return
    const selectedNow = parseDateOnly(value)
    const now = todayParts()
    setView({
      year: selectedNow?.year ?? now.year,
      month: selectedNow?.month ?? now.month,
    })
  }, [open, value])

  const weekStartsOn = React.useMemo(() => getWeekStartsOn(locale), [locale])
  const monthLabels = React.useMemo(() => getMonthLabels(locale), [locale])
  const weekdayLabels = React.useMemo(
    () => getWeekdayLabels(locale, weekStartsOn),
    [locale, weekStartsOn]
  )
  const cells = React.useMemo(
    () => getMonthDayCells(view.year, view.month, weekStartsOn),
    [view.year, view.month, weekStartsOn]
  )
  const weeks = React.useMemo(() => {
    const rows: (typeof cells)[] = []
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7))
    }
    return rows
  }, [cells])

  const display = selected != null ? formatDisplayDate(formatDateOnly(selected), locale) : null
  const triggerPlaceholder = placeholder ?? labels.placeholder

  const selectDay = (day: number) => {
    const next = formatDateOnly({ year: view.year, month: view.month, day })
    onChange(next)
    setOpen(false)
  }

  const setMonth = (month: number) => {
    setView((prev) => ({ ...prev, month }))
  }

  const setYear = (year: number) => {
    setView((prev) => ({
      year,
      month: prev.month,
    }))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel ?? labels.openCalendar}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            'h-7 w-full justify-start gap-2 px-2.5 font-normal',
            !display && 'text-muted-foreground',
            className
          )}
        >
          <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">{display ?? triggerPlaceholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          'fade-in-0 zoom-in-95 w-[min(100vw-2rem,18.5rem)] animate-in p-2 duration-fast',
          contentClassName
        )}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="iconXs"
              aria-label={labels.previousMonth}
              onClick={() => setView((prev) => shiftMonth(prev, -1))}
            >
              <ChevronLeft />
            </Button>
            <div className="grid min-w-0 flex-1 grid-cols-[1.4fr_1fr] gap-1">
              <Select value={String(view.month)} onValueChange={(next) => setMonth(Number(next))}>
                <SelectTrigger aria-label={labels.month} className="h-7 px-2 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-56">
                  {monthLabels.map((label, monthIndex) => {
                    const monthNumber = monthIndex + 1
                    return (
                      <SelectItem key={`month-${monthNumber}`} value={String(monthNumber)}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <Select value={String(view.year)} onValueChange={(next) => setYear(Number(next))}>
                <SelectTrigger aria-label={labels.year} className="h-7 px-2 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-56">
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="iconXs"
              aria-label={labels.nextMonth}
              onClick={() => setView((prev) => shiftMonth(prev, 1))}
            >
              <ChevronRight />
            </Button>
          </div>

          <table
            className="w-full border-collapse"
            aria-label={`${monthLabels[view.month - 1]} ${view.year}`}
          >
            <thead>
              <tr>
                {weekdayLabels.map((label, weekdayOffset) => {
                  const weekday = (weekStartsOn + weekdayOffset) % 7
                  return (
                    <th
                      key={`weekday-${weekday}`}
                      scope="col"
                      className="h-7 p-0 text-center font-medium text-[10px] text-muted-foreground uppercase tracking-wide"
                    >
                      <span aria-hidden>{label}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {weeks.map((row) => {
                const weekAnchor = row.find((cell) => cell.day != null)?.key ?? row[0]?.key
                return (
                  <tr key={`week-${weekAnchor}`}>
                    {row.map((cell) => {
                      if (cell.day == null) {
                        return <td key={cell.key} className="h-7 p-0" />
                      }
                      const cellParts = { year: view.year, month: view.month, day: cell.day }
                      const isSelected = partsEqual(selected, cellParts)
                      const isToday = partsEqual(today, cellParts)
                      return (
                        <td key={cell.key} className="h-7 p-0">
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            aria-current={isToday ? 'date' : undefined}
                            onClick={() => selectDay(cell.day as number)}
                            className={cn(
                              'flex h-7 w-full items-center justify-center rounded-sm font-medium text-xs outline-none transition-colors duration-fast',
                              'hover:bg-accent hover:text-accent-foreground',
                              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                              isSelected &&
                                'bg-primary text-primary-foreground hover:bg-primary/90',
                              !isSelected && isToday && 'bg-accent/60 text-accent-foreground',
                              !isSelected && !isToday && 'text-foreground'
                            )}
                          >
                            {cell.day}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="flex items-center justify-between gap-2 border-border/70 border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              <X className="size-3" aria-hidden />
              {labels.clear}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => {
                const next = {
                  year: today.year,
                  month: today.month,
                  day: clampDay(today.year, today.month, today.day),
                }
                setView({ year: next.year, month: next.month })
                onChange(formatDateOnly(next))
                setOpen(false)
              }}
            >
              {labels.today}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
