<script setup lang="ts">
import { withBase } from 'vitepress'
import HomeFaq from './HomeFaq.vue'
import ScreenshotFrame from './ScreenshotFrame.vue'

const capabilities = [
  {
    num: '01',
    title: 'Structure graph',
    desc: 'ELK layout for dataclasses, relations, and catalog methods.',
    link: '/guide/structure-graph',
  },
  {
    num: '02',
    title: 'Query builder',
    desc: 'Build queries, choose fields, sort results, and reuse recent searches.',
    link: '/guide/query-builder',
  },
  {
    num: '03',
    title: 'AI assistant',
    desc: 'Natural-language exploration with tool traces and diagrams.',
    link: '/guide/assistant',
  },
  {
    num: '04',
    title: 'Keyboard workflow',
    desc: 'Command palette, chord shortcuts, and VS Code-like presets.',
    link: '/guide/keyboard-shortcuts',
  },
  {
    num: '05',
    title: 'Themes & profiles',
    desc: 'Color themes, light/dark mode, icons, and per-profile settings.',
    link: '/guide/settings',
  },
  {
    num: '06',
    title: 'Schema tools',
    desc: 'JSON Schema Builder and Assistant Metadata Editor.',
    link: '/guide/schema-builder',
  },
  {
    num: '07',
    title: 'Method Executor',
    desc: 'Run exposed ORDA methods with typed arguments and specialized result views.',
    link: '/guide/method-executor',
  },
  {
    num: '08',
    title: 'HTTP Client',
    desc: 'Compose REST requests, inspect responses, and replay console network entries.',
    link: '/guide/http-client',
  },
  {
    num: '09',
    title: 'Console panel',
    desc: 'Inspect app logs and every HTTP request in a docked bottom panel.',
    link: '/guide/console',
  },
  {
    num: '10',
    title: 'ORDA Terminal',
    desc: 'Run ds.* expressions and snippet files with actionable result cells.',
    link: '/guide/terminal',
  },
] as const

const gallery = [
  {
    num: '01',
    title: 'Structure graph',
    desc: 'Auto-layout dataclasses, relations, singletons, and catalog methods in an interactive ELK diagram.',
    link: '/guide/structure-graph',
    src: '/screenshots/08-structure-graph.png',
    alt: 'Structure graph showing dataclass relationships',
  },
  {
    num: '02',
    title: 'AI assistant',
    desc: 'Ask questions in plain language, follow tool traces, and keep the panel docked or fullscreen while you work.',
    link: '/guide/assistant',
    src: '/screenshots/16-assistant-panel.png',
    alt: 'AI assistant panel with quick actions and chat',
  },
  {
    num: '03',
    title: 'Query builder',
    desc: 'Build queries visually, choose fields, and sort results. Run against entity sets, paginate results, and open any row in the entity viewer.',
    link: '/guide/query-builder',
    src: '/screenshots/06-query-builder.png',
    alt: 'Query builder with filter fields and JSON results',
  },
  {
    num: '04',
    title: 'Method Executor',
    desc: 'Select exposed methods, configure arguments, and inspect results as an entity, entity selection, or JSON.',
    link: '/guide/method-executor',
    src: '/screenshots/20-method-executor-get-first-car.png',
    alt: 'Method Executor with an entity result in the viewer',
  },
  {
    num: '05',
    title: 'HTTP Client',
    desc: 'Build and send HTTP requests, tune params and headers, and open captured console traffic for replay.',
    link: '/guide/http-client',
    src: '/screenshots/27-http-client.png',
    alt: 'HTTP Client with a REST request and response panel',
  },
  {
    num: '06',
    title: 'Console panel',
    desc: 'Watch application logs and every REST call in the bottom dock — expand rows for headers and bodies, or open a request in the HTTP Client.',
    link: '/guide/console',
    src: '/screenshots/22-console-panel.png',
    alt: 'Console panel with network log and expanded request details',
  },
  {
    num: '07',
    title: 'ORDA Terminal',
    desc: 'Run ds.* expressions in a REPL or edit named .js snippets — open entities and selections from result cells, with traffic in Console → Network.',
    link: '/guide/terminal',
    src: '/screenshots/37-terminal-panel.png',
    alt: 'ORDA Terminal with a ds.Car.all() result',
  },
] as const
</script>

<template>
  <div class="home-landing">
    <div class="home-landing__intro">
      <header class="home-landing__masthead">
        <p class="home-landing__eyebrow">4D REST data browser</p>
        <h1 class="home-landing__title">Data Explorer</h1>
        <p class="home-landing__lede">
          Browse, query, and document your database through the REST API — a tabbed workspace for
          everyday data work in the browser.
        </p>
        <div class="home-landing__actions">
          <DownloadDesktop />
          <RunDocker />
          <a :href="withBase('/guide/getting-started')" class="home-landing__cta home-landing__cta--secondary">
            Get started
          </a>
          <a :href="withBase('/release-notes/')" class="home-landing__cta home-landing__cta--secondary">
            Release notes
          </a>
        </div>
      </header>

      <DownloadStats />
    </div>

    <section class="home-landing__hero-shot" aria-label="Application preview">
      <ScreenshotFrame
        src="/screenshots/02-welcome-home.png"
        alt="Data Explorer welcome screen"
        caption="Welcome screen — dataclass overview and quick navigation"
      />
    </section>

    <section class="home-landing__index" aria-labelledby="home-capabilities">
      <h2 id="home-capabilities" class="home-landing__section-label">Capabilities</h2>
      <ol class="home-landing__list">
        <li v-for="item in capabilities" :key="item.num" class="home-landing__list-item">
          <a :href="withBase(item.link)" class="home-landing__list-link">
            <span class="home-landing__list-num" aria-hidden="true">{{ item.num }}</span>
            <span class="home-landing__list-body">
              <span class="home-landing__list-title">{{ item.title }}</span>
              <span class="home-landing__list-desc">{{ item.desc }}</span>
            </span>
          </a>
        </li>
      </ol>
    </section>

    <section class="home-landing__gallery" aria-labelledby="home-gallery">
      <div class="home-landing__gallery-header">
        <h2 id="home-gallery" class="home-landing__section-label">In the interface</h2>
        <p class="home-landing__gallery-intro">
          Start with the structure graph, lean on the AI assistant when you need guidance, drill into
          precise queries when you know what to fetch, run exposed methods in the Method Executor
          when you need to call ORDA functions, use the HTTP Client to compose or replay REST
          requests, and keep the Console and ORDA Terminal docked for logs and live
          <code>ds.*</code> exploration.
        </p>
      </div>

      <div class="home-landing__gallery-grid">
        <article
          v-for="item in gallery"
          :key="item.num"
          class="home-landing__figure"
          :class="{ 'home-landing__figure--wide': item.num === '01' }"
        >
          <header class="home-landing__figure-header">
            <div class="home-landing__figure-meta">
              <span class="home-landing__figure-num" aria-hidden="true">{{ item.num }}</span>
              <h3 class="home-landing__figure-title">{{ item.title }}</h3>
            </div>
            <a :href="withBase(item.link)" class="home-landing__figure-link">
              Read guide
              <span aria-hidden="true">→</span>
            </a>
          </header>
          <p class="home-landing__figure-desc">{{ item.desc }}</p>
          <ScreenshotFrame
            class="home-landing__figure-shot"
            :src="item.src"
            :alt="item.alt"
            hide-caption
          />
        </article>
      </div>
    </section>

    <HomeFaq />

    <footer class="home-landing__footnote">
      <p>
        Open from <strong>Records → Data Explorer In Browser</strong> in 4D, run the
        <a :href="withBase('/guide/getting-started#run-with-docker')">Docker image</a>, or connect
        with a direct URL and access key.
      </p>
    </footer>
  </div>
</template>
