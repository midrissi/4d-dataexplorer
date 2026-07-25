#!/bin/sh
set -eu

PUBLISHED_PORT="${PUBLISHED_PORT:-8080}"
BACKEND_URL="${BACKEND_URL:-http://host.docker.internal:7080}"

# Keep the official nginx entrypoint quiet (no envsubst chatter).
export NGINX_ENTRYPOINT_QUIET_LOGS=1

BOLD="$(printf '\033[1m')"
DIM="$(printf '\033[2m')"
CYAN="$(printf '\033[36m')"
ORANGE="$(printf '\033[38;5;208m')"
GREEN="$(printf '\033[32m')"
RESET="$(printf '\033[0m')"

# Clear the terminal when attached interactively (ignore failures in CI/non-TTY).
printf '\033c' 2>/dev/null || true

cat <<EOF

  ${ORANGE}${BOLD}
       🐳  4D Data Explorer
  ${RESET}${DIM}       nginx · REST proxy · ready to browse${RESET}

  ${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}

  ${BOLD}🌐  Open${RESET}
      ${GREEN}→${RESET}  http://localhost:${PUBLISHED_PORT}/dataexplorer/

  ${BOLD}🔌  Backend${RESET}
      ${GREEN}→${RESET}  ${BACKEND_URL}

  ${BOLD}💚  Health${RESET}
      ${GREEN}→${RESET}  http://localhost:${PUBLISHED_PORT}/health

  ${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}

  ${BOLD}💡  Tip${RESET}
      Match ${ORANGE}PUBLISHED_PORT${RESET} to your ${ORANGE}-p${RESET} host port:
      ${DIM}docker run -p 3015:80 -e PUBLISHED_PORT=3015 …${RESET}

  ${DIM}⌨️   Press Ctrl+C to stop${RESET}


EOF

# Validate config first so failures are visible in the terminal.
if ! /docker-entrypoint.sh nginx -t >/tmp/nginx-test.log 2>&1; then
  printf '%s\n' "${ORANGE}${BOLD}⚠️  nginx configuration failed:${RESET}"
  cat /tmp/nginx-test.log
  exit 1
fi

# Foreground nginx; send boot chatter to a log file so the welcome banner
# stays the main terminal output. Real runtime errors land in error.log.
exec /docker-entrypoint.sh nginx -g "daemon off; error_log /var/log/nginx/error.log warn;" 2>/var/log/nginx/boot.log
