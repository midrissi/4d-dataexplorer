import { tokenize } from '../lexer/lexer.ts'
import { getAttribute, getDataClass, getRelatedDataclassName } from '../schema/catalog-index.ts'
import type { HoverInfo } from '../types/language.ts'
import type { CatalogIndex } from '../types/service.ts'
import { TokenKind } from '../types/tokens.ts'

/**
 * Return hover information for the token at `offset` within `query`.
 *
 * Resolves the full dotted attribute path that contains the offset
 * and returns the attribute's type, kind, and index metadata.
 */
export function hover(
  query: string,
  offset: number,
  index: CatalogIndex,
  dataclassName: string
): HoverInfo | null {
  const tokens = tokenize(query)

  // Find the token at offset
  const tokIdx = tokens.findIndex((t) => t.start <= offset && t.end > offset)
  if (tokIdx < 0) return null

  const tok = tokens[tokIdx]
  if (tok.kind !== TokenKind.Identifier) return null

  // Walk backwards collecting the full dotted path this token belongs to
  const pathTokens: (typeof tok)[] = [tok]
  let i = tokIdx - 1
  while (i >= 1) {
    if (tokens[i].kind === TokenKind.Dot && tokens[i - 1].kind === TokenKind.Identifier) {
      pathTokens.unshift(tokens[i - 1])
      i -= 2
    } else {
      break
    }
  }

  // Walk the path through the schema
  let currentDc = dataclassName
  let lastAttrName: string | null = null
  let lastDcName = dataclassName
  let resolvedEnd = 0

  for (let j = 0; j < pathTokens.length; j++) {
    const seg = pathTokens[j]
    const attr = getAttribute(currentDc, seg.text, index)
    if (!attr) break

    lastAttrName = attr.name
    lastDcName = currentDc
    resolvedEnd = seg.end

    if (j < pathTokens.length - 1) {
      const related = getRelatedDataclassName(currentDc, seg.text, index)
      if (!related) break
      const relDc = getDataClass(related, index)
      if (!relDc) break
      currentDc = relDc.name
    }
  }

  if (!lastAttrName) return null

  const attr = getAttribute(lastDcName, lastAttrName, index)
  if (!attr) return null

  const lines: string[] = [`**${lastDcName}.${attr.name}**`]
  lines.push(`- Type: \`${attr.type}\``)
  lines.push(`- Kind: \`${attr.kind}\``)
  if (attr.indexed) lines.push('- Indexed: yes')
  if (attr.unique) lines.push('- Unique: yes')
  if (attr.readOnly) lines.push('- Read only: yes')
  if (attr.identifying) lines.push('- Primary key: yes')
  if (attr.kind === 'relatedEntity' || attr.kind === 'relatedEntities') {
    lines.push(`- Related dataclass: \`${attr.type}\``)
    if (attr.inverseName) lines.push(`- Inverse: \`${attr.inverseName}\``)
  }

  return {
    range: { start: pathTokens[0].start, end: resolvedEnd },
    contents: { value: lines.join('\n') },
  }
}
