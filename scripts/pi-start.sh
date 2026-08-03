#!/usr/bin/env bash
#
# Start the dashboard and open it full-screen on the Pi's display.
#
#   ./scripts/pi-start.sh
#
# Serves the built front end on 5173, the Fastify API on 3000, waits for the
# front end to actually answer, then launches Chromium in kiosk mode on it.
# Ctrl-C here, or Alt+F4 in the browser, stops all of it.
#
# Run ./scripts/pi-setup.sh once before the first launch. This script
# deliberately does no installing and no building: it should start in a second
# and fail loudly rather than quietly rebuilding a wall display.
#
# Options:
#   --no-browser   Serve only, and do not launch Chromium. Use this over SSH,
#                  or when reading the dashboard from another device.
#
set -euo pipefail

readonly REQUIRED_NODE_MAJOR=24

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly ROOT

LAUNCH_BROWSER=1
SERVERS_PID=""
BROWSER_PID=""

# --- Output ---------------------------------------------------------------

if [ -t 1 ]; then
  readonly BOLD=$'\033[1m' DIM=$'\033[2m' RED=$'\033[31m' OFF=$'\033[0m'
else
  readonly BOLD='' DIM='' RED='' OFF=''
fi

step() { printf '%s==>%s %s\n' "$BOLD" "$OFF" "$1"; }
note() { printf '    %s%s%s\n' "$DIM" "$1" "$OFF"; }
warn() { printf '    %s! %s%s\n' "$RED" "$1" "$OFF"; }
die()  { printf '%serror:%s %s\n' "$RED" "$OFF" "$1" >&2; exit 1; }

# The header comment above, minus the shebang and the leading hashes. Reading
# it rather than counting lines, so editing the header cannot silently start
# printing shell code as documentation.
usage() {
  awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "${BASH_SOURCE[0]}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --no-browser) LAUNCH_BROWSER=0; shift ;;
    -h|--help)    usage; exit 0 ;;
    *)            die "unknown option: $1" ;;
  esac
done

# --- Shutdown -------------------------------------------------------------

# `npm start` runs concurrently, which runs two shells, which run node and
# vite. Signalling the top of that tree does not reliably reach the bottom of
# it, and an orphaned vite holding port 5173 makes the *next* launch fail in a
# way that looks like a bug in the app. So walk the tree and kill downward.
kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

cleanup() {
  trap - EXIT INT TERM
  printf '\n'

  if [ -n "$BROWSER_PID" ]; then
    kill_tree "$BROWSER_PID" || true
  fi
  if [ -n "$SERVERS_PID" ]; then
    step "Stopping the dashboard"
    kill_tree "$SERVERS_PID" || true
    wait "$SERVERS_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# --- Checks ---------------------------------------------------------------

command -v node >/dev/null 2>&1 || die "Node is not installed. Run ./scripts/pi-setup.sh"

MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
[ "$MAJOR" -ge "$REQUIRED_NODE_MAJOR" ] ||
  die "Node $(node -v) is too old; this needs ${REQUIRED_NODE_MAJOR}+. Run ./scripts/pi-setup.sh"

[ -d "$ROOT/node_modules" ] || die "dependencies are not installed. Run ./scripts/pi-setup.sh"
[ -f "$ROOT/apps/api/dist/server.js" ] || die "the API is not built. Run ./scripts/pi-setup.sh"
[ -f "$ROOT/apps/web/dist/index.html" ] || die "the front end is not built. Run ./scripts/pi-setup.sh"

# Has to agree with vite.config.ts, which reads the same two sources in the
# same order. Otherwise the browser is pointed at a port nothing is serving.
env_file_value() {
  [ -f "$ROOT/.env" ] || return 1
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$ROOT/.env" |
    tail -1 | tr -d "\"' \r"
}

WEB_PORT="${WEB_PORT:-$(env_file_value WEB_PORT || true)}"
case "$WEB_PORT" in
  ''|*[!0-9]*) WEB_PORT=5173 ;;
esac
readonly WEB_PORT
readonly URL="http://localhost:$WEB_PORT"

# --- Servers --------------------------------------------------------------

cd "$ROOT"

step "Starting the dashboard"
note "node on the built API, and 'vite preview' on the built front end"
npm start &
SERVERS_PID=$!

wait_for_web() {
  if ! command -v curl >/dev/null 2>&1; then
    note "curl is not installed, so waiting a fixed five seconds instead"
    sleep 5
    return 0
  fi

  local deadline=$((SECONDS + 90))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if curl -sf -o /dev/null --max-time 2 "$URL"; then
      return 0
    fi
    # If the servers died on startup — a port already taken is the usual one —
    # say so now rather than sitting in this loop for ninety seconds.
    if ! kill -0 "$SERVERS_PID" 2>/dev/null; then
      die "the dashboard exited while starting up. The output above says why."
    fi
    sleep 0.5
  done
  return 1
}

step "Waiting for $URL"
wait_for_web || die "nothing answered on port $WEB_PORT after 90 seconds"
note "serving"

# --- Browser --------------------------------------------------------------

find_browser() {
  local candidate
  # Raspberry Pi OS has called it both of the first two across releases.
  for candidate in chromium-browser chromium chromium-browser-v7 google-chrome-stable; do
    if command -v "$candidate" >/dev/null 2>&1; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

if [ "$LAUNCH_BROWSER" -eq 0 ]; then
  step "Serving only"
  note "open $URL from this Pi, or reach it from another device on the network"
  note "Ctrl-C to stop"
  wait "$SERVERS_PID"
  exit 0
fi

if ! BROWSER="$(find_browser)"; then
  warn "Chromium is not installed, so the screen stays where it is."
  note "install it with:  sudo apt install -y chromium-browser"
  note "meanwhile the dashboard is up at $URL — Ctrl-C to stop"
  wait "$SERVERS_PID"
  exit 0
fi

# Over SSH there is no display to open a window on. Assuming :0 is what makes
# `ssh pi ./scripts/pi-start.sh` put the dashboard on the panel rather than
# failing, which is usually the intent.
if [ -z "${WAYLAND_DISPLAY:-}" ] && [ -z "${DISPLAY:-}" ]; then
  export DISPLAY=:0
  note "no display set, assuming :0 — pass --no-browser if that is wrong"
fi

step "Opening $BROWSER in kiosk mode"
note "Alt+F4 in the browser, or Ctrl-C here, stops everything"

# Exactly the command you would type by hand. Chromium is noisy on a Pi and
# its output is left alone rather than hidden, so this behaves the same way
# running it yourself does.
"$BROWSER" --kiosk "$URL" &
BROWSER_PID=$!

# Waiting on the browser rather than the servers: closing the dashboard should
# take its servers down with it, which the EXIT trap then does.
wait "$BROWSER_PID"
