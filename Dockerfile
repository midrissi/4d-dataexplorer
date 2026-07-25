# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────────
# Pin Bun to match the lockfile / local toolchain (avoid frozen-lockfile drift).
FROM oven/bun:1.3.9 AS build

WORKDIR /app

COPY package.json bun.lockb bunfig.toml ./
COPY patches ./patches

# Workspace manifests — full graph needed for --frozen-lockfile
COPY apps/dataexplorer/package.json ./apps/dataexplorer/
COPY apps/desktop/package.json ./apps/desktop/
COPY apps/docs/package.json ./apps/docs/
COPY packages/e2e/package.json ./packages/e2e/
COPY packages/base64-decoder/package.json ./packages/base64-decoder/
COPY packages/json-schema-builder/package.json ./packages/json-schema-builder/
COPY packages/orda-language-service/package.json ./packages/orda-language-service/
COPY packages/rest/package.json ./packages/rest/
COPY packages/rest-server/package.json ./packages/rest-server/
COPY packages/ui/package.json ./packages/ui/

RUN bun install --frozen-lockfile

# Sources needed for the DataExplorer Vite build
COPY apps/dataexplorer ./apps/dataexplorer
COPY packages/base64-decoder ./packages/base64-decoder
COPY packages/json-schema-builder ./packages/json-schema-builder
COPY packages/orda-language-service ./packages/orda-language-service
COPY packages/rest ./packages/rest
COPY packages/ui ./packages/ui

RUN bun --filter @4d/dataexplorer build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Backend URL used by nginx to proxy /rest, /api, and related paths.
# Defaults to the Docker host (host.docker.internal). Override at run time:
#   -e BACKEND_URL=https://4d.example.com
ENV BACKEND_URL=http://host.docker.internal:7080

COPY --from=build /app/apps/dataexplorer/DataBrowser /usr/share/nginx/html/dataexplorer
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/docker-entrypoint.sh /docker-welcome-entrypoint.sh
RUN chmod +x /docker-welcome-entrypoint.sh

# Optional: set PUBLISHED_PORT to the host port from -p so the welcome banner URL matches.
ENV PUBLISHED_PORT=8080

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

ENTRYPOINT ["/docker-welcome-entrypoint.sh"]
