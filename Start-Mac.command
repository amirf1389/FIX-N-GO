#!/bin/bash
# Bracket Engine launcher for macOS — double-click to start.
cd "$(dirname "$0")" || exit 1
mkdir -p data
export DB_FILE="$PWD/data/bracket.sqlite"   # one shared database for every way of running the app

if [ "$(uname -m)" = "arm64" ]; then APP="app/BracketEngine-macos-arm64"; else APP="app/BracketEngine-macos-x64"; fi

if [ -f "$APP" ]; then
  xattr -dr com.apple.quarantine app 2>/dev/null   # allow the unsigned app to run
  chmod +x "$APP"
  echo "Starting Bracket Engine… your browser will open in a moment."
  echo "Keep this window open while you use the app. Close it to stop."
  exec "./$APP"
elif command -v node >/dev/null 2>&1; then
  echo "Mac app not found — starting the Node.js version instead."
  cd node && { [ -d node_modules ] || npm install --omit=dev; }
  (sleep 2 && open "http://localhost:3000") &
  exec node server.js
else
  echo "Could not find the Mac app or Node.js. Install Node.js from https://nodejs.org and try again."
  read -r -p "Press Enter to close…"
fi
