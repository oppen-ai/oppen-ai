#!/bin/bash
set -e

# Generate favicon.ico from SVG logo
# Usage: ./generate-favicon.sh
# Requires: rsvg-convert OR magick (ImageMagick)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SVG="$PROJECT_DIR/src/logo.svg"
OUT="$PROJECT_DIR/public/favicon.ico"

if command -v rsvg-convert &>/dev/null && command -v magick &>/dev/null; then
    echo "Generating favicon via rsvg-convert + magick..."
    rsvg-convert -w 32 -h 32 "$SVG" -o /tmp/favicon-32.png
    magick /tmp/favicon-32.png "$OUT"
    rm -f /tmp/favicon-32.png
elif command -v magick &>/dev/null; then
    echo "Generating favicon via magick..."
    magick -background none -density 300 "$SVG" -resize 32x32 "$OUT"
else
    echo "ERROR: Need rsvg-convert + magick or magick alone"
    exit 1
fi

echo "Generated: $OUT"
