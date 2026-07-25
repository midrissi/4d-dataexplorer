<script setup lang="ts">
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { computed } from 'vue'
import ImageZoomProvider from './components/ImageZoomProvider.vue'

const { Layout: VPLayout } = DefaultTheme
const { frontmatter } = useData()

const isHome = computed(() => {
  if (frontmatter.value.layout === 'home') return true
  const pageClass = String(frontmatter.value.pageClass ?? '')
  return pageClass.split(/\s+/).includes('is-home')
})
</script>

<template>
  <div class="docs-site" :class="{ 'is-home': isHome }">
    <VPLayout>
      <template #layout-top>
        <ImageZoomProvider />
      </template>
    </VPLayout>
  </div>
</template>
