# E2E Tests

End-to-end tests for the Data Explorer application using Playwright.

## Setup

Install dependencies:

```bash
bun install
```

Install Playwright browsers (required before running tests):

```bash
bunx playwright install
```

Or install only Chromium (faster, for local development):

```bash
bunx playwright install chromium
```

## Running Tests

Run all tests:

```bash
bun test
```

Run tests in UI mode (interactive):

```bash
bun test:ui
```

Run tests in headed mode (see browser):

```bash
bun test:headed
```

Debug tests:

```bash
bun test:debug
```

View test report:

```bash
bun test:report
```

Generate tests using codegen:

```bash
bun test:codegen
```

## Test Structure

- `tests/login.e2e.ts` - Login flow tests
- `tests/app.e2e.ts` - Basic app loading and functionality tests
- `tests/welcome-screen.e2e.ts` - Welcome screen tests
- `tests/sidebar.e2e.ts` - Sidebar navigation tests
- `tests/navigation.e2e.ts` - Navigation and routing tests
- `tests/helpers/auth.ts` - Login helper function used by all tests

## Authentication

All tests automatically log in before running using the `login` helper function. The login flow:
1. Sends a POST request to `/api/login` with multipart/form-data containing `accessKey=123`
2. Verifies the login was successful
3. Navigates to `/dataexplorer` after successful authentication

The login helper is called in `beforeEach` hooks, so each test starts with an authenticated session.

## Configuration

The Playwright configuration is in `playwright.config.ts`.

E2E runs against the **production build** (`apps/dataexplorer/DataBrowser`), not Vite dev:

1. Stage the build under `.e2e-static/dataexplorer/` (app `base` is `/dataexplorer/`)
2. Serve it with `bunx http-server`
3. Proxy `/rest`, `/api`, `/health`, … to rest-server (`REST_PORT`, default `7081`)

Playwright starts this via `scripts/e2e-serve.sh` (also `bun run test:e2e:serve` from the repo root).

```bash
# optional: build first (e2e-serve builds if DataBrowser is missing)
bun --filter @4d/dataexplorer build

# run tests (starts http-server + rest-server automatically)
bun run test:e2e
```

Defaults: `DATAEXPLORER_URL=http://localhost:4173`, `PORT=4173`, `REST_PORT=7081`. Locally, an already-running server on that URL is reused (`reuseExistingServer`).

Some tests may be skipped if certain conditions aren't met (e.g., no dataclasses available). This is expected behavior.

## Docs Screenshots

Capture scripts write dark/light PNGs to `apps/dataexplorer/docs/screenshots/` and sync them into the docs site.

Start the Data Explorer Vite app first (default `http://localhost:3002`):

```bash
bun --filter @4d/dataexplorer dev
```

From the repo root:

```bash
bun run capture:screenshots
```

Or from `packages/e2e`:

```bash
bun run capture:screenshots
```

### Scripts

| Script | What it captures |
| --- | --- |
| `capture:screenshots` | All docs screenshots |
| `capture:screenshots:console` | Console panel only |
| `capture:screenshots:http-client` | HTTP Client (including WebFolder response formats) |
| `capture:screenshots:ai-actions` | AI actions & tasks only |

You can also run a script file directly:

```bash
bun run ./scripts/capture-docs-screenshots.ts
bun run ./scripts/capture-console-screenshot.ts
bun run ./scripts/capture-http-client-screenshot.ts
bun run ./scripts/capture-ai-actions-screenshot.ts
```

### Options

All capture scripts share the same CLI:

| Option | Description |
| --- | --- |
| `[page...]` | Capture only these page numbers (e.g. `27` or `2 3`). `7` selects both `07-card-view` and `07-table-view`. |
| `--mode <dark\|light\|all>` | Theme to capture (default: `all`) |
| `--list` | List available screenshot pages |
| `--help`, `-h` | Show usage |

### Examples

```bash
# All pages, dark + light
bun run capture:screenshots

# One page
bun run ./scripts/capture-docs-screenshots.ts 27

# Several pages
bun run ./scripts/capture-docs-screenshots.ts 2 3

# Dark theme only
bun run ./scripts/capture-docs-screenshots.ts --mode dark 27

# Focused feature script
bun run capture:screenshots:http-client -- --mode light 28

# List pages / help
bun run capture:screenshots -- --list
bun run capture:screenshots -- --help
```

Optional env vars:

- `DATAEXPLORER_URL` — app base URL (default `http://localhost:3002`)
- `ACCESS_KEY` — login access key (default `123`)

## CI/CD

Tests run against the production build served by `scripts/e2e-serve.sh` (`bunx http-server` + rest-server API proxy), with:
- Retries on failure
- HTML and GitHub reporters
- Trace collection on first retry
- Screenshots and videos on failure
