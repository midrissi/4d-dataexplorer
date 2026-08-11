import { cn, Label } from '@4d/ui'
import { type LucideIcon, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from '~/i18n'

export type PlaygroundExampleId =
  | 'greeting'
  | 'email'
  | 'mixed'
  | 'pick'
  | 'repeat'
  | 'object'
  | 'vector'
  | 'hash'
  | 'this'

export type PlaygroundExample = {
  id: PlaygroundExampleId
  template: string
  /** Short mono preview shown under the title. */
  preview: string
}

/** Demo `$this` root for the Environments playground. */
export const PLAYGROUND_THIS = {
  name: 'Ada',
  email: 'ada@example.com',
  method: 'POST',
  path: '/rest/Person',
  headers: { Authorization: 'Bearer demo-token' },
} as const

export const PLAYGROUND_EXAMPLES: readonly PlaygroundExample[] = [
  {
    id: 'greeting',
    template: 'Hello {{$faker.person.firstName | lower}}!',
    preview: 'Hello {{$faker.person.firstName | lower}}!',
  },
  {
    id: 'email',
    template: '{{$faker.internet.email}}',
    preview: '{{$faker.internet.email}}',
  },
  {
    id: 'mixed',
    template:
      '{{$faker.person.fullName | female}}\n{{$faker.location.city}}, {{$faker.location.country}}\n{{$timestamp}}',
    preview: '{{$faker.person.fullName | female}} · city · $timestamp',
  },
  {
    id: 'pick',
    template: '{{$pick | from:draft,published,archived}}',
    preview: '{{$pick | from:draft,published,archived}}',
  },
  {
    id: 'repeat',
    template: '{{$repeat | of:$faker.person.firstName | count:2,5}}',
    preview: '{{$repeat | of:$faker.person.firstName | count:2,5}}',
  },
  {
    id: 'object',
    template:
      '{{$object | name:$faker.person.fullName | email:$faker.internet.email | city:$faker.location.city}}',
    preview: '{{$object | name:… | email:… | city:…}}',
  },
  {
    id: 'vector',
    template: '{{$vector | dims:8 | normalize}}',
    preview: '{{$vector | dims:8 | normalize}}',
  },
  {
    id: 'hash',
    template: '{{$faker.person.firstName | hash:md5}}',
    preview: '{{$faker.person.firstName | hash:md5}}',
  },
  {
    id: 'this',
    template: '{{$this.method}} {{$this.path}}\nAuthorization: {{$this.headers.Authorization}}\nHi {{$this.name}}!',
    preview: '{{$this.method}} {{$this.path}} · $this.name',
  },
]

const EXAMPLE_LABEL_KEYS = {
  greeting: 'environments.testTemplatesExampleGreeting',
  email: 'environments.testTemplatesExampleEmail',
  mixed: 'environments.testTemplatesExampleMixed',
  pick: 'environments.testTemplatesExamplePick',
  repeat: 'environments.testTemplatesExampleRepeat',
  object: 'environments.testTemplatesExampleObject',
  vector: 'environments.testTemplatesExampleVector',
  hash: 'environments.testTemplatesExampleHash',
  this: 'environments.testTemplatesExampleThis',
} as const

/** Favourites-style examples strip for the template playground. */
export function EnvTemplatePlaygroundExamples({
  selectedId,
  onSelect,
}: {
  selectedId: PlaygroundExampleId | null
  onSelect: (example: PlaygroundExample) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border/70 bg-muted/10 shadow-xs">
      <div className="flex shrink-0 items-center gap-2 border-border/60 border-b bg-muted/25 px-2 py-1">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 flex-1 font-medium text-xs">
          {t('environments.testTemplatesExamples')}
        </p>
        <span className="rounded-full border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
          {PLAYGROUND_EXAMPLES.length}
        </span>
      </div>
      <div className="max-h-44 overflow-y-auto overscroll-contain bg-background/40 sm:max-h-none sm:flex-1">
        {PLAYGROUND_EXAMPLES.map((example) => {
          const selected = selectedId === example.id
          return (
            <button
              key={example.id}
              type="button"
              onClick={() => onSelect(example)}
              className={cn(
                'group relative flex w-full items-start gap-2 border-border/50 border-b px-2 py-1.5 text-left transition-colors last:border-b-0',
                selected ? 'bg-primary/10' : 'hover:bg-muted/35'
              )}
              aria-pressed={selected}
            >
              <span
                className={cn(
                  'mt-0.5 h-7 w-0.5 shrink-0 rounded-full transition-colors',
                  selected ? 'bg-primary/70' : 'bg-transparent group-hover:bg-muted-foreground/25'
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium font-sans text-[11px] text-foreground leading-tight">
                  {t(EXAMPLE_LABEL_KEYS[example.id])}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground leading-snug">
                  {example.preview}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Dense section chrome matching SavedListPanel headers. */
export function PlaygroundSection({
  icon: Icon,
  title,
  titleFor,
  count,
  actions,
  children,
  className,
  bodyClassName,
}: {
  icon: LucideIcon
  title: string
  titleFor?: string
  count?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-md border border-border/70 bg-muted/10 shadow-xs',
        className
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-border/60 border-b bg-muted/25 px-2 py-1">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 flex-1 font-medium text-xs">
          {titleFor ? (
            <Label htmlFor={titleFor} className="cursor-pointer font-medium text-xs">
              {title}
            </Label>
          ) : (
            title
          )}
        </p>
        {count}
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      <div className={cn('min-h-0 bg-background/40', bodyClassName)}>{children}</div>
    </div>
  )
}
