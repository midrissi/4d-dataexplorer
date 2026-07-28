<script setup lang="ts">
import { computed, ref, watch } from 'vue'

export type InstallOs = 'mac' | 'windows' | 'linux'

const props = defineProps<{
  loading: boolean
  detected: 'mac-arm' | 'mac-intel' | 'windows' | 'linux' | 'web' | 'unknown'
  version: string
}>()

const REPO = 'midrissi/4d-dataexplorer'

function detectedToTab(d: typeof props.detected): InstallOs {
  if (d === 'mac-arm' || d === 'mac-intel') return 'mac'
  if (d === 'windows') return 'windows'
  if (d === 'linux') return 'linux'
  return 'mac'
}

const tab = ref<InstallOs>(detectedToTab(props.detected))

watch(
  () => props.detected,
  (d) => {
    tab.value = detectedToTab(d)
  }
)

const tabs: { id: InstallOs; label: string }[] = [
  { id: 'mac', label: 'macOS' },
  { id: 'windows', label: 'Windows' },
  { id: 'linux', label: 'Linux' },
]

const releaseBase = computed(() =>
  props.version
    ? `https://github.com/${REPO}/releases/download/${encodeURIComponent(props.version)}`
    : `https://github.com/${REPO}/releases/latest/download`
)

const command = computed(() => {
  if (tab.value === 'windows') {
    return `irm ${releaseBase.value}/install-desktop.ps1 | iex`
  }
  return `curl -fsSL ${releaseBase.value}/install-desktop.sh | bash`
})

const hint = computed(() => {
  if (tab.value === 'mac') {
    return 'Downloads the ZIP, clears Gatekeeper quarantine, installs to /Applications, and opens the app.'
  }
  if (tab.value === 'windows') {
    return 'PowerShell: downloads the installer and launches it.'
  }
  return 'Downloads the Linux build (AppImage/deb) and launches or saves it.'
})

const shellLabel = computed(() => (tab.value === 'windows' ? 'PowerShell' : 'Terminal'))

const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

async function copyCommand(): Promise<void> {
  try {
    await navigator.clipboard.writeText(command.value)
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 1600)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <aside class="term-install" aria-labelledby="term-install-title">
    <div class="term-install__head">
      <h3 id="term-install-title" class="term-install__title">Install via {{ shellLabel }}</h3>
    </div>

    <div v-if="loading" class="term-install__skeleton" aria-busy="true" aria-live="polite">
      <span class="term-install__skel term-install__skel--tabs" />
      <span class="term-install__skel term-install__skel--code" />
      <span class="visually-hidden">Detecting your OS…</span>
    </div>

    <template v-else>
      <div class="term-install__tabs" role="tablist" aria-label="Operating system">
        <button
          v-for="t in tabs"
          :id="`term-tab-${t.id}`"
          :key="t.id"
          type="button"
          role="tab"
          class="term-install__tab"
          :class="{ 'is-active': tab === t.id }"
          :aria-selected="tab === t.id"
          :aria-controls="`term-panel-${t.id}`"
          @click="tab = t.id"
        >
          {{ t.label }}
          <span v-if="detectedToTab(detected) === t.id" class="term-install__yours">Yours</span>
        </button>
      </div>

      <div
        :id="`term-panel-${tab}`"
        class="term-install__panel"
        role="tabpanel"
        :aria-labelledby="`term-tab-${tab}`"
      >
        <div class="term-install__row">
          <pre class="term-install__code" tabindex="0"><code>{{ command }}</code></pre>
          <button type="button" class="term-install__copy" @click="copyCommand">
            {{ copied ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <p class="term-install__hint">{{ hint }}</p>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.term-install {
  margin: 0.85rem 0 0;
  width: min(100%, 34rem);
  text-align: left;
}

.term-install__head {
  margin-bottom: 0.5rem;
}

.term-install__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.term-install__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}

.term-install__tab {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 1.85rem;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.term-install__tab:hover {
  border-color: var(--vp-c-brand-2);
  color: var(--vp-c-brand-1);
}

.term-install__tab.is-active {
  border-color: transparent;
  background: var(--vp-c-brand-2);
  color: oklch(0.98 0.01 260);
}

.term-install__tab.is-active:hover {
  background: var(--vp-c-brand-1);
  color: oklch(0.98 0.01 260);
}

.term-install__tab:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.term-install__yours {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1.3;
  color: var(--vp-c-brand-2);
  background: var(--vp-c-brand-soft);
  border: 1px solid oklch(0.64 0.17 36 / 28%);
}

/* On the selected tab, invert so it stays readable on brand fill */
.term-install__tab.is-active .term-install__yours {
  color: oklch(0.98 0.01 260);
  background: oklch(0.98 0.01 260 / 18%);
  border-color: oklch(0.98 0.01 260 / 28%);
}

.term-install__tab:hover:not(.is-active) .term-install__yours {
  border-color: oklch(0.64 0.17 36 / 45%);
  background: oklch(0.64 0.17 36 / 16%);
}

.term-install__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.45rem;
  align-items: start;
}

.term-install__code {
  margin: 0;
  padding: 0.55rem 0.7rem;
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-family: var(--vp-font-family-mono);
  font-size: 0.6875rem;
  line-height: 1.45;
  color: var(--vp-c-text-1);
  white-space: pre-wrap;
  word-break: break-all;
}

.term-install__code code {
  font-size: inherit;
  background: none;
  padding: 0;
}

.term-install__copy {
  min-height: 1.85rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.term-install__copy:hover {
  border-color: var(--vp-c-brand-2);
  color: var(--vp-c-brand-1);
}

.term-install__copy:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.term-install__hint {
  margin: 0.4rem 0 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--vp-c-text-3);
}

.term-install__skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.term-install__skel {
  display: block;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--vp-c-bg-soft) 0%,
    var(--vp-c-bg-mute) 50%,
    var(--vp-c-bg-soft) 100%
  );
  background-size: 200% 100%;
  animation: term-skel 1.2s ease-in-out infinite;
}

.term-install__skel--tabs {
  height: 1.85rem;
  width: 11rem;
}

.term-install__skel--code {
  height: 2.25rem;
  width: 100%;
  border-radius: 8px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes term-skel {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .term-install__skel {
    animation: none;
  }
}

@media (max-width: 560px) {
  .term-install__row {
    grid-template-columns: 1fr;
  }
}
</style>
