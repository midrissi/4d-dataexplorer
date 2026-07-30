---
title: ORDA Terminal
---

# ORDA Terminal

The terminal is a resizable bottom-panel tab (alongside the [Console](/guide/console)) for running short ORDA-style JavaScript against the connected 4D REST server.

Open from the footer **Terminal** control, the dock tab strip, or the command palette (**Open Terminal**). Shortcut: `⌘ J` / `Ctrl+J` (default preset).

### What you can run

```js
ds.Car.all()
ds.Car.query("ID > 0").select("name")
ds.Car.query("color.label=:1", "black")
await ds.Car.get(12).select("name")
```

Multi-line snippets work with `await` and `console.log`:

```js
const car = await ds.Car.get(12).select("name")
console.log(car)
const reservations = await ds.Reservation.query("car.ID=:1", car.getKey())
console.log(reservations)
```

Each `console.log` argument becomes an output cell, plus the snippet’s completion value (often `undefined`). Press **Enter** to run (or the Run button). **Shift+Enter** inserts a new line. The input clears after each run.

### Class methods

```js
await ds.myDatastoreMethod()
await ds.Car.myDataClassMethod()
await ds.Car.entity(12).myEntityMethod()
await ds.Car.sel(entitySetId).mySelectionMethod()
```

Exposed catalog methods appear in autocomplete after `ds.` / `ds.Car.` / `ds.Car.entity(…).` / `ds.Car.sel(…).`.

### Result cells

| Result | Display | Actions |
|--------|---------|---------|
| Entity | `ds.Car.entity(12)` | Open in a dataclass tab |
| Selection | `ds.Car.sel(…)` | Open in a new tab (server entity set) |
| Binary / image | Typed chip | Expand viewer |
| Other | Tree / JSON | Expand like the console |

REST calls use the same logging fetch as the rest of the app, so they appear under **Console → Network**.

### Autocomplete

The Monaco editor highlights JavaScript and suggests:

- Dataclass names after `ds.`
- `all` / `query` / `get` on a dataclass
- Chain methods (`select`, `orderBy`, …)
- ORDA filter completions inside `query("…")` strings (catalog-aware)

### Notes

- Write APIs (create/update/delete) are not exposed in the terminal yet.
- Selections create a server entity set so “Open in tab” stays stable.
- History: ↑ / ↓ on the first/last line of the input walks previous submissions.
