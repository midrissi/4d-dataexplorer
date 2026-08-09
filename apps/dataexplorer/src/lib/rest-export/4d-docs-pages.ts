import attributes from './4d-docs/attributes.md?raw'
import authUsers from './4d-docs/authUsers.md?raw'
import catalog from './4d-docs/catalog.md?raw'
import classFunctions from './4d-docs/classFunctions.md?raw'
import clean from './4d-docs/clean.md?raw'
import compute from './4d-docs/compute.md?raw'
import dataClass from './4d-docs/dataClass.md?raw'
import directory from './4d-docs/directory.md?raw'
import entityset from './4d-docs/entityset.md?raw'
import filter from './4d-docs/filter.md?raw'
import info from './4d-docs/info.md?raw'
import method from './4d-docs/method.md?raw'
import orderby from './4d-docs/orderby.md?raw'
import singleton from './4d-docs/singleton.md?raw'
import skip from './4d-docs/skip.md?raw'
import timeout from './4d-docs/timeout.md?raw'
import topLimit from './4d-docs/top-limit.md?raw'
import upload from './4d-docs/upload.md?raw'

const REST_DOCS_SITE = 'https://developer.4d.com/docs/REST'

const PAGES: Record<string, string> = {
  attributes,
  authUsers,
  catalog,
  classFunctions,
  clean,
  compute,
  dataClass,
  directory,
  entityset,
  filter,
  info,
  method,
  orderby,
  singleton,
  skip,
  timeout,
  top_$limit: topLimit,
  upload,
}

const MD_LINK = /\[([^\]]*)]\(([^)]+)\)/g

export function docsSlugFromUrl(url: string): string | undefined {
  const match = url.match(/\/REST\/([^/#?]+)/i)
  return match?.[1]
}

export function officialDocsMarkdown(url: string | undefined): string | undefined {
  if (!url) return undefined
  const slug = docsSlugFromUrl(url)
  if (!slug) return undefined
  const raw = PAGES[slug]
  if (!raw) return undefined
  return prepareOfficialDocsMarkdown(raw, url.split('#')[0] ?? url)
}

export function prepareOfficialDocsMarkdown(raw: string, pageUrl: string): string {
  const body = rewriteRelativeDocLinks(stripFrontmatter(raw).trim())
  const title = pageUrl.replace(/.*\//, '').replace(/#.*/, '') || '4D Docs'
  return `> Source: [${title} | 4D Docs](${pageUrl})\n\n${body}`
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}

function rewriteRelativeDocLinks(markdown: string): string {
  return markdown.replace(MD_LINK, (full, label: string, href: string) => {
    if (/^https?:\/\//i.test(href) || href.startsWith('#') || href.startsWith('mailto:')) {
      return full
    }
    const abs = relativeDocHrefToUrl(href)
    return abs ? `[${label}](${abs})` : full
  })
}

function relativeDocHrefToUrl(href: string): string | undefined {
  if (href.includes('/assets/')) {
    const asset = href.replace(/^(?:\.\.\/)+/, '')
    return `https://developer.4d.com/docs/${asset}`
  }
  const [file, hash] = href.split('#')
  if (!file?.endsWith('.md')) return undefined
  const withoutMd = file.replace(/\.md$/i, '')
  const parts = withoutMd.split('/').filter((part) => part && part !== '.')
  while (parts[0] === '..') parts.shift()
  let slug = (parts.pop() ?? withoutMd).replace(/^\$/, '')
  if (slug === 'ClassFunctions') slug = 'classFunctions'
  const dir = parts.length > 0 ? `${parts.join('/')}/` : ''
  const base = dir ? `https://developer.4d.com/docs/${dir}${slug}` : `${REST_DOCS_SITE}/${slug}`
  return hash ? `${base}#${hash}` : base
}
