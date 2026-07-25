---
title: Command palette
---

<script setup>
import { paletteModeColumns, paletteModeRows } from '../.vitepress/data/tables'
</script>

# Command palette

The command palette is the primary navigation hub. Open it with:

- Header search bar (click or focus)
- Footer command icon
- `⌘ P` (Mac) / `Ctrl+P` (Windows/Linux)

![Command palette](/screenshots/03-command-palette.png)

Beyond typing command names, the palette groups actions by category (Navigation, Dataclasses, Entities, Tabs, Appearance, …). **Recent commands** appear at the top with a clock icon.

### Quick modes

Type a prefix in the palette search to switch modes:

<DocTable :columns="paletteModeColumns" :rows="paletteModeRows" variant="shortcuts" />

### Notable commands

- **Open all dataclasses** — opens every dataclass in separate tabs
- **Refresh dataclasses** — reload catalog metadata
- **Pin / unpin tab**, **close tab**, **close others**, **close to the right**, **close all**
- **Switch tabs** — visual grid of open tabs (same as `@` mode)

---
