---
title: Environment variables
---

<script setup>
import { dynamicEnvVarColumns, dynamicEnvVarRows } from '../.vitepress/data/dynamic-env-vars'
</script>

# Environment variables

Environments hold reusable key/value pairs you can insert anywhere templated text is accepted — HTTP Client URLs and bodies, Method Executor arguments, Query Builder filters, ORDA Terminal snippets, and more.

Values resolve at **execution** time. Saved drafts and favourites keep the raw <code>&#123;&#123;variable&#125;&#125;</code> text.

![Environment editor](/screenshots/40-environments-editor.png)

## Layers

Three layers merge when a template resolves. Higher layers win when the same key exists in more than one place:

| Priority | Layer | Where it lives |
|----------|-------|----------------|
| Highest | **Database** | Named environments for the connected `BASEID` |
| Middle | **Profile** | Named environments stored with the current UI profile |
| Lowest | **Globals** | Always available across profiles and databases |

Open the editor from the footer **Environment** switcher → **Manage…**, or the command palette (**Environments**).

Use the scope control at the top of the editor to switch between **Globals**, **Profile**, and **This database**.

![Environment editor — profile scope](/screenshots/41-environments-profile.png)

### Active environments

Only one profile environment and one database environment can be **active** at a time. The footer switcher selects them; hover it to preview the merged variable list (secrets stay masked until you reveal them).

![Environment switcher](/screenshots/42-environments-switcher.png)

### Variable fields

| Field | Purpose |
|-------|---------|
| **Enabled** | Disabled variables are ignored during resolution |
| **Variable** | Key referenced as <code>&#123;&#123;key&#125;&#125;</code> |
| **Initial** | Default value; used when you reset |
| **Current** | Live value used at resolve time (stays linked to Initial until you edit Current on its own) |
| **Type** | **Default** or **Secret** (masked in the UI) |

Export / Import JSON from the editor toolbar to share environments across machines.

## Templates

Write <code>&#123;&#123;name&#125;&#125;</code> in any templated field. On send/run, Data Explorer substitutes the value from the active merge map.

```text
{{baseUrl}}/rest/{{dataclass}}
Authorization: Bearer {{token}}
```

Unresolved keys stay as <code>&#123;&#123;…&#125;&#125;</code> so typos are visible. Templated inputs highlight known variables as chips and warn on missing ones — use **Manage variables** from the chip popover to jump to the editor.

### Pipe filters

Liquid-style filters apply left-to-right after the value is resolved (or generated):

| Filter | Effect | Example |
|--------|--------|---------|
| `upper` / `lower` | Case | <code>&#123;&#123;name \| upper&#125;&#125;</code> |
| `trim` | Strip ends | <code>&#123;&#123;name \| trim&#125;&#125;</code> |
| `snake` / `kebab` / `camel` / `pascal` | Identifier style | <code>&#123;&#123;title \| snake&#125;&#125;</code> |
| `female` / `male` | Gender for name/email dynamics | <code>&#123;&#123;$faker.person.firstName \| female&#125;&#125;</code> |
| `min` / `max` / `between` | Numeric (or date) bounds | <code>&#123;&#123;$faker.number.int \| between:10,100&#125;&#125;</code> |
| `after` / `before` | Date bounds (`YYYY-MM-DD`) | <code>&#123;&#123;$faker.date.between \| after:2020-01-01&#125;&#125;</code> |

Unknown filters leave the whole <code>&#123;&#123;…&#125;&#125;</code> token unresolved.

```text
{{$faker.person.fullName | female | upper}}
{{$faker.number.int | min:1 | max:50}}
{{$faker.date.between | between:2024-01-01,2024-12-31}}
```

## Dynamic variables

Keys that start with `$` are **dynamic variables**. They are not stored in an environment — each resolve generates a fresh value via [Faker](https://fakerjs.dev/).

### Faker paths

Call any Faker module method with <code>&#123;&#123;$faker.module.method&#125;&#125;</code>:

```text
{{$faker.person.fullName}}
{{$faker.airline.airline}}
{{$faker.food.dish}}
{{$faker.string.uuid}}
{{$faker.number.int | min:1 | max:50}}
{{$faker.person.firstName | female}}
{{$faker.date.between | after:2024-01-01 | before:2024-12-31}}
```

Pipe filters (`female` / `male`, `min` / `max` / `between`, `after` / `before`) map onto Faker options when the method supports them.

### Helper templates (lists & objects)

Ergonomic keys for picking from lists, building arrays, and constructing JSON objects. Nested generators use **bare** <code>$faker…</code> paths in filter args (no nested <code>&#123;&#123;…&#125;&#125;</code>):

```text
{{$pick | from:draft,published,archived}}
{{$sample | from:a,b,c,d | count:2}}
{{$sample | from:a,b,c,d | count:2,4}}
{{$unique | from:a,b,c,d | count:>=2}}
{{$repeat | of:$faker.person.firstName | count:5}}
{{$repeat | of:$faker.person.firstName | count:2,5}}
{{$repeat | of:$faker.person.firstName | count:<=4}}
{{$object | name:$faker.person.fullName | email:$faker.internet.email | status:draft}}
```

`count` accepts a fixed length (`count:3`), an inclusive range (`count:2,5`), or a one-sided bound (`count:>=2`, `count:>2`, `count:<=4`, `count:<5`). Open lower bounds default the upper end to 10; open upper bounds start at 1. For `$sample` / `$unique`, the range is clamped to the `from` list length.
The same filters work on <code>$faker.helpers.arrayElement</code>, <code>arrayElements</code>, <code>multiple</code>, <code>uniqueArray</code>, and <code>weightedArrayElement</code> (e.g. <code>&#123;&#123;$faker.helpers.weightedArrayElement | from&#58;a&#58;3,b&#58;1&#125;&#125;</code>).

In JSON / entity payloads, a leaf that is **exactly** one <code>$object</code> / <code>$sample</code> / <code>$unique</code> / <code>$repeat</code> template rehydrates to a real object or array (not a JSON string).

### Clock aliases

Wall-clock values that are not Faker methods:

```text
{{$timestamp}}
{{$isoTimestamp}}
```

### Reference

<DocTable :columns="dynamicEnvVarColumns" :rows="dynamicEnvVarRows" variant="meta" caption="Dynamic variables" />

## ORDA Terminal

In the terminal, embed <code>&#123;&#123;variable&#125;&#125;</code> in snippet source (substituted before run), call **`faker`** directly (same instance as <code>&#123;&#123;$faker…&#125;&#125;</code>), or use the `app.environment` API:

```js
faker.person.firstName()
faker.string.uuid()

app.environment.get("baseUrl")
app.environment.set("token", "abc")
app.environment.use("Local")
app.environment.globals.set("apiKey", "…")
app.environment.profile.set("token", "abc")
app.environment.base.set("baseUrl", "https://…")
```

Dot commands: `.env` (show / switch active), `.envs` (list profile and database environments).

See also [ORDA Terminal](/guide/terminal).

---
