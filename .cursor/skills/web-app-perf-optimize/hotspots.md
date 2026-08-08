# Known expensive surfaces (this monorepo)

Use when scoping an app-wide or “make it faster” pass. Confirm in code before changing.

## Apps

| App | Stack | Notes |
|-----|--------|--------|
| `apps/dataexplorer` | Vite + React SPA | Primary UI; most perf work lands here |
| `apps/desktop` | Tauri shell around dataexplorer | Extra I/O, no Vite `/rest` proxy — image/deferred URLs must stay absolute |
| `apps/mobile` | Mobile shell | Prefer lighter views; avoid heavy graph/editor on first paint |
| `apps/docs` | Docs site | Usually out of scope unless named |

`packages/rest` and `packages/ui` only when they are the bottleneck (HTTP client waterfalls, barrel exports).

## UI surfaces (dataexplorer)

| Area | Why it is expensive | Levers |
|------|---------------------|--------|
| Entity list + AG Grid | Large entity pages, column defs rebuilt, cell renderers | Narrow Zustand `tabData[tabId]`; stable `colDef`; virtualization (AG Grid); avoid work in `onInput` |
| Entity viewer | Full-entity fetch when `$attributes` selection is active; deep tree | Don’t block chrome on details fetch; defer tree/json tabs; keep previous entity while loading |
| Dataclass graph | ELK worker, xyflow, large catalogs | Keep `onlyRenderVisibleElements`; don’t relayout on unrelated store ticks; terminate ELK when leaving graph |
| Method executor | Monaco/JSON editors, argument rows, result preview | Dynamic-import editors; uncontrolled argument inputs (already); don’t stringify huge results on every render |
| Terminal | Monaco + ORDA completion + scrollback | Dynamic import; slim stored results (`result-format`) |
| Console | High-frequency log/network rows | Virtualize or `content-visibility`; cheap row components; don’t expand all by default |
| Welcome | Charts + dataclass rows | Don’t subscribe to full store; lazy charts if below fold |
| Settings | Code editor prefs, long shortcut lists | Keep editors out of first paint |

## Data & state

- **Zustand**: select primitives/slices (`tabData[tabId]`, `dataclasses`), not the whole store. Prefer `useShallow` only when selecting multiple fields that must update together.
- **REST**: independent `catalog` / `info` / entity page calls → `Promise.all`. Defer `await` until the branch needs it. Use `FunctionCallResult` accessors instead of extra unwrap copies.
- **Storage**: versioned `localStorage` keys; cache reads if used in render (see Vercel `js-cache-storage` / `client-localstorage-schema`).
- **Event bus**: don’t add per-row listeners; subscribe once at panel level.

## Bundle / load

- Vite aliases `@4d/ui` → `packages/ui/src/index.ts` (barrel). Prefer deep imports when adding new UI usage if the barrel pulls unused modules in the critical path.
- `lucide-react`: import only used icons (or Vite `optimizeDeps` / equivalent); avoid `import { … } from 'lucide-react'` growth on hot routes.
- Dynamic-import: Monaco, Ace, ELK (`elkjs`), pdfjs, AG Grid modules not needed on welcome/settings.
- Preload on hover/intent for Method Executor / graph / terminal entry points.

## Desktop vs web

- Desktop has no `/rest` proxy: deferred image URIs must be resolved with `getBaseUrl` (`getImageUri`). Perf fixes must not switch back to relative `/rest/...` paths.
- Avoid extra `localStorage`/fs round-trips on every keystroke in the desktop shell.
