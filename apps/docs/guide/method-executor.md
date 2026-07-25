---
title: Method Executor
---

# Method Executor

Configure and run exposed 4D / ORDA methods from a dedicated tab. Open it from the **command palette**, dataclass and entity views, the **Tools** menu, or the assistant.

The left panel selects the method and arguments; the right panel shows the result.

### Scopes

| Scope | Expression | Use when |
|-------|------------|----------|
| **Datastore** | `ds.method` | Catalog / datastore functions |
| **Dataclass** | `ds.Table.method` | Class functions on a dataclass |
| **Entity** | `ds.Table.entity(key).method` | Methods on a single entity |
| **Entity selection** | `ds.Table.sel(key).method` | Methods on a server entity selection / entity set |

### Arguments

Arguments keep positional order (`$1`, `$2`, …). Each can be a **Custom** value, an **Entity** reference, or an **Entity selection**. Reorder, duplicate, or remove them before execute.

### Result views

After **Execute**, the right panel adapts to the response: an **entity selection** opens as a preview table (with count and **Open all in new tab**), a single **entity** opens in the entity viewer, and any other value is shown as read-only JSON. The screenshots below are examples from a sample database — the methods themselves are not built into the executor.

![Entity selection result](/screenshots/19-method-executor-get-entity-sel.png)

![Entity result](/screenshots/20-method-executor-get-first-car.png)

![JSON result](/screenshots/21-method-executor-say-hello.png)

### Running a method

- Defaults to a **POST** request. If the method allows HTTP GET, enable **Execute with GET**.
- Click **Execute** when the target and arguments are complete.
- **History** lists recent successful runs so you can reopen the same configuration. ⌘/Ctrl+click keys in history to open the related entity or selection.

### Tips

- Clear the current method with the **×** control to return to the catalog picker.
- Incomplete entity / selection arguments block execution.
- Entity-selection targets use the selection key (entity set ID); query filter / order-by from a data tab are not carried into the executor when an entity set is already bound.
