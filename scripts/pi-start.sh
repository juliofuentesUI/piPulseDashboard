#!/usr/bin/env bash
#
# Start the dashboard. Run ./scripts/pi-setup.sh once before the first launch.
#
#   ./scripts/pi-start.sh
#
# Serves the built front end on 5173 and the Fastify API on 3000, and keeps
# running until interrupted. Deliberately does no installing and no building:
# this is the thing that runs at boot, so it should start in a second and fail
# loudly rather than quietly rebuilding a wall display.
#
set -euo pipefail

readonly REQUIRED_NODE_MAJOR=24

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly ROOT

if [ -t 1 ]; then
  readonly RED=$'\033[31m' OFF=$'\033[0m'
else
  readonly RED='' OFF=''
fi

die() { printf '%serror:%s %s\n' "$RED" "$OFF" "$1" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "Node is not installed. Run ./scripts/pi-setup.sh"

MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
[ "$MAJOR" -ge "$REQUIRED_NODE_MAJOR" ] ||
  die "Node $(node -v) is too old; this needs ${REQUIRED_NODE_MAJOR}+. Run ./scripts/pi-setup.sh"

[ -d "$ROOT/node_modules" ] || die "dependencies are not installed. Run ./scripts/pi-setup.sh"
[ -f "$ROOT/apps/api/dist/server.js" ] || die "the API is not built. Run ./scripts/pi-setup.sh"
[ -f "$ROOT/apps/web/dist/index.html" ] || die "the front end is not built. Run ./scripts/pi-setup.sh"

cd "$ROOT"

# `npm start` runs both halves under concurrently: node on the built API, and
# 'vite preview' on the built front end. Preview proxies /api to Fastify, so
# the browser only ever calls a relative path.
exec npm start
