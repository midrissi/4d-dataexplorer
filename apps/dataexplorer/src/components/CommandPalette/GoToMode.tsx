import { Button, cn } from '@4d/ui'
import { FileStack, Hash } from 'lucide-react'
import type { RefObject } from 'react'
import type { TFunction } from './utils'

export type GoToVariant = 'entity' | 'page'

export type GoToModeProps = {
  variant: GoToVariant
  goToValue: string
  setGoToValue: (value: string) => void
  goToInputRef: RefObject<HTMLInputElement | null>
  onGoTo: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  pagination: { total: number; totalPages: number; page: number } | null
  pageSize: number
  t: TFunction
  className?: string
}

export function GoToModeHeader({
  variant,
  goToValue,
  setGoToValue,
  goToInputRef,
  onGoTo,
  onKeyDown,
  pagination,
  t,
  className,
}: GoToModeProps) {
  const isPage = variant === 'page'
  const max = isPage ? (pagination?.totalPages ?? undefined) : (pagination?.total ?? undefined)
  const Icon = isPage ? FileStack : Hash
  const prefix = isPage ? ':' : '#'
  const placeholder = isPage
    ? t('commandPalette.goToPagePlaceholder')
    : t('commandPalette.goToEntityPlaceholder')

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-primary text-sm">{prefix}</span>
      <input
        ref={goToInputRef}
        type="number"
        min="1"
        max={max}
        value={goToValue}
        onChange={(e) => setGoToValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-xs outline-none [appearance:textfield] placeholder:text-muted-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          className ? 'min-h-0' : 'h-8'
        )}
      />
      <Button
        variant="default"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={onGoTo}
        disabled={!goToValue || Number.parseInt(goToValue, 10) < 1}
      >
        {t('commandPalette.go')}
      </Button>
      <kbd className="hidden rounded bg-muted px-1 py-0.5 font-mono text-muted-foreground text-xs sm:inline">
        esc
      </kbd>
    </div>
  )
}

export function GoToModeContent({
  variant,
  goToValue,
  pagination,
  pageSize,
  t,
}: Pick<GoToModeProps, 'variant' | 'goToValue' | 'pagination' | 'pageSize' | 't'>) {
  const parsed = Number.parseInt(goToValue, 10)
  const valid = goToValue !== '' && !Number.isNaN(parsed) && parsed >= 1
  const isPage = variant === 'page'
  const Icon = isPage ? FileStack : Hash

  const entityPage = valid ? Math.ceil(parsed / pageSize) : 0
  const entityPosition = valid ? ((parsed - 1) % pageSize) + 1 : 0
  const pageOutOfRange = isPage && valid && pagination != null && parsed > pagination.totalPages

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4">
      <Icon className="mb-4 h-12 w-12 text-muted-foreground/50" />
      <p className="mb-2 font-medium text-foreground">
        {isPage ? t('commandPalette.goToByPageTitle') : t('commandPalette.goToByIndexTitle')}
      </p>
      <p className="mb-4 text-center text-muted-foreground text-sm">
        {isPage
          ? t('commandPalette.goToByPageDescription')
          : t('commandPalette.goToByIndexDescription')}
        {pagination && (
          <>
            <br />
            <span className="text-xs">
              {isPage ? (
                <>
                  {t('commandPalette.totalPagesLabel')}: {pagination.totalPages.toLocaleString()} •{' '}
                  {t('commandPalette.currentPageLabel')}: {pagination.page}
                </>
              ) : (
                <>
                  {t('commandPalette.totalEntitiesLabel')}: {pagination.total.toLocaleString()} •{' '}
                  {t('commandPalette.pageSizeLabel')}: {pageSize}
                </>
              )}
            </span>
          </>
        )}
      </p>
      {valid ? (
        <div className="rounded-lg bg-muted p-3 text-center text-sm">
          {isPage ? (
            pageOutOfRange ? (
              <p className="text-destructive">
                {t('commandPalette.pageOutOfRange', {
                  page: String(parsed),
                  total: String(pagination?.totalPages ?? 0),
                })}
              </p>
            ) : (
              <p>
                {t('commandPalette.pageTarget', {
                  page: String(parsed),
                  total: String(pagination?.totalPages ?? '—'),
                })}
              </p>
            )
          ) : (
            <p>
              {t('commandPalette.entityPosition', {
                index: goToValue,
                page: String(entityPage),
                position: String(entityPosition),
              })}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function GoToModeFooter({ variant, t }: { variant: GoToVariant; t: TFunction }) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">↵</kbd>
        <span>
          {variant === 'page' ? t('commandPalette.goToPage') : t('commandPalette.goToEntity')}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          {t('commandPalette.escKey')}
        </kbd>
        <span>{t('commandPalette.back')}</span>
      </div>
    </>
  )
}
