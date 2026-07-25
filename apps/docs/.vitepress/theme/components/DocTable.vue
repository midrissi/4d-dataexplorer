<script setup lang="ts">
import { computed } from 'vue'
import {
  CONTROL_ICONS,
  type DocTableColumn,
  type DocTableRow,
  metaIconFor,
  resolveDocTableLayout,
} from '../doc-table'
import DocCell from './DocCell.vue'
import DocIcon from './DocIcon.vue'
import DocRich from './DocRich.vue'

const props = withDefaults(
  defineProps<{
    columns: DocTableColumn[]
    rows: DocTableRow[]
    variant?: 'default' | 'controls' | 'shortcuts' | 'meta'
    caption?: string
    hideHeader?: boolean
  }>(),
  { variant: 'default', hideHeader: false }
)

const layout = computed(() => resolveDocTableLayout(props.columns, props.hideHeader))

const primaryKey = computed(() => props.columns[0]?.key ?? '')
const secondaryKey = computed(() => props.columns[1]?.key ?? '')

const wrapClass = computed(() => [
  'doc-table-wrap',
  `doc-table-wrap--${props.variant}`,
  layout.value === 'kv' ? 'doc-table-wrap--kv' : 'doc-table-wrap--table',
])

const tableClass = computed(() => ['doc-table', `doc-table--${props.variant}`])

function cellValue(row: DocTableRow, key: string): string {
  return row[key] ?? ''
}

function rowIcon(row: DocTableRow, col: DocTableColumn): string | null {
  const value = cellValue(row, col.key)
  if (col.icons) return CONTROL_ICONS[value] ?? 'circle'
  if (props.variant === 'meta' && col === props.columns[0]) return metaIconFor(value)
  return null
}

function colWidth(col: DocTableColumn, index: number): string | undefined {
  if (col.width) return col.width
  if (props.columns.length === 2) {
    if (props.variant === 'shortcuts') return index === 0 ? '34%' : undefined
    if (props.variant === 'controls') return index === 0 ? '30%' : undefined
    return index === 0 ? '32%' : undefined
  }
  if (props.columns.length === 3) {
    return index === 0 ? '22%' : index === 1 ? '22%' : undefined
  }
  if (props.columns.length === 4) {
    return ['12%', '30%', '28%', '18%'][index]
  }
  return undefined
}
</script>

<template>
  <figure :class="wrapClass">
    <div v-if="layout === 'kv'" class="doc-kv">
      <div v-for="(row, i) in rows" :key="i" class="doc-kv__row">
        <span class="doc-kv__label">
          <DocRich :value="cellValue(row, primaryKey)" title />
        </span>
        <span class="doc-kv__value">
          <DocRich :value="cellValue(row, secondaryKey)" />
        </span>
      </div>
    </div>

    <div v-else class="doc-table-scroll">
      <table :class="tableClass">
        <colgroup>
          <col
            v-for="(col, i) in columns"
            :key="col.key"
            :style="colWidth(col, i) ? { width: colWidth(col, i) } : undefined"
          />
        </colgroup>
        <thead v-if="!hideHeader">
          <tr>
            <th v-for="col in columns" :key="col.key" scope="col">
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
            <td
              v-for="col in columns"
              :key="col.key"
              :data-label="col.label"
              :class="{
                'doc-table__cell--lead': col === columns[0],
                'doc-table__cell--kbd': col.kbd || (variant === 'shortcuts' && col.key === 'shortcut'),
              }"
            >
              <span
                class="doc-table__cell-inner"
                :class="{
                  'doc-table__cell-inner--icon': rowIcon(row, col) && !col.icons,
                  'doc-table__cell-inner--control': col.icons,
                }"
              >
                <DocIcon
                  v-if="rowIcon(row, col) && !col.icons"
                  :name="rowIcon(row, col)!"
                  class="doc-table__row-icon"
                />
                <DocCell
                  :column="col"
                  :value="cellValue(row, col.key)"
                  :variant="variant"
                  :title-only="col === columns[0] && variant === 'meta'"
                />
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <figcaption v-if="caption" class="doc-table__caption">{{ caption }}</figcaption>
  </figure>
</template>
