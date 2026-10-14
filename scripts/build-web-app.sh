#!/usr/bin/env bash
# Builds the TV app for the browser and puts it in the server, which serves it
# at /app/ (and inside a scaled 1920x1080 "TV" frame at /play).
# Usage: scripts/build-web-app.sh   then commit server/public/app and push.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/server/public/app"
rm -rf "$OUT"
cd "$ROOT/tv/apps/expo-multi-tv"
EXPO_BASE_URL=/app npx expo export -p web --output-dir "$OUT"
# The exported page is titled after the template; name it after the app.
sed -i '' 's#<title>[^<]*</title>#<title>SteadyUp</title>#' "$OUT/index.html"
echo "Built $OUT"
