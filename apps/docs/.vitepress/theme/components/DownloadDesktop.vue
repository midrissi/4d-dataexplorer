<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  DOWNLOAD_STATS_RAW_URL,
  DOWNLOAD_STATS_REPO,
  type DownloadStatsReleaseDetail,
  type DownloadStatsReleaseRef,
  type DownloadStatsSnapshot,
} from '../../data/download-stats'
import TerminalInstall from './TerminalInstall.vue'

const REPO = DOWNLOAD_STATS_REPO
const RELEASES_INDEX = `https://github.com/${REPO}/releases`
const STATS_BASE = DOWNLOAD_STATS_RAW_URL.replace(/\/releases\/download-stats\.json$/, '')
const GH_LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`

type PlatformId = 'mac-arm' | 'mac-intel' | 'windows' | 'linux' | 'web' | 'unknown'

interface ReleaseAsset {
  name: string
  url: string
  size: number
}

interface PlatformMeta {
  id: PlatformId
  label: string
  sub: string
  icon: 'apple' | 'windows' | 'linux' | 'web'
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
  { id: 'web', label: 'Web', sub: '4D assets', icon: 'web' },
]

const root = ref<HTMLElement | null>(null)
const loading = ref(true)
const failed = ref(false)
const open = ref(false)
const version = ref('')
const assets = ref<ReleaseAsset[]>([])
const detected = ref<PlatformId>('unknown')

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
  if (n.endsWith('.dmg')) {
    if (n.includes('aarch64') || n.includes('arm64')) return 'mac-arm'
    if (n.includes('x64') || n.includes('x86_64') || n.includes('intel')) return 'mac-intel'
    return 'mac-arm'
  }
  if (n.endsWith('.zip')) {
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
  return list[0]
})

const releasePageUrl = computed(() =>
  version.value
    ? `https://github.com/${REPO}/releases/tag/${encodeURIComponent(version.value)}`
    : RELEASES_INDEX
)

function onDocClick(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) {
    open.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

function assetLabel(name: string): string {
  const n = name.toLowerCase()
  if (n === 'dataexplorer.zip' || n === 'databrowser.zip') return name
  if (n.endsWith('.dmg')) return 'DMG'
  if (n.endsWith('.zip')) return 'ZIP (app bundle)'
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
  document.addEventListener('click', onDocClick)
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
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
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
              type="button"
              class="hero-download__btn hero-download__btn--primary hero-download__caret"
              :aria-expanded="open"
              aria-haspopup="menu"
              aria-label="Choose platform or format"
              @click="open = !open"
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

          <transition name="hero-download-menu">
            <div v-if="open" class="hero-download__menu" role="menu">
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
        :loading="loading"
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
.hero-download-menu-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.hero-download-menu-enter-from,
.hero-download-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
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
