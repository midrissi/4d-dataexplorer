---
title: Query builder
---

<script setup>
import { queryColumns, queryRows } from '../.vitepress/data/tables'
</script>

# Query builder

Expand the **Query** panel to build REST queries visually.

![Query builder](/screenshots/06-query-builder.png)

Supported options:

<DocTable :columns="queryColumns" :rows="queryRows" variant="meta" />

Click **Run** to execute the query. Use **Reset** to clear the builder.

### ORDA language assistance

The filter editor provides ORDA query assistance powered by a language service:

- **Completion** — suggestions for attributes, operators, and placeholders as you type.
- **Hover** — type and attribute information when hovering an identifier.
- **Signature help** — guidance on placeholders and parameters within the expression.

Types are resolved against the catalog, so suggestions reflect the attributes of the current dataclass and its relations.

### Query history

Each dataclass keeps a **query history** of recent runs. Open the history panel from the query header to re-apply a previous filter, sort, or limit, or to remove individual entries / clear all history.

### Entity set binding

Enter an **entity set ID** to bind the tab to a server-side entity set (`$entityset`). Click the pencil icon to edit, then validate or cancel. Clearing the ID unbinds the tab and returns to the default entity selection for that dataclass.

Entity sets can also be **combined** (`AND` / `OR` / `EXCEPT` / `INTERSECT`) and **released** through the API and the assistant tools.

---
