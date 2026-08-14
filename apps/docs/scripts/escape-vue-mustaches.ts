/**
 * Escape `{{…}}` so VitePress/Vue does not treat them as interpolations.
 *
 * Markdown code spans (`…`) do not decode HTML entities, so writing
 * `&#123;&#123;name&#125;&#125;` inside backticks shows the entities literally.
 * Rewrite those spans to `<code v-pre>{{…}}</code>` (raw braces, Vue skipped).
 */
export function escapeVueMustaches(md: string): string {
  const protectedSpans: string[] = []
  let out = md.replace(/`([^`]*\{\{[^`]*\}\}[^`]*)`/g, (_, inner: string) => {
    const index = protectedSpans.length
    protectedSpans.push(`<code v-pre>${inner}</code>`)
    return `\0VP${index}\0`
  })

  // Leftover bare mustaches (outside the spans we just rewrote).
  out = out.replaceAll('{{', '&#123;&#123;').replaceAll('}}', '&#125;&#125;')

  return out.replace(/\0VP(\d+)\0/g, (_, index: string) => protectedSpans[Number(index)] ?? '')
}
