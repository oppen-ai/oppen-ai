#!/bin/bash
set -e

# Generate OG preview image (1200x630) from logo
# Usage: ./generate-og.sh
# Requires: magick (ImageMagick) or rsvg-convert + magick

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SVG="$PROJECT_DIR/src/logo.svg"
OUT="$PROJECT_DIR/public/og-preview.png"

if ! command -v magick &>/dev/null; then
    echo "ERROR: ImageMagick (magick) required"
    echo "Install: sudo apt install imagemagick"
    exit 1
fi

echo "Generating OG preview image..."

# Create dark background with centered logo and text
magick -size 1200x630 xc:'#0a0a0a' \
    \( -background none -density 300 "$SVG" -resize 200x200 \) \
    -gravity center -geometry +0-60 -composite \
    -gravity center -geometry +0+80 \
    -font "Helvetica-Bold" -pointsize 48 -fill '#ebebeb' \
    -annotate +0+80 "Öppen AI" \
    -font "Helvetica" -pointsize 24 -fill '#888888' \
    -annotate +0+130 "Private AI chat, on your device" \
    "$OUT"

echo "Generated: $OUT"
