import { Button, cn } from '@4d/ui'
import { Command as CommandIcon, Search } from 'lucide-react'
import type { RefObject } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import type { Command } from '~/lib/commands'
import type { TFunction } from './utils'
import { formatRelativeTime } from './utils'

export type CommandsModeProps = {
  search: string
  setSearch: (value: string) => void
  inputRef: RefObject<HTMLInputElement | null>
  onKeyDown: (e: React.KeyboardEvent) => void
  filteredCommands: Command[]
  groupedCommands: Record<string, Command[]>
  selectedIndex: number
  setSelectedIndex: (index: number) => void
  listRef: RefObject<HTMLDivElement | null>
  onExecuteCommand: (cmd: Command) => void
  selectedDataclass: string | null
  t: TFunction
  locale?: string
  className?: string
}

export function CommandsModeHeader({
  search,
  setSearch,
  inputRef,
  onKeyDown,
  selectedDataclass,
  t,
  className,
}: CommandsModeProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={
          selectedDataclass
            ? t('commandPalette.placeholderFull')
            : t('commandPalette.placeholderShort')
        }
        className={cn(
          'min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground',
          className ? 'min-h-0' : 'h-8'
        )}
      />
      <kbd className="hidden rounded bg-muted px-1 py-0.5 font-mono text-muted-foreground text-xs sm:inline">
        {t('commandPalette.escKey')}
      </kbd>
    </div>
  )
}

export function CommandsModeContent({
  filteredCommands,
  groupedCommands,
  search,
  selectedIndex,
  setSelectedIndex,
  listRef,
  onExecuteCommand,
  t,
  locale,
}: CommandsModeProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-command-palette-list>
      <div ref={listRef} className="p-1">
        {filteredCommands.length === 0 ? (
          <EmptyPanel
            icon={CommandIcon}
            badgeIcon={Search}
            badgeTone="amber"
            title={t('commandPalette.noCommands')}
            ghost="none"
            size="sm"
          />
        ) : (
          Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category} className="mb-1">
              <div className="mb-0.5 px-1.5 py-0.5 font-medium text-muted-foreground text-xs">
                {t(`category.${category}`)}
              </div>
              {cmds.map((cmd) => {
                const globalIndex = filteredCommands.indexOf(cmd)
                const isSelected = globalIndex === selectedIndex
                const lowerSearch = search.toLowerCase()
                const hasKeywords = cmd.keywords && cmd.keywords.length > 0

                return (
                  <Button
                    type="button"
                    key={cmd.id}
                    variant="ghost"
                    data-index={globalIndex}
                    onClick={() => onExecuteCommand(cmd)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    className={cn(
                      'group h-auto min-h-7 w-full items-start justify-start gap-2 whitespace-normal rounded-sm px-1.5 py-1.5 text-left hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-accent text-accent-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 shrink-0',
                        isSelected
                          ? 'text-accent-foreground'
                          : 'text-muted-foreground group-hover:text-accent-foreground'
                      )}
                    >
                      {cmd.icon}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div
                        className={cn(
                          'truncate font-medium text-xs leading-tight',
                          isSelected
                            ? 'text-accent-foreground'
                            : 'group-hover:text-accent-foreground'
                        )}
                      >
                        {cmd.label}
                      </div>
                      {cmd.description && (
                        <div
                          className={cn(
                            'truncate text-[11px] leading-tight',
                            isSelected
                              ? 'text-accent-foreground/75'
                              : 'text-muted-foreground group-hover:text-accent-foreground/80'
                          )}
                        >
                          {cmd.description}
                        </div>
                      )}
                      {hasKeywords && (
                        <div className="flex items-center gap-1">
                          <span
                            className={cn(
                              'shrink-0 text-[10px] leading-none',
                              isSelected
                                ? 'text-accent-foreground/70'
                                : 'text-muted-foreground/50 group-hover:text-accent-foreground/70'
                            )}
                          >
                            {t('commandPalette.keywords')}
                          </span>
                          <div className="flex min-w-0 flex-wrap gap-0.5">
                            {cmd.keywords?.map((keyword) => {
                              const translatedKw = t(`commandPalette.keyword.${keyword}`)
                              const displayKw =
                                translatedKw && translatedKw !== `commandPalette.keyword.${keyword}`
                                  ? translatedKw
                                  : keyword
                              const isMatch =
                                search &&
                                (displayKw.toLowerCase().includes(lowerSearch) ||
                                  keyword.toLowerCase().includes(lowerSearch))
                              return (
                                <span
                                  key={keyword}
                                  className={cn(
                                    'inline-flex items-center rounded-sm px-1 py-px text-[10px] leading-none',
                                    isSelected
                                      ? 'bg-background/40 text-accent-foreground'
                                      : isMatch
                                        ? 'bg-primary/20 text-primary group-hover:bg-background/40 group-hover:text-accent-foreground'
                                        : 'bg-muted text-muted-foreground/70 group-hover:bg-background/40 group-hover:text-accent-foreground'
                                  )}
                                >
                                  {displayKw}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    {cmd.usedAt && (
                      <span
                        className={cn(
                          'mt-0.5 shrink-0 text-[10px] leading-none',
                          isSelected
                            ? 'text-accent-foreground/80'
                            : 'text-muted-foreground/60 group-hover:text-accent-foreground/80'
                        )}
                      >
                        {formatRelativeTime(cmd.usedAt, t, locale)}
                      </span>
                    )}
                    {cmd.shortcut && (
                      <kbd
                        className={cn(
                          'mt-0.5 shrink-0 rounded px-1 py-0.5 font-mono text-[10px] leading-none',
                          isSelected
                            ? 'bg-background/40 text-accent-foreground'
                            : 'bg-muted text-muted-foreground group-hover:bg-background/40 group-hover:text-accent-foreground'
                        )}
                      >
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </Button>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function CommandsModeFooter({ t }: { t: TFunction }) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">↑↓</kbd>
        <span>{t('commandPalette.navigate')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">↵</kbd>
        <span>{t('commandPalette.execute')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">esc</kbd>
        <span>{t('common.close')}</span>
      </div>
    </>
  )
}
