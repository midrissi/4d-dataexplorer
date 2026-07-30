---
title: ORDA Terminal
---

# ORDA Terminal

The terminal is a bottom-dock tab (alongside the [Console](/guide/console)) for running short ORDA-style JavaScript against the connected 4D REST server. Results render as actionable cells — entities, selections, binaries — not only raw JSON.

![ORDA Terminal](/screenshots/37-terminal-panel.png)

## Open

- Footer **Terminal** control, dock tab strip, or command palette (**Open Terminal**)
- Shortcut: `⌘ J` / `Ctrl+J` (default preset)
- Open state and the Console/Terminal tab are restored after reload

## REPL and Code modes

The composer switches between:

| Mode | Purpose | Run |
|------|---------|-----|
| **REPL** | Quick one-liners and short multi-line blocks | Enter runs; Shift+Enter inserts a newline |
| **Code** | Named `.js` snippet files with highlighting | Enter inserts a newline; Shift+Enter runs |

`⌘/Ctrl+Enter` always runs in both modes. On touch devices, use the **Run** button.

![Terminal Code mode](/screenshots/38-terminal-code.png)

### Snippet files

In **Code** mode you can:

- Create, open, save, and delete named snippets (`weekendCars.js`)
- Export / import a gzip pack of snippets (`.orda-snippets.gz`) for backup or sharing
- Use `.load name`, `.run name`, and `.rm name` from the REPL (with name autocomplete)

Dot commands such as `.help` work as a single line in either mode.

## What you can run

```js
ds.Car.all()
ds.Car.query("ID > 0").select("name")
ds.Car.query("color.label=:1", "black")
await ds.Car.get(12).select("name")
```

Multi-line snippets with `await` and `console.log`:

```js
const car = await ds.Car.get(12).select("name")
console.log(car)
const reservations = await ds.Reservation.query("car.ID=:1", car.getKey())
console.log(reservations)
```

Each `console.log` argument becomes an output cell, plus the snippet’s completion value (often `undefined`).

### Class methods

```js
await ds.myDatastoreMethod()
await ds.Car.myDataClassMethod()
await ds.Car.entity(12).myEntityMethod()
await ds.Car.sel(entitySetId).mySelectionMethod()
```

Exposed catalog methods appear in autocomplete after `ds.` / `ds.Car.` / `ds.Car.entity(…).` / `ds.Car.sel(…).`.

## Result cells

| Result | Display | Actions |
|--------|---------|---------|
| Entity | `ds.Car.entity(12)` | Open in a dataclass tab |
| Selection | `ds.Car.sel(…)` | Open in a new tab (server entity set) |
| Binary / image | Typed chip | Expand viewer |
| Other | Tree / JSON | Expand like the console |

REST calls use the same logging fetch as the rest of the app, so they appear under **Console → Network**.

## Autocomplete

The Monaco editor highlights JavaScript and suggests:

- Dataclass names after `ds.`
- `all` / `query` / `get` on a dataclass
- Chain methods (`select`, `orderBy`, …)
- ORDA filter completions inside `query("…")` strings (catalog-aware)
- Dot commands when the buffer looks like `.help` / `.load` / …

## Notes

- Write APIs (create/update/delete) are not exposed in the terminal yet
- Selections create a server entity set so “Open in tab” stays stable
- History: ↑ / ↓ on the first/last line of the REPL walks previous submissions (when suggest is closed)
- `.exit` clears scrollback and closes the dock
- On mobile, opening an entity or selection from a result closes the dock so you can browse the tab

---
