---
title: Browsing entities
---

<script setup>
import { browsingPanelRows, panelColumns } from '../.vitepress/data/tables'
</script>

# Browsing entities

Click a dataclass in the sidebar or on the Home screen to open a tab. The dataclass view has three panels:

<DocTable :columns="panelColumns" :rows="browsingPanelRows" variant="meta" />

![Dataclass view](/screenshots/04-dataclass-view.png)

### List view modes

Switch between **Cards** and **Table** using the toggle in the dataclass toolbar, or with `⌘ 1` / `⌘ 2`.

**Cards** — compact cards with key field values and actions (copy, delete).

![Cards view](/screenshots/07-card-view.png)

**Table** — spreadsheet-style grid. Visible columns follow the query **Attributes** (`$attributes`) selection; when empty, default columns are shown.

![Table view](/screenshots/07-table-view.png)

### Toolbar actions

- **Refresh** — reload entities from the server (`⌥ ⌘ R` when focused on the list)
- **+ New** — open the **create entity** dialog (when edit mode is enabled; `N`)
- **Structure** — open the structure graph with this dataclass highlighted
- **Top / limit** — quick selector for how many rows to fetch (`$top`)
- **Pagination** — first, previous, next, last page controls at the bottom of the list

### Create entity

The create dialog validates fields against the dataclass schema. Submit to POST a new record; the list refreshes and selects the new entity. **Duplicate** (from a card menu or the command palette) pre-fills the dialog with a sanitized copy of an existing entity.

### Display fields

Use the **Display fields** button in the dataclass toolbar to choose and reorder the attributes shown in the list.

- **Table columns / Card fields** — maintain independent attribute lists for the **Table** and **Cards** views.
- **Reorder** — drag attributes to change their order; the list and cards follow the same order.
- **Nested attributes** — drill into a relation to pick nested attributes (for example `company.name`), and deeper as needed.
- **Save as default** — save the current selection as the default for the dataclass, or reset back to the defaults.

Selections are kept per tab. They are applied as the query **Attributes** (`$attributes`) selection, so the list only fetches the chosen attributes. The [entity viewer](./entity-viewer) detail panel still shows every attribute.

---

