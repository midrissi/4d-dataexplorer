<script setup lang="ts">
import { CONTROL_ICONS, type DocTableColumn, splitShortcutKeys } from '../doc-table'
import DocIcon from './DocIcon.vue'
import DocRich from './DocRich.vue'

defineProps<{
  column: DocTableColumn
  value: string
  variant?: string
  titleOnly?: boolean
}>()

function isKbdColumn(column: DocTableColumn, variant?: string): boolean {
  return (
    column.kbd === true ||
    (variant === 'shortcuts' &&
      (column.key === 'shortcut' || column.key === 'prefix' || column.key === 'example'))
  )
}
</script>

<template>
  <span v-if="column.icons" class="doc-table__control">
    <DocIcon :name="CONTROL_ICONS[value] ?? 'circle'" />
    <span class="doc-table__control-label">{{ value }}</span>
  </span>

  <span v-else-if="isKbdColumn(column, variant)" class="doc-table__shortcut">
    <template v-for="(group, gi) in splitShortcutKeys(value)" :key="gi">
      <span v-if="gi > 0" class="doc-table__or">or</span>
      <kbd v-for="(key, ki) in group" :key="`${gi}-${ki}`" class="doc-table__kbd">{{ key }}</kbd>
    </template>
  </span>

  <DocRich v-else :value="value" :title="titleOnly" />
</template>
