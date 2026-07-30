import { Button, cn } from '@4d/ui'
import type { LucideIcon } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'

export type EmptyPanelChip = {
  label: string
  icon?: LucideIcon
  tone?: 'primary' | 'amber' | 'cyan' | 'default'
}

export type EmptyPanelProps = {
  icon: LucideIcon
  title: string
  description?: string
  /** Small overlay on the icon badge (icon or short label like "0"). */
  badgeIcon?: LucideIcon
  badgeLabel?: string
  badgeTone?: 'primary' | 'amber' | 'cyan' | 'muted'
  chips?: EmptyPanelChip[]
  action?: ReactNode
  /** Decorative stacked silhouettes behind the content. */
  ghost?: 'rows' | 'cards' | 'none'
  bordered?: boolean
  size?: 'sm' | 'md' | 'lg'
  /** Vertical alignment of the content block. @default 'center' */
  align?: 'center' | 'start'
  className?: string
  /** Applied to the inner content column (title, description, chips, actions). */
  contentClassName?: string
  children?: ReactNode
}

const badgeToneClass: Record<NonNullable<EmptyPanelProps['badgeTone']>, string> = {
  primary: 'bg-primary text-primary-foreground',
  amber: 'bg-amber-500 text-white',
  cyan: 'bg-cyan-500 text-white',
  muted: 'bg-background text-muted-foreground',
}

const chipToneClass: Record<NonNullable<EmptyPanelChip['tone']>, string> = {
  primary: 'text-primary',
  amber: 'text-amber-500',
  cyan: 'text-cyan-600 dark:text-cyan-400',
  default: 'text-muted-foreground',
}

/**
 * Shared empty-state panel used across Data Explorer.
 * Radial glow + dotted field + optional ghost silhouettes + icon badge.
 */
export function EmptyPanel({
  icon: Icon,
  title,
  description,
  badgeIcon: BadgeIcon,
  badgeLabel,
  badgeTone = 'muted',
  chips,
  action,
  ghost = 'rows',
  bordered = false,
  size = 'md',
  align = 'center',
  className,
  contentClassName,
  children,
}: EmptyPanelProps) {
  const isSm = size === 'sm'
  const isLg = size === 'lg'

  return (
    <div
      className={cn(
        'relative flex flex-col items-center overflow-hidden text-center',
        align === 'start' ? 'justify-start' : 'justify-center',
        bordered && 'rounded-lg border border-border/80 border-dashed',
        isSm ? 'min-h-24 px-3 py-4' : isLg ? 'min-h-0 flex-1 px-5 py-6' : 'min-h-40 px-4 py-6',
        className
      )}
    >
      {ghost !== 'none' ? (
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-x-6 top-1/2 flex translate-y-[-78%] flex-col opacity-35',
            isSm ? 'gap-1' : 'gap-1.5'
          )}
        >
          {[0, 1, 2].map((i) =>
            ghost === 'cards' ? (
              <div
                key={i}
                className={cn(
                  'mx-auto flex w-full items-center gap-2 rounded-lg border border-border/70 border-dashed bg-muted/15 px-2',
                  isSm ? 'h-6 max-w-40' : 'h-8 max-w-xl'
                )}
                style={{
                  transform: `scale(${1 - i * 0.05}) translateY(${i * 2}px)`,
                  opacity: 1 - i * 0.3,
                }}
              >
                <span
                  className={cn('shrink-0 rounded-md bg-muted/50', isSm ? 'h-3 w-3' : 'h-4 w-4')}
                />
                <span className="h-1.5 flex-1 rounded-full bg-muted/40" />
                <span className="h-1.5 w-6 shrink-0 rounded-full bg-muted/30" />
              </div>
            ) : (
              <div
                key={i}
                className={cn(
                  'mx-auto w-full rounded-md border border-border/70 border-dashed bg-muted/20',
                  isSm ? 'h-6 max-w-44' : 'h-9 max-w-xl'
                )}
                style={{
                  transform: `scale(${1 - i * 0.04}) translateY(${i * 2}px)`,
                  opacity: 1 - i * 0.28,
                }}
              />
            )
          )}
        </div>
      ) : null}

      <div
        className={cn(
          'relative flex w-full flex-col items-center',
          isSm ? 'max-w-56' : 'max-w-sm',
          contentClassName
        )}
      >
        <div className={cn('relative', isSm ? 'mb-2' : 'mb-3')}>
          <div
            className={cn(
              'flex items-center justify-center rounded-2xl border border-border/60 bg-background/80 shadow-sm backdrop-blur-sm',
              isSm ? 'h-9 w-9' : isLg ? 'h-14 w-14' : 'h-12 w-12'
            )}
          >
            <Icon
              className={cn(
                'text-muted-foreground',
                isSm ? 'h-4 w-4' : isLg ? 'h-7 w-7' : 'h-6 w-6'
              )}
            />
          </div>
          {(BadgeIcon || badgeLabel) && (
            <span
              className={cn(
                'absolute -right-1.5 -bottom-1.5 flex items-center justify-center rounded-full border border-background shadow-sm',
                badgeToneClass[badgeTone],
                badgeLabel
                  ? 'h-6 min-w-6 px-1.5 font-semibold text-[11px]'
                  : isSm
                    ? 'h-5 w-5'
                    : 'h-6 w-6'
              )}
            >
              {badgeLabel ? (
                badgeLabel
              ) : BadgeIcon ? (
                <BadgeIcon className={cn(isSm ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
              ) : null}
            </span>
          )}
        </div>

        <p
          className={cn(
            'font-semibold tracking-tight',
            isSm ? 'text-xs' : isLg ? 'text-base' : 'text-sm'
          )}
        >
          {title}
        </p>
        {description ? (
          <p
            className={cn(
              'text-muted-foreground leading-relaxed',
              isSm ? 'mt-1 text-[11px]' : 'mt-1.5 text-xs'
            )}
          >
            {description}
          </p>
        ) : null}

        {chips && chips.length > 0 ? (
          <div
            className={cn(
              'flex flex-wrap items-center justify-center gap-1.5',
              isSm ? 'mt-3' : 'mt-4'
            )}
          >
            {chips.map((chip) => {
              const ChipIcon = chip.icon
              const tone = chip.tone ?? 'default'
              return (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {ChipIcon ? <ChipIcon className={cn('h-3 w-3', chipToneClass[tone])} /> : null}
                  {chip.label}
                </span>
              )
            })}
          </div>
        ) : null}

        {action ? (
          <div
            className={cn(
              'flex flex-wrap items-center justify-center gap-2',
              isSm ? 'mt-3' : 'mt-4'
            )}
          >
            {action}
          </div>
        ) : null}

        {children}
      </div>
    </div>
  )
}

/** Convenience outline button sized for EmptyPanel actions. */
export function EmptyPanelAction({
  children,
  onClick,
  disabled,
  icon: ActionIcon,
}: {
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  icon?: LucideIcon
}) {
  return (
    <Button type="button" variant="outline" size="xs" onClick={onClick} disabled={disabled}>
      {ActionIcon ? <ActionIcon /> : null}
      {children}
    </Button>
  )
}
