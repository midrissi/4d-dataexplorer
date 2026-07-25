#!/bin/bash
set -e

# Install curl and Node.js if not available
apt-get update -qq && apt-get install -y -qq curl nodejs npm >/dev/null

# Install dependencies
bun install --frozen-lockfile

# Install Playwright browsers
cd packages/e2e && bunx playwright install --with-deps && cd ../..

# Verify DataBrowser exists (from build artifact)
if [ ! -d "apps/dataexplorer/DataBrowser" ]; then
  echo "Building DataBrowser..."
  bun --filter @4d/dataexplorer build
fi

# Start rest-server in background
cd packages/rest-server
bun run dev > rest-server.log 2>&1 &
echo $! > rest-server.pid
cd ../..

# Wait for server to be ready
timeout 30 bash -c 'until curl -f http://localhost:7080/health 2>/dev/null; do sleep 1; done' || true

# Verify rest-server is running
sleep 2
curl -f http://localhost:7080/health || exit 1
curl -f http://localhost:7080/dataexplorer/ || exit 1
