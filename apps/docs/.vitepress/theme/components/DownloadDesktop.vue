<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  DOWNLOAD_STATS_RAW_URL,
  DOWNLOAD_STATS_REPO,
  type DownloadStatsReleaseDetail,
  type DownloadStatsReleaseRef,
  type DownloadStatsSnapshot,
} from '../../data/download-stats'
import TerminalInstall from './TerminalInstall.vue'

const { site } = useData()

/** Build an internal docs URL that respects VitePress `base`. */
function docsHref(path: string): string {
  const base = site.value.base || '/'
  if (/^(?:[a-z]+:)?\/\//i.test(path) || !path.startsWith('/')) return path
  return `${base}${path.slice(1)}`.replace(/\/{2,}/g, '/')
}

const macosDesktopHref = computed(() => docsHref('/guide/macos-desktop'))
const gettingStartedHref = computed(() => docsHref('/guide/getting-started'))

const REPO = DOWNLOAD_STATS_REPO
const RELEASES_INDEX = `https://github.com/${REPO}/releases`
const STATS_BASE = DOWNLOAD_STATS_RAW_URL.replace(/\/releases\/download-stats\.json$/, '')
const GH_LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`

type PlatformId =
  | 'mac-arm'
  | 'mac-intel'
  | 'windows'
  | 'linux'
  | 'android'
  | 'ios'
  | 'web'
  | 'unknown'

interface ReleaseAsset {
  name: string
  url: string
  size: number
}

interface PlatformMeta {
  id: PlatformId
  label: string
  sub: string
  icon: 'apple' | 'windows' | 'linux' | 'android' | 'ios' | 'web'
}

const FALLBACK_PLATFORM: PlatformMeta = {
  id: 'mac-arm',
  label: 'macOS',
  sub: 'Apple Silicon',
  icon: 'apple',
}

const PLATFORMS: PlatformMeta[] = [
  FALLBACK_PLATFORM,
  { id: 'mac-intel', label: 'macOS', sub: 'Intel', icon: 'apple' },
  { id: 'windows', label: 'Windows', sub: 'x64', icon: 'windows' },
  { id: 'linux', label: 'Linux', sub: 'AppImage / deb', icon: 'linux' },
  { id: 'android', label: 'Android', sub: 'APK', icon: 'android' },
  { id: 'ios', label: 'iOS', sub: 'IPA', icon: 'ios' },
  { id: 'web', label: 'Web', sub: '4D assets', icon: 'web' },
]

const root = ref<HTMLElement | null>(null)
const infoBtn = ref<HTMLElement | null>(null)
const infoPanel = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const caretBtn = ref<HTMLElement | null>(null)
const loading = ref(true)
const failed = ref(false)
const open = ref(false)
const infoOpen = ref(false)
const version = ref('')
const assets = ref<ReleaseAsset[]>([])
const detected = ref<PlatformId>('unknown')
const copiedKey = ref('')
let copyTimer: ReturnType<typeof setTimeout> | undefined

function isAppleSilicon(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return true
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return true
    const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
    return /apple/i.test(renderer) && !/intel|amd|radeon|nvidia/i.test(renderer)
  } catch {
    return true
  }
}

function detectPlatform(): PlatformId {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  if (/mac/i.test(platform) || /mac os x/i.test(ua)) {
    return isAppleSilicon() ? 'mac-arm' : 'mac-intel'
  }
  if (/win/i.test(platform) || /windows/i.test(ua)) return 'windows'
  if (/linux|x11/i.test(platform) || /linux/i.test(ua)) return 'linux'
  return 'unknown'
}

function classify(name: string): PlatformId | null {
  const n = name.toLowerCase()
  if (n.endsWith('.sha256') || n.endsWith('.sig') || n.endsWith('.sh') || n.endsWith('.ps1'))
    return null
  if (n === 'latest.json') return null
  if (n === 'dataexplorer.zip' || n === 'databrowser.zip') return 'web'
  // Updater archives are not useful for manual install.
  if (n.endsWith('.app.tar.gz')) return null

  // Mobile packages before desktop zip heuristics (arm64 appears in both).
  if (n.endsWith('.apk') || n.endsWith('.aab')) return 'android'
  if (n.endsWith('.ipa')) return 'ios'

  if (n.endsWith('.dmg')) {
    if (n.includes('aarch64') || n.includes('arm64')) return 'mac-arm'
    if (n.includes('x64') || n.includes('x86_64') || n.includes('intel')) return 'mac-intel'
    return 'mac-arm'
  }
  if (n.endsWith('.zip')) {
    if (n.includes('android')) return 'android'
    if (n.includes('ios') || n.includes('iphone') || n.includes('ipad')) return 'ios'
    if (n.includes('aarch64') || n.includes('arm64')) return 'mac-arm'
    if (n.includes('x86_64') || n.includes('intel')) return 'mac-intel'
    return null
  }
  if (n.endsWith('.msi') || n.endsWith('.exe')) return 'windows'
  if (n.endsWith('.appimage') || n.endsWith('.deb') || n.endsWith('.rpm')) return 'linux'
  return null
}

const grouped = computed(() => {
  const map: Record<PlatformId, ReleaseAsset[]> = {
    'mac-arm': [],
    'mac-intel': [],
    windows: [],
    linux: [],
    android: [],
    ios: [],
    web: [],
    unknown: [],
  }
  for (const asset of assets.value) {
    const id = classify(asset.name)
    if (id) map[id].push(asset)
  }
  return map
})

const menuPlatforms = computed(() =>
  PLATFORMS.map((p) => ({ ...p, assets: grouped.value[p.id] })).filter((p) => p.assets.length > 0)
)

const activePlatform = computed<PlatformId>(() => {
  if (detected.value !== 'unknown' && grouped.value[detected.value]?.length) {
    return detected.value
  }
  return menuPlatforms.value[0]?.id ?? 'mac-arm'
})

const activeMeta = computed(
  () => PLATFORMS.find((p) => p.id === activePlatform.value) ?? FALLBACK_PLATFORM
)

const isMac = computed(
  () => activePlatform.value === 'mac-arm' || activePlatform.value === 'mac-intel'
)

const primaryAsset = computed<ReleaseAsset | undefined>(() => {
  const list = grouped.value[activePlatform.value] ?? []
  if (isMac.value) {
    return list.find((a) => a.name.toLowerCase().endsWith('.zip')) ?? list[0]
  }
  if (activePlatform.value === 'android') {
    // Prefer the release APK (no "debug" in name) over any debug variant.
    return (
      list.find((a) => {
        const n = a.name.toLowerCase()
        return n.endsWith('.apk') && !n.includes('debug')
      }) ??
      list.find((a) => a.name.toLowerCase().endsWith('.apk')) ??
      list[0]
    )
  }
  if (activePlatform.value === 'ios') {
    // Prefer release over debug when both happen to exist in the same release.
    return (
      list.find((a) => {
        const n = a.name.toLowerCase()
        return n.endsWith('.ipa') && !n.includes('debug')
      }) ??
      list.find((a) => a.name.toLowerCase().endsWith('.ipa')) ??
      list.find((a) => {
        const n = a.name.toLowerCase()
        return n.endsWith('.zip') && !n.includes('debug')
      }) ??
      list[0]
    )
  }
  return list[0]
})

const releasePageUrl = computed(() =>
  version.value
    ? `https://github.com/${REPO}/releases/tag/${encodeURIComponent(version.value)}`
    : RELEASES_INDEX
)

const quarantineScriptUrl = computed(() =>
  version.value
    ? `https://github.com/${REPO}/releases/download/${encodeURIComponent(version.value)}/fix-macos-quarantine.sh`
    : `https://github.com/${REPO}/releases/latest/download/fix-macos-quarantine.sh`
)

const xattrCommand = computed(
  () => 'xattr -cr "/Applications/Data Explorer.app" && open "/Applications/Data Explorer.app"'
)

function toggleMenu(): void {
  open.value = !open.value
  if (open.value) infoOpen.value = false
}

function toggleInfo(): void {
  infoOpen.value = !infoOpen.value
  if (infoOpen.value) open.value = false
}

function closeInfo(): void {
  infoOpen.value = false
}

function nodeInside(el: HTMLElement | null, target: Node): boolean {
  return !!el && el.contains(target)
}

function onDocPointerDown(event: PointerEvent): void {
  const target = event.target as Node
  if (
    infoOpen.value &&
    !nodeInside(infoPanel.value, target) &&
    !nodeInside(infoBtn.value, target)
  ) {
    infoOpen.value = false
  }
  if (open.value && !nodeInside(menuEl.value, target) && !nodeInside(caretBtn.value, target)) {
    open.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    open.value = false
    infoOpen.value = false
  }
}

async function copyText(key: string, text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copiedKey.value = ''
    }, 1600)
  } catch {
    copiedKey.value = ''
  }
}

const curlQuarantineCommand = computed(() => `curl -fsSL ${quarantineScriptUrl.value} | bash`)

function formatSize(bytes: number): string {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

function assetLabel(name: string): string {
  const n = name.toLowerCase()
  if (n === 'dataexplorer.zip' || n === 'databrowser.zip') return name
  if (n.endsWith('.dmg')) return 'DMG'
  if (n.endsWith('.apk')) return 'APK'
  if (n.endsWith('.aab')) return 'AAB (Play Bundle)'
  if (n.endsWith('.ipa')) return 'IPA'
  if (n.endsWith('.zip')) {
    if (n.includes('android') || n.includes('ios') || n.includes('iphone') || n.includes('ipad')) {
      return 'ZIP'
    }
    return 'ZIP (app bundle)'
  }
  if (n.endsWith('.msi')) return 'MSI installer'
  if (n.endsWith('.exe')) return 'EXE installer'
  if (n.endsWith('.appimage')) return 'AppImage'
  if (n.endsWith('.deb')) return 'Debian package'
  if (n.endsWith('.rpm')) return 'RPM package'
  return name.split('.').pop()?.toUpperCase() ?? 'Download'
}

function mapGhAssets(
  list: { name: string; browser_download_url?: string; size?: number }[]
): ReleaseAsset[] {
  const out: ReleaseAsset[] = []
  for (const a of list) {
    if (!a.browser_download_url || !classify(a.name)) continue
    out.push({ name: a.name, url: a.browser_download_url, size: a.size ?? 0 })
  }
  return out
}

function mapStatsAssets(detail: DownloadStatsReleaseDetail): ReleaseAsset[] {
  const out: ReleaseAsset[] = []
  for (const a of detail.assets) {
    if (!a.browserDownloadUrl || !classify(a.name)) continue
    out.push({ name: a.name, url: a.browserDownloadUrl, size: a.size ?? 0 })
  }
  return out
}

/** Prefer GitHub's /releases/latest so we never offer older builds here. */
async function loadLatestFromGitHub(): Promise<boolean> {
  const res = await fetch(GH_LATEST_API, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) return false
  const data = await res.json()
  const tag = data.tag_name || data.name || ''
  if (!tag) return false
  version.value = tag
  assets.value = mapGhAssets(data.assets ?? [])
  return true
}

/**
 * Fallback when the API is rate-limited: use the stats catalog's first entry
 * only if it matches GitHub latest via /releases/latest/download redirect… we
 * can't know that offline, so take the newest publishedAt ref as best effort.
 */
async function loadLatestFromStatsBranch(): Promise<boolean> {
  const res = await fetch(DOWNLOAD_STATS_RAW_URL, { cache: 'no-store' })
  if (!res.ok) return false
  const snapshot = (await res.json()) as DownloadStatsSnapshot
  const refs = [...((snapshot.releases ?? []) as DownloadStatsReleaseRef[])]
  if (!refs.length) return false

  refs.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0
    return tb - ta
  })
  const latest = refs[0]
  if (!latest) return false

  const detailRes = await fetch(`${STATS_BASE}/${latest.file}`)
  if (!detailRes.ok) return false
  const detail = (await detailRes.json()) as DownloadStatsReleaseDetail
  version.value = detail.tag || latest.tag
  assets.value = mapStatsAssets(detail)
  return assets.value.length > 0
}

onMounted(async () => {
  detected.value = detectPlatform()
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onKeydown)
  try {
    const ok = (await loadLatestFromGitHub()) || (await loadLatestFromStatsBranch())
    if (!ok) failed.value = true
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onKeydown)
  clearTimeout(copyTimer)
})
</script>

<template>
  <div ref="root" class="hero-download is-stacked">
    <div class="hero-download__stack">
      <span v-if="loading" class="hero-download__btn hero-download__btn--primary is-loading">
        <span class="hero-download__spinner" aria-hidden="true" />
        Fetching latest…
      </span>

      <template v-else>
        <div class="hero-download__anchor">
          <div class="hero-download__toolbar">
            <div class="hero-download__split">
              <a
                :href="primaryAsset ? primaryAsset.url : releasePageUrl"
                :download="primaryAsset ? primaryAsset.name : undefined"
                :target="primaryAsset ? undefined : '_blank'"
                :rel="primaryAsset ? undefined : 'noopener'"
                class="hero-download__btn hero-download__btn--primary hero-download__main"
              >
                <span class="hero-download__glyph" aria-hidden="true">
                  <svg
                    v-if="activeMeta.icon === 'apple'"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="currentColor"
                  >
                    <path
                      d="M16.365 1.43c0 1.14-.417 2.2-1.11 2.99-.83.95-2.18 1.68-3.29 1.6-.14-1.12.42-2.28 1.06-3.01.79-.9 2.19-1.57 3.34-1.58zM20.5 17.06c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-1-2.09.01-2.52 1.02-4.06 1-1.73-.02-3.06-1.77-4.05-3.33-2.76-4.37-3.05-9.5-1.35-12.23 1.21-1.94 3.12-3.08 4.91-3.08 1.83 0 2.98 1.01 4.49 1.01 1.47 0 2.36-1.01 4.48-1.01 1.6 0 3.29.87 4.5 2.38-3.96 2.17-3.32 7.82.33 9.82z"
                    />
                  </svg>
                  <svg
                    v-else-if="activeMeta.icon === 'windows'"
                    viewBox="0 0 24 24"
                    width="17"
                    height="17"
                    fill="currentColor"
                  >
                    <path
                      d="M3 5.1 10.5 4v7.5H3zM10.5 12.5V20L3 18.9v-6.4zM11.5 3.85 21 2.5v9H11.5zM21 12.5V21.5l-9.5-1.35V12.5z"
                    />
                  </svg>
                  <svg
                    v-else-if="activeMeta.icon === 'ios'"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="currentColor"
                  >
                    <path
                      d="M16.365 1.43c0 1.14-.417 2.2-1.11 2.99-.83.95-2.18 1.68-3.29 1.6-.14-1.12.42-2.28 1.06-3.01.79-.9 2.19-1.57 3.34-1.58zM20.5 17.06c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-1-2.09.01-2.52 1.02-4.06 1-1.73-.02-3.06-1.77-4.05-3.33-2.76-4.37-3.05-9.5-1.35-12.23 1.21-1.94 3.12-3.08 4.91-3.08 1.83 0 2.98 1.01 4.49 1.01 1.47 0 2.36-1.01 4.48-1.01 1.6 0 3.29.87 4.5 2.38-3.96 2.17-3.32 7.82.33 9.82z"
                    />
                  </svg>
                  <svg
                    v-else-if="activeMeta.icon === 'android'"
                    viewBox="0 0 24 24"
                    width="17"
                    height="17"
                    fill="currentColor"
                  >
                    <path
                      d="M17.6 9.48 19.44 6.3a.65.65 0 1 0-1.12-.65l-1.87 3.24a7.8 7.8 0 0 0-9 0L5.58 5.65a.65.65 0 1 0-1.12.65L6.3 9.48C3.9 11.28 2.35 14.1 2.35 17.3h19.3c0-3.2-1.55-6.02-4.05-7.82ZM8.55 14.55a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1Zm6.9 0a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1Z"
                    />
                  </svg>
                  <svg
                    v-else-if="activeMeta.icon === 'web'"
                    viewBox="0 0 24 24"
                    width="17"
                    height="17"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18" />
                    <path d="M12 3a14 14 0 0 1 0 18" />
                    <path d="M12 3a14 14 0 0 0 0 18" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                    <path
                      d="M12 2c-2 0-3.2 1.6-3.2 3.7 0 1.3.1 2.4-.5 3.5-.6 1.1-2 2.2-2.6 3.9-.3.9-.2 1.7.1 2.2-.6.4-1 1-1 1.7 0 .3.1.6.3.9-.2.4-.3.9-.1 1.3.4.9 1.7 1 3 1.1 1.1.1 2.1.5 2.7.5s1.6-.4 2.7-.5c1.3-.1 2.6-.2 3-1.1.2-.4.1-.9-.1-1.3.2-.3.3-.6.3-.9 0-.7-.4-1.3-1-1.7.3-.5.4-1.3.1-2.2-.6-1.7-2-2.8-2.6-3.9-.6-1.1-.5-2.2-.5-3.5C15.2 3.6 14 2 12 2z"
                    />
                  </svg>
                </span>
                <span class="hero-download__btn-text">
                  <span class="hero-download__btn-title">Download for {{ activeMeta.label }}</span>
                  <span class="hero-download__btn-sub">
                    {{ activeMeta.sub }}<template v-if="version"> · {{ version }}</template>
                  </span>
                </span>
              </a>

              <button
                ref="caretBtn"
                type="button"
                class="hero-download__btn hero-download__btn--primary hero-download__caret"
                :aria-expanded="open"
                aria-haspopup="menu"
                aria-label="Choose platform or format"
                @click="toggleMenu"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :class="{ 'is-open': open }"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>

            <button
              ref="infoBtn"
              type="button"
              class="hero-download__info"
              :class="{ 'is-open': infoOpen }"
              :aria-expanded="infoOpen"
              aria-controls="hero-download-info-panel"
              aria-label="Install notes and tips"
              @click="toggleInfo"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 10.5v6" />
                <circle cx="12" cy="7.5" r="0.85" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </div>

          <transition name="hero-download-info">
            <div
              v-if="infoOpen"
              id="hero-download-info-panel"
              ref="infoPanel"
              class="hero-download__info-panel"
              role="dialog"
              aria-modal="false"
              :aria-labelledby="`hero-download-info-title-${activePlatform}`"
            >
              <header class="hero-download__info-head">
                <span class="hero-download__info-mark" aria-hidden="true">
                  <svg
                    v-if="isMac"
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 3 4.5 6.5v5.2c0 4.4 3.1 8.4 7.5 9.3 4.4-.9 7.5-4.9 7.5-9.3V6.5L12 3z" />
                    <path d="M9.5 12.2 11.2 14l3.3-3.5" />
                  </svg>
                  <svg
                    v-else
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 10.5v6" />
                    <circle cx="12" cy="7.5" r="0.85" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <div class="hero-download__info-head-text">
                  <p class="hero-download__info-kicker">
                    <template v-if="isMac">macOS · first launch</template>
                    <template v-else-if="activePlatform === 'windows'">Windows</template>
                    <template v-else-if="activePlatform === 'linux'">Linux</template>
                    <template v-else-if="activePlatform === 'android'">Android</template>
                    <template v-else-if="activePlatform === 'ios'">iOS</template>
                    <template v-else>Web</template>
                  </p>
                  <p
                    :id="`hero-download-info-title-${activePlatform}`"
                    class="hero-download__info-title"
                  >
                    <template v-if="isMac">Before you open the app</template>
                    <template v-else-if="activePlatform === 'windows'">Windows install tip</template>
                    <template v-else-if="activePlatform === 'linux'">Linux install tip</template>
                    <template v-else-if="activePlatform === 'android'">Android install tip</template>
                    <template v-else-if="activePlatform === 'ios'">iOS install tip</template>
                    <template v-else>Web assets</template>
                  </p>
                </div>
                <button
                  type="button"
                  class="hero-download__info-close"
                  aria-label="Close install tips"
                  @click="closeInfo"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </header>

              <template v-if="isMac">
                <div class="hero-download__info-callout" role="status">
                  <span class="hero-download__info-callout-label">Gatekeeper</span>
                  <p>
                    Builds are signed but <strong>not Apple-notarized</strong>. macOS may say the
                    app can’t be opened or is damaged — clear quarantine once, then launch.
                  </p>
                </div>

                <ol class="hero-download__info-steps">
                  <li class="hero-download__info-step">
                    <span class="hero-download__info-step-num" aria-hidden="true">1</span>
                    <div class="hero-download__info-step-body">
                      <p class="hero-download__info-step-label">Clear quarantine in Terminal</p>
                      <div class="hero-download__info-code-wrap">
                        <pre class="hero-download__info-code"><code>{{ xattrCommand }}</code></pre>
                        <button
                          type="button"
                          class="hero-download__info-copy-btn"
                          :aria-label="copiedKey === 'xattr' ? 'Copied' : 'Copy command'"
                          @click="copyText('xattr', xattrCommand)"
                        >
                          {{ copiedKey === 'xattr' ? 'Copied' : 'Copy' }}
                        </button>
                      </div>
                    </div>
                  </li>
                  <li class="hero-download__info-step">
                    <span class="hero-download__info-step-num" aria-hidden="true">2</span>
                    <div class="hero-download__info-step-body">
                      <p class="hero-download__info-step-label">
                        Or run the fix script
                        <span class="hero-download__info-step-hint"
                          >searches Applications, Downloads, Desktop</span
                        >
                      </p>
                      <div class="hero-download__info-code-wrap">
                        <pre class="hero-download__info-code"><code>{{ curlQuarantineCommand }}</code></pre>
                        <button
                          type="button"
                          class="hero-download__info-copy-btn"
                          :aria-label="copiedKey === 'curl' ? 'Copied' : 'Copy command'"
                          @click="copyText('curl', curlQuarantineCommand)"
                        >
                          {{ copiedKey === 'curl' ? 'Copied' : 'Copy' }}
                        </button>
                      </div>
                    </div>
                  </li>
                </ol>
              </template>

              <template v-else-if="activePlatform === 'windows'">
                <p class="hero-download__info-copy">
                  SmartScreen may warn on first run for newly published installers. Choose
                  <strong>More info → Run anyway</strong> when the file comes from this project’s
                  GitHub release.
                </p>
              </template>
              <template v-else-if="activePlatform === 'linux'">
                <p class="hero-download__info-copy">
                  For AppImage builds, mark the file executable
                  (<code>chmod +x …AppImage</code>) before running. Deb/RPM packages install via
                  your package manager.
                </p>
              </template>
              <template v-else-if="activePlatform === 'android'">
                <p class="hero-download__info-copy">
                  APK installs require allowing installs from this browser or file manager. AAB
                  files are for Play Console upload, not sideloading on a device.
                </p>
              </template>
              <template v-else-if="activePlatform === 'ios'">
                <p class="hero-download__info-copy">
                  IPA builds need a matching provisioning profile (TestFlight, enterprise, or
                  ad-hoc). Direct install from the browser usually isn’t enough on stock iOS.
                </p>
              </template>
              <template v-else>
                <p class="hero-download__info-copy">
                  The web ZIP is for embedding inside a 4D application, not a standalone desktop
                  installer. Prefer the platform installers above for the native app.
                </p>
              </template>

              <ul class="hero-download__info-links">
                <li v-if="isMac">
                  <a :href="macosDesktopHref">
                    <span>macOS first-launch guide</span>
                    <span aria-hidden="true">→</span>
                  </a>
                </li>
                <li v-if="!isMac">
                  <a :href="gettingStartedHref">
                    <span>Getting started</span>
                    <span aria-hidden="true">→</span>
                  </a>
                </li>
                <li>
                  <a :href="releasePageUrl" target="_blank" rel="noopener">
                    <span>This release on GitHub</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </li>
              </ul>
            </div>
          </transition>

          <transition name="hero-download-menu">
            <div v-if="open" ref="menuEl" class="hero-download__menu" role="menu">
              <p class="hero-download__menu-title">
                Latest{{ version ? ` · ${version}` : '' }}
              </p>

              <p v-if="menuPlatforms.length === 0" class="hero-download__menu-empty">
                No installers published for this release yet.
              </p>
              <ul v-else class="hero-download__menu-list">
                <li v-for="platform in menuPlatforms" :key="platform.id" role="none">
                  <a
                    v-for="asset in platform.assets"
                    :key="asset.url"
                    :href="asset.url"
                    :download="asset.name"
                    class="hero-download__menu-item"
                    :class="{ 'is-active': platform.id === activePlatform }"
                    role="menuitem"
                    @click="open = false"
                  >
                    <span class="hero-download__menu-glyph" aria-hidden="true">
                      <svg
                        v-if="platform.icon === 'apple'"
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="currentColor"
                      >
                        <path
                          d="M16.365 1.43c0 1.14-.417 2.2-1.11 2.99-.83.95-2.18 1.68-3.29 1.6-.14-1.12.42-2.28 1.06-3.01.79-.9 2.19-1.57 3.34-1.58zM20.5 17.06c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-1-2.09.01-2.52 1.02-4.06 1-1.73-.02-3.06-1.77-4.05-3.33-2.76-4.37-3.05-9.5-1.35-12.23 1.21-1.94 3.12-3.08 4.91-3.08 1.83 0 2.98 1.01 4.49 1.01 1.47 0 2.36-1.01 4.48-1.01 1.6 0 3.29.87 4.5 2.38-3.96 2.17-3.32 7.82.33 9.82z"
                        />
                      </svg>
                      <svg
                        v-else-if="platform.icon === 'windows'"
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        fill="currentColor"
                      >
                        <path
                          d="M3 5.1 10.5 4v7.5H3zM10.5 12.5V20L3 18.9v-6.4zM11.5 3.85 21 2.5v9H11.5zM21 12.5V21.5l-9.5-1.35V12.5z"
                        />
                      </svg>
                      <svg
                        v-else-if="platform.icon === 'ios'"
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="currentColor"
                      >
                        <path
                          d="M16.365 1.43c0 1.14-.417 2.2-1.11 2.99-.83.95-2.18 1.68-3.29 1.6-.14-1.12.42-2.28 1.06-3.01.79-.9 2.19-1.57 3.34-1.58zM20.5 17.06c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-1-2.09.01-2.52 1.02-4.06 1-1.73-.02-3.06-1.77-4.05-3.33-2.76-4.37-3.05-9.5-1.35-12.23 1.21-1.94 3.12-3.08 4.91-3.08 1.83 0 2.98 1.01 4.49 1.01 1.47 0 2.36-1.01 4.48-1.01 1.6 0 3.29.87 4.5 2.38-3.96 2.17-3.32 7.82.33 9.82z"
                        />
                      </svg>
                      <svg
                        v-else-if="platform.icon === 'android'"
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        fill="currentColor"
                      >
                        <path
                          d="M17.6 9.48 19.44 6.3a.65.65 0 1 0-1.12-.65l-1.87 3.24a7.8 7.8 0 0 0-9 0L5.58 5.65a.65.65 0 1 0-1.12.65L6.3 9.48C3.9 11.28 2.35 14.1 2.35 17.3h19.3c0-3.2-1.55-6.02-4.05-7.82ZM8.55 14.55a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1Zm6.9 0a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1Z"
                        />
                      </svg>
                      <svg
                        v-else-if="platform.icon === 'web'"
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18" />
                        <path d="M12 3a14 14 0 0 1 0 18" />
                        <path d="M12 3a14 14 0 0 0 0 18" />
                      </svg>
                      <svg v-else viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                        <path
                          d="M12 2c-2 0-3.2 1.6-3.2 3.7 0 1.3.1 2.4-.5 3.5-.6 1.1-2 2.2-2.6 3.9-.3.9-.2 1.7.1 2.2-.6.4-1 1-1 1.7 0 .3.1.6.3.9-.2.4-.3.9-.1 1.3.4.9 1.7 1 3 1.1 1.1.1 2.1.5 2.7.5s1.6-.4 2.7-.5c1.3-.1 2.6-.2 3-1.1.2-.4.1-.9-.1-1.3.2-.3.3-.6.3-.9 0-.7-.4-1.3-1-1.7.3-.5.4-1.3.1-2.2-.6-1.7-2-2.8-2.6-3.9-.6-1.1-.5-2.2-.5-3.5C15.2 3.6 14 2 12 2z"
                        />
                      </svg>
                    </span>
                    <span class="hero-download__menu-body">
                      <span class="hero-download__menu-name"
                        >{{ platform.label }} · {{ platform.sub }}</span
                      >
                      <span class="hero-download__menu-meta">
                        {{ assetLabel(asset.name)
                        }}<template v-if="asset.size"> · {{ formatSize(asset.size) }}</template>
                      </span>
                    </span>
                    <span v-if="platform.id === detected" class="hero-download__menu-tag">Yours</span>
                  </a>
                </li>
              </ul>

              <a
                :href="RELEASES_INDEX"
                class="hero-download__menu-all"
                target="_blank"
                rel="noopener"
                @click="open = false"
              >
                Older releases &amp; checksums →
              </a>
            </div>
          </transition>
        </div>
      </template>

      <TerminalInstall
        :detected="detected"
        :version="version"
      />

      <p v-if="failed && !primaryAsset && !loading" class="hero-download__note">
        Couldn’t load release assets. Visit
        <a :href="RELEASES_INDEX" target="_blank" rel="noopener">GitHub Releases</a>
        to download manually.
      </p>
    </div>
  </div>
</template>

<style scoped>
.hero-download {
  position: relative;
  display: inline-flex;
}

.hero-download.is-stacked {
  display: flex;
  flex-basis: 100%;
  width: 100%;
}

.hero-download__stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.hero-download__anchor {
  position: relative;
  display: inline-flex;
}

.hero-download__toolbar {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
}

.hero-download__info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.15rem;
  height: 2.15rem;
  flex: 0 0 auto;
  padding: 0;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}

.hero-download__info:hover,
.hero-download__info.is-open {
  color: var(--vp-c-brand-1);
  border-color: color-mix(in oklab, var(--vp-c-brand-2) 45%, var(--vp-c-divider));
  background: var(--vp-c-brand-soft);
}

.hero-download__info:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.hero-download__info-panel {
  position: absolute;
  top: calc(100% + 0.65rem);
  left: 0;
  z-index: 41;
  box-sizing: border-box;
  width: min(27.5rem, 92vw);
  padding: 0.85rem;
  border-radius: 1rem;
  border: 1px solid color-mix(in oklab, var(--vp-c-brand-2) 22%, var(--vp-c-divider));
  /* Solid fill only — brand-soft tokens carry alpha and would show page content through. */
  background: var(--vp-c-bg);
  background-image: linear-gradient(
    165deg,
    color-mix(in oklab, var(--vp-c-brand-2) 10%, var(--vp-c-bg)) 0%,
    var(--vp-c-bg) 48%
  );
  box-shadow:
    0 0 0 1px color-mix(in oklab, var(--vp-c-brand-2) 8%, var(--vp-c-bg)),
    0 22px 48px -24px oklch(0 0 0 / 55%);
  text-align: left;
}

.hero-download__info-head {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  margin-bottom: 0.7rem;
}

.hero-download__info-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  border-radius: 0.65rem;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border: 1px solid color-mix(in oklab, var(--vp-c-brand-2) 28%, transparent);
}

.hero-download__info-head-text {
  flex: 1;
  min-width: 0;
  padding-top: 0.1rem;
}

.hero-download__info-kicker {
  margin: 0 0 0.12rem;
  font-size: 0.625rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vp-c-brand-1);
}

.hero-download__info-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 650;
  line-height: 1.25;
  color: var(--vp-c-text-1);
}

.hero-download__info-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  flex: 0 0 auto;
  margin: -0.15rem -0.15rem 0 0;
  padding: 0;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--vp-c-text-3);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;
}

.hero-download__info-close:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  border-color: var(--vp-c-divider);
}

.hero-download__info-close:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.hero-download__info-callout {
  margin: 0 0 0.75rem;
  padding: 0.55rem 0.65rem;
  border-radius: 0.65rem;
  border: 1px solid color-mix(in oklab, var(--vp-c-brand-2) 30%, var(--vp-c-divider));
  background: color-mix(in oklab, var(--vp-c-brand-2) 12%, var(--vp-c-bg-soft));
}

.hero-download__info-callout-label {
  display: inline-block;
  margin-bottom: 0.2rem;
  padding: 0.08rem 0.4rem;
  border-radius: 999px;
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-brand-1);
  background: color-mix(in oklab, var(--vp-c-brand-2) 16%, var(--vp-c-bg));
  border: 1px solid color-mix(in oklab, var(--vp-c-brand-2) 25%, var(--vp-c-divider));
}

.hero-download__info-callout p {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.hero-download__info-callout strong {
  color: var(--vp-c-text-1);
  font-weight: 650;
}

.hero-download__info-steps {
  margin: 0 0 0.75rem;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.hero-download__info-step {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
}

.hero-download__info-step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.35rem;
  height: 1.35rem;
  flex: 0 0 auto;
  margin-top: 0.1rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border: 1px solid color-mix(in oklab, var(--vp-c-brand-2) 28%, transparent);
}

.hero-download__info-step-body {
  flex: 1;
  min-width: 0;
}

.hero-download__info-step-label {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.hero-download__info-step-hint {
  display: block;
  margin-top: 0.1rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--vp-c-text-3);
}

.hero-download__info-code-wrap {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.35rem;
  align-items: stretch;
}

.hero-download__info-code {
  margin: 0;
  padding: 0.5rem 0.65rem;
  overflow-x: auto;
  border-radius: 0.5rem;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-family: var(--vp-font-family-mono);
  font-size: 0.625rem;
  line-height: 1.45;
  color: var(--vp-c-text-1);
  white-space: pre-wrap;
  word-break: break-all;
}

.hero-download__info-code code {
  background: none;
  padding: 0;
  font-size: inherit;
}

.hero-download__info-copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  min-width: 3.25rem;
  margin: 0;
  padding: 0.35rem 0.55rem;
  border-radius: 0.45rem;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 0.625rem;
  font-weight: 650;
  letter-spacing: 0.02em;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}

.hero-download__info-copy-btn:hover {
  color: var(--vp-c-brand-1);
  border-color: color-mix(in oklab, var(--vp-c-brand-2) 40%, var(--vp-c-divider));
  background: var(--vp-c-brand-soft);
}

.hero-download__info-copy-btn:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.hero-download__info-copy-btn:active {
  transform: translateY(0.5px);
}

.hero-download__info-copy {
  margin: 0 0 0.7rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.hero-download__info-copy code {
  font-size: 0.85em;
  padding: 0.08em 0.3em;
  border-radius: 4px;
  background: var(--vp-c-default-soft);
}

.hero-download__info-links {
  margin: 0;
  padding: 0.55rem 0 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  border-top: 1px solid var(--vp-c-divider);
}

.hero-download__info-links a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.35rem 0.4rem;
  margin: 0 -0.4rem;
  border-radius: 0.45rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  transition: background 0.15s ease;
}

.hero-download__info-links a:hover {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-2);
}

.hero-download__info-links a:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.hero-download__note {
  margin: 0.85rem 0 0;
  max-width: 34rem;
  font-size: 0.8125rem;
  line-height: 1.55;
  color: var(--vp-c-text-2);
  text-align: left;
}

.hero-download__note-title {
  display: block;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin-bottom: 0.15rem;
}

.hero-download__note code {
  font-size: 0.78em;
  padding: 0.12em 0.42em;
  border-radius: 5px;
  background: var(--vp-c-default-soft);
  white-space: nowrap;
}

.hero-download__note a {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.hero-download__split {
  display: inline-flex;
  align-items: stretch;
  border-radius: 999px;
  box-shadow: 0 8px 22px -12px oklch(0.64 0.17 36 / 65%);
}

.hero-download__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    filter 0.15s ease;
}

.hero-download__btn--primary {
  color: oklch(0.98 0.01 260);
  background: var(--vp-c-brand-2);
}

.hero-download__btn--primary:hover {
  background: var(--vp-c-brand-1);
}

.hero-download__btn--primary:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.hero-download__main {
  padding: 0.5rem 1.1rem 0.5rem 1rem;
  border-radius: 999px 0 0 999px;
}

.hero-download__caret {
  padding: 0 0.75rem;
  border-radius: 0 999px 999px 0;
  border-left: 1px solid oklch(1 0 0 / 18%);
}

.hero-download__caret svg {
  transition: transform 0.18s ease;
}

.hero-download__caret svg.is-open {
  transform: rotate(180deg);
}

.hero-download__glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.hero-download__btn-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  text-align: left;
}

.hero-download__btn-title {
  font-size: 0.9375rem;
}

.hero-download__btn-sub {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  opacity: 0.82;
}

.hero-download__spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid oklch(1 0 0 / 35%);
  border-top-color: oklch(1 0 0);
  animation: hero-download-spin 0.7s linear infinite;
}

.is-loading {
  padding: 0.625rem 1.25rem;
  border-radius: 999px;
  cursor: default;
  opacity: 0.85;
}

@keyframes hero-download-spin {
  to {
    transform: rotate(360deg);
  }
}

.hero-download__menu {
  position: absolute;
  top: calc(100% + 0.6rem);
  left: 0;
  z-index: 40;
  width: min(22rem, 88vw);
  padding: 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg);
  box-shadow: 0 18px 44px -20px oklch(0 0 0 / 45%);
}

.hero-download__menu-title {
  margin: 0.15rem 0 0.6rem;
  padding: 0 0.35rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.hero-download__menu-empty {
  margin: 0 0 0.5rem;
  padding: 0.35rem;
  font-size: 0.8125rem;
  color: var(--vp-c-text-2);
}

.hero-download__menu-list {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 18rem;
  overflow: auto;
}

.hero-download__menu-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.5rem;
  border-radius: 9px;
  text-decoration: none;
  color: var(--vp-c-text-1);
  transition: background-color 0.12s ease;
}

.hero-download__menu-item:hover,
.hero-download__menu-item.is-active {
  background: var(--vp-c-bg-soft);
}

.hero-download__menu-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 8px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
}

.hero-download__menu-item.is-active .hero-download__menu-glyph {
  color: oklch(0.98 0.01 260);
  background: var(--vp-c-brand-2);
  border-color: var(--vp-c-brand-2);
}

.hero-download__menu-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.hero-download__menu-name {
  font-size: 0.875rem;
  font-weight: 600;
}

.hero-download__menu-meta {
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-download__menu-tag {
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  background: oklch(0.64 0.17 36 / 12%);
}

.hero-download__menu-all {
  display: block;
  margin-top: 0.5rem;
  padding: 0.5rem 0.35rem 0.2rem;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.hero-download__menu-all:hover {
  color: var(--vp-c-brand-1);
}

.hero-download-menu-enter-active,
.hero-download-menu-leave-active,
.hero-download-info-enter-active,
.hero-download-info-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.hero-download-menu-enter-from,
.hero-download-menu-leave-to,
.hero-download-info-enter-from,
.hero-download-info-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

@media (max-width: 480px) {
  .hero-download,
  .hero-download__split {
    width: 100%;
  }

  .hero-download__main {
    flex: 1;
    justify-content: center;
  }
}
</style>
