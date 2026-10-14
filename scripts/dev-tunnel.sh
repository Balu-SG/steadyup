#!/usr/bin/env bash
# Start the SteadyUp server behind a fresh HTTPS tunnel (phones need https for
# motion sensors) and point the TV app at it.
# Usage: scripts/dev-tunnel.sh   (Ctrl+C stops both)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/out"
CONFIG="$ROOT/tv/packages/shared-ui/src/steadyup/config.ts"
PORT="${PORT:-8787}"
mkdir -p "$OUT"

pkill -f "node src/index.js" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://localhost:$PORT" 2>/dev/null || true

cloudflared tunnel --url "http://localhost:$PORT" --no-autoupdate > "$OUT/tunnel.log" 2>&1 &
TUNNEL_PID=$!
trap 'kill $TUNNEL_PID 2>/dev/null; pkill -f "node src/index.js" 2>/dev/null' EXIT

URL=""
for _ in $(seq 1 30); do
  URL=$(grep -a -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$OUT/tunnel.log" | grep -v '^https://api\.' | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done
[ -z "$URL" ] && { echo "Tunnel did not start; see $OUT/tunnel.log"; exit 1; }
echo "$URL" > "$OUT/public_url.txt"

# Point the TV app at this server.
sed -i '' "s#^export const SERVER_URL = .*#export const SERVER_URL = '$URL';#" "$CONFIG"

echo "Public URL: $URL"
echo "TV preview: http://localhost:$PORT   (rebuild the TV app to pick up the new URL)"
cd "$ROOT/server" && PUBLIC_URL="$URL" PORT="$PORT" node src/index.js
