import { cn } from '@4d/ui'
import {
  Bot,
  ChevronDown,
  Code2,
  Database,
  FileText,
  FolderOpen,
  History,
  Layers,
  type LucideIcon,
  Network,
  Palette,
  Rocket,
  Search,
  Settings,
  Sparkles,
  Tag,
  Wrench,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { EmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import {
  countReleaseNoteItems,
  parseReleaseNotes,
  type ReleaseNoteSection,
  type ReleaseNoteSectionKind,
  type ReleaseNoteVersion,
  releaseNotesMatchQuery,
} from '~/lib/parse-release-notes'

const SECTION_META: Record<
  ReleaseNoteSectionKind,
  { icon: LucideIcon; accent: string; chip: string }
> = {
  overview: {
    icon: FileText,
    accent: 'text-sky-500',
    chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  features: {
    icon: Sparkles,
    accent: 'text-primary',
    chip: 'bg-primary/10 text-primary',
  },
  fixes: {
    icon: Wrench,
    accent: 'text-amber-500',
    chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  technical: {
    icon: Code2,
    accent: 'text-violet-500',
    chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  other: {
    icon: Tag,
    accent: 'text-muted-foreground',
    chip: 'bg-muted text-muted-foreground',
  },
}

function groupIcon(title: string): LucideIcon {
  const t = title.toLowerCase()
  if (t.includes('assistant') || t.includes('metadata') || t.includes('métadonnées')) {
    return Bot
  }
  if (t.includes('graph') || t.includes('structure') || t.includes('graphe')) return Network
  if (t.includes('schema') || t.includes('schéma') || t.includes('json')) return Code2
  if (t.includes('profile') || t.includes('profil') || t.includes('setting')) return Settings
  if (t.includes('appearance') || t.includes('theme') || t.includes('apparence')) return Palette
  if (t.includes('dataclass') || t.includes('entit') || t.includes('data')) return Database
  if (t.includes('home') || t.includes('navigation')) return Rocket
  return FolderOpen
}

function versionAnchor(version: string): string {
  return `release-${version.replace(/\./g, '-')}`
}

type ReleaseNotesViewProps = {
  markdown: string
}

export function ReleaseNotesView({ markdown }: ReleaseNotesViewProps) {
  const { t } = useTranslation()
  const parsed = useMemo(() => parseReleaseNotes(markdown), [markdown])
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([parsed.versions[0]?.version ?? ''])
  )

  const filtered = useMemo(() => releaseNotesMatchQuery(parsed, query), [parsed, query])
  const stats = useMemo(() => countReleaseNoteItems(parsed), [parsed])

  const toggleVersion = (version: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(version)) next.delete(version)
      else next.add(version)
      return next
    })
  }

  const scrollToVersion = (version: string) => {
    setExpanded((prev) => new Set(prev).add(version))
    requestAnimationFrame(() => {
      document
        .getElementById(versionAnchor(version))
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="relative h-full overflow-auto bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[8%] left-[5%] h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-[35%] right-[8%] h-80 w-80 rounded-full bg-violet-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full px-4 py-6 lg:px-6">
        {/* Hero header */}
        <header className="mb-6 text-center">
          <div className="relative mx-auto mb-4 h-20 w-20">
            <div className="absolute inset-0 animate-pulse rounded-3xl bg-primary/20" />
            <div className="absolute inset-2 flex items-center justify-center rounded-2xl bg-background shadow-lg">
              <Rocket className="h-9 w-9 text-primary" />
            </div>
          </div>
          <h1 className="font-semibold text-3xl text-foreground tracking-tight">{parsed.title}</h1>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground text-sm">
            {t('releaseNotes.subtitle')}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {parsed.versions[0] && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-primary text-xs">
                <Sparkles className="h-3.5 w-3.5" />v{parsed.versions[0].version}
                <span className="rounded-full bg-primary/20 px-1.5 py-0.5 font-sans text-[10px] uppercase tracking-wide">
                  {t('releaseNotes.latest')}
                </span>
              </span>
            )}
            <span className="rounded-full border bg-card px-3 py-1 text-muted-foreground text-xs">
              {t('releaseNotes.versionCount', { count: parsed.versions.length })}
            </span>
            <span className="rounded-full border bg-card px-3 py-1 text-muted-foreground text-xs">
              {t('releaseNotes.featureCount', { count: stats.features })}
            </span>
            <span className="rounded-full border bg-card px-3 py-1 text-muted-foreground text-xs">
              {t('releaseNotes.fixCount', { count: stats.fixes })}
            </span>
          </div>
        </header>

        <div className="mx-auto mb-6 max-w-sm">
          <ReleaseNotesSearch query={query} onChange={setQuery} />
        </div>

        {filtered.versions.length === 0 ? (
          <EmptyPanel
            icon={Search}
            badgeIcon={Sparkles}
            badgeTone="amber"
            title={t('releaseNotes.noResults')}
            description={t('releaseNotes.noResultsHint')}
            ghost="rows"
            bordered
            size="md"
            action={
              <EmptyPanelAction icon={X} onClick={() => setQuery('')}>
                {t('releaseNotes.clearSearch')}
              </EmptyPanelAction>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-5">
            <nav className="hidden lg:block" aria-label={t('releaseNotes.versionNav')}>
              <div className="sticky top-4 space-y-1 rounded-xl border bg-card/80 p-3 backdrop-blur-sm">
                <p className="mb-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  {t('releaseNotes.timeline')}
                </p>
                {parsed.versions.map((version, index) => (
                  <button
                    key={version.version}
                    type="button"
                    onClick={() => scrollToVersion(version.version)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted/80',
                      index === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        index === 0
                          ? 'bg-primary shadow-[0_0_8px] shadow-primary/50'
                          : 'bg-muted-foreground/40'
                      )}
                    />
                    <span className="font-mono">v{version.version}</span>
                  </button>
                ))}
              </div>
            </nav>

            <div className="min-w-0 space-y-4">
              {filtered.versions.map((version) => (
                <VersionCard
                  key={version.version}
                  version={version}
                  isLatest={parsed.versions[0]?.version === version.version}
                  isExpanded={expanded.has(version.version)}
                  onToggle={() => toggleVersion(version.version)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ReleaseNotesSearch({
  query,
  onChange,
}: {
  query: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 transition-colors focus-within:bg-background focus-within:ring-2 focus-within:ring-ring">
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('releaseNotes.searchPlaceholder')}
        aria-label={t('releaseNotes.searchPlaceholder')}
        className="h-full min-w-0 flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground"
      />
      {query ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label={t('releaseNotes.clearSearch')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}

type VersionCardProps = {
  version: ReleaseNoteVersion
  isLatest: boolean
  isExpanded: boolean
  onToggle: () => void
}

function VersionCard({ version, isLatest, isExpanded, onToggle }: VersionCardProps) {
  const { t } = useTranslation()
  const open = isExpanded

  const featureCount = version.sections
    .filter((s) => s.kind === 'features')
    .reduce((n, s) => n + s.groups.reduce((g, group) => g + group.items.length, 0), 0)
  const fixCount = version.sections
    .filter((s) => s.kind === 'fixes')
    .reduce((n, s) => n + s.groups.reduce((g, group) => g + group.items.length, 0), 0)

  return (
    <article
      id={versionAnchor(version.version)}
      className={cn(
        'scroll-mt-4 overflow-hidden rounded-xl border bg-card/80 shadow-sm backdrop-blur-sm',
        isLatest && 'ring-1 ring-primary/25'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 border-b bg-muted/20 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            isLatest
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {isLatest ? (
            <Sparkles className="h-5 w-5" />
          ) : (
            <History className="h-5 w-5" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-foreground text-lg">v{version.version}</h2>
            {isLatest && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-[10px] text-primary uppercase tracking-wide">
                {t('releaseNotes.latest')}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-2 text-muted-foreground text-xs">
            {featureCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                {t('releaseNotes.featureCount', { count: featureCount })}
              </span>
            )}
            {fixCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Wrench className="h-3 w-3 text-amber-500" />
                {t('releaseNotes.fixCount', { count: fixCount })}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="space-y-5 px-4 py-4">
          {version.sections.map((section) => (
            <SectionBlock key={`${version.version}-${section.title}`} section={section} />
          ))}
        </div>
      )}
    </article>
  )
}

function SectionBlock({ section }: { section: ReleaseNoteSection }) {
  const meta = SECTION_META[section.kind]
  const Icon = meta.icon

  if (section.kind === 'overview' && section.overviewText) {
    return (
      <section>
        <SectionHeader
          title={section.title}
          icon={Icon}
          accent={meta.accent}
          chipClass={meta.chip}
        />
        <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-muted-foreground text-sm leading-relaxed">
          {renderInlineCode(section.overviewText)}
        </p>
      </section>
    )
  }

  const hasItems = section.groups.some((g) => g.items.length > 0)
  if (!hasItems) return null

  const isFixes = section.kind === 'fixes'

  return (
    <section>
      <SectionHeader title={section.title} icon={Icon} accent={meta.accent} chipClass={meta.chip} />
      <div className="space-y-4">
        {section.groups.map((group) => {
          if (group.items.length === 0) return null
          const GroupIcon = group.title ? groupIcon(group.title) : Layers

          return (
            <div key={group.title ?? 'default'}>
              {group.title && (
                <h4 className="mb-2 flex items-center gap-2 font-medium text-foreground text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                    <GroupIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  {group.title}
                </h4>
              )}
              <ul
                className={cn(
                  isFixes
                    ? 'space-y-2'
                    : 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2'
                )}
              >
                {group.items.map((item) => (
                  <li
                    key={item.title}
                    className={cn(
                      'rounded-lg border bg-background/60 px-3 py-2.5 transition-colors hover:border-primary/20 hover:bg-background',
                      isFixes && 'flex gap-2.5'
                    )}
                  >
                    {isFixes && (
                      <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/80" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm">{item.title}</p>
                      <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                        {renderInlineCode(item.description)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SectionHeader({
  title,
  icon: Icon,
  accent,
  chipClass,
}: {
  title: string
  icon: LucideIcon
  accent: string
  chipClass: string
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', chipClass)}>
        <Icon className={cn('h-4 w-4', accent)} />
      </span>
      <h3 className="font-semibold text-base text-foreground">{title}</h3>
    </div>
  )
}

/** Render `backtick` segments as inline code chips. */
function renderInlineCode(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`)/g)
  let offset = 0
  return parts.map((part) => {
    const key = `${offset}-${part.length}`
    offset += part.length
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}
