<script setup lang="ts">
import { withBase } from 'vitepress'
import { computed, onMounted, ref, watch } from 'vue'

const SCRIPT_FILE = 'fix-macos-quarantine.sh'
const REPO = 'midrissi/4d-dataexplorer'
const GH_LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`
const SOURCE_BLOB = `https://github.com/${REPO}/blob/main/apps/desktop/scripts/${SCRIPT_FILE}`

const props = withDefaults(
  defineProps<{
    /** Release tag such as v1.2.3. Empty = resolve latest from GitHub. */
    tag?: string
  }>(),
  { tag: '' }
)

const resolvedTag = ref(props.tag)
const copiedCurl = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

const scriptHref = computed(() => {
  if (resolvedTag.value) {
    return `https://github.com/${REPO}/releases/download/${encodeURIComponent(resolvedTag.value)}/${SCRIPT_FILE}`
  }
  return `https://github.com/${REPO}/releases/latest/download/${SCRIPT_FILE}`
})

const releaseHref = computed(() =>
  resolvedTag.value
    ? `https://github.com/${REPO}/releases/tag/${encodeURIComponent(resolvedTag.value)}`
    : `https://github.com/${REPO}/releases/latest`
)

const curlCommand = computed(() => `curl -fsSL ${scriptHref.value} | bash`)

async function resolveLatestTag(): Promise<void> {
  if (props.tag) {
    resolvedTag.value = props.tag
    return
  }
  try {
    const res = await fetch(GH_LATEST_API, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return
    const data = await res.json()
    if (typeof data.tag_name === 'string' && data.tag_name) {
      resolvedTag.value = data.tag_name
    }
  } catch {
    // Keep latest/download fallback URL.
  }
}

onMounted(() => {
  void resolveLatestTag()
})

watch(
  () => props.tag,
  (tag) => {
    resolvedTag.value = tag
    if (!tag) void resolveLatestTag()
  }
)

async function copyCurl(): Promise<void> {
  try {
    await navigator.clipboard.writeText(curlCommand.value)
    copiedCurl.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copiedCurl.value = false
    }, 1600)
  } catch {
    copiedCurl.value = false
  }
}
</script>

<template>
  <div class="macos-fix">
    <p v-if="resolvedTag" class="macos-fix__version">
      Script for release <strong>{{ resolvedTag }}</strong>
      ·
      <a :href="releaseHref" target="_blank" rel="noopener">open release</a>
    </p>

    <div class="macos-fix__actions">
      <a
        class="macos-fix__btn macos-fix__btn--primary"
        :href="scriptHref"
        :download="SCRIPT_FILE"
        rel="noopener"
      >
        Download .sh
      </a>
      <a class="macos-fix__btn" :href="SOURCE_BLOB" target="_blank" rel="noopener">
        Source on GitHub
      </a>
      <button type="button" class="macos-fix__btn" @click="copyCurl">
        {{ copiedCurl ? 'Copied curl' : 'Copy curl | bash' }}
      </button>
    </div>

    <p class="macos-fix__hint">
      Each GitHub Release ships its own
      <code>fix-macos-quarantine.sh</code>
      (also inside the macOS ZIP). Prefer a direct one-liner?
      <code>xattr -cr "/Applications/Data Explorer.app"</code>
      — full steps:
      <a :href="withBase('/guide/macos-desktop')">macOS desktop first launch</a>.
    </p>
  </div>
</template>

<style scoped>
.macos-fix {
  margin: 1rem 0 1.5rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
}

.macos-fix__version {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  color: var(--vp-c-text-2);
}

.macos-fix__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.macos-fix__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  font-family: inherit;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

.macos-fix__btn:hover:not(:disabled):not(.macos-fix__btn--primary) {
  border-color: var(--vp-c-brand-2);
  color: var(--vp-c-brand-1);
}

.macos-fix__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.macos-fix__btn--primary {
  background: var(--vp-c-brand-2);
  border-color: transparent;
  color: oklch(0.98 0.01 260);
}

.macos-fix__btn--primary:hover:not(:disabled) {
  background: var(--vp-c-brand-1);
  border-color: transparent;
  color: oklch(0.98 0.01 260);
}

.macos-fix__btn--primary:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.macos-fix__hint {
  margin: 0.85rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.55;
  color: var(--vp-c-text-2);
}

.macos-fix__hint code {
  font-size: 0.78em;
}
</style>
