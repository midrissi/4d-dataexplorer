import { defineConfig } from 'vitepress'
import { imageZoomPlugin } from './theme/markdown/image-zoom'

const DATAEXPLORER_DOWNLOAD_URL =
  'https://github.com/midrissi/4d-dataexplorer/releases/latest/download/DataExplorer.zip'

const guideSidebar = [
  {
    text: 'Getting started',
    collapsed: true,
    items: [
      { text: 'Introduction', link: '/guide/' },
      { text: 'Getting started', link: '/guide/getting-started' },
      { text: 'macOS desktop first launch', link: '/guide/macos-desktop' },
    ],
  },
  {
    text: 'Basics',
    collapsed: true,
    items: [
      { text: 'Interface overview', link: '/guide/interface' },
      { text: 'Home screen', link: '/guide/home' },
      { text: 'Sidebar & dataclasses', link: '/guide/sidebar' },
      { text: 'Tabs', link: '/guide/tabs' },
      { text: 'Read-only & edit modes', link: '/guide/modes' },
    ],
  },
  {
    text: 'Working with data',
    collapsed: true,
    items: [
      { text: 'Browsing entities', link: '/guide/browsing' },
      { text: 'Query builder', link: '/guide/query-builder' },
      { text: 'Entity viewer', link: '/guide/entity-viewer' },
      { text: 'Method Executor', link: '/guide/method-executor' },
      { text: 'Structure graph', link: '/guide/structure-graph' },
    ],
  },
  {
    text: 'AI',
    collapsed: true,
    items: [
      { text: 'AI assistant', link: '/guide/assistant' },
      { text: 'AI actions & tasks', link: '/guide/ai-actions' },
      { text: 'Assistant Metadata Editor', link: '/guide/metadata-editor' },
    ],
  },
  {
    text: 'Tools',
    collapsed: true,
    items: [
      { text: 'Command palette', link: '/guide/command-palette' },
      { text: 'Console panel', link: '/guide/console' },
      { text: 'ORDA Terminal', link: '/guide/terminal' },
      { text: 'HTTP Client', link: '/guide/http-client' },
      { text: 'JSON Schema Builder', link: '/guide/schema-builder' },
    ],
  },
  {
    text: 'Configuration',
    collapsed: true,
    items: [
      { text: 'Settings & appearance', link: '/guide/settings' },
      { text: 'Keyboard shortcuts', link: '/guide/keyboard-shortcuts' },
      { text: 'Language & localization', link: '/guide/localization' },
      { text: 'Profiles & import/export', link: '/guide/profiles' },
    ],
  },
  {
    text: 'Development',
    collapsed: true,
    items: [{ text: 'Development', link: '/guide/development' }],
  },
]

const SITE_URL = 'https://midrissi.github.io/4d-dataexplorer'
const SITE_TITLE = 'Data Explorer'
const SITE_DESCRIPTION =
  '4D REST data browser — structure graph, query builder, AI assistant, Method Executor, HTTP Client, themes, Docker & desktop.'

export default defineConfig({
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  base: '/4d-dataexplorer/',
  lang: 'en-US',
  appearance: true,
  // Local Docker / REST examples are not reachable during the docs build.
  ignoreDeadLinks: [/^https?:\/\/localhost(?::\d+)?(?:\/|$)/],
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/4d-dataexplorer/logo.svg' }],
    ['link', { rel: 'apple-touch-icon', href: '/4d-dataexplorer/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#ea580c' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&display=swap',
      },
    ],
    // Open Graph
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: SITE_TITLE }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    ['meta', { property: 'og:title', content: SITE_TITLE }],
    ['meta', { property: 'og:description', content: SITE_DESCRIPTION }],
    ['meta', { property: 'og:url', content: `${SITE_URL}/` }],
    ['meta', { property: 'og:image', content: `${SITE_URL}/og-image.png` }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    [
      'meta',
      {
        property: 'og:image:alt',
        content: 'Data Explorer — 4D REST data browser',
      },
    ],
    // Twitter / X
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: SITE_TITLE }],
    ['meta', { name: 'twitter:description', content: SITE_DESCRIPTION }],
    ['meta', { name: 'twitter:image', content: `${SITE_URL}/og-image.png` }],
    [
      'meta',
      {
        name: 'twitter:image:alt',
        content: 'Data Explorer — 4D REST data browser',
      },
    ],
  ],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      {
        text: 'Download',
        link: DATAEXPLORER_DOWNLOAD_URL,
      },
      { text: 'Release notes', link: '/release-notes/', activeMatch: '/release-notes/' },
      {
        text: 'GitHub',
        link: 'https://github.com/midrissi/4d-dataexplorer',
      },
    ],
    sidebar: {
      '/guide/': guideSidebar,
      '/release-notes/': [
        {
          text: 'Release notes',
          items: [
            { text: 'Overview', link: '/release-notes/' },
            { text: 'English', link: '/release-notes/en' },
            { text: 'Français', link: '/release-notes/fr' },
            { text: 'Español', link: '/release-notes/es' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/midrissi/4d-dataexplorer' }],
    editLink: {
      pattern: 'https://github.com/midrissi/4d-dataexplorer/edit/main/apps/docs/:path',
      text: 'Edit this page on GitHub',
    },
    search: { provider: 'local' },
    footer: {
      message: 'Data Explorer — 4D REST data browser',
    },
  },
  markdown: {
    image: {
      lazyLoading: true,
    },
    config(md) {
      imageZoomPlugin(md)
    },
  },
})
