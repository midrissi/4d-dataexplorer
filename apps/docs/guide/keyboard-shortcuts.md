---
title: Keyboard shortcuts
---

<script setup>
import {
  entityShortcuts,
  generalShortcuts,
  navigationShortcuts,
  shortcutColumns,
  tabShortcuts,
  viewShortcuts,
} from '../.vitepress/data/tables'
</script>

# Keyboard shortcuts

Default shortcuts (Mac; use **Ctrl** instead of **⌘** on Windows/Linux unless noted). Many commands also have `⌘ K` chord variants — see [Chord shortcuts](/guide/keyboard-shortcuts#chord-shortcuts).

### General

<DocTable :columns="shortcutColumns" :rows="generalShortcuts" variant="shortcuts" />

### View

<DocTable :columns="shortcutColumns" :rows="viewShortcuts" variant="shortcuts" />

### Navigation

<DocTable :columns="shortcutColumns" :rows="navigationShortcuts" variant="shortcuts" />

### Entities

<DocTable :columns="shortcutColumns" :rows="entityShortcuts" variant="shortcuts" />

### Tabs

<DocTable :columns="shortcutColumns" :rows="tabShortcuts" variant="shortcuts" />

Shortcuts are per-profile and can be remapped in Settings. Presets change many bindings at once (for example **VS Code-like** uses `⇧ ⌘ P` for the command palette).

### Chord shortcuts

Some shortcuts use a **two-key chord** (like VS Code): press `⌘ K`, release, then press the second key. While the first key is held, the footer shows **waiting for second key**; press `Esc` to cancel.

Examples: `⌘ K` `B` (toggle sidebar), `⌘ K` `,` (settings), `⌘ K` `H` (shortcuts help).

---
