---
title: Interface overview
---

<script setup>
import {
  areaColumns,
  areaRows,
  footerColumns,
  footerRows,
} from '../.vitepress/data/tables'
</script>

# Interface overview

The application layout has four main areas:

<AppLayoutDiagram />

<DocTable :columns="areaColumns" :rows="areaRows" variant="meta" />

![Welcome home screen](/screenshots/02-welcome-home.png)

### Resizable panels

Both the **sidebar** and the **entity list / viewer** split are resizable:

- **Sidebar** — drag the right edge to change width (325-450 px). Double-click the resize handle to reset. Collapse to a 52 px icon rail from the footer chevron or `⌘ B`.
- **Entity list** — drag the handle between the list and entity viewer (25-70% of the row). Double-click the handle to restore the default 40% split.
- **Console** — when open, drag the top edge of the bottom panel (120 px-50% of the window). Double-click to reset. See [Console panel](/guide/console). The same dock hosts the [ORDA Terminal](/guide/terminal) via a tab strip.

Panel widths are saved per profile and per database.

### Footer bar

The footer is a compact status bar with quick actions (left to right on the right side):

<DocTable
  :columns="footerColumns"
  :rows="footerRows"
  variant="controls"
/>

---
