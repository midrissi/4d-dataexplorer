import { cn, Input, Popover, PopoverContent, PopoverTrigger } from '@4d/ui'
import { Check, ChevronDown, Search, Table2 } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { DataclassIcon, getDataclassColorClasses } from '~/components/DataclassCustomizeModal'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { useDataclassCustomizations } from '~/store/settings'

type SearchableDataclassSelectProps = {
  value: string
  dataClasses: string[]
  argumentName: string
  onChange: (value: string) => void
  /** When set, empty value is allowed and shown as this label (e.g. “All dataclasses”). */
  emptyOptionLabel?: string
}

export function SearchableDataclassSelect({
  value,
  dataClasses,
  argumentName,
  onChange,
  emptyOptionLabel,
}: SearchableDataclassSelectProps) {
  const { t } = useTranslation()
  const dataclassCustomizations = useDataclassCustomizations()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const filteredDataClasses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return query
      ? dataClasses.filter((dataClass) => dataClass.toLocaleLowerCase().includes(query))
      : dataClasses
  }, [dataClasses, search])

  const showEmptyOption = Boolean(emptyOptionLabel) && !search.trim()
  const options = useMemo(
    () => (showEmptyOption ? ['', ...filteredDataClasses] : filteredDataClasses),
    [filteredDataClasses, showEmptyOption]
  )

  const selectedCustomization = value ? dataclassCustomizations[value] : undefined
  const selectedColorClasses = getDataclassColorClasses(selectedCustomization)
  const displayLabel = value || emptyOptionLabel || t('methodExecutor.chooseDataclass')

  useEffect(() => {
    if (!open || options.length === 0) return
    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, listboxId, open, options.length])

  const selectDataclass = (dataClass: string) => {
    onChange(dataClass)
    setOpen(false)
    setSearch('')
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setSearch('')
      const selectedIndex = emptyOptionLabel
        ? value
          ? dataClasses.indexOf(value) + 1
          : 0
        : dataClasses.indexOf(value)
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    }
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(options.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const selected = options[activeIndex]
      if (selected !== undefined) selectDataclass(selected)
      return
    }
    if (event.key === 'Escape') setOpen(false)
  }

  const activeOptionId = options.length > 0 ? `${listboxId}-option-${activeIndex}` : undefined

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={t('methodExecutor.chooseArgumentDataclass', { name: argumentName })}
          className={cn(
            'inline-flex max-w-44 items-center gap-1 align-middle',
            'font-mono text-[length:inherit] leading-5',
            'rounded-sm transition-colors duration-150',
            'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            value ? selectedColorClasses.text : 'text-muted-foreground'
          )}
          style={selectedColorClasses.style}
        >
          {value ? (
            <DataclassIcon customization={selectedCustomization} className="size-[1em] shrink-0" />
          ) : null}
          <span className="min-w-0 truncate leading-5">{displayLabel}</span>
          <ChevronDown className="size-[0.85em] shrink-0 opacity-40" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-1.5"
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
            name="dataclass-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('methodExecutor.searchDataclasses')}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            aria-label={t('methodExecutor.searchDataclasses')}
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div
          id={listboxId}
          role="listbox"
          aria-label={t('methodExecutor.dataclass')}
          className="mt-1.5 max-h-52 overflow-y-auto overscroll-contain"
        >
          {options.length === 0 ? (
            <EmptyPanel
              icon={Table2}
              badgeIcon={Search}
              badgeTone="amber"
              title={t('methodExecutor.noDataclassesMatch')}
              ghost="none"
              size="sm"
            />
          ) : (
            options.map((dataClass, index) => {
              if (!dataClass) {
                return (
                  <button
                    key="__all__"
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={!value}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectDataclass('')}
                    className={cn(
                      'flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs',
                      'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      index === activeIndex && 'bg-muted/70'
                    )}
                  >
                    <Check
                      className={cn('h-3.5 w-3.5 shrink-0', !value ? 'opacity-100' : 'opacity-0')}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {emptyOptionLabel}
                    </span>
                  </button>
                )
              }

              const customization = dataclassCustomizations[dataClass]
              const colorClasses = getDataclassColorClasses(customization)
              return (
                <button
                  key={dataClass}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={dataClass === value}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectDataclass(dataClass)}
                  style={colorClasses.style}
                  className={cn(
                    'flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs',
                    'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    index === activeIndex && 'bg-muted/70'
                  )}
                >
                  <Check
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      dataClass === value ? 'opacity-100' : 'opacity-0'
                    )}
                    aria-hidden="true"
                  />
                  <DataclassIcon
                    customization={customization}
                    className={cn('h-3.5 w-3.5 shrink-0', colorClasses.text)}
                  />
                  <span className={cn('min-w-0 flex-1 truncate font-mono', colorClasses.text)}>
                    {dataClass}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
