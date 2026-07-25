---
title: Read-only & edit modes
---

<script setup>
import { editModeRows, modeColumns } from '../.vitepress/data/tables'
</script>

# Read-only & edit modes

Toggle **Edit mode** / **Read only** from the header button.

![Read-only mode](/screenshots/15-read-only-mode.png)

<DocTable :columns="modeColumns" :rows="editModeRows" variant="meta" />

The header button turns amber in read-only mode. Toggle with `⇧ ⌘ R`.

**Settings → General**:

- **Read-only mode** — default on launch
- **Default edit mode** — when you press Edit, open **Form** or **JSON**

---
