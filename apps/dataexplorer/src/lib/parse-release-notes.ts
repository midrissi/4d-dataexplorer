export type ReleaseNoteItem = {
  title: string
  description: string
}

export type ReleaseNoteGroup = {
  title?: string
  items: ReleaseNoteItem[]
}

export type ReleaseNoteSectionKind = 'overview' | 'features' | 'fixes' | 'technical' | 'other'

export type ReleaseNoteSection = {
  kind: ReleaseNoteSectionKind
  title: string
  overviewText?: string
  groups: ReleaseNoteGroup[]
}

export type ReleaseNoteVersion = {
  version: string
  sections: ReleaseNoteSection[]
}

export type ParsedReleaseNotes = {
  title: string
  versions: ReleaseNoteVersion[]
}

const LIST_ITEM_RE = /^-\s+\*\*(.+?)\*\*\s+[—–-]\s+(.+)$/
const VERSION_RE = /^##\s+(.+)$/
const SECTION_RE = /^###\s+(.+)$/
const GROUP_RE = /^####\s+(.+)$/

export function classifySectionKind(title: string): ReleaseNoteSectionKind {
  const normalized = title.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

  if (/\b(overview|apercu|resumen)\b/.test(normalized)) return 'overview'
  if (/\b(features|fonctionnalites|funcionalidades|caracteristicas)\b/.test(normalized)) {
    return 'features'
  }
  if (/\b(fixes|corrections|correcciones)\b/.test(normalized)) return 'fixes'
  if (/\b(technical|technique|tecnico|tecnica)\b/.test(normalized)) return 'technical'
  return 'other'
}

function parseListItem(line: string): ReleaseNoteItem | null {
  const match = LIST_ITEM_RE.exec(line.trim())
  if (!match) return null
  return { title: match[1].trim(), description: match[2].trim() }
}

function createEmptySection(title: string): ReleaseNoteSection {
  return {
    kind: classifySectionKind(title),
    title,
    groups: [{ items: [] }],
  }
}

/** Parse release-notes markdown into structured version/section data. */
export function parseReleaseNotes(markdown: string): ParsedReleaseNotes {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let title = 'Release notes'
  const versions: ReleaseNoteVersion[] = []

  let currentVersion: ReleaseNoteVersion | null = null
  let currentSection: ReleaseNoteSection | null = null
  let currentGroup: ReleaseNoteGroup | null = null
  const overviewLines: string[] = []

  const flushOverview = () => {
    if (currentSection?.kind !== 'overview') return
    const text = overviewLines.join(' ').trim()
    if (text) currentSection.overviewText = text
    overviewLines.length = 0
  }

  const ensureGroup = () => {
    if (!currentSection) return
    if (!currentGroup) {
      currentGroup = { items: [] }
      currentSection.groups.push(currentGroup)
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    if (line.startsWith('# ') && !line.startsWith('## ')) {
      title = line.slice(2).trim()
      continue
    }

    if (line === '---' || line === '') {
      if (line === '' && currentSection?.kind === 'overview') {
        overviewLines.push('')
      }
      continue
    }

    const versionMatch = VERSION_RE.exec(line)
    if (versionMatch) {
      flushOverview()
      currentVersion = { version: versionMatch[1].trim(), sections: [] }
      versions.push(currentVersion)
      currentSection = null
      currentGroup = null
      continue
    }

    const sectionMatch = SECTION_RE.exec(line)
    if (sectionMatch && currentVersion) {
      flushOverview()
      currentSection = createEmptySection(sectionMatch[1].trim())
      currentVersion.sections.push(currentSection)
      currentGroup = null
      continue
    }

    const groupMatch = GROUP_RE.exec(line)
    if (groupMatch && currentSection) {
      flushOverview()
      currentGroup = { title: groupMatch[1].trim(), items: [] }
      currentSection.groups.push(currentGroup)
      continue
    }

    if (!currentSection) continue

    if (currentSection.kind === 'overview') {
      overviewLines.push(line.trim())
      continue
    }

    const item = parseListItem(line)
    if (item) {
      ensureGroup()
      currentGroup?.items.push(item)
    }
  }

  flushOverview()

  for (const version of versions) {
    for (const section of version.sections) {
      section.groups = section.groups.filter(
        (group) => group.items.length > 0 || Boolean(group.title)
      )
      if (section.groups.length === 0) {
        section.groups.push({ items: [] })
      }
    }
  }

  return { title, versions }
}

export function countReleaseNoteItems(notes: ParsedReleaseNotes): {
  features: number
  fixes: number
} {
  let features = 0
  let fixes = 0
  for (const version of notes.versions) {
    for (const section of version.sections) {
      const count = section.groups.reduce((sum, group) => sum + group.items.length, 0)
      if (section.kind === 'features') features += count
      if (section.kind === 'fixes') fixes += count
    }
  }
  return { features, fixes }
}

export function releaseNotesMatchQuery(
  notes: ParsedReleaseNotes,
  query: string
): ParsedReleaseNotes {
  const q = query.trim().toLowerCase()
  if (!q) return notes

  const versions = notes.versions
    .map((version) => {
      if (version.version.toLowerCase().includes(q)) return version

      const sections = version.sections
        .map((section) => {
          if (section.title.toLowerCase().includes(q)) return section
          if (section.overviewText?.toLowerCase().includes(q)) return section

          const groups = section.groups
            .map((group) => {
              if (group.title?.toLowerCase().includes(q)) return group
              const items = group.items.filter(
                (item) =>
                  item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
              )
              return items.length > 0 ? { ...group, items } : null
            })
            .filter((group): group is ReleaseNoteGroup => group !== null)

          if (groups.length === 0) return null
          return { ...section, groups }
        })
        .filter((section): section is ReleaseNoteSection => section !== null)

      if (sections.length === 0) return null
      return { ...version, sections }
    })
    .filter((version): version is ReleaseNoteVersion => version !== null)

  return { ...notes, versions }
}
