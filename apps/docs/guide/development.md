---
title: Development & screenshots
---

# Development & screenshots

Screenshots in this document were captured at **1920×1080 @ 2×** (3840×2160 effective) against `http://localhost:7080/dataexplorer/` with access key `123`, **Tangerine** theme, and randomized dataclass icons. Each in-app screenshot is stored in **dark** and **light** variants; the docs site shows the variant that matches your theme.

To regenerate screenshots:

```bash
bun scripts/generate-coverage-html.ts --screenshots --docs
```

Or capture only:

```bash
cd packages/e2e
DATAEXPLORER_URL=http://localhost:7080 bun run capture:screenshots

# Or from the e2e package:
# bun --filter @4d/e2e capture:screenshots
```

To capture a single new screenshot against the Vite app (proxied to the 4D REST API) when the built `/dataexplorer/` on port 7080 is stale:

```bash
cd packages/e2e
DATAEXPLORER_URL=http://localhost:3002 bun run capture:screenshots:console
DATAEXPLORER_URL=http://localhost:3002 bun run capture:screenshots:terminal
DATAEXPLORER_URL=http://localhost:3002 bun run capture:screenshots:http-client
DATAEXPLORER_URL=http://localhost:3002 bun run capture:screenshots:ai-actions
DATAEXPLORER_URL=http://localhost:3002 bun run capture:screenshots -- 39
```

HTTP Client response-format screenshots expect sample files on the 4D WebFolder at `http://localhost/` (for example `/text.txt`, `/markdown.md`, `/PDF.pdf` from `apps/base/WebFolder`).

Output directory: `apps/dataexplorer/docs/screenshots/dark/` and `.../light/`.

To check documentation coverage (features + screenshot pairs):

```bash
bun scripts/generate-coverage-html.ts --docs
```

Report: `coverage/html/docs.html`.

---