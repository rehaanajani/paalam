#!/usr/bin/env bash
# Paalam installer for macOS and Linux.
#   curl -fsSL https://raw.githubusercontent.com/rehaanajani/paalam/main/scripts/install.sh | bash
# Installs into ~/paalam (or $PAALAM_DIR), sets it up, and starts it on http://localhost:8080.
# Run it again to update. PAALAM_NO_START=1 sets up without starting; PAALAM_DESKTOP=1 opens the desktop app.
set -euo pipefail

REPO="https://github.com/rehaanajani/paalam.git"
DIR="${PAALAM_DIR:-$HOME/paalam}"
say() { printf '\033[1;35m▸\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m✕\033[0m %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || fail "git is missing. Install it from https://git-scm.com (on a Mac: run 'xcode-select --install'), then run this again."
command -v node >/dev/null 2>&1 || fail "Node.js is missing. Install Node.js 20 or newer from https://nodejs.org, then run this again."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || fail "Node.js $(node -v) is too old. Install Node.js 20 or newer from https://nodejs.org, then run this again."

if [ -d "$DIR/.git" ]; then
  say "Updating Paalam in $DIR"
  git -C "$DIR" pull --ff-only
else
  say "Downloading Paalam into $DIR"
  git clone --depth 1 "$REPO" "$DIR"
fi
cd "$DIR"

say "Installing and building (a minute or two the first time)"
npm run setup --silent

if [ ! -f .env ]; then
  cp .env.example .env
  say "Created .env: Paalam runs in demo mode until you add keys (see docs/KEYS.md)"
fi

if [ "${PAALAM_NO_START:-}" = "1" ]; then
  say "Ready. Start it any time with:  cd \"$DIR\" && npm start"
  exit 0
fi

if [ "${PAALAM_DESKTOP:-}" = "1" ]; then
  say "Opening the desktop app"
  exec npm run desktop --silent
fi

say "Starting Paalam on http://localhost:8080  (Ctrl+C to stop; 'cd \"$DIR\" && npm start' to start again)"
( sleep 4; command -v open >/dev/null && open http://localhost:8080 || command -v xdg-open >/dev/null && xdg-open http://localhost:8080 ) >/dev/null 2>&1 &
exec npm start --silent
