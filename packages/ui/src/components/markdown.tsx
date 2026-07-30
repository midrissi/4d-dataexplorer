/// <reference path="../markdown-it-plugins.d.ts" />
import hljs from 'highlight.js'
import DOMPurify from 'isomorphic-dompurify'
import MarkdownIt from 'markdown-it'
import markdownItAbbr from 'markdown-it-abbr'
import markdownItContainer from 'markdown-it-container'
import markdownItDeflist from 'markdown-it-deflist'
import { full as emojiPlugin } from 'markdown-it-emoji'
import markdownItFootnote from 'markdown-it-footnote'
import markdownItIns from 'markdown-it-ins'
import markdownItMark from 'markdown-it-mark'
import markdownItSub from 'markdown-it-sub'
import markdownItSup from 'markdown-it-sup'
import { useEffect, useMemo, useRef } from 'react'
import { cn } from '../lib/utils'
import './markdown.css'

const CONTAINER_NAMES = ['warning', 'info', 'tip', 'note', 'danger'] as const

function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight(str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
        } catch {
          // fall through
        }
      }
      return ''
    },
  })

  md.use(emojiPlugin)
    .use(markdownItSub)
    .use(markdownItSup)
    .use(markdownItIns)
    .use(markdownItMark)
    .use(markdownItFootnote)
    .use(markdownItDeflist)
    .use(markdownItAbbr)

  for (const name of CONTAINER_NAMES) {
    const label = name.charAt(0).toUpperCase() + name.slice(1)
    md.use(markdownItContainer, name, {
      render(tokens: { nesting: number }[], idx: number) {
        if (tokens[idx].nesting === 1) {
          return (
            `<aside class="md-container md-container-${name}" data-md-type="${name}">` +
            `<span class="md-container-badge">${label}</span>` +
            `<div class="md-container-body">\n`
          )
        }
        return '</div></aside>\n'
      },
    })
  }

  // Open external links in a new tab.
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const href = token.attrGet('href') ?? ''
    if (/^https?:\/\//i.test(href)) {
      token.attrSet('target', '_blank')
      token.attrSet('rel', 'noopener noreferrer')
    }
    return defaultLinkOpen(tokens, idx, options, env, self)
  }

  // Wrap fenced code blocks with a language toolbar (copy added in React).
  const defaultFence =
    md.renderer.rules.fence ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const info = token.info ? md.utils.unescapeAll(token.info).trim() : ''
    const lang = info ? info.split(/\s+/g)[0] : ''
    const highlighted = defaultFence(tokens, idx, options, env, self)
    const langLabel = lang || 'text'
    return `<div class="md-code-block" data-lang="${md.utils.escapeHtml(langLabel)}">${highlighted}</div>`
  }

  return md
}

const md = createMarkdownIt()

function renderMarkdown(source: string): string {
  const dirty = md.render(source)
  return DOMPurify.sanitize(dirty, {
    ADD_ATTR: ['target', 'rel', 'data-lang', 'data-md-type'],
    ADD_TAGS: ['aside'],
  })
}

function enhanceCodeBlocks(root: HTMLElement) {
  for (const block of root.querySelectorAll<HTMLElement>('.md-code-block')) {
    if (block.dataset.enhanced === '1') continue
    block.dataset.enhanced = '1'

    const pre = block.querySelector('pre')
    if (!pre) continue

    const lang = block.dataset.lang || 'text'
    const toolbar = document.createElement('div')
    toolbar.className = 'md-code-toolbar'
    toolbar.innerHTML = `<span class="md-code-lang">${lang}</span>`

    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'md-code-copy'
    copyBtn.textContent = 'Copy'
    copyBtn.addEventListener('click', () => {
      const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? ''
      void navigator.clipboard.writeText(code).then(() => {
        copyBtn.textContent = 'Copied!'
        window.setTimeout(() => {
          copyBtn.textContent = 'Copy'
        }, 1200)
      })
    })
    toolbar.appendChild(copyBtn)
    pre.insertBefore(toolbar, pre.firstChild)
  }
}

export type MarkdownProps = {
  /** Markdown source string */
  children: string
  className?: string
  /**
   * `default` — docs-style preview.
   * `compact` — dense UI (terminal, side panels); 11px body, smaller headings.
   */
  density?: 'default' | 'compact'
}

/**
 * Renders markdown with markdown-it feature parity for the common demo set:
 * GFM-like tables/autolink, typographer, emoji, sub/sup, insert, mark,
 * footnotes, definition lists, abbreviations, custom containers, and
 * syntax-highlighted fenced code.
 */
export function Markdown({ children, className, density = 'default' }: MarkdownProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const html = useMemo(() => renderMarkdown(children), [children])

  useEffect(() => {
    const root = rootRef.current
    if (!root || !html) return
    enhanceCodeBlocks(root)
  }, [html])

  return (
    <div
      ref={rootRef}
      className={cn('md-preview', density === 'compact' && 'md-preview-compact', className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is produced by markdown-it and sanitized with DOMPurify
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** @deprecated Kept for API compatibility; rendering no longer uses react-markdown components. */
export const markdownComponents = {}
