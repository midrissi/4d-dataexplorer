---
title: Structure graph
---

<script setup>
import { structureToolbarColumns, structureToolbarRows } from '../.vitepress/data/tables'
</script>

# Structure graph

The **Structure** tab renders an interactive diagram of dataclasses, attributes, relations, **singletons**, and **catalog methods**.

![Structure graph](/screenshots/08-structure-graph.png)

### Navigation

- **Pan & zoom** — mouse wheel and drag; minimap in the corner; built-in zoom controls
- **Persisted viewport** — zoom and pan are saved per database (**BASEID**)
- Open from the footer network icon, command palette, or `⇧ ⌘ S`

### Toolbar

<DocTable :columns="structureToolbarColumns" :rows="structureToolbarRows" variant="meta" />

### Nodes & panels

- **Click a dataclass node** — storage vs calculated attributes, exposed flags, relation cardinalities
- **Info panel** — summary of the selected node
- **Singletons & catalog methods panel** — browse global singletons and datastore/catalog methods with signatures
- **Highlight** — context menu on a dataclass tab → *Show in structure*, or the list toolbar structure button

Drag nodes manually; positions are remembered per database.

---
