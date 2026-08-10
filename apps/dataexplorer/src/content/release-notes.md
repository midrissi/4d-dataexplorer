# Release notes

---

## 1.4.x

### Overview

Version `1.4.x` adds **environment variables** (globals, profile, and database layers with `{{templates}}`, pipe filters, and Faker-powered dynamics); adds the **ORDA Terminal** (REPL and Code modes with snippet files) in a shared bottom dock with the Console; adds **REST Export** (Collection v2.1 and OpenAPI 3.1 from the catalog, HTTP Client, and Method Executor); adds **favourites** for HTTP Client and Method Executor; ships **iOS and Android** mobile apps; improves console network previews and image share/save; and polishes mobile HTTP Client and dock UX.

### Features

#### Environment variables

- **Environments editor** — Manage **Globals**, **Profile**, and **This database** scopes from Tools, the command palette (**Environments**), or the footer **Environment** switcher → **Manage…**.
- **Active environments** — One profile and one database environment active at a time; footer switcher selects them and previews the merged variable list (secrets stay masked until revealed).
- **Templates** — Insert `{{name}}` in HTTP Client, Method Executor, Query Builder, Create Entity, ORDA Terminal snippets, and other templated fields; values resolve at send/run time.
- **Pipe filters** — Liquid-style transforms (`upper`, `lower`, `snake`, …) plus generator options (`female` / `male`, `min` / `max` / `between`, `after` / `before`).
- **Dynamic variables** — Full Faker surface via `{{$faker.module.method}}` (e.g. `{{$faker.person.fullName}}`, `{{$faker.string.uuid}}`), plus clock aliases `{{$timestamp}}` / `{{$isoTimestamp}}`.
- **Helper templates** — `$pick` / `$sample` / `$unique` / `$repeat` / `$object` (and `$faker.helpers.*`) for lists and JSON objects; `count:n`, `count:min,max`, or `count:>=n` / `count:<=n` for dynamic array length; deep resolve rehydrates exact structured leaves.
- **Chips & autocomplete** — Known variables highlight as chips; completions cover environment keys, aliases, helpers, and `$faker.*` paths; unresolved keys stay visible as `{{…}}`.
- **Export / Import** — Share environments as JSON from the editor toolbar.
- **Terminal API** — `app.environment` helpers plus `.env` / `.envs` dot commands.

#### ORDA Terminal

- **Bottom dock** — Console and Terminal share a resizable dock with a tab strip; open state and active tab persist per profile.
- **REPL** — Run `ds.*` expressions with Monaco highlighting, catalog-aware autocomplete (including inside `query("…")`), and ↑/↓ history.
- **Code mode** — Edit named `.js` snippet files inline; Enter for newline, Shift+Enter (or Run) to execute; `⌘/Ctrl+Enter` always runs.
- **Snippet pack** — Export/import gzip packs (`.orda-snippets.gz`); `.load` / `.run` / `.rm` with name completion.
- **Result cells** — Entities and selections open in tabs; binaries/images use existing viewers; REST traffic appears in Console → Network.
- **Dot commands** — `.help`, `.exit`, and related commands; compact help rendering.

#### REST Export

- **REST Export tab** — Open from Tools or the command palette; a four-step wizard (selection → categories → variables → preview) builds a Collection v2.1 or OpenAPI 3.1 toolkit from the live catalog.
- **Request catalog** — Auth, catalog, info, CRUD, entity sets, dataclass / entity / entitySelection functions, and singletons. Unexposed methods and directory login are off by default.
- **Preview** — Expand or collapse folders (including expand / collapse all), turn emojis on or off, Shift-click to apply or clear emojis by category, and optionally attach official 4D REST documentation to each request.
- **HTTP Client & Method Executor** — Export the current request or favourites as a collection or OpenAPI as well.

#### Mobile

- **iOS & Android apps** — Native shells with connection profiles, CORS-free HTTP, and safe-area layouts.
- **Touch dock** — Console/Terminal as overlays with larger hit targets; share sheet / Downloads for exports.
- **Mobile CI** — GitHub Actions builds and uploads mobile release artifacts (including Android signing support).

#### Console & media

- **Network image preview** — Inline preview for image responses in the console network log.
- **Share / save** — Share or download binary objects and images via platform-native paths (fixes iOS WKWebView download failures).

#### Favourites & create flows

- **HTTP Client favourites** — Save, reopen, and export favourites (including collection / OpenAPI export).
- **Method Executor favourites** — Same favourites workflow for method calls.
- **Batch create entity** — Create multiple entities with templated field values resolved from the active environment map.

#### UX

- **About dialog** — App about information from mobile/desktop chrome.
- **Panel heights** — Entity list and request panes remember height; console height clamps safely when the viewport size is unknown.
- **HTTP Client (mobile)** — Responsive request/response summary for narrow screens.
- **Console URL decoding** — Optional toggle to decode percent-encoded URLs in the network log for easier reading.
- **Environment switcher** — Footer control refined for clearer active profile / database selection and Manage access.

### Docs

- Guide pages for [Console](https://midrissi.github.io/4d-dataexplorer/guide/console.html), [ORDA Terminal](https://midrissi.github.io/4d-dataexplorer/guide/terminal.html), [REST Export](https://midrissi.github.io/4d-dataexplorer/guide/rest-export.html), [Environment variables](https://midrissi.github.io/4d-dataexplorer/guide/environments.html), and [Mobile apps](https://midrissi.github.io/4d-dataexplorer/guide/mobile.html).
- Home gallery includes the Environment editor and updated screenshots (including light / dark captures).

### Fixes

- **iOS downloads** — Snippet and settings exports use the native download/share path instead of `<a download>` (NSURLError -3000).
- **Dock tab restore** — Reloading with Terminal open no longer forces Console.
- **Entity reveal** — Opening an entity from the terminal uses primary-key lookup instead of `$filter` on `__KEY`.
- **Empty query params** — Collection export disables empty `$filter` / `$orderby` / `$attributes` by default so they are not sent until filled in.
- **OpenAPI responses** — Exported specs list known 4D REST statuses (200, 401, 402, 404, 500).
- **Request Docs tab** — Request documentation includes the official 4D REST page markdown, not only a short summary.
- **Dynamic name / range filters** — Gender and numeric / date bounds on `$faker.*` templates resolve through Faker options.
- **Docs templates** — Environment guide and home copy render `{{…}}` examples without breaking the VitePress Vue compiler.

## 1.3.x

### Overview

Version `1.3.x` introduces Data Explorer Desktop (Tauri + React) with persistent connection profiles, native window integration, and in-app auto-updates; adds a Method Executor for selecting and running exposed ORDA methods with typed arguments and specialized result views; adds an HTTP Client for composing and replaying REST requests; adds a resizable Console panel that logs application messages and every HTTP request; improves cross-platform connection handling with HTTP fetch support; extends binary data handling with deferred BLOB loading; optimizes structure graph rendering for large schemas; and refines assistant feedback and accessibility in key navigation surfaces.

### Features

#### Desktop app

- **Data Explorer Desktop** - New desktop application built with Tauri and React.
- **Saved connections** - Create, edit, and reuse connection profiles from a dedicated desktop connection screen.
- **Window and theme handling** - Better desktop startup behavior with improved window state and theme synchronization.
- **Auto-updater** - In-app update detection and process management with update notifications.
- **macOS release pipeline** - GitHub Actions workflow now packages and uploads macOS desktop artifacts.

#### Method Executor

- **Method Executor tab** - Configure and run exposed 4D methods from a dedicated tab; open from the command palette, dataclass and entity views, or the assistant.
- **Scoped method calls** - Call datastore, dataclass, entity, and entity-selection methods with ORDA-style expressions (`ds.method`, `ds.Table.method`, `ds.Table.entity(key).method`, `ds.Table.sel(key).method`).
- **Runtime arguments** - Build positional arguments as custom values, entity references, or entity selections; reorder, duplicate, and validate before execute.
- **Run history** - Reopen recent successful runs; ⌘/Ctrl+click keys in history to open the related entity or selection.
- **Result views** - Inspect JSON results, or open specialized entity and entity-selection previews automatically.

#### Console panel

- **Docked console** - Open a resizable bottom panel from the status bar or the command palette to inspect logs while browsing.
- **Network logging** - Every HTTP request is recorded with method, URL, status, duration, and response size; expand an entry to inspect headers and bodies (secrets redacted).
- **Open in HTTP Client** - Replay a captured network entry in the HTTP Client with sanitized method, URL, headers, and body when available.
- **Filters and controls** - Filter by level (all, log, info, warn, error, network), collapse all expanded rows, and clear the in-memory buffer; error and warning counts appear on the footer Console button.

#### HTTP Client

- **HTTP Client tab** - Compose and send HTTP requests from Tools or the command palette against the current server or a custom origin.
- **Request editor** - Method, server, and path autocomplete; Params, Headers, Body (none / form / urlencoded / raw / binary), and Settings.
- **Response inspector** - Status, timing, size, headers, cookies, and body after Send (⌘/Ctrl+Enter).
- **Desktop options** - Cookie session control, timeouts, redirect limits, and optional TLS skip on desktop builds.

#### Connectivity & data loading

- **HTTP fetch support** - Connection flows were updated to support fetch-based HTTP calls across environments.
- **Deferred BLOB loading** - Binary object loading is improved with on-demand BLOB retrieval in the entity viewer.

#### Structure graph & UI

- **Graph responsiveness** - Dataclass graph rendering now uses card-dimension estimation and optimized node highlight comparisons.
- **Assistant activity feedback** - Chatbot responses now show clearer loading states and an animated sparkles indicator.
- **Accessibility improvements** - Sidebar, tab bar, command palette, and related views received accessibility and semantic class-name refinements.

### Fixes

- **Binary object rendering** - Improved deferred binary handling paths in the entity viewer.
- **Connection editing stability** - Desktop connection edit/update flows were stabilized.
- **Coverage HTML layout** - Adjusted padding in generated coverage HTML output for cleaner rendering.

## 1.2.x

### Overview

Version `1.2.x` adds a visual field manager for displayed attributes (including nested relation paths), inline on-demand loading of related entities, a grouped metadata panel, a binary object viewer, ORDA language assistance in the query builder, an AI assistant with configurable tools, a JSON Schema Builder, Monaco-based code editors, entity set management in the query builder, the Assistant Metadata Editor, bulk entity mutations, access key authentication, structure graph enhancements including fit-to-view navigation, entity viewer loading and error states, and UI improvements across the assistant and query builder.

### Features

#### Display fields

- **Field manager** — Choose and reorder the attributes shown in table columns and cards from a single popover; selections are kept per tab.
- **Nested attributes** — Drill into relations to select nested attributes (e.g. `company.name`, and deeper) for both table and card views.
- **Per-view selection** — Maintain independent attribute lists for the table and card views; drag to reorder.
- **Save as default** — Save the current selection as the default for a dataclass, or reset back to defaults.

#### Entity viewer

- **Deferred relations** — Load related entities and related entity sets on demand, inline in the form and tree views.
- **Shared table for relations** — Related entity sets render in the same data grid used by the table view.
- **Metadata panel** — 4D system attributes (`__KEY`, `__STAMP`, `__TIMESTAMP`, …) are grouped into a collapsible metadata panel.
- **All attributes in details** — The details view always shows every attribute, even when the field manager limits the columns or fields in the list.
- **Expandable card fields** — Cards preview the first fields with a Show more / Show less toggle.
- **Binary object viewer** — Preview 4D private binary objects (blobs and pictures) directly in the entity form and viewer.
- **Loading indicators** — Entity data shows a loading state while fetching, including related entities and entity sets.
- **Error recovery** — When entities fail to load, an inline panel lets you try again, reset the query, or close the tab.
- **Deferred images** — Picture attributes load on demand in table cells and the entity viewer.
- **Cell tooltips** — Hover truncated table cells to reveal the full value.
- **Column sorting** — Sort entity tables by column, including related entity tables.

#### Assistant Metadata Editor

- **Metadata Editor tab** — Document dataclasses, attributes, methods, singletons, and catalog methods for the AI assistant; open from Tools, the command palette, or the assistant toolbar.
- **AI description generation** — Generate descriptions per field or in bulk for all missing entries; optional JSON Schema generation for method parameters.
- **Missing-description indicators** — Highlight items without documentation; filter the sidebar to show only missing entries.
- **JSON editor** — Edit the full metadata object directly; export the schema as a JSON file.

#### AI Assistant

- **Assistant panel** — AI chat panel with tools to query data, navigate tabs, run commands, and control the UI.
- **Configurable tools** — Enable or disable assistant tool namespaces and individual tools in Settings.
- **Fullscreen mode** — Expand the assistant panel to fill the screen; press Escape to exit.
- **Copy trace** — Copy the assistant activity trace to the clipboard from the activity panel.
- **Mermaid diagrams** — Improved rendering and error handling for Mermaid charts in assistant responses.

#### Data operations

- **Bulk entity create/update** — Create or update multiple entities in one call via the API and assistant datastore tools.

#### JSON Schema Builder

- **Schema Builder tab** — Visual editor for building JSON schemas; open from the Tools menu in the footer.
- **Object editor** — Expand or collapse nested objects and configure schema attributes.

#### Code editor

- **Monaco editor** — Code and JSON editors with schema completion throughout the app.
- **Editor preferences** — Configure font size, word wrap, and toolbar in Settings; applies to entity forms, the schema builder, and other editors.

#### Query & entity sets

- **ORDA language assistance** — Code completion, hover information, and signature help for ORDA query expressions, with type resolution against the catalog.
- **Entity set operations** — Combine entity sets (`AND` / `OR` / `EXCEPT` / `INTERSECT`) and release entity sets via the API and assistant tools.
- **Entity set binding** — Bind dataclass tabs to existing server entity set IDs; load, copy, and edit entity set IDs in the query builder.
- **Entity set caching** — Server-side entity sets are cached and released when tabs close.
- **Filter parameters** — Define typed filter parameters for parameterized filter expressions in the query builder.

#### Profiles & appearance

- **Quick profile switch** — Switch profiles from the footer without opening Settings; profile icon and color shown in the status bar.
- **Per-profile appearance** — Customize each profile with an icon and color.
- **Qodly theme** — New Qodly color theme with light and dark modes (Roboto typography, purple accent).

#### Structure graph

- **Method signatures** — Method signatures highlighted in the structure graph.
- **Attribute indicators** — Exposed attributes and relation handles visually highlighted on dataclass nodes.
- **Stable navigation** — Repeated dataclass clicks no longer clear the graph; viewport is validated and node selection is preserved.
- **Fit to view** — Recenter and zoom the structure graph to fit all visible nodes.

#### Authentication & localization

- **Access key login** — Sign in with a REST access key when the server requires authentication.
- **Internationalization** — Expanded translations across the assistant UI, query builder, and other components.

### Fixes

- **Tab state** — Per-tab state stays consistent when switching tabs (active tab synchronization); the active tab ID is validated before closing tabs or setting entity set IDs.
- **Profile shortcuts** — Shortcuts are merged with defaults when loading profiles so empty shortcut lists no longer wipe configured shortcuts.
- **Structure graph viewport** — Programmatic pan/zoom no longer corrupts saved viewport state.
- **List view editing** — Disabled in-table editing in list view to prevent accidental edits.
- **Tab activation order** — Closing a tab now activates the most recently used tab instead of the adjacent one.

---

## 1.1.x

### Overview

Version `1.1.x` delivers a refined 4D REST Explorer for browsing dataclasses and entities, with profile management, a global search bar, command-palette quick modes, keyboard shortcut refinements, language selection, and a focused set of capabilities for viewing and editing data.

### Features

#### Home & Navigation

- **Welcome screen** — Summary of your database: stats, entity counts, and charts (`bar` and `pie`)
- **Global search bar** — Search bar in the header; click or focus to open the command palette.
- **Command palette** — Open entities by ID, open a dataclass, or search dataclasses from one place
- **Recent commands** — Recently used commands appear at the top of the palette with a clock icon; history is stored per profile.
- **Quick modes** — From the palette search, type `:` to jump to an entity by index, `>` to pick a dataclass for the structure view, `/` to open a dataclass’s data, or `@` to switch between tabs.
- **Keyboard shortcuts** — Custom shortcuts for common actions (`command palette`, `settings`, `theme`, `structure`, etc.)
- **Tabbed interface** — Pin tabs, close others, or reorder by dragging
- **Release notes tab** — Open release notes from the status bar (footer); content is shown in a dedicated tab
- **Language** — Choose app language (English, French, Spanish) from the status bar (footer); release notes and UI follow the selected language.

#### Dataclass & Entities

- **Dataclass browser** — Work with several dataclasses in tabs and switch between card and table layout
- **Query builder** — Apply filter, sort, field selection, and limit; collapsible query panel
- **Entity list** — Paginated list in a resizable panel with entity count badges
- **Entity viewer** — Inspect entity `JSON` and create, edit, or delete entities (unless read-only is on)
- **Go to entity** — Open a given entity by ID from the command palette

#### Structure & Visualization

- **Structure graph** — Diagram of dataclasses and their links; highlight a dataclass from the tab context menu
- **Dataclass appearance** — Per-dataclass colors and icons in Settings

#### Profiles & settings

- **Profile management** — Create, rename, duplicate, and delete profiles in Settings. Each profile has its own theme, shortcuts, sidebar width, and other preferences.
- **Import / export** — Export all settings or selected profiles to a JSON file, and import settings or profiles from a file (with the option to choose which profiles to import).

#### Settings & Appearance

- **Appearance** — Several color themes (`Slate`, `Tangerine`, `Violet Bloom`, `Graphite`, `Aurora`, etc.)
- **Light / dark mode** — Follow system or switch manually
- **Default views** — Choose default layout (`cards` or `table`) and page size for new dataclass tabs
- **Keyboard shortcuts** — Turn shortcuts on or off and see the full list in Settings
- **Dataclass appearance** — Set colors and icons for each dataclass in the sidebar and tabs

#### Keyboard shortcuts

- **Shortcuts modal** — The "View" section is now shown in two columns for a more compact layout.
- **Record as chord** — The "Record as chord (two-key sequence)" option is now in the shortcut record modal, so you can choose chord mode when recording a shortcut.
- **Shortcut display** — Shortcut buttons in Settings use a lighter, border-only style (no background) for the key labels.

#### Safety & Modes

- **Read-only mode** — Header toggle to turn off create/edit/delete for safe browsing
- **Edit mode** — Create, update, and delete entities when enabled

### Technical

- **4D REST API** — Talks to your 4D server over REST and supports standard query parameters
- **Persistent state** — Tabs, sidebar width, and settings are stored per base (`BASEID`)
