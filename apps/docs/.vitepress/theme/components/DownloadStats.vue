<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  DOWNLOAD_STATS_RAW_URL,
  type DownloadStatsSnapshot,
  EMPTY_DOWNLOAD_STATS,
  MOCK_DOWNLOAD_STATS,
  type PlatformId,
  parseDownloadStatsSnapshot,
} from '../../data/download-stats'
import { data as buildStats } from '../../data/download-stats.data'

function withMockFallback(snapshot: DownloadStatsSnapshot): DownloadStatsSnapshot {
  if (snapshot.mocked) return snapshot
  if (snapshot.total > 0 || snapshot.releaseCount > 0) return snapshot
  return MOCK_DOWNLOAD_STATS
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Final snapshot once fetch settles; UI starts from zeros and counts up. */
const target = ref<DownloadStatsSnapshot>(EMPTY_DOWNLOAD_STATS)
/** 0 → 1 eased progress after data arrives. */
const progress = ref(0)
const pending = ref(true)
const revealed = ref(false)

let rafId = 0

const isMocked = computed(() => Boolean(target.value.mocked))

const displayTotal = computed(() => Math.round(target.value.total * progress.value))
const displayReleaseCount = computed(() => Math.round(target.value.releaseCount * progress.value))

const maxPlatform = computed(() =>
  Math.max(1, ...target.value.platforms.map((platform) => platform.downloads))
)

const totalForShare = computed(() => Math.max(1, target.value.total))

const platforms = computed(() =>
  target.value.platforms.map((platform, index) => {
    const downloads = Math.round(platform.downloads * progress.value)
    const share = (downloads / Math.max(1, displayTotal.value)) * 100
    const targetShare = (platform.downloads / totalForShare.value) * 100
    const rawBar = (platform.downloads / maxPlatform.value) * 100 * progress.value
    const bar = platform.downloads > 0 ? (progress.value >= 1 ? Math.max(rawBar, 4) : rawBar) : 0
    return {
      ...platform,
      index,
      downloads,
      share,
      targetShare,
      bar,
      shareLabel: formatShare(progress.value >= 1 ? targetShare : share),
    }
  })
)

const leading = computed(() => {
  const ranked = [...target.value.platforms].sort((a, b) => b.downloads - a.downloads)
  const top = ranked[0]
  if (!top || top.downloads <= 0) return null
  const share = (top.downloads / totalForShare.value) * 100 * progress.value
  return {
    label: top.label,
    shareLabel: formatShare(
      progress.value >= 1 ? (top.downloads / totalForShare.value) * 100 : share
    ),
  }
})

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

function formatShare(share: number): string {
  if (share <= 0) return '0%'
  if (share < 1) return '<1%'
  return `${Math.round(share)}%`
}

const fetchedLabel = computed(() => {
  if (pending.value || !target.value.fetchedAt) return null
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(target.value.fetchedAt))
  } catch {
    return null
  }
})

function platformIcon(id: PlatformId): 'apple' | 'windows' | 'linux' | 'android' | 'web' {
  if (id === 'macos' || id === 'ios') return 'apple'
  if (id === 'windows') return 'windows'
  if (id === 'android') return 'android'
  if (id === 'web') return 'web'
  return 'linux'
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function animateCounts() {
  if (rafId) cancelAnimationFrame(rafId)

  if (prefersReducedMotion()) {
    progress.value = 1
    revealed.value = true
    return
  }

  progress.value = 0
  revealed.value = false
  const duration = 1100
  const start = performance.now()

  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    progress.value = easeOutCubic(t)
    if (t < 1) {
      rafId = requestAnimationFrame(frame)
    } else {
      progress.value = 1
      revealed.value = true
      rafId = 0
    }
  }

  rafId = requestAnimationFrame(frame)
}

onMounted(async () => {
  try {
    const res = await fetch(DOWNLOAD_STATS_RAW_URL, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const parsed = parseDownloadStatsSnapshot(await res.json())
      if (parsed) {
        target.value = parsed
      } else {
        target.value = withMockFallback(buildStats)
      }
    } else {
      target.value = withMockFallback(buildStats)
    }
  } catch {
    target.value = withMockFallback(buildStats)
  } finally {
    pending.value = false
    animateCounts()
  }
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<template>
  <section
    class="download-stats"
    :class="{
      'is-revealed': revealed,
      'is-mocked': isMocked,
      'is-pending': pending,
    }"
    :aria-busy="pending"
    aria-labelledby="download-stats-heading"
  >
    <header class="download-stats__header">
      <div class="download-stats__kicker">
        <p class="download-stats__eyebrow">GitHub releases</p>
        <span
          v-if="pending"
          class="download-stats__live download-stats__live--loading"
          title="Fetching live download counts"
        >
          <span class="download-stats__signal" aria-hidden="true">
            <i data-platform="macos" />
            <i data-platform="windows" />
            <i data-platform="linux" />
            <i data-platform="android" />
            <i data-platform="ios" />
            <i data-platform="web" />
          </span>
          Syncing
        </span>
        <span
          v-else-if="isMocked"
          class="download-stats__live download-stats__live--mock"
          title="Live snapshot not published yet"
        >
          Sample data
        </span>
        <span
          v-else-if="fetchedLabel"
          class="download-stats__live"
          :title="`Snapshot ${fetchedLabel}`"
        >
          <span class="download-stats__live-dot" aria-hidden="true" />
          Snapshot
        </span>
      </div>

      <div class="download-stats__hero">
        <p id="download-stats-heading" class="download-stats__total">
          <span class="download-stats__total-value">{{
            formatCount(displayTotal)
          }}</span>
          <span class="download-stats__total-copy">
            <span class="download-stats__total-unit">downloads</span>
            <span class="download-stats__total-meta">
              across
              <strong>{{ formatCount(displayReleaseCount) }}</strong>
              {{ displayReleaseCount === 1 ? "release" : "releases" }}
            </span>
          </span>
        </p>
        <p
          class="download-stats__lead"
          :aria-hidden="pending || leading ? undefined : 'true'"
        >
          <template v-if="pending">
            <span class="download-stats__lead-label">Fetching snapshot</span>
            <span class="download-stats__meter" aria-hidden="true">
              <span class="download-stats__meter-spectrum" />
              <span class="download-stats__meter-run" />
              <span class="download-stats__meter-echo" />
            </span>
          </template>
          <template v-else-if="leading">
            <span class="download-stats__lead-label">Most downloaded</span>
            <span class="download-stats__lead-value">
              {{ leading.label }}
              <em>{{ leading.shareLabel }}</em>
            </span>
          </template>
        </p>
      </div>

      <div
        class="download-stats__ribbon"
        role="img"
        :aria-label="
          platforms
            .map(
              (p) => `${p.label} ${formatCount(p.downloads)} (${p.shareLabel})`,
            )
            .join(', ')
        "
      >
        <span
          v-for="platform in platforms"
          :key="`ribbon-${platform.id}`"
          class="download-stats__ribbon-seg"
          :data-platform="platform.id"
          :style="{
            flexGrow: Math.max(
              platform.downloads,
              platform.downloads > 0 ? 1 : 0,
            ),
          }"
          :title="`${platform.label}: ${formatCount(platform.downloads)}`"
        />
      </div>
    </header>

    <p
      v-if="!pending && isMocked"
      class="download-stats__mock-note"
      role="note"
    >
      Preview figures — live counts appear once
      <code>data/download-stats</code> publishes
      <code>releases/download-stats.json</code>.
    </p>

    <ul class="download-stats__platforms" role="list">
      <li
        v-for="platform in platforms"
        :key="platform.id"
        class="download-stats__platform"
        :data-platform="platform.id"
        :style="{ '--bar': `${platform.bar}%` }"
      >
        <div class="download-stats__platform-head">
          <span class="download-stats__platform-identity">
            <span class="download-stats__platform-icon" aria-hidden="true">
              <svg
                v-if="platformIcon(platform.id) === 'apple'"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="currentColor"
              >
                <path
                  d="M16.365 1.43c0 1.14-.417 2.2-1.11 2.99-.83.95-2.18 1.68-3.29 1.6-.14-1.12.42-2.28 1.06-3.01.79-.9 2.19-1.57 3.34-1.58zM20.5 17.06c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-1-2.09.01-2.52 1.02-4.06 1-1.73-.02-3.06-1.77-4.05-3.33-2.76-4.37-3.05-9.5-1.35-12.23 1.21-1.94 3.12-3.08 4.91-3.08 1.83 0 2.98 1.01 4.49 1.01 1.47 0 2.36-1.01 4.48-1.01 1.6 0 3.29.87 4.5 2.38-3.96 2.17-3.32 7.82.33 9.82z"
                />
              </svg>
              <svg
                v-else-if="platformIcon(platform.id) === 'windows'"
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="currentColor"
              >
                <path
                  d="M3 5.1 10.5 4v7.5H3zM10.5 12.5V20L3 18.9v-6.4zM11.5 3.85 21 2.5v9H11.5zM21 12.5V21.5l-9.5-1.35V12.5z"
                />
              </svg>
              <svg
                v-else-if="platformIcon(platform.id) === 'android'"
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="currentColor"
              >
                <path
                  d="M17.6 9.48 19.44 6.3a.65.65 0 1 0-1.12-.65l-1.87 3.24a7.8 7.8 0 0 0-9 0L5.58 5.65a.65.65 0 1 0-1.12.65L6.3 9.48C3.9 11.28 2.35 14.1 2.35 17.3h19.3c0-3.2-1.55-6.02-4.05-7.82ZM8.55 14.55a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1Zm6.9 0a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1Z"
                />
              </svg>
              <svg
                v-else-if="platformIcon(platform.id) === 'web'"
                viewBox="0 0 24 24"
                width="13"
                height="13"
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
              <svg
                v-else
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="currentColor"
              >
                <path
                  d="M12 2c-2 0-3.2 1.6-3.2 3.7 0 1.3.1 2.4-.5 3.5-.6 1.1-2 2.2-2.6 3.9-.3.9-.2 1.7.1 2.2-.6.4-1 1-1 1.7 0 .3.1.6.3.9-.2.4-.3.9-.1 1.3.4.9 1.7 1 3 1.1 1.1.1 2.1.5 2.7.5s1.6-.4 2.7-.5c1.3-.1 2.6-.2 3-1.1.2-.4.1-.9-.1-1.3.2-.3.3-.6.3-.9 0-.7-.4-1.3-1-1.7.3-.5.4-1.3.1-2.2-.6-1.7-2-2.8-2.6-3.9-.6-1.1-.5-2.2-.5-3.5C15.2 3.6 14 2 12 2z"
                />
              </svg>
            </span>
            <span class="download-stats__platform-label">{{
              platform.label
            }}</span>
          </span>
          <span class="download-stats__platform-nums">
            <span class="download-stats__platform-share">{{
              platform.shareLabel
            }}</span>
            <span class="download-stats__platform-count">{{
              formatCount(platform.downloads)
            }}</span>
          </span>
        </div>
        <div
          class="download-stats__track"
          role="img"
          :aria-label="`${platform.label}: ${formatCount(platform.downloads)} downloads, ${platform.shareLabel}`"
        >
          <span class="download-stats__fill" />
        </div>
      </li>
    </ul>

    <footer class="download-stats__footer">
      <p class="download-stats__footnote">
        Desktop installers + web zip + mobile
        <span class="download-stats__footnote-formats"
          >DMG · ZIP · EXE · AppImage · deb · rpm · APK · IPA · DataExplorer.zip</span
        >
      </p>
      <a
        class="download-stats__link"
        :href="target.sourceUrl"
        target="_blank"
        rel="noopener"
      >
        View on GitHub
        <span aria-hidden="true">→</span>
      </a>
    </footer>
  </section>
</template>
