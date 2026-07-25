import { describe, expect, it } from 'bun:test'
import {
  classifySectionKind,
  countReleaseNoteItems,
  parseReleaseNotes,
  releaseNotesMatchQuery,
} from './parse-release-notes'

const SAMPLE = `# Release notes

---

## 1.2.x

### Overview

Version \`1.2.x\` adds bulk tools and an AI assistant.

### Features

#### AI Assistant

- **Fullscreen mode** — Expand the assistant panel.
- **Copy trace** — Copy activity trace.
- **Assistant panel** — AI chat with tools.

### Fixes

- **Profile shortcuts** — Shortcuts merge with defaults.

---

## 1.1.x

### Features

- **Welcome screen** — Database summary with charts.
`

describe('parseReleaseNotes', () => {
  it('parses title and versions', () => {
    const parsed = parseReleaseNotes(SAMPLE)
    expect(parsed.title).toBe('Release notes')
    expect(parsed.versions).toHaveLength(2)
    expect(parsed.versions[0]?.version).toBe('1.2.x')
  })

  it('parses overview text', () => {
    const parsed = parseReleaseNotes(SAMPLE)
    expect(parsed.versions[0]?.sections[0]?.kind).toBe('overview')
    expect(parsed.versions[0]?.sections[0]?.overviewText).toContain('bulk tools')
  })

  it('parses grouped feature items', () => {
    const parsed = parseReleaseNotes(SAMPLE)
    const features = parsed.versions[0]?.sections.find((s) => s.kind === 'features')
    expect(features?.groups[0]?.title).toBe('AI Assistant')
    expect(features?.groups[0]?.items).toHaveLength(3)
    expect(features?.groups[0]?.items[0]?.title).toBe('Fullscreen mode')
  })

  it('classifies localized section titles', () => {
    expect(classifySectionKind('Fonctionnalités')).toBe('features')
    expect(classifySectionKind('Correcciones')).toBe('fixes')
    expect(classifySectionKind('Aperçu')).toBe('overview')
  })

  it('counts features and fixes', () => {
    const parsed = parseReleaseNotes(SAMPLE)
    expect(countReleaseNoteItems(parsed)).toEqual({ features: 4, fixes: 1 })
  })

  it('filters by search query', () => {
    const parsed = parseReleaseNotes(SAMPLE)
    const filtered = releaseNotesMatchQuery(parsed, 'fullscreen')
    expect(filtered.versions).toHaveLength(1)
    const features = filtered.versions[0]?.sections.find((s) => s.kind === 'features')
    expect(features?.groups[0]?.items).toHaveLength(1)
  })
})
