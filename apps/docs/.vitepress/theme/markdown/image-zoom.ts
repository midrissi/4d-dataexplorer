import type MarkdownIt from 'markdown-it'

function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

export function imageZoomPlugin(md: MarkdownIt): void {
  const defaultRender =
    md.renderer.rules.image ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const src = token.attrGet('src') ?? ''
    const alt = token.content

    if (src.includes('/screenshots/')) {
      return `<DocScreenshot src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" />`
    }

    token.attrSet('data-zoomable', '')
    return defaultRender(tokens, idx, options, env, self)
  }
}
