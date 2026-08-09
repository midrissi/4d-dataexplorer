---
title: Tabs
---

<script setup>
import { shortcutColumns, tabsPageShortcuts } from '../.vitepress/data/tables'
</script>

# Tabs

Tabs behave like a modern browser:

- **Click** — activate a tab
- **Drag** — reorder tabs (pinned tabs stay in the pinned section)
- **Pin** — keep important tabs fixed (context menu or `⇧ ⌘ P`)
- **Pin all / unpin all** — context menu on any tab
- **Close** — single tab (`Ctrl+Alt+W`), others, to the right, or all (pinned tabs are protected)
- **Show in structure** — dataclass tab context menu

Static tabs include **Home**, **Structure**, **Settings**, **Release notes**, **JSON Schema Builder**, **REST Export**, and **Assistant Metadata**.

### Tab shortcuts

<DocTable :columns="shortcutColumns" :rows="tabsPageShortcuts" variant="shortcuts" />

---
