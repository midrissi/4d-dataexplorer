<script setup lang="ts">
import { computed, ref, watch } from 'vue'

export type InstallOs = 'mac' | 'windows' | 'linux'

type CommandToken = { kind: 'cmd' | 'flag' | 'url' | 'pipe' | 'run' | 'text'; text: string }

const props = defineProps<{
  detected: 'mac-arm' | 'mac-intel' | 'windows' | 'linux' | 'android' | 'ios' | 'web' | 'unknown'
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

const tabs: { id: InstallOs; label: string; icon: 'apple' | 'windows' | 'linux' }[] = [
  { id: 'mac', label: 'macOS', icon: 'apple' },
  { id: 'windows', label: 'Windows', icon: 'windows' },
  { id: 'linux', label: 'Linux', icon: 'linux' },
]

const activeIndex = computed(() =>
  Math.max(
    0,
    tabs.findIndex((t) => t.id === tab.value)
  )
)

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

const commandTokens = computed<CommandToken[]>(() => {
  if (tab.value === 'windows') {
    return [
      { kind: 'cmd', text: 'irm' },
      { kind: 'text', text: ' ' },
      { kind: 'url', text: `${releaseBase.value}/install-desktop.ps1` },
      { kind: 'text', text: ' ' },
      { kind: 'pipe', text: '|' },
      { kind: 'text', text: ' ' },
      { kind: 'run', text: 'iex' },
    ]
  }
  return [
    { kind: 'cmd', text: 'curl' },
    { kind: 'text', text: ' ' },
    { kind: 'flag', text: '-fsSL' },
    { kind: 'text', text: ' ' },
    { kind: 'url', text: `${releaseBase.value}/install-desktop.sh` },
    { kind: 'text', text: ' ' },
    { kind: 'pipe', text: '|' },
    { kind: 'text', text: ' ' },
    { kind: 'run', text: 'bash' },
  ]
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
const promptGlyph = computed(() => (tab.value === 'windows' ? 'PS>' : '$'))
const scriptName = computed(() =>
  tab.value === 'windows' ? 'install-desktop.ps1' : 'install-desktop.sh'
)

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

function onTabKeydown(event: KeyboardEvent, index: number) {
  const last = tabs.length - 1
  let next = index
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    next = index === last ? 0 : index + 1
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    next = index === 0 ? last : index - 1
  } else if (event.key === 'Home') {
    next = 0
  } else if (event.key === 'End') {
    next = last
  } else {
    return
  }
  event.preventDefault()
  const nextTab = tabs[next]
  if (!nextTab) return
  tab.value = nextTab.id
  document.getElementById(`term-tab-${nextTab.id}`)?.focus()
}
</script>

<template>
  <aside class="term-install" :data-os="tab" aria-labelledby="term-install-title">
    <header class="term-install__head">
      <div class="term-install__titles">
        <p class="term-install__eyebrow">One-liner</p>
        <h3 id="term-install-title" class="term-install__title">
          Install via {{ shellLabel }}
        </h3>
      </div>
      <span v-if="version" class="term-install__version" :title="`Release ${version}`">
        {{ version }}
      </span>
    </header>

    <div
      class="term-install__window"
      :class="{ 'is-copied': copied }"
    >
      <div class="term-install__accent" aria-hidden="true" />

      <div class="term-install__titlebar">
        <span class="term-install__dots" aria-hidden="true">
          <i /><i /><i />
        </span>

        <div
          class="term-install__tabs"
          role="tablist"
          aria-label="Operating system"
          :style="{ '--ti-tab-index': String(activeIndex) }"
        >
          <button
            v-for="(t, index) in tabs"
            :id="`term-tab-${t.id}`"
            :key="t.id"
            type="button"
            role="tab"
            class="term-install__tab"
            :class="{ 'is-active': tab === t.id }"
            :data-os="t.id"
            :aria-selected="tab === t.id"
            :aria-controls="`term-panel-${t.id}`"
            :aria-label="
              detectedToTab(detected) === t.id ? `${t.label}, detected` : t.label
            "
            :tabindex="tab === t.id ? 0 : -1"
            @click="tab = t.id"
            @keydown="onTabKeydown($event, index)"
          >
            <span class="term-install__tab-icon" aria-hidden="true">
              <svg
                v-if="t.icon === 'apple'"
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="currentColor"
              >
                <path
                  d="M16.365 1.43c0 1.14-.417 2.2-1.11 2.99-.83.95-2.18 1.68-3.29 1.6-.14-1.12.42-2.28 1.06-3.01.79-.9 2.19-1.57 3.34-1.58zM20.5 17.06c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-1-2.09.01-2.52 1.02-4.06 1-1.73-.02-3.06-1.77-4.05-3.33-2.76-4.37-3.05-9.5-1.35-12.23 1.21-1.94 3.12-3.08 4.91-3.08 1.83 0 2.98 1.01 4.49 1.01 1.47 0 2.36-1.01 4.48-1.01 1.6 0 3.29.87 4.5 2.38-3.96 2.17-3.32 7.82.33 9.82z"
                />
              </svg>
              <svg
                v-else-if="t.icon === 'windows'"
                viewBox="0 0 24 24"
                width="11"
                height="11"
                fill="currentColor"
              >
                <path
                  d="M3 5.1 10.5 4v7.5H3zM10.5 12.5V20L3 18.9v-6.4zM11.5 3.85 21 2.5v9H11.5zM21 12.5V21.5l-9.5-1.35V12.5z"
                />
              </svg>
              <svg v-else viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                <path
                  d="M12 2c-2 0-3.2 1.6-3.2 3.7 0 1.3.1 2.4-.5 3.5-.6 1.1-2 2.2-2.6 3.9-.3.9-.2 1.7.1 2.2-.6.4-1 1-1 1.7 0 .3.1.6.3.9-.2.4-.3.9-.1 1.3.4.9 1.7 1 3 1.1 1.1.1 2.1.5 2.7.5s1.6-.4 2.7-.5c1.3-.1 2.6-.2 3-1.1.2-.4.1-.9-.1-1.3.2-.3.3-.6.3-.9 0-.7-.4-1.3-1-1.7.3-.5.4-1.3.1-2.2-.6-1.7-2-2.8-2.6-3.9-.6-1.1-.5-2.2-.5-3.5C15.2 3.6 14 2 12 2z"
                />
              </svg>
            </span>
            <span class="term-install__tab-label">{{ t.label }}</span>
            <span v-if="detectedToTab(detected) === t.id" class="term-install__yours">Yours</span>
          </button>
        </div>

        <span class="term-install__shell-badge">
          <span class="term-install__shell-dot" aria-hidden="true" />
          {{ shellLabel }}
        </span>
      </div>

      <div class="term-install__body">
        <div class="term-install__meta" aria-hidden="true">
          <span class="term-install__meta-cwd">~/downloads</span>
          <span class="term-install__meta-sep">/</span>
          <span class="term-install__meta-file">{{ scriptName }}</span>
        </div>

        <div
          :id="`term-panel-${tab}`"
          :key="tab"
          class="term-install__panel"
          role="tabpanel"
          :aria-labelledby="`term-tab-${tab}`"
        >
          <div class="term-install__row">
            <pre
              class="term-install__code"
              tabindex="0"
              :aria-label="`${shellLabel} install command`"
            ><span class="term-install__prompt" aria-hidden="true">{{ promptGlyph }}</span><code><span
                  v-for="(token, i) in commandTokens"
                  :key="`${token.kind}-${i}`"
                  class="term-install__tok"
                  :data-kind="token.kind"
                  >{{ token.text }}</span
                ></code><span class="term-install__caret" aria-hidden="true" /></pre>
            <button
              type="button"
              class="term-install__copy"
              :class="{ 'is-copied': copied }"
              :aria-label="copied ? 'Copied to clipboard' : 'Copy install command'"
              @click="copyCommand"
            >
              <span class="term-install__copy-icon" aria-hidden="true">
                <svg
                  v-if="!copied"
                  viewBox="0 0 24 24"
                  width="11"
                  height="11"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  width="11"
                  height="11"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
          </div>
        </div>

      </div>
    </div>

    <p class="term-install__hint">
      <span class="term-install__hint-mark" aria-hidden="true" />
      {{ hint }}
    </p>
    <span class="visually-hidden" aria-live="polite">{{
      copied ? 'Install command copied to clipboard' : ''
    }}</span>
  </aside>
</template>

<style scoped>
.term-install {
  --ti-mac: var(--vp-c-brand-2);
  --ti-windows: oklch(0.62 0.1 250);
  --ti-linux: oklch(0.62 0.09 155);
  --ti-accent: var(--ti-mac);
  --ti-tab-count: 3;
  position: relative;
  margin: 1rem 0 0;
  width: min(100%, 36rem);
  padding: 0.95rem 1rem 1rem;
  text-align: left;
  border-radius: 0.85rem;
  border: 1px solid var(--vp-c-divider);
  background:
    radial-gradient(ellipse 80% 60% at 100% 0%, var(--vp-c-brand-soft), transparent 55%),
    var(--vp-c-bg-soft);
  isolation: isolate;
  overflow: hidden;
}

.term-install[data-os='mac'] {
  --ti-accent: var(--ti-mac);
}

.term-install[data-os='windows'] {
  --ti-accent: var(--ti-windows);
}

.term-install[data-os='linux'] {
  --ti-accent: var(--ti-linux);
}

.term-install::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
    color-mix(in oklab, var(--vp-c-text-1) 8%, transparent) 0.7px,
    transparent 0.7px
  );
  background-size: 12px 12px;
  mask-image: linear-gradient(180deg, #000 0%, transparent 72%);
  opacity: 0.45;
  pointer-events: none;
  z-index: 0;
}

.term-install > * {
  position: relative;
  z-index: 1;
}

.term-install__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.term-install__titles {
  min-width: 0;
}

.term-install__eyebrow {
  margin: 0 0 0.2rem;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vp-c-brand-2);
}

.term-install__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
}

.term-install__version {
  flex: 0 0 auto;
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 0.15rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  font-family: var(--vp-font-family-mono);
  font-size: 0.625rem;
  font-weight: 500;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}

.term-install__window {
  position: relative;
  border-radius: 0.7rem;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  overflow: hidden;
  box-shadow:
    0 1px 0 color-mix(in oklab, var(--vp-c-text-1) 4%, transparent),
    0 0.85rem 1.6rem -1.1rem color-mix(in oklab, var(--vp-c-text-1) 18%, transparent);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.term-install__window.is-copied {
  border-color: color-mix(in oklab, var(--ti-accent) 45%, var(--vp-c-divider));
  box-shadow:
    0 0 0 1px color-mix(in oklab, var(--ti-accent) 18%, transparent),
    0 0.85rem 1.6rem -1.1rem color-mix(in oklab, var(--ti-accent) 35%, transparent);
}

.term-install__accent {
  position: absolute;
  inset: 0 auto 0 0;
  width: 2px;
  background: linear-gradient(
    180deg,
    var(--ti-accent) 0%,
    color-mix(in oklab, var(--ti-accent) 20%, transparent) 100%
  );
  opacity: 0.9;
  pointer-events: none;
  transition: background 0.25s ease;
}

.term-install__titlebar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.45rem;
  min-height: 2.55rem;
  padding: 0.35rem 0.7rem 0 0.7rem;
  background:
    linear-gradient(
      180deg,
      color-mix(in oklab, var(--vp-c-bg-mute) 88%, var(--vp-c-bg)) 0%,
      color-mix(in oklab, var(--vp-c-bg-mute) 55%, var(--vp-c-bg)) 100%
    );
  border-bottom: 1px solid var(--vp-c-divider);
}

.term-install__dots {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  flex: 0 0 auto;
  height: 2.1rem;
  padding-bottom: 0.35rem;
}

.term-install__dots i {
  display: block;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--vp-c-divider);
}

.term-install__dots i:nth-child(1) {
  background: oklch(0.72 0.12 25);
}

.term-install__dots i:nth-child(2) {
  background: oklch(0.78 0.12 85);
}

.term-install__dots i:nth-child(3) {
  background: oklch(0.72 0.12 145);
}

.term-install__tabs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
  min-width: 0;
  gap: 0.15rem;
}

.term-install__tab {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  min-height: 2.1rem;
  width: 100%;
  padding: 0.35rem 0.45rem 0.45rem;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 0.5rem 0.5rem 0 0;
  background: transparent;
  color: var(--vp-c-text-3);
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease;
}

.term-install__tab:hover {
  color: var(--vp-c-text-1);
  background: color-mix(in oklab, var(--vp-c-bg) 55%, transparent);
}

.term-install__tab.is-active {
  z-index: 2;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border-color: var(--vp-c-divider);
  margin-bottom: -1px;
  padding-bottom: calc(0.45rem + 1px);
  box-shadow: inset 0 2px 0 var(--ti-accent);
}

.term-install__tab.is-active:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
}

.term-install__tab:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
  z-index: 3;
}

.term-install__tab-icon {
  display: inline-flex;
  flex: 0 0 auto;
  opacity: 0.75;
}

.term-install__tab.is-active .term-install__tab-icon {
  color: var(--ti-accent);
  opacity: 1;
}

.term-install__tab-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.term-install__yours {
  display: inline-flex;
  align-items: center;
  padding: 0.08rem 0.32rem;
  border-radius: 999px;
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1.25;
  color: var(--vp-c-brand-2);
  background: var(--vp-c-brand-soft);
  border: 1px solid color-mix(in oklab, var(--vp-c-brand-2) 28%, transparent);
}

.term-install__tab.is-active .term-install__yours {
  color: var(--ti-accent);
  background: color-mix(in oklab, var(--ti-accent) 14%, transparent);
  border-color: color-mix(in oklab, var(--ti-accent) 30%, transparent);
}

.term-install__shell-badge {
  display: inline-flex;
  align-items: center;
  align-self: center;
  gap: 0.22rem;
  flex: 0 0 auto;
  height: auto;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  font-size: 0.4375rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ti-accent);
  background: transparent;
}

.term-install__shell-dot {
  width: 0.25rem;
  height: 0.25rem;
  border-radius: 50%;
  background: var(--ti-accent);
  box-shadow: 0 0 0 0 color-mix(in oklab, var(--ti-accent) 35%, transparent);
  animation: term-live 2.4s ease-out infinite;
}

.term-install__body {
  position: relative;
  background:
    linear-gradient(
      180deg,
      color-mix(in oklab, var(--ti-accent) 4%, var(--vp-c-bg)) 0%,
      var(--vp-c-bg) 2.5rem
    );
}

.term-install__meta {
  display: flex;
  align-items: baseline;
  gap: 0;
  padding: 0.55rem 0.9rem 0.15rem;
  font-family: var(--vp-font-family-mono);
  font-size: 0.625rem;
  line-height: 1.3;
  color: var(--vp-c-text-3);
}

.term-install__meta-cwd {
  opacity: 0.7;
}

.term-install__meta-sep {
  opacity: 0.45;
  margin: 0 0.05rem;
}

.term-install__meta-file {
  color: var(--ti-accent);
  font-weight: 600;
}

.term-install__panel {
  animation: term-panel-in 0.24s ease both;
}

.term-install__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.55rem;
  align-items: start;
  padding: 0.35rem 0.8rem 0.7rem;
}

.term-install__code {
  margin: 0;
  padding: 0;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 0.6875rem;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  white-space: pre-wrap;
  word-break: break-all;
  background: none;
  border: none;
}

.term-install__code:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
  border-radius: 4px;
}

.term-install__prompt {
  margin-right: 0.45rem;
  font-weight: 700;
  color: var(--ti-accent);
  user-select: none;
}

.term-install__code code {
  font-size: inherit;
  background: none;
  padding: 0;
  color: inherit;
}

.term-install__tok[data-kind='cmd'] {
  color: var(--ti-accent);
  font-weight: 650;
}

.term-install__tok[data-kind='flag'] {
  color: color-mix(in oklab, var(--vp-c-brand-2) 35%, var(--vp-c-text-2));
}

.term-install__tok[data-kind='url'] {
  color: var(--vp-c-text-2);
}

.term-install__tok[data-kind='pipe'] {
  color: var(--vp-c-text-3);
}

.term-install__tok[data-kind='run'] {
  color: var(--vp-c-brand-1);
  font-weight: 650;
}

.term-install__caret {
  display: inline-block;
  width: 0.45em;
  height: 1.05em;
  margin-left: 0.12em;
  vertical-align: -0.15em;
  background: color-mix(in oklab, var(--ti-accent) 80%, transparent);
  border-radius: 1px;
  animation: term-caret 1.1s steps(1) infinite;
}

.term-install__copy {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 1.65rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-family: inherit;
  font-size: 0.625rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}

.term-install__copy:hover {
  border-color: var(--vp-c-brand-2);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.term-install__copy.is-copied {
  border-color: color-mix(in oklab, var(--ti-accent) 45%, var(--vp-c-divider));
  color: var(--ti-accent);
  background: color-mix(in oklab, var(--ti-accent) 12%, var(--vp-c-bg));
}

.term-install__copy:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.term-install__copy-icon {
  display: inline-flex;
}

.term-install__hint {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0.7rem 0 0;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--vp-c-text-3);
}

.term-install__hint-mark {
  flex: 0 0 auto;
  width: 0.35rem;
  height: 0.35rem;
  margin-top: 0.4rem;
  border-radius: 50%;
  background: var(--ti-accent);
  box-shadow: 0 0 0 0.2rem color-mix(in oklab, var(--ti-accent) 18%, transparent);
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

@keyframes term-panel-in {
  from {
    opacity: 0;
    transform: translateY(0.15rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes term-caret {
  0%,
  45% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

@keyframes term-live {
  0% {
    box-shadow: 0 0 0 0 color-mix(in oklab, var(--ti-accent) 40%, transparent);
  }
  70% {
    box-shadow: 0 0 0 0.35rem transparent;
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .term-install__panel,
  .term-install__caret,
  .term-install__shell-dot {
    animation: none;
  }

  .term-install__caret {
    opacity: 0.7;
  }

  .term-install__tab,
  .term-install__window {
    transition: none;
  }
}

@media (max-width: 560px) {
  .term-install {
    padding: 0.85rem 0.8rem 0.9rem;
  }

  .term-install__titlebar {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.45rem;
    padding: 0.45rem 0.55rem 0.5rem;
    min-height: 0;
  }

  .term-install__dots {
    height: auto;
    padding-bottom: 0;
  }

  /* Title already says Terminal/PowerShell — badge only cluttered the tab row */
  .term-install__shell-badge {
    display: none;
  }

  .term-install__tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.3rem;
    padding: 0.2rem;
    border-radius: 0.55rem;
    border: 1px solid var(--vp-c-divider);
    background: color-mix(in oklab, var(--vp-c-bg-mute) 70%, var(--vp-c-bg));
  }

  .term-install__tab {
    flex-direction: column;
    gap: 0.15rem;
    min-height: 2.75rem;
    padding: 0.4rem 0.25rem;
    border-radius: 0.4rem;
    border: 1px solid transparent;
    font-size: 0.625rem;
  }

  .term-install__tab:hover {
    background: color-mix(in oklab, var(--vp-c-bg) 70%, transparent);
  }

  .term-install__tab.is-active {
    z-index: 1;
    margin-bottom: 0;
    padding-bottom: 0.4rem;
    border-color: color-mix(in oklab, var(--ti-accent) 42%, var(--vp-c-divider));
    background: var(--vp-c-bg);
    box-shadow:
      inset 0 0 0 1px color-mix(in oklab, var(--ti-accent) 12%, transparent),
      0 1px 0 color-mix(in oklab, var(--ti-accent) 25%, transparent);
  }

  .term-install__tab-icon {
    opacity: 0.85;
  }

  .term-install__tab-icon svg {
    width: 14px;
    height: 14px;
  }

  .term-install__tab-label {
    display: block;
    max-width: 100%;
    font-size: 0.5625rem;
    font-weight: 650;
    letter-spacing: 0.02em;
  }

  .term-install__yours {
    display: none;
  }

  .term-install__row {
    grid-template-columns: 1fr;
  }

  .term-install__copy {
    justify-content: center;
    min-height: 2.5rem;
  }
}
</style>
