<script setup lang="ts">
import { withBase } from 'vitepress'
import { computed } from 'vue'
import { openLightbox } from '../composables/useImageLightbox'
import { docsScreenshotPaths, screenshotBaseName } from '../doc-screenshots'

const props = defineProps<{
  src: string
  alt?: string
  caption?: string
  hideCaption?: boolean
}>()

const paths = computed(() => {
  const resolved = docsScreenshotPaths(screenshotBaseName(props.src))
  return {
    dark: withBase(resolved.dark),
    light: withBase(resolved.light),
  }
})

function visibleSrc(): string {
  if (typeof document === 'undefined') {
    return paths.value.dark
  }
  return document.documentElement.classList.contains('dark') ? paths.value.dark : paths.value.light
}

function enlarge(): void {
  openLightbox(visibleSrc(), props.alt ?? props.caption ?? '')
}
</script>

<template>
  <figure class="screenshot-frame">
    <div class="screenshot-frame__chrome">
      <div class="screenshot-frame__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div class="screenshot-frame__url">dataexplorer</div>
    </div>
    <div class="screenshot-frame__body">
      <button
        type="button"
        class="screenshot-frame__zoom"
        :aria-label="`Enlarge ${alt ?? caption ?? 'screenshot'}`"
        @click="enlarge"
      >
        <img
          class="doc-screenshot__img doc-screenshot__img--dark"
          :src="paths.dark"
          :alt="alt ?? caption ?? ''"
          loading="lazy"
          data-zoomable
        />
        <img
          class="doc-screenshot__img doc-screenshot__img--light"
          :src="paths.light"
          :alt="alt ?? caption ?? ''"
          loading="lazy"
          data-zoomable
        />
      </button>
    </div>
    <figcaption v-if="caption && !hideCaption">{{ caption }}</figcaption>
  </figure>
</template>
