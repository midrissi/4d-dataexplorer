---
name: web-app-perf-optimize
description: Finds performance hotspots in the monorepo apps (dataexplorer, desktop, mobile), compares alternative fixes, and applies the highest-impact safe change. Use when asked to optimize, speed up, reduce jank, fix slow renders, shrink bundle size, eliminate waterfalls, or improve TTI/LCP/FPS.
---

# Optimize app performance

Spot real bottlenecks, analyze at least two fixes, apply the best one. Do not spray micro-optimizations.

For React/Next-style rules, also follow [vercel-react-best-practices](../vercel-react-best-practices/SKILL.md). Repo-specific surfaces: [hotspots.md](hotspots.md).

## When to use

User asks to optimize, speed up, reduce jank/lag, shrink the bundle, cut waterfalls, or improve TTI/LCP/FPS — or names a slow screen (entity list, graph, viewer, method executor, terminal, console).

If they name paths, stay on those. If they say “the app”, start from [hotspots.md](hotspots.md) and evidence in code (not guesswork).

## Workflow

Copy and track:

```
Perf pass:
- [ ] 1. Scope + evidence
- [ ] 2. Inventory hotspots (ranked)
- [ ] 3. Analyze ≥2 solutions per chosen hotspot
- [ ] 4. Apply the best one
- [ ] 5. Verify
```

### 1. Scope + evidence

- Read the target screen/module and its data path (`lib/api`, `@4d/rest`, Zustand stores).
- Prefer evidence: sequential `await`, store subscribed too broadly, list/grid without virtualization, eager heavy imports (Monaco, ELK, AG Grid, pdfjs, Ace), O(n²) lookups, layout reads in loops.
- Skip cosmetic refactors unless they unlock the perf win.

### 2. Inventory

Rank by **user-visible impact**, then risk:

| Pri | Class | Typical smell |
|-----|--------|----------------|
| P0 | Waterfalls | Independent REST/catalog/entity calls awaited in series |
| P0 | Bundle | Heavy libs on initial route; barrel imports (`@4d/ui`, `lucide-react`) |
| P1 | Re-renders | `useStore()` / wide Zustand selectors; new object/array each render |
| P1 | Lists | Unvirtualized long lists; AG Grid work on every keystroke |
| P2 | Main-thread | ELK/layout, JSON highlight, big `JSON.stringify` on the UI thread |
| P2 | I/O | Uncached `localStorage` in render; duplicate fetches |

### 3. Analyze solutions

For the **top hotspot only** (unless the user asked for a full pass), write 2–3 options:

| Option | Impact | Risk | Fits stack? |
|--------|--------|------|-------------|
| A | … | … | … |
| B | … | … | … |

**Pick “best” using this order:**

1. Highest user-visible impact (jank, wait time, bytes on first load)
2. Lowest product-behavior risk (no stale entities, no broken pagination/tabs)
3. Fits existing stack: Vite SPA, Zustand, AG Grid, xyflow/ELK, Monaco/Ace, `@4d/rest` — do not add SWR/React Query unless clearly better than extending current fetch + store
4. Prefer a Vercel rule when it applies
5. Prefer extracting a tested `lib/` helper over inlining cleverness

If options are close, choose the smaller diff.

### 4. Apply

- Change only what the chosen option needs (call sites, types, tests).
- Keep i18n, `@4d/ui` APIs, and REST contracts unless the fix requires it.
- Do not change product behavior except to remove accidental extra work (duplicate fetch, extra render).
- One concern per pass. Do not mix a maintainability rewrite with perf unless required.

### 5. Verify

- `bun run typecheck` for touched packages
- Relevant `bun test` (especially extracted helpers)
- Mentally (or via existing tests) check tab switch, entity select, graph load, method run — whatever you touched

## Don't

- Optimize without naming the hotspot and the rejected alternatives
- Memoize everything (`useMemo`/`React.memo` as default)
- Cache entity/catalog data in ways that can show stale `__STAMP` / lists
- Introduce a new data library for one screen
- Drive-by refactor unrelated files
- Trade accessibility or correctness for FPS

## Output

```markdown
## Hotspots
- [P0] `path` — smell + why it hurts
- [P1] …

## Chosen
**Hotspot:** …
**Options:** A … / B … (rejected because …)
**Applied:** … (why it won)

## Verify
typecheck / tests …
```
