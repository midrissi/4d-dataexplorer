---
title: Assistant Metadata Editor
---

<script setup>
import { metadataFeatureColumns, metadataFeatureRows } from '../.vitepress/data/tables'
</script>

# Assistant Metadata Editor

Document dataclasses, attributes, methods, and singletons so the AI assistant and [AI actions](/guide/ai-actions) understand your database.

![Assistant Metadata Editor](/screenshots/18-assistant-metadata-editor.png)

Open from **Tools → Assistant Metadata** or the command palette.

<DocTable :columns="metadataFeatureColumns" :rows="metadataFeatureRows" variant="meta" />

Better metadata improves:

- Chat answers in the [AI assistant](/guide/assistant)
- Generated sample values and filters from [AI actions & tasks](/guide/ai-actions)

---
