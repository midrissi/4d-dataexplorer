---
name: web-app-refactor-maintainable
description: Refactor a file or list of files into testable, readable, maintainable code — small files, one React component per file, logic extracted for tests. Use when asked to refactor, clean up, split, or improve maintainability of specific paths.
---

# Refactor for maintainability

Rewrite the given file(s) so the result is easy to read, easy to change, and easy to test. Follow `AGENTS.md` code quality rules.

## When to use

User provides one or more paths (or asks to refactor a module/feature). Apply this skill to those targets only — do not drive-by refactor unrelated files.

## Goals

- **Readable** — clear names, shallow nesting, obvious control flow
- **Maintainable** — single responsibility per module; small files
- **Testable** — pure logic and side-effectful code separated from presentational UI
- **One React component per file**
- Extract shared/reusable helpers into `hooks/`, `lib/`, or `store/` as appropriate

## Workflow

1. **Read** the target file(s) and their direct imports/usages.
2. **Inventory** components, hooks, helpers, types, and side effects in each file.
3. **Plan splits** before editing:
   - One exported React component → one `.tsx` file
   - Hooks → `use*.ts` / `use*.tsx`
   - Pure helpers → `lib/*.ts` (prefer unit tests here)
   - Types shared across modules → dedicated `types.ts` or next to the domain
4. **Rewrite** by moving code into the new structure; update imports at call sites.
5. **Add or update tests** for extracted pure functions, store slices, and non-trivial helpers (`bun test` / existing patterns).
6. **Verify** `bun run typecheck` (and relevant unit tests) for touched packages.
7. Keep i18n, `@4d/ui`, and REST patterns unchanged unless the refactor requires it.

## Split heuristics

| Smell | Action |
|-------|--------|
| Multiple `function Foo()` / `const Bar =` components in one file | One file each |
| File ≫ ~200–300 lines with mixed concerns | Split by responsibility |
| Inline business rules inside JSX | Extract hook or `lib` function |
| Duplicated fetch/parse/format logic | Shared `lib` + tests |
| Giant prop bags / god components | Compose smaller children |

Do not split for its own sake — only when it improves clarity or testability.

## Don't

- Change product behavior unless fixing an obvious bug found during refactor
- Merge unrelated refactors into the same pass
- Leave dead code or unused exports behind
- Put multiple React components in one file “for convenience”
- Expand scope beyond the requested files and their necessary import updates

## Output

Summarize briefly: what was split, where logic moved, and which tests were added/updated.
