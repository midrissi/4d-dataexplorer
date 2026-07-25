<script setup lang="ts">
import { withBase } from 'vitepress'
import { computed } from 'vue'
import { docsScreenshotPaths, screenshotBaseName } from '../doc-screenshots'

const props = defineProps<{
  src: string
  alt?: string
}>()

const paths = computed(() => {
  const resolved = docsScreenshotPaths(screenshotBaseName(props.src))
  return {
    dark: withBase(resolved.dark),
    light: withBase(resolved.light),
  }
})
</script>

<template>
  <span class="doc-screenshot doc-screenshot--themed">
    <img
      class="doc-screenshot__img doc-screenshot__img--dark"
      :src="paths.dark"
      :alt="alt"
      loading="lazy"
      data-zoomable
    />
    <img
      class="doc-screenshot__img doc-screenshot__img--light"
      :src="paths.light"
      :alt="alt"
      loading="lazy"
      data-zoomable
    />
  </span>
</template>
