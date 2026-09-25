#!/bin/bash
# Double-click to run the Pulse client demo: starts the local server (unless it is already
# running) and opens the demo in Chrome. Close this window or press Ctrl+C to stop it.
cd "$(dirname "$0")" || exit 1
PORT=8080
URL="http://pulse.localhost:$PORT"

open_demo() { open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL"; }

if curl -s "http://127.0.0.1:$PORT/" | grep -q "<x-dc>"; then
  echo "Pulse demo already running at $URL"
  open_demo
  exit 0
fi
if curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then
  echo "Something else is using port $PORT. Quit it, or change PORT at the top of this file."
  read -r -p "Press Return to close." _
  exit 1
fi

python3 serve.py "$PORT" &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null' EXIT
until curl -s -o /dev/null "http://127.0.0.1:$PORT/"; do
  if ! kill -0 "$SERVER" 2>/dev/null; then
    read -r -p "The demo could not start (see above). Press Return to close." _
    exit 1
  fi
  sleep 0.1
done
open_demo
wait "$SERVER"
