<script setup lang="ts">
import { withBase } from 'vitepress'
import { parseInlineMarkdown } from '../doc-table'

defineProps<{
  value: string
  title?: boolean
}>()

/** Apply VitePress site base to root-relative links (markdown tables bypass the MD pipeline). */
function resolveHref(href: string): string {
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href
  if (href.startsWith('#')) return href
  if (href.startsWith('/')) return withBase(href)
  return href
}
</script>

<template>
  <span :class="title ? 'doc-rich doc-rich--title' : 'doc-rich'">
    <template v-for="(seg, i) in parseInlineMarkdown(value)" :key="i">
      <strong v-if="seg.type === 'bold'">{{ seg.value }}</strong>
      <code v-else-if="seg.type === 'code'" class="doc-table__inline-code">{{ seg.value }}</code>
      <a
        v-else-if="seg.type === 'link'"
        :href="resolveHref(seg.href)"
        class="doc-table__link"
      >{{ seg.label }}</a>
      <template v-else>{{ seg.value }}</template>
    </template>
  </span>
</template>
