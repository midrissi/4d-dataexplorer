import type { ReactNode } from 'react'

export type InlineMarkdownSegment =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'link'; value: string; href: string }

/** Tokenize a limited inline markdown subset used in release notes. */
export function parseInlineMarkdown(text: string): InlineMarkdownSegment[] {
  const segments: InlineMarkdownSegment[] = []
  const tokenRe = /(`[^`]+`)|(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)/g
  let lastIndex = 0

  for (const match of text.matchAll(tokenRe)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, index) })
    }

    const [full, code, link, bold] = match
    if (code) {
      segments.push({ type: 'code', value: code.slice(1, -1) })
    } else if (link) {
      const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(link)
      if (linkMatch) {
        segments.push({ type: 'link', value: linkMatch[1], href: linkMatch[2] })
      } else {
        segments.push({ type: 'text', value: full })
      }
    } else if (bold) {
      segments.push({ type: 'bold', value: bold.slice(2, -2) })
    }

    lastIndex = index + full.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }]
}

/** Render `code`, **bold**, and [links](url) from release-note prose. */
export function renderInlineMarkdown(text: string): ReactNode {
  const segments = parseInlineMarkdown(text)
  let offset = 0

  return segments.map((segment) => {
    const key = `${offset}-${segment.type}-${segment.value.length}`
    offset += segment.value.length

    switch (segment.type) {
      case 'code':
        return (
          <code
            key={key}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground"
          >
            {segment.value}
          </code>
        )
      case 'bold':
        return (
          <strong key={key} className="font-medium text-foreground">
            {segment.value}
          </strong>
        )
      case 'link':
        return (
          <a
            key={key}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {segment.value}
          </a>
        )
      default:
        return <span key={key}>{segment.value}</span>
    }
  })
}
