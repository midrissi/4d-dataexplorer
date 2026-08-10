# ORDA Terminal

Interactive JavaScript REPL over a client-side `ds` facade. Expressions talk to your 4D server via REST; HTTP traffic shows up in **Console**.

## Quick start

```js
ds.Car.all()
await ds.Agency.get(12).select("name")
ds.Employee.query("lastname = :1", "Smith")
```

Press **Enter** to run · **Shift+Enter** for a new line · **↑/↓** for history (REPL). In **Code** mode, **Enter** inserts a line and **Shift+Enter** runs.

## Dot commands

Type a command on its own line (starting with `.`):

| Command | What it does |
| --- | --- |
| `.help` / `.h` / `.?` | Show this help |
| `.clear` / `.cls` | Clear the scrollback |
| `.exit` / `.quit` / `.q` | Clear the scrollback and close the terminal dock |
| `.history` | List recent commands |
| `.snippets` / `.ls` | List saved snippets |
| `.save <name>` | Save the last run as a snippet |
| `.load <name>` | Open a snippet file in the editor |
| `.run <name>` | Run a saved snippet |
| `.rm <name>` | Delete a snippet |
| `.classes` / `.ds` | List dataclass names |
| `.about` | Short about line |
| `.theme` | Tip: switch app theme in Settings |
| `.env` | Show active environments; `.env <name>` switches |
| `.envs` | List profile and database environments |

Snippet names: letters, digits, `_`, `-` (e.g. `.save weekendCars`). Files appear as `weekendCars.js` in the terminal bar — open them to edit with JS highlighting and ORDA autocomplete (⌘/Ctrl+S to save).

## `app.environment`

```js
app.environment.get("baseUrl")
app.environment.set("token", "abc")
app.environment.remove("token")
app.environment.clear()
app.environment.list()
app.environment.use("Local")
app.environment.getActive()
app.environment.globals.get("apiKey")
app.environment.globals.set("apiKey", "…")
app.environment.profile.set("token", "abc")
app.environment.base.set("baseUrl", "https://…")
```

`profile` / `base` read and write the **active** profile or database environment (`set` returns `false` if none is active). `globals` always writes the global layer.

You can also embed `{{variable}}` in snippet source — values are substituted from the active environment map before the snippet runs.

Postman-style **dynamic variables** work the same way and generate a fresh value each time, for example `{{$timestamp}}`, `{{$isoTimestamp}}`, `{{$guid}}`, `{{$randomInt}}`, `{{$randomEmail}}`.

## `ds` surface

```js
ds.Car.all()
ds.Car.query("ID > :1", 10).orderBy("name").top(20)
await ds.Car.get(12).select("name", "agency.name")
ds.Car.entity(12).myMethod(...)
ds.Car.sel("entitySetId").mySelectionMethod(...)
```

Chain builders: `.select()`, `.orderBy()`, `.expand()`, `.top()`, `.skip()`, `.first()`, `.count()`, `.toCollection()`.

## Tips

- Open an entity or selection from a result cell to jump into a table tab.
- Multi-line `await` snippets work — wrap statements normally; a final expression is returned.
- Create or open **New .js** files in the composer bar; no separate dialog.
- **Export / Import** icons download or load a single gzip pack (`.orda-snippets.gz`). Import merges; existing names are skipped.
- Autocomplete after `ds.` and `ds.Car.` when the catalog is loaded; `.load` / `.run` suggest snippet names.
- Type `.` alone for the list of terminal commands.
