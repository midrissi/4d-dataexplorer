import { Button, cn, Input, Popover, PopoverContent, PopoverTrigger } from '@4d/ui'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { type ComponentProps, useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import { getIntlLocale } from '~/i18n/labels'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const FOUR_D_DATE = /^!!(\d{4}-\d{2}-\d{2})!!$/
const WEEKDAY_COUNT = 7

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

/** Accept `YYYY-MM-DD` or `!!YYYY-MM-DD!!` and return a normalized ISO date, or null. */
function normalizeDateInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const fourD = trimmed.match(FOUR_D_DATE)
  const iso = fourD?.[1] ?? trimmed
  return parseIsoDate(iso) ? iso : null
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function weekStartsOnMonday(locale: string): boolean {
  return locale.startsWith('fr') || locale.startsWith('es')
}

function buildCalendarDays(month: Date, weekStartsMonday: boolean): Date[] {
  const first = startOfMonth(month)
  const firstWeekday = first.getDay() // 0 = Sunday
  const offset = weekStartsMonday ? (firstWeekday + 6) % 7 : firstWeekday
  const start = new Date(first)
  start.setDate(first.getDate() - offset)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

export function DateArgumentPicker({
  id,
  name,
  value,
  label,
  onChange,
  onKeyDown,
  ...inputProps
}: {
  id: string
  name: string
  value: string
  label: string
  onChange: (value: string) => void
} & Omit<
  ComponentProps<typeof Input>,
  'id' | 'name' | 'value' | 'onChange' | 'children' | 'onBlur'
>) {
  const { t, language } = useTranslation()
  const intlLocale = getIntlLocale(language)
  const calendarButtonId = useId()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const selected = useMemo(() => parseIsoDate(value), [value])
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selected ?? today))
  const draftIsInvalid = draft.trim() !== '' && normalizeDateInput(draft) === null

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (open) setVisibleMonth(startOfMonth(selected ?? today))
  }, [open, selected, today])

  const weekStartsMonday = weekStartsOnMonday(intlLocale)
  const days = useMemo(
    () => buildCalendarDays(visibleMonth, weekStartsMonday),
    [visibleMonth, weekStartsMonday]
  )
  const weekdayLabels = useMemo(() => {
    const narrow = new Intl.DateTimeFormat(intlLocale, { weekday: 'narrow' })
    const long = new Intl.DateTimeFormat(intlLocale, { weekday: 'long' })
    // 2024-01-07 is Sunday; shift so index 0 matches week start.
    const base = weekStartsMonday ? 8 : 7
    return Array.from({ length: WEEKDAY_COUNT }, (_, index) => {
      const date = new Date(2024, 0, base + index)
      return { key: long.format(date), label: narrow.format(date) }
    })
  }, [intlLocale, weekStartsMonday])

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale, { month: 'long', year: 'numeric' }).format(visibleMonth),
    [intlLocale, visibleMonth]
  )

  const commitDraft = (nextDraft: string) => {
    const normalized = normalizeDateInput(nextDraft)
    if (normalized === null) return
    setDraft(normalized)
    if (normalized !== value) onChange(normalized)
  }

  const pick = (date: Date) => {
    const iso = toIsoDate(date)
    setDraft(iso)
    onChange(iso)
    setOpen(false)
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <div className="relative min-w-0 flex-1">
        <Input
          {...inputProps}
          id={id}
          name={name}
          value={draft}
          aria-label={label}
          aria-invalid={draftIsInvalid || undefined}
          placeholder={t('methodExecutor.dateInputPlaceholder')}
          spellCheck={false}
          autoComplete="off"
          inputMode="numeric"
          className={cn(
            'h-7 min-w-0 px-2 pr-8 font-mono text-xs md:text-xs',
            draftIsInvalid && 'border-destructive/60 focus-visible:ring-destructive',
            inputProps.className
          )}
          onChange={(event) => {
            const next = event.target.value
            setDraft(next)
            const normalized = normalizeDateInput(next)
            if (normalized !== null && normalized !== value) {
              onChange(normalized)
            } else if (next.trim() === '' && value !== '') {
              onChange('')
            }
          }}
          onBlur={() => {
            const normalized = normalizeDateInput(draft)
            if (normalized === null) {
              setDraft(value)
              return
            }
            commitDraft(normalized)
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event)
            if (event.defaultPrevented) return
            if (event.key === 'Enter') {
              event.preventDefault()
              const normalized = normalizeDateInput(draft)
              if (normalized === null) {
                setDraft(value)
                return
              }
              commitDraft(normalized)
              ;(event.target as HTMLInputElement).blur()
            }
            if (event.key === 'Escape') {
              setDraft(value)
              ;(event.target as HTMLInputElement).blur()
            }
          }}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={calendarButtonId}
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-0.5 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t('methodExecutor.dateOpenCalendar')}
            >
              <CalendarDays className="h-3.5 w-3.5 text-primary/80" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-70 overflow-hidden border-primary/20 bg-popover p-0 shadow-xl"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <div className="relative border-border/60 border-b bg-primary/10 px-3 pt-3 pb-2.5">
              <div className="pointer-events-none absolute -top-8 -right-6 h-20 w-20 rounded-full bg-primary/20 blur-2xl" />
              <div className="relative flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
                  aria-label={t('methodExecutor.datePreviousMonth')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="font-semibold text-sm capitalize tracking-tight">{monthLabel}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
                  aria-label={t('methodExecutor.dateNextMonth')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {selected ? (
                <p
                  className="relative mt-1 text-center font-mono text-[11px] text-muted-foreground"
                  translate="no"
                >
                  !!{toIsoDate(selected)}!!
                </p>
              ) : (
                <p className="relative mt-1 text-center text-[11px] text-muted-foreground">
                  {t('methodExecutor.dateHint')}
                </p>
              )}
            </div>

            <div className="px-3 pt-2.5 pb-1">
              <div className="mb-1 grid grid-cols-7 gap-0.5">
                {weekdayLabels.map((weekday) => (
                  <div
                    key={weekday.key}
                    className="py-1 text-center font-medium text-[10px] text-muted-foreground uppercase tracking-wide"
                  >
                    {weekday.label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {days.map((day) => {
                  const inMonth = day.getMonth() === visibleMonth.getMonth()
                  const isSelected = selected ? sameDay(day, selected) : false
                  const isToday = sameDay(day, today)
                  return (
                    <button
                      key={toIsoDate(day)}
                      type="button"
                      onClick={() => pick(day)}
                      className={cn(
                        'relative flex h-8 items-center justify-center rounded-md font-mono text-xs tabular-nums transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        inMonth ? 'text-foreground' : 'text-muted-foreground/45',
                        !isSelected && 'hover:bg-muted',
                        isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
                        isToday && !isSelected && 'ring-1 ring-primary/50 ring-inset'
                      )}
                    >
                      {day.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-border/60 border-t bg-muted/20 px-2 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={!selected && !draft.trim()}
                onClick={() => {
                  setDraft('')
                  onChange('')
                  setOpen(false)
                }}
              >
                <X className="h-3.5 w-3.5" />
                {t('methodExecutor.dateClear')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => pick(today)}
              >
                {t('methodExecutor.dateToday')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {selected ? (
        <span
          className="hidden shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary sm:inline"
          translate="no"
        >
          !!{value}!!
        </span>
      ) : null}
    </div>
  )
}
