# 4D Data Explorer

Monorepo for the **Data Explorer** web app (REST browser for 4D), desktop shell (Tauri), docs site, and supporting packages.

## Prerequisites

- [Bun](https://bun.sh) **1.3.9+** (lockfile is pinned; prefer matching this version)
- Optional: [Docker](https://docs.docker.com/get-docker/) for the nginx image / e2e container
- Optional: Rust + platform deps for the Tauri desktop app

## Quick start

```bash
bun install --frozen-lockfile

# Terminal 1 — mock 4D REST API (+ serves a built DataBrowser if present)
bun --filter @4d/rest-server dev

# Terminal 2 — Vite app (proxies /rest, /api, … to BACKEND_URL)
BACKEND_URL=http://localhost:7080 bun --filter @4d/dataexplorer dev
```

Open **http://localhost:3002/dataexplorer/**.

| Service | Default URL |
| --- | --- |
| Data Explorer (Vite) | http://localhost:3002/dataexplorer/ |
| Mock REST server | http://localhost:7080 |
| Docs (VitePress) | http://localhost:5173/4d-dataexplorer/ |

Point `BACKEND_URL` at a real 4D REST host instead of the mock when needed.

## Repository layout

| Path | Package | Role |
| --- | --- | --- |
| `apps/dataexplorer` | `@4d/dataexplorer` | Web UI (Vite + React) |
| `apps/desktop` | `@4d/desktop` | Tauri desktop shell |
| `apps/mobile` | `@4d/mobile` | Tauri mobile shell (iOS/Android beta) |
| `apps/docs` | `@4d/docs` | User docs (VitePress) |
| `packages/rest` | `@4d/rest` | REST client |
| `packages/rest-server` | `@4d/rest-server` | Mock REST API for local/e2e |
| `packages/ui` | `@4d/ui` | Shared UI kit |
| `packages/json-schema-builder` | `@4d/json-schema-builder` | JSON Schema builder |
| `packages/orda-language-service` | `@4d/orda-language-service` | ORDA language helpers |
| `packages/e2e` | `@4d/e2e` | Playwright tests |

## Root scripts

Run from the repo root with `bun run <script>`.

### Quality

| Script | Description |
| --- | --- |
| `format` | Format with Biome (write) |
| `format:check` | Check formatting only |
| `lint` | Lint with Biome |
| `lint:fix` | Lint and apply unsafe fixes |
| `check` | Biome check (format + lint + organize) |
| `check:fix` | Biome check with writes |
| `typecheck` | Typecheck all workspaces |
| `quick-ci` | format:check → lint → check → typecheck → unit tests |
| `quick-ci:fix` | `check:fix` then `quick-ci` |

### Build & test

| Script | Description |
| --- | --- |
| `build` | Build all packages/apps that define a `build` script |
| `test` / `test:unit` | Unit tests (excludes e2e) |
| `test:coverage` | Unit tests with coverage |
| `coverage:html` | Merge LCOV and generate HTML coverage report |
| `coverage:report` | Extended dataexplorer coverage merge + text report |
| `docs:coverage` | Docs/screenshot coverage HTML report |

### E2E

Install Playwright browsers once: `cd packages/e2e && bunx playwright install --with-deps`.

Typical flow: build DataExplorer, start rest-server (serves `DataBrowser` at `/dataexplorer/`), then run e2e.

| Script | Description |
| --- | --- |
| `test:e2e` | Playwright (headless) |
| `test:e2e:ui` | Playwright UI mode |
| `test:e2e:headed` | Headed browser |
| `test:e2e:debug` | Debug mode |
| `test:e2e:report` | Open last HTML report |
| `test:e2e:codegen` | Codegen against `$DATAEXPLORER_URL` |
| `test:e2e:docker` | Build & run e2e in `Dockerfile.e2e` |

### Docs & release

| Script | Description |
| --- | --- |
| `docs:dev` | VitePress docs in watch mode |
| `docs:build` | Build static docs site |
| `release` / `release:patch` / `release:minor` / `release:major` | Version bump helpers (`scripts/release.ts`) |

## App & package scripts

### `@4d/dataexplorer`

```bash
bun --filter @4d/dataexplorer dev          # Vite on :3002
bun --filter @4d/dataexplorer build        # → apps/dataexplorer/DataBrowser
bun --filter @4d/dataexplorer preview
bun --filter @4d/dataexplorer test
bun --filter @4d/dataexplorer test:coverage
bun --filter @4d/dataexplorer check-i18n
```

Build output: `apps/dataexplorer/DataBrowser` (base path `/dataexplorer/`).

### `@4d/rest-server`

```bash
bun --filter @4d/rest-server dev           # :7080 — mock REST + static DataBrowser
```

Build the web app first if you want `/dataexplorer/` served from the mock server.

### `@4d/desktop`

```bash
bun --filter @4d/desktop tauri:dev
bun --filter @4d/desktop tauri:build
```

### `@4d/mobile` (Beta)

See [apps/mobile/README.md](apps/mobile/README.md) for Android/iOS prerequisites, LAN/cleartext notes, and scripts.

```bash
bun --filter @4d/mobile dev                 # Vite UI on :3005
bun --filter @4d/mobile tauri:android:dev
bun --filter @4d/mobile tauri:ios:dev
```

### `@4d/docs`

```bash
bun run docs:dev
bun run docs:build
```

## Docker

Lightweight nginx image: serves the DataExplorer build at `/dataexplorer/` and proxies `/rest`, `/api`, `/login.html`, `/js`, `/css`, `/img` to `BACKEND_URL`.

### Build

```bash
docker build -t dataexplorer .
```

### Run

```bash
docker run --rm -p 8080:80 \
  -e BACKEND_URL=http://host.docker.internal:7080 \
  -e PUBLISHED_PORT=8080 \
  --add-host=host.docker.internal:host-gateway \
  dataexplorer
```

Then open http://localhost:8080/dataexplorer/.

| Variable / flag | Purpose |
| --- | --- |
| `BACKEND_URL` | 4D (or mock) REST origin — no trailing slash |
| `PUBLISHED_PORT` | Host port shown in the welcome banner (keep in sync with `-p`) |
| `--add-host=host.docker.internal:host-gateway` | Lets the container reach the Docker host (needed on Linux) |

Published images: `ghcr.io/midrissi/4d-dataexplorer` (`linux/amd64` + `linux/arm64`; see GitHub Packages / CI `ci.yml`).

```bash
docker pull ghcr.io/midrissi/4d-dataexplorer:latest
```

E2E image (separate Dockerfile):

```bash
bun run test:e2e:docker
# or
docker build -f Dockerfile.e2e -t dataexplorer-e2e .
docker run --rm dataexplorer-e2e
```

## Before you commit

Run a clean check-and-fix pass so CI stays green:

```bash
clear && bun run quick-ci:fix
```

That applies Biome fixes, then runs format check, lint, check, typecheck, and unit tests.

Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:

```
<type>(<scope>): <subject>
```

Examples: `feat(dataexplorer): …`, `fix(rest): …`, `docs: …`, `chore(deps): …`. Prefer imperative subjects (`add`, `fix`, `update`), keep the subject under 72 characters, and include a scope when it clarifies the change.

## Useful links

- User docs (source): [`apps/docs`](./apps/docs) — getting started includes Docker for end users
- Releases / `DataExplorer.zip`: https://github.com/midrissi/4d-dataexplorer/releases
- Container package: https://github.com/midrissi/4d-dataexplorer/pkgs/container/4d-dataexplorer

## License

Private project — all rights reserved.
