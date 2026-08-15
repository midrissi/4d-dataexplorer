---
title: Entity viewer
---

<script setup>
import {
  entityActionColumns,
  entityActionRows,
  entityViewModeRows,
  viewModeColumns,
} from '../.vitepress/data/tables'
</script>

# Entity viewer

Select an entity in the list to inspect it in the right panel.

![Entity viewer](/screenshots/05-entity-viewer.png)

The detail panel always shows **every attribute**, even when the [Display fields](./browsing#display-fields) manager limits the columns or fields in the list.

### View modes

<DocTable :columns="viewModeColumns" :rows="entityViewModeRows" variant="meta" />

Use the toolbar to switch modes. The default mode for new tabs is set in Settings → **Default entity view**.

### Tree view

- **Expand / collapse** individual nodes, or use **Expand all** / **Collapse all**
- **Relations** — click deferred relation links to open the related entity (when exposed by REST)
- **Copy** — click-to-copy on scalar values

### Form view

- Type-aware inputs for numbers, dates, durations, booleans, and text
- **Image** and **PDF** fields — preview and upload files (images use `$rawPict`, PDFs use `$binary`)
- **Binary objects** — preview 4D private binary objects (blobs and pictures) inline
- **Save** / **Cancel** when editing (`⌘ S` / `Esc` by default)

### Related entities

Relations are loaded **on demand** to keep the viewer fast:

- **Related entity** — click a deferred relation to fetch and open the related entity inline.
- **Related entity sets** — a related selection loads into the same data grid used by the [table view](./browsing#list-view-modes), with its own pagination. Use [Selection tools](./selection-tools) on related sets when an entity set id is available.

### Metadata panel

4D system attributes (`__KEY`, `__STAMP`, `__TIMESTAMP`, and other `__`-prefixed keys) are grouped into a collapsible **metadata** panel, keeping the main view focused on data attributes.

### Actions (edit mode)

<DocTable :columns="entityActionColumns" :rows="entityActionRows" variant="meta" />

Use the viewer footer pagination to move between entities on the current page (`↑` / `↓` or page shortcuts).

---
