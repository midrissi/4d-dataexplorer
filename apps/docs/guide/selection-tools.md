---
title: Selection tools
---

# Selection tools

Wherever you have an **entity set** (dataclass list after a query, Method Executor selection result, related selection, Home entity-set row, or tab context menu), open **Selection tools** to analyze, export, import, or anonymize that selection.

Entry points include:

- Dataclass list toolbar (**⋯** / Selection tools)
- Dataclass tab context menu
- Method Executor entity-selection result
- Related entity-set actions
- Home screen entity-set rows
- Command palette (**Analyze**, **Export**, **Import**, **Anonymize**)

An entity set is required for analyze, export, and anonymize. **Import** always targets the currently open dataclass and does not require a selection.

## Analyze

**Analyze** inspects one attribute on the current entity set:

- **Distinct values** — uses 4D REST `$distinct` on the attribute path
- **Compute** — min / max / average / count via `$compute=$all` when the type supports it

Pick an attribute, then refresh to reload stats.

## Export

**Export** downloads the current selection (or filter / whole dataclass when no set is bound) in an extendable format registry:

| Format | Typical use |
|--------|-------------|
| JSON / JSON REST / JSON Lines | Interchange and tooling |
| CSV / TSV | Spreadsheets |
| SQL | `INSERT` scripts |
| XML / YAML / Markdown / HTML | Docs and structured dumps |

Choose columns (select all / none), then download. Large selections ask for confirmation before paging through the entity set.

## Import

**Import** reads a file (or pasted content), detects the format when possible, previews rows, and writes into the **current dataclass**:

- **Create** — new records (`$method=update` batch create)
- **Update** — existing records; each row must include `__KEY` and `__STAMP`

Supported parsers match the export registry where implemented (JSON family, CSV/TSV, SQL inserts, XML, …).

## Anonymize

**Anonymize** replaces mapped fields with synthetic data (or fixed values) using the same template engine as [Create entity](./browsing#create-entity) and [Environment variables](./environments):

- **Field mapping** — add, change, or remove rows; per attribute: **Faker** (<code>&#123;&#123;$faker… | filters&#125;&#125;</code>), **Fixed value**, **Keep**, or **Empty**. **Restore defaults** rebuilds the plan from the dataclass schema
- **Remove fields** — drop a row from the mapping so that attribute is **not** included in download, import-as-new, or in-place update payloads
- **Pick lists** — declare named value pools under [Environments → This database](./environments#pick-lists-this-database) (dataclass + attribute). Anonymize loads `$distinct` values on demand when a Faker template references <code>&#123;&#123;$pick | from:$lists.&lt;name&gt;&#125;&#125;</code> (also `$sample` / `$unique`)
- **Seed** — optional Faker seed for reproducible dumps
- **Preview** — same multi-mode viewer as the HTTP Client (Code / HTML / Markdown / JSON / CSV), with auto-detected default from the chosen export format

Actions:

| Action | Effect |
|--------|--------|
| **Download** | Export anonymized rows (create-shaped payload, no PK / system keys) |
| **Import as new** | Create new records from the anonymized mapping |
| **Anonymize existing** | Overwrite mapped fields on the **current entity set** (confirmation required; sends `__KEY` / `__STAMP` plus changed fields only) |

Templates support pipe filters (for example <code>&#123;&#123;$faker.internet.username | lower&#125;&#125;</code>) and autocomplete, consistent with create-entity templating.
