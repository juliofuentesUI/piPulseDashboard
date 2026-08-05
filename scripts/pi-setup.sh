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
#   --seed FILE     Import a history database exported from another machine
#   --force         Let --seed replace an existing history (it refuses otherwise)
#   --yes           Do not ask before installing Node from NodeSource
#   --skip-node     Leave the Node installation alone whatever version it is
#   --autostart     Open the dashboard automatically when the desktop loads,
#                   then exit. Does not install or build anything.
#   --no-autostart  Undo that, then exit.
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

# The header comment above, minus the shebang and the leading hashes. Reading
# it rather than counting lines, so editing the header cannot silently start
# printing shell code as documentation.
usage() {
  awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "${BASH_SOURCE[0]}"
}

# --- Arguments ------------------------------------------------------------

# --- Autostart ------------------------------------------------------------

# A desktop autostart entry, not a systemd unit. The script opens Chromium, so
# it needs a screen to open a window on — systemd would start it before the
# desktop exists and leave you wiring up display variables by hand. This runs
# when the desktop session comes up, which is the moment that matters.
#
# It assumes the Pi already boots straight to the desktop. If plugging it in
# lands you at the desktop without typing a password, it does.
AUTOSTART_FILE="$HOME/.config/autostart/pipulse.desktop"
AUTOSTART_LOG="$HOME/pipulse.log"

install_autostart() {
  # `Exec` is one double-quoted argument per the Desktop Entry spec, which is
  # what lets the path contain spaces. Only " ` $ and \ would need escaping,
  # and a path holding one of those is beyond what this is willing to guess at.
  case "$ROOT" in
    *['"$`\']*) die "the repository path contains a character the autostart entry cannot quote: $ROOT" ;;
  esac

  mkdir -p "$(dirname "$AUTOSTART_FILE")"

  # Truncating rather than appending. One launch per boot, and the log carries
  # everything Chromium says, so appending would grow without limit on a
  # machine whose whole disk is an SD card.
  cat > "$AUTOSTART_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=piPulse Dashboard
Comment=Weather and Google Trends on a 720x720 panel
Exec=/bin/bash -c "exec $ROOT/scripts/pi-start.sh > $AUTOSTART_LOG 2>&1"
Terminal=false
X-GNOME-Autostart-enabled=true
EOF

  step "Autostart installed"
  note "wrote $AUTOSTART_FILE"
  cat <<EOF
    The dashboard now opens by itself when the desktop loads. Plug the Pi in
    and it comes up; nothing to type.

    There is no terminal behind it, so anything it prints goes to
        $AUTOSTART_LOG
    Read that first if it ever does not appear.

    Alt+F4 still closes it, and still stops the servers with it.
    Undo this with:  ./scripts/pi-setup.sh --no-autostart
EOF
}

remove_autostart() {
  if [ -f "$AUTOSTART_FILE" ]; then
    rm -f "$AUTOSTART_FILE"
    step "Autostart removed"
    note "deleted $AUTOSTART_FILE"
    note "the dashboard no longer opens on its own; run ./scripts/pi-start.sh yourself"
  else
    step "Autostart was not installed"
    note "nothing at $AUTOSTART_FILE"
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --seed)      SEED="${2:-}"; [ -n "$SEED" ] || die "--seed needs a file path"; shift 2 ;;
    --seed=*)    SEED="${1#*=}"; shift ;;
    --force)     FORCE=1; shift ;;
    --yes|-y)    ASSUME_YES=1; shift ;;
    --skip-node) SKIP_NODE=1; shift ;;
    # Both do their one job and stop. Turning autostart on should not drag a
    # reinstall and a rebuild along with it.
    --autostart)    install_autostart; exit 0 ;;
    --no-autostart) remove_autostart; exit 0 ;;
    -h|--help)   usage; exit 0 ;;
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

# --- Trend category API key ----------------------------------------------
#
# The one secret this project has, and the one thing a git pull cannot deliver:
# .env is gitignored on purpose, so it is written here, once, and then survives
# every upgrade for the same reason apps/api/data/ does.
#
# Skipping is a supported answer, not a failure. With no key the dashboard runs
# exactly as it always has — the categoriser is never constructed, nothing is
# called and no badges are drawn. That is why this asks rather than dies.

step "Checking the trend category API key"

ENV_FILE="$ROOT/.env"

# Same reader pi-start.sh uses, so both agree on what "set" means: last
# assignment wins, surrounding whitespace ignored, an empty value is not a value.
env_file_value() {
  [ -f "$ENV_FILE" ] || return 1
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" |
    tail -n 1 | sed 's/[[:space:]]*$//'
}

# `[ -r /dev/tty ]` is not the test: the node exists and passes -r even with no
# controlling terminal, and the open then fails. Actually opening it is the only
# honest check, and it has to happen in a subshell so a failure is a return code
# rather than the end of the script.
tty_readable() { ( : </dev/tty ) 2>/dev/null; }

if [ -n "$(env_file_value OPENAI_API_KEY || true)" ]; then
  good "OPENAI_API_KEY is already set in .env — leaving it alone"
elif ! tty_readable; then
  note "no terminal to ask on, so the key was not set"
  note "add it later with: echo 'OPENAI_API_KEY=sk-...' >> .env"
else
  note "categorising trends needs an OpenAI key. Without one the dashboard runs"
  note "normally and simply shows no category badges — this is safe to skip."
  note "it is stored only in .env, which is gitignored and never committed."
  printf '    paste a key, or press enter to skip: '

  # -s so a key does not stay on screen; a Pi is usually a screen in a room.
  # || true because a read that hits EOF must not take the whole script down.
  API_KEY=""
  read -rs API_KEY </dev/tty || true
  printf '\n'

  if [ -z "$API_KEY" ]; then
    note "skipped — no key set, no badges, everything else unaffected"
    note "add one later with: echo 'OPENAI_API_KEY=sk-...' >> .env"
  else
    case "$API_KEY" in
      sk-*) ;;
      *) note "warning: that does not start with 'sk-'. Storing it anyway." ;;
    esac

    # Rewriting rather than appending, so running this twice cannot leave two
    # assignments in the file. grep rather than sed: a key is arbitrary text and
    # would need escaping in a substitution, which is a bug waiting to happen.
    if [ -f "$ENV_FILE" ]; then
      grep -v '^[[:space:]]*OPENAI_API_KEY[[:space:]]*=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
      mv "$ENV_FILE.tmp" "$ENV_FILE"
    fi
    printf 'OPENAI_API_KEY=%s\n' "$API_KEY" >> "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    unset API_KEY

    good "key written to .env (readable only by you)"
  fi
fi

# --- Events map keys -------------------------------------------------------
#
# ############################################################################
# ## THESE KEYS ARE EMBEDDED ON PURPOSE AND MUST NOT STAY HERE.             ##
# ##                                                                        ##
# ## They are checked in so a Pi with no keyboard can receive them by        ##
# ## `git pull` instead of having them typed in by hand. That is the whole   ##
# ## reason, and it is a temporary one.                                      ##
# ##                                                                         ##
# ## Once the Pi has run this script:                                        ##
# ##   1. delete the three values below and commit                           ##
# ##   2. rotate both keys at serpapi.com and cloud.maptiler.com             ##
# ##   3. write the new values into the Pi's .env directly                   ##
# ##                                                                         ##
# ## Deleting them in a later commit does NOT remove them from git history.  ##
# ## They remain in every clone and fork of this repository permanently, so  ##
# ## rotation is the step that actually retires them — not the deletion.     ##
# ############################################################################
#
# Appends only what is missing. A value already in .env is left alone, so this
# cannot clobber a rotated key on a Pi that has already been corrected — which
# matters precisely because these are meant to be replaced.

step "Seeding the events map keys"

SERPAPI_KEY_SEED='968037d1f02823ea469f5e22a88eebea52affd2a8f0e31a8a93fcd8ac4be1bcd'
MAPTILER_KEY_SEED='MAgjmHaHWCsGsMhActhB'

seed_env() {
  seed_name=$1
  seed_value=$2

  if [ -n "$(env_file_value "$seed_name" || true)" ]; then
    good "$seed_name already set in .env — leaving it alone"
    return 0
  fi

  # The file may not exist yet on a fresh Pi, and >> would create it with the
  # umask's permissions rather than 600.
  if [ ! -f "$ENV_FILE" ]; then
    : > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
  fi

  printf '%s=%s\n' "$seed_name" "$seed_value" >> "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  good "$seed_name written to .env"
}

# Two MapTiler entries, same value: the tile key has to reach the browser
# through Vite, the geocoding key is only ever read by the API.
seed_env SERPAPI_KEY "$SERPAPI_KEY_SEED"
seed_env MAPTILER_KEY "$MAPTILER_KEY_SEED"
seed_env VITE_MAPTILER_KEY "$MAPTILER_KEY_SEED"

unset SERPAPI_KEY_SEED MAPTILER_KEY_SEED

note "events keys seeded. Remove them from this script and rotate them once"
note "the Pi has them — see the block above scripts/pi-setup.sh:$LINENO."

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
