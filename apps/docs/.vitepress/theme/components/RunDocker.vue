<script setup lang="ts">
import { withBase } from 'vitepress'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const IMAGE = 'ghcr.io/midrissi/4d-dataexplorer:latest'

const runCommand = `docker run --rm -p 8080:80 \\
  -e BACKEND_URL=http://host.docker.internal:7080 \\
  -e PUBLISHED_PORT=8080 \\
  --add-host=host.docker.internal:host-gateway \\
  ${IMAGE}`

const root = ref<HTMLElement | null>(null)
const open = ref(false)
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

function onDocClick(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) {
    open.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

async function copyCommand(): Promise<void> {
  try {
    await navigator.clipboard.writeText(
      runCommand.replace(/ \\\n/g, ' ').replace(/\s+/g, ' ').trim()
    )
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 1800)
  } catch {
    copied.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
  clearTimeout(copyTimer)
})
</script>

<template>
  <div ref="root" class="hero-docker">
    <button
      type="button"
      class="hero-docker__trigger"
      :aria-expanded="open"
      aria-haspopup="dialog"
      aria-controls="hero-docker-panel"
      @click="open = !open"
    >
      <span class="hero-docker__glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 16c0 2.2 2.7 4 6 4h4c3.3 0 6-1.8 6-4" />
          <path d="M4 12h16" />
          <path d="M5 8h2M9 8h2M13 8h2M7 5h2M11 5h2" />
          <rect x="3" y="12" width="18" height="4" rx="1" />
        </svg>
      </span>
      <span class="hero-docker__label">
        <span class="hero-docker__title">Run with Docker</span>
        <span class="hero-docker__sub">nginx · GHCR</span>
      </span>
      <svg
        class="hero-docker__caret"
        :class="{ 'is-open': open }"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <transition name="hero-docker-panel">
      <div
        v-if="open"
        id="hero-docker-panel"
        class="hero-docker__panel"
        role="dialog"
        aria-label="Run Data Explorer with Docker"
      >
        <div class="hero-docker__panel-head">
          <p class="hero-docker__kicker">One command</p>
          <p class="hero-docker__lede">
            Serves <code>/dataexplorer/</code> and proxies REST to your 4D host.
          </p>
        </div>

        <div class="hero-docker__snippet">
          <pre class="hero-docker__code"><code>{{ runCommand }}</code></pre>
          <button
            type="button"
            class="hero-docker__copy"
            :aria-label="copied ? 'Copied' : 'Copy command'"
            @click="copyCommand"
          >
            <svg v-if="!copied" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {{ copied ? 'Copied' : 'Copy' }}
          </button>
        </div>

        <ol class="hero-docker__steps">
          <li>
            <span class="hero-docker__step-num" aria-hidden="true">1</span>
            <span>Pull <code>{{ IMAGE }}</code> (or build locally).</span>
          </li>
          <li>
            <span class="hero-docker__step-num" aria-hidden="true">2</span>
            <span>Set <code>BACKEND_URL</code> to your 4D REST host.</span>
          </li>
          <li>
            <span class="hero-docker__step-num" aria-hidden="true">3</span>
            <span>
              Open
              <a href="http://localhost:8080/dataexplorer/">localhost:8080/dataexplorer/</a>
            </span>
          </li>
        </ol>

        <a
          :href="withBase('/guide/getting-started#run-with-docker')"
          class="hero-docker__more"
          @click="open = false"
        >
          Full Docker guide
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.hero-docker {
  position: relative;
  display: inline-flex;
}

.hero-docker__trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem 0.85rem 0.45rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  box-shadow: 0 1px 0 oklch(0 0 0 / 4%);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.hero-docker__trigger:hover {
  border-color: oklch(0.64 0.17 36 / 45%);
  background: oklch(0.64 0.17 36 / 5%);
}

.hero-docker__trigger:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.hero-docker__trigger[aria-expanded='true'] {
  border-color: var(--vp-c-brand-2);
  background: oklch(0.64 0.17 36 / 8%);
  box-shadow: 0 0 0 3px oklch(0.64 0.17 36 / 12%);
}

.hero-docker__glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  color: var(--vp-c-brand-1);
  background: oklch(0.64 0.17 36 / 12%);
}

.hero-docker__label {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.15;
  text-align: left;
}

.hero-docker__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.hero-docker__sub {
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.hero-docker__caret {
  margin-left: 0.15rem;
  color: var(--vp-c-text-3);
  transition: transform 0.18s ease;
}

.hero-docker__caret.is-open {
  transform: rotate(180deg);
}

.hero-docker__panel {
  position: absolute;
  top: calc(100% + 0.65rem);
  left: 0;
  z-index: 40;
  width: min(26rem, 90vw);
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  background: var(--vp-c-bg);
  box-shadow: 0 22px 48px -24px oklch(0 0 0 / 42%);
}

.hero-docker__panel-head {
  margin-bottom: 0.85rem;
}

.hero-docker__kicker {
  margin: 0 0 0.35rem;
  font-family: "Fraunces", Georgia, serif;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--vp-c-text-1);
}

.hero-docker__lede {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.hero-docker__lede code {
  font-size: 0.9em;
  padding: 0.08em 0.32em;
  border-radius: 4px;
  background: var(--vp-c-default-soft);
}

.hero-docker__snippet {
  position: relative;
  margin-bottom: 0.85rem;
}

.hero-docker__code {
  margin: 0;
  padding: 0.85rem 3.4rem 0.85rem 0.9rem;
  overflow-x: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  font-size: 0.6875rem;
  line-height: 1.55;
  color: var(--vp-c-text-1);
}

.hero-docker__code code {
  font-family: var(--vp-font-family-mono);
  white-space: pre;
}

.hero-docker__copy {
  position: absolute;
  top: 0.55rem;
  right: 0.55rem;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.28rem 0.55rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease,
    color 0.12s ease;
}

.hero-docker__copy:hover {
  border-color: var(--vp-c-brand-2);
  color: var(--vp-c-brand-1);
}

.hero-docker__copy:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 1px;
}

.hero-docker__steps {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin: 0 0 0.85rem;
  padding: 0;
  list-style: none;
}

.hero-docker__steps li {
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr);
  gap: 0.55rem;
  align-items: start;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--vp-c-text-2);
}

.hero-docker__steps code {
  font-size: 0.9em;
  padding: 0.05em 0.28em;
  border-radius: 4px;
  background: var(--vp-c-default-soft);
  word-break: break-all;
}

.hero-docker__steps a {
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  border-bottom: 1px solid oklch(0.64 0.17 36 / 35%);
}

.hero-docker__steps a:hover {
  border-bottom-color: var(--vp-c-brand-1);
}

.hero-docker__step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  background: oklch(0.64 0.17 36 / 12%);
}

.hero-docker__more {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  text-decoration: none;
  border-bottom: 1px solid oklch(0.64 0.17 36 / 35%);
}

.hero-docker__more:hover {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand-1);
}

.hero-docker-panel-enter-active,
.hero-docker-panel-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.hero-docker-panel-enter-from,
.hero-docker-panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 480px) {
  .hero-docker,
  .hero-docker__trigger {
    width: 100%;
  }

  .hero-docker__trigger {
    justify-content: center;
  }

  .hero-docker__panel {
    left: 50%;
    width: min(26rem, calc(100vw - 2rem));
    transform: translateX(-50%);
  }

  .hero-docker-panel-enter-from,
  .hero-docker-panel-leave-to {
    transform: translate(-50%, -6px);
  }

  .hero-docker-panel-enter-to,
  .hero-docker-panel-leave-from {
    transform: translateX(-50%);
  }
}
</style>
