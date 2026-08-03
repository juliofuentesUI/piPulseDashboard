#!/usr/bin/env bash
#
# One-time setup for a freshly cloned piPulseDashboard on a Raspberry Pi.
#
#   git clone https://github.com/juliofuentesUI/piPulseDashboard.git
#   cd piPulseDashboard
#   ./scripts/pi-setup.sh
#
# Installs Node 24 if the machine has something older, installs dependencies,
# builds both workspaces, and proves SQLite can actually write where the
# history lives. Safe to run again — every step is idempotent.
#
# Options:
#   --seed FILE   Import a history database exported from another machine
#   --force       Let --seed replace an existing history (it refuses otherwise)
#   --yes         Do not ask before installing Node from NodeSource
#   --skip-node   Leave the Node installation alone whatever version it is
#
set -euo pipefail

# node:sqlite is behind --experimental-sqlite on 22 and built in on 24. That is
# what sets the floor, not Vite.
readonly REQUIRED_NODE_MAJOR=24

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly ROOT
readonly API_DIR="$ROOT/apps/api"

SEED=""
FORCE=0
ASSUME_YES=0
SKIP_NODE=0

# --- Output ---------------------------------------------------------------

if [ -t 1 ]; then
  readonly BOLD=$'\033[1m' DIM=$'\033[2m' RED=$'\033[31m' GREEN=$'\033[32m' OFF=$'\033[0m'
else
  readonly BOLD='' DIM='' RED='' GREEN='' OFF=''
fi

step() { printf '\n%s==>%s %s%s\n' "$BOLD" "$OFF" "$1" "$OFF"; }
note() { printf '    %s%s%s\n' "$DIM" "$1" "$OFF"; }
good() { printf '    %s%s%s\n' "$GREEN" "$1" "$OFF"; }
die()  { printf '\n%serror:%s %s\n' "$RED" "$OFF" "$1" >&2; exit 1; }

# --- Arguments ------------------------------------------------------------

while [ $# -gt 0 ]; do
  case "$1" in
    --seed)      SEED="${2:-}"; [ -n "$SEED" ] || die "--seed needs a file path"; shift 2 ;;
    --seed=*)    SEED="${1#*=}"; shift ;;
    --force)     FORCE=1; shift ;;
    --yes|-y)    ASSUME_YES=1; shift ;;
    --skip-node) SKIP_NODE=1; shift ;;
    -h|--help)   sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)           die "unknown option: $1" ;;
  esac
done

# The history file the API will open. `config.ts` resolves TRENDS_DB_PATH
# against the API's own directory, so this has to agree with it.
DB_RELATIVE="${TRENDS_DB_PATH:-data/trends.db}"
case "$DB_RELATIVE" in
  /*) DB_PATH="$DB_RELATIVE" ;;
  *)  DB_PATH="$API_DIR/$DB_RELATIVE" ;;
esac
readonly DB_PATH
DATA_DIR="$(dirname "$DB_PATH")"
readonly DATA_DIR

# --- Node -----------------------------------------------------------------

node_major() {
  command -v node >/dev/null 2>&1 || return 1
  node -v | sed 's/^v//' | cut -d. -f1
}

install_node() {
  command -v sudo >/dev/null 2>&1 || die "need sudo to install Node, and it is not on this machine"
  command -v curl >/dev/null 2>&1 || die "need curl to fetch the NodeSource installer"

  local script
  script="$(mktemp -t nodesource-XXXXXX.sh)"
  note "downloading the NodeSource setup script to $script"
  curl -fsSL "https://deb.nodesource.com/setup_${REQUIRED_NODE_MAJOR}.x" -o "$script"

  note "running it with sudo — it adds the NodeSource apt repository"
  sudo -E bash "$script"
  sudo apt-get install -y nodejs
  rm -f "$script"
}

step "Checking Node"
CURRENT_MAJOR="$(node_major || echo 0)"

if [ "$SKIP_NODE" -eq 1 ]; then
  note "--skip-node given, leaving Node alone (found major version ${CURRENT_MAJOR})"
elif [ "$CURRENT_MAJOR" -ge "$REQUIRED_NODE_MAJOR" ]; then
  good "Node $(node -v) is new enough"
else
  if [ "$CURRENT_MAJOR" -eq 0 ]; then
    note "Node is not installed"
  else
    note "Node $(node -v) is too old — the version in apt is 18, which cannot build this"
  fi
  note "this needs Node ${REQUIRED_NODE_MAJOR}+, because the trend history uses node:sqlite"

  if [ "$ASSUME_YES" -ne 1 ]; then
    printf '    install Node %s from NodeSource now? [y/N] ' "$REQUIRED_NODE_MAJOR"
    read -r reply </dev/tty
    case "$reply" in
      [yY]*) ;;
      *) die "cannot continue without Node ${REQUIRED_NODE_MAJOR}+. Install it and run this again." ;;
    esac
  fi

  install_node
  CURRENT_MAJOR="$(node_major || echo 0)"
  [ "$CURRENT_MAJOR" -ge "$REQUIRED_NODE_MAJOR" ] ||
    die "Node is still $(node -v 2>/dev/null || echo missing) after installing. Check the apt output above."
  good "Node $(node -v) installed"
fi

# --- Dependencies and build ----------------------------------------------

cd "$ROOT"

step "Installing dependencies"
note "npm ci — this includes dev dependencies on purpose, because the built"
note "front end is served by 'vite preview' and Vite is one of them"
npm ci
good "dependencies installed"

step "Building both workspaces"
npm run build
[ -f "$API_DIR/dist/server.js" ] || die "the API build produced no dist/server.js"
[ -f "$ROOT/apps/web/dist/index.html" ] || die "the web build produced no dist/index.html"
good "API and web built"

# --- SQLite ---------------------------------------------------------------

step "Checking SQLite"
note "opening a throwaway database in $DATA_DIR and reading a row back"
node "$ROOT/scripts/history-db.mjs" check "$DATA_DIR"
good "SQLite is working"

# --- Optional history import ---------------------------------------------

if [ -n "$SEED" ]; then
  step "Importing history"
  [ -f "$SEED" ] || die "seed file not found: $SEED"

  if [ -f "$DB_PATH" ]; then
    note "this Pi already has a history database:"
    node "$ROOT/scripts/history-db.mjs" stats "$DB_PATH" | sed 's/^/    /'
    if [ "$FORCE" -ne 1 ]; then
      die "refusing to replace it. Move it aside, or pass --force if you meant to."
    fi
    note "--force given, replacing it"
    rm -f "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm"
  fi

  node "$ROOT/scripts/history-db.mjs" export "$SEED" "$DB_PATH"
  good "history imported"
fi

# --- Done -----------------------------------------------------------------

step "Ready"
cat <<EOF
    Start it with:

        ./scripts/pi-start.sh

    That serves the dashboard on port 5173 and the API on 3000. Point the
    Pi's browser at http://localhost:5173 — the layout is authored for a
    720 x 720 panel and scales to whatever the window is.

    Setup only needs running again after a 'git pull' that changes
    dependencies, or to import a history file with --seed.
EOF
