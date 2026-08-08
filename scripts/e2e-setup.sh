#!/bin/bash
set -e

# Install curl and Node.js if not available (GitLab / slim images)
if ! command -v curl >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq curl nodejs npm >/dev/null
fi

# Install dependencies
bun install --frozen-lockfile

# Install Playwright browsers
cd packages/e2e && bunx playwright install --with-deps && cd ../..

# Prefer build artifact at repo root (GitLab) or apps path (GitHub / local)
if [ -f "DataBrowser/index.html" ] && [ ! -f "apps/dataexplorer/DataBrowser/index.html" ]; then
  mkdir -p apps/dataexplorer
  rm -rf apps/dataexplorer/DataBrowser
  mv DataBrowser apps/dataexplorer/DataBrowser
fi

if [ ! -f "apps/dataexplorer/DataBrowser/index.html" ]; then
  echo "Building DataBrowser..."
  bun --filter @4d/dataexplorer build
fi

echo "DataBrowser ready for e2e (Playwright will start scripts/e2e-serve.sh)."
