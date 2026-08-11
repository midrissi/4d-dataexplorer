import type { EnvTemplateSuggestion } from '@4d/ui'

export type FieldTemplateHint = {
  /** Attribute / form field name (e.g. `firstname`, `email_address`). */
  name: string
  /** Dataclass attribute type (`string`, `date`, `bool`, `int`, …). */
  type?: string
}

type SynonymRule = {
  /** Match normalized field name (lowercase, no separators). */
  test: RegExp
  keys: readonly string[]
}

/** Common field-name → dynamic template mappings. */
const FIELD_SYNONYMS: readonly SynonymRule[] = [
  { test: /^firstname$|^fname$|^givenname$/, keys: ['$faker.person.firstName'] },
  { test: /^lastname$|^surname$|^lname$|^familyname$/, keys: ['$faker.person.lastName'] },
  {
    test: /^fullname$|^name$|^displayname$|^username$/,
    keys: ['$faker.person.fullName', '$faker.internet.userName'],
  },
  { test: /^email$|^emailaddress$|^mail$/, keys: ['$faker.internet.email'] },
  { test: /^phone$|^mobile$|^tel$|^telephone$|^phonenumber$/, keys: ['$faker.phone.number'] },
  { test: /^city$|^town$/, keys: ['$faker.location.city'] },
  { test: /^country$/, keys: ['$faker.location.country'] },
  { test: /^street$|^address$|^streetaddress$/, keys: ['$faker.location.streetAddress'] },
  { test: /^zip$|^zipcode$|^postal$|^postcode$/, keys: ['$faker.location.zipCode'] },
  { test: /^company$|^org$|^organization$/, keys: ['$faker.company.name'] },
  { test: /^job$|^jobtitle$|^title$|^role$/, keys: ['$faker.person.jobTitle'] },
  { test: /^url$|^website$|^homepage$/, keys: ['$faker.internet.url'] },
  { test: /^password$|^passwd$|^secret$/, keys: ['$faker.internet.password'] },
  { test: /^uuid$|^guid$/, keys: ['$faker.string.uuid'] },
  { test: /^color$|^colour$/, keys: ['$faker.color.human', '$faker.color.rgb'] },
  { test: /^ip$|^ipaddress$/, keys: ['$faker.internet.ip'] },
  { test: /^avatar$|^photo$/, keys: ['$faker.image.avatar'] },
  { test: /^bio$|^about$|^description$|^summary$/, keys: ['$faker.lorem.sentence'] },
  { test: /^sex$|^gender$/, keys: ['$faker.person.sex'] },
]

const TYPE_DEFAULTS: Record<string, readonly string[]> = {
  bool: ['$faker.datatype.boolean'],
  date: ['$isoTimestamp', '$faker.date.past', '$faker.date.recent'],
  duration: ['$faker.number.int'],
  int: ['$faker.number.int', '$timestamp'],
  integer: ['$faker.number.int', '$timestamp'],
  long: ['$faker.number.int', '$timestamp'],
  word: ['$faker.number.int'],
  real: ['$faker.number.float'],
  float: ['$faker.number.float'],
  number: ['$faker.number.int', '$faker.number.float'],
  uuid: ['$faker.string.uuid'],
  image: ['$faker.image.avatar', '$faker.image.url'],
}

const MAX_SUGGESTIONS = 6

/** Lowercase alphanumeric only — `firstName` / `first_name` → `firstname`. */
export function normalizeFieldKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** True when strings differ by at most one insert/delete/substitute. */
export function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  if (longer.length - shorter.length > 1) return false

  if (longer.length === shorter.length) {
    let diffs = 0
    for (let i = 0; i < shorter.length; i++) {
      if (shorter[i] !== longer[i] && ++diffs > 1) return false
    }
    return diffs === 1
  }

  let i = 0
  let j = 0
  let skipped = 0
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i += 1
      j += 1
      continue
    }
    if (++skipped > 1) return false
    j += 1
  }
  return true
}

/** Split `firstName` / `first_name` / `first-name` into lowercase tokens. */
export function tokenizeFieldName(name: string): string[] {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0)
}

function synonymRuleMatches(norm: string, rule: SynonymRule): boolean {
  if (rule.test.test(norm)) return true
  // Tolerate common schema typos (`firsname` ≈ `firstname`) for longer names.
  if (norm.length < 5) return false
  const candidates = rule.test.source.split('|').map((part) => part.replace(/^\^|\$$/g, ''))
  return candidates.some(
    (candidate) => candidate.length >= 5 && editDistanceAtMost1(norm, candidate)
  )
}

function scoreCatalogKey(key: string, fieldNorm: string, tokens: readonly string[]): number {
  const compact = key
    .toLowerCase()
    .replace(/^\$/, '')
    .replace(/[^a-z0-9]/g, '')
  if (!fieldNorm) return 0
  if (compact === fieldNorm || compact.endsWith(fieldNorm)) return 120
  if (compact.includes(fieldNorm)) return 90
  // Typo tolerance against the trailing identifier (`…firstname` vs `firsname`).
  if (fieldNorm.length >= 5) {
    const tail = compact.slice(-Math.max(fieldNorm.length + 1, fieldNorm.length))
    if (
      editDistanceAtMost1(tail, fieldNorm) ||
      editDistanceAtMost1(compact.slice(-fieldNorm.length), fieldNorm)
    ) {
      return 100
    }
  }
  let score = 0
  for (const token of tokens) {
    if (token.length < 2) continue
    if (compact.includes(token)) score += token.length >= 4 ? 25 : 15
  }
  return score
}

function typeDefaultKeys(attrType: string | undefined): readonly string[] {
  if (!attrType) return []
  return TYPE_DEFAULTS[attrType.trim().toLowerCase()] ?? []
}

/**
 * Ranked template keys for a form field (name + type), before catalog filtering.
 * Excludes `$this.<sameField>` (self-reference while editing that field).
 */
export function proposeFieldTemplateKeys(hint: FieldTemplateHint): string[] {
  const fieldNorm = normalizeFieldKey(hint.name)
  const tokens = tokenizeFieldName(hint.name)
  const ranked = new Map<string, number>()

  const bump = (key: string, score: number) => {
    if (!key || score <= 0) return
    // Avoid suggesting the field’s own `$this` path while editing it.
    if (key.toLowerCase() === `$this.${hint.name}`.toLowerCase()) return
    if (
      normalizeFieldKey(key.replace(/^\$this\./i, '')) === fieldNorm &&
      key.startsWith('$this.')
    ) {
      return
    }
    ranked.set(key, Math.max(ranked.get(key) ?? 0, score))
  }

  for (const rule of FIELD_SYNONYMS) {
    if (synonymRuleMatches(fieldNorm, rule)) {
      for (const key of rule.keys) bump(key, 200)
    }
  }

  // Token-level synonym hits (e.g. `user_email` → email).
  for (const token of tokens) {
    if (token === fieldNorm) continue
    for (const rule of FIELD_SYNONYMS) {
      if (synonymRuleMatches(token, rule)) {
        for (const key of rule.keys) bump(key, 160)
      }
    }
  }

  // Compound tokens: `first` + `name` → firstName (covers `person_first_name`).
  if (tokens.includes('first') && tokens.includes('name')) {
    bump('$faker.person.firstName', 180)
  }
  if (tokens.includes('last') && tokens.includes('name')) {
    bump('$faker.person.lastName', 180)
  }

  for (const key of typeDefaultKeys(hint.type)) {
    bump(key, 40)
  }

  return [...ranked.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key]) => key)
}

/**
 * Build a leading “For this field” suggestion group from a catalog of known keys.
 * Also lifts strong name matches that already exist in the catalog (env / faker / $this).
 */
export function buildFieldTemplateSuggestions(
  hint: FieldTemplateHint,
  catalog: readonly EnvTemplateSuggestion[],
  options?: { max?: number }
): EnvTemplateSuggestion[] {
  const max = options?.max ?? MAX_SUGGESTIONS
  const fieldNorm = normalizeFieldKey(hint.name)
  const tokens = tokenizeFieldName(hint.name)
  const byKey = new Map(catalog.map((item) => [item.key, item]))

  const proposed = proposeFieldTemplateKeys(hint)
  const out: EnvTemplateSuggestion[] = []
  const seen = new Set<string>()

  const push = (key: string, detail: string) => {
    if (seen.has(key) || out.length >= max) return
    const fromCatalog = byKey.get(key)
    // Prefer catalog entries (known dynamics); allow proposed faker paths even if
    // somehow missing from a trimmed catalog.
    if (!fromCatalog && !key.startsWith('$')) return
    seen.add(key)
    out.push({
      key,
      detail: fromCatalog?.detail ? `${detail} · ${fromCatalog.detail}` : detail,
      group: 'field',
    })
  }

  for (const key of proposed) {
    push(key, 'Matches this field')
  }

  // Lift high-scoring catalog keys (e.g. env `firstName`, `$this.email`).
  const scored = catalog
    .map((item) => ({
      item,
      score: scoreCatalogKey(item.key, fieldNorm, tokens),
    }))
    .filter((row) => row.score >= 90)
    .sort((a, b) => b.score - a.score || a.item.key.localeCompare(b.item.key))

  for (const row of scored) {
    if (row.item.key.toLowerCase() === `$this.${hint.name}`.toLowerCase()) continue
    push(row.item.key, 'Closest match')
  }

  return out
}

/** Prepend field suggestions and drop duplicate keys from the rest of the list. */
export function mergeFieldTemplateSuggestions(
  catalog: readonly EnvTemplateSuggestion[],
  hint: FieldTemplateHint | null | undefined
): EnvTemplateSuggestion[] {
  if (!hint?.name.trim()) return [...catalog]
  const fieldItems = buildFieldTemplateSuggestions(hint, catalog)
  if (fieldItems.length === 0) return [...catalog]
  const claimed = new Set(fieldItems.map((item) => item.key))
  return [...fieldItems, ...catalog.filter((item) => !claimed.has(item.key))]
}

/** Apply “For this field” suggestions + group label onto templated-input props. */
export function withFieldTemplateSuggestions<
  T extends {
    variableSuggestions?: readonly EnvTemplateSuggestion[]
    variableGroupLabels?: Readonly<Record<string, string>>
  },
>(envField: T, hint: FieldTemplateHint, fieldGroupLabel: string): T {
  return {
    ...envField,
    variableSuggestions: mergeFieldTemplateSuggestions(envField.variableSuggestions ?? [], hint),
    variableGroupLabels: {
      ...envField.variableGroupLabels,
      field: fieldGroupLabel,
    },
  }
}
