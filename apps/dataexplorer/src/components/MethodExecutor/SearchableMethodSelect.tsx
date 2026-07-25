import {
  cn,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Check, ChevronDown, CircleAlert, Code2, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import type { MethodCatalogItem } from './useMethodCatalog'

type SearchableMethodSelectProps = {
  value: string
  methods: MethodCatalogItem[]
  onChange: (item: MethodCatalogItem) => void
  /** When true, skip the missing-method error state (catalog still loading). */
  loading?: boolean
}

export function SearchableMethodSelect({
  value,
  methods,
  onChange,
  loading = false,
}: SearchableMethodSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const methodExists = useMemo(
    () => methods.some((method) => method.methodName === value),
    [methods, value]
  )
  const isMissing = Boolean(value) && !loading && !methodExists

  const filteredMethods = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return methods
    return methods.filter((method) =>
      `${method.methodName} ${method.paramsText ?? ''}`.toLocaleLowerCase().includes(query)
    )
  }, [methods, search])

  useEffect(() => {
    if (!open || filteredMethods.length === 0) return
    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, filteredMethods.length, listboxId, open])

  const selectMethod = (method: MethodCatalogItem) => {
    onChange(method)
    setOpen(false)
    setSearch('')
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setSearch('')
      const selectedIndex = methods.findIndex((method) => method.methodName === value)
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    }
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(filteredMethods.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const selected = filteredMethods[activeIndex]
      if (selected) selectMethod(selected)
      return
    }
    if (event.key === 'Escape') setOpen(false)
  }

  const activeOptionId =
    filteredMethods.length > 0 ? `${listboxId}-option-${activeIndex}` : undefined

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={isMissing ? undefined : false}>
        <Popover open={open} onOpenChange={handleOpenChange}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                aria-expanded={open}
                aria-invalid={isMissing || undefined}
                aria-label={
                  isMissing
                    ? t('methodExecutor.methodNotFound', { name: value })
                    : t('methodExecutor.chooseMethod')
                }
                className={cn(
                  'inline-flex max-w-52 items-center gap-1 align-middle',
                  'font-mono text-[length:inherit] leading-5',
                  'rounded-sm transition-colors duration-150',
                  'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                  isMissing
                    ? 'bg-destructive/10 text-destructive underline decoration-destructive/60 decoration-wavy underline-offset-2'
                    : 'text-amber-600 dark:text-amber-400'
                )}
              >
                <span className="min-w-0 truncate leading-5">{value}</span>
                <ChevronDown className="size-[0.85em] shrink-0 opacity-40" aria-hidden="true" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <PopoverContent
            align="start"
            className="w-72 p-1.5"
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              searchRef.current?.focus()
            }}
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={searchRef}
                name="method-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={t('methodExecutor.searchMethods')}
                autoComplete="off"
                spellCheck={false}
                role="combobox"
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={activeOptionId}
                aria-label={t('methodExecutor.searchMethods')}
                className="h-8 pl-7 text-xs"
              />
            </div>
            <div
              id={listboxId}
              role="listbox"
              aria-label={t('methodExecutor.methods')}
              className="mt-1.5 max-h-52 overflow-y-auto overscroll-contain"
            >
              {filteredMethods.length === 0 ? (
                <EmptyPanel
                  icon={Code2}
                  badgeIcon={Search}
                  badgeTone="amber"
                  title={t('methodExecutor.noMethodsMatch')}
                  ghost="none"
                  size="sm"
                />
              ) : (
                filteredMethods.map((method, index) => {
                  const selected = method.methodName === value
                  return (
                    <button
                      key={method.id}
                      id={`${listboxId}-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectMethod(method)}
                      className={cn(
                        'flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs',
                        'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        index === activeIndex && 'bg-muted/70'
                      )}
                    >
                      <Check
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          selected ? 'opacity-100' : 'opacity-0'
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-amber-600 dark:text-amber-400">
                        {method.methodName}
                      </span>
                      {method.paramsText ? (
                        <span className="max-w-[45%] truncate font-mono text-[10px] text-muted-foreground/70">
                          {method.paramsText}
                        </span>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
        <TooltipContent side="top" className="w-fit max-w-64 px-2.5 py-1.5">
          <div className="flex items-start gap-1.5 text-destructive">
            <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="text-xs leading-snug">
              {t('methodExecutor.methodNotFound', { name: value })}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
