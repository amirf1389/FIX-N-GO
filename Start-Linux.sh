#!/bin/bash
# Bracket Engine launcher for Linux — run: ./Start-Linux.sh
cd "$(dirname "$0")" || exit 1
mkdir -p data
export DB_FILE="$PWD/data/bracket.sqlite"   # one shared database for every way of running the app
APP="app/BracketEngine-linux-x64"

if [ -f "$APP" ] && [ "$(uname -m)" = "x86_64" ]; then
  chmod +x "$APP"
  echo "Starting Bracket Engine at http://localhost:3000 (Ctrl+C to stop)"
  exec "./$APP"
elif command -v node >/dev/null 2>&1; then
  echo "Using the Node.js version."
  cd node && { [ -d node_modules ] || npm install --omit=dev; }
  (sleep 2 && command -v xdg-open >/dev/null && xdg-open "http://localhost:3000" >/dev/null 2>&1) &
  exec node server.js
else
  echo "Could not find a Linux app for $(uname -m) or Node.js. Install Node.js from https://nodejs.org and try again."
  exit 1
fi
