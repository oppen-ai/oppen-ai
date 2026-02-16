#!/bin/bash
set -e

# Generate PNG icons from SVG logo
# Usage: ./generate-icons.sh
# Requires: rsvg-convert (librsvg) OR inkscape OR magick (ImageMagick)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SVG="$PROJECT_DIR/src/logo.svg"
OUT="$PROJECT_DIR/public/icons"

SIZES=(48 72 96 128 144 152 180 192 384 512)

mkdir -p "$OUT"

if command -v rsvg-convert &>/dev/null; then
    TOOL="rsvg-convert"
elif command -v inkscape &>/dev/null; then
    TOOL="inkscape"
elif command -v magick &>/dev/null; then
    TOOL="magick"
else
    echo "ERROR: Need rsvg-convert, inkscape, or magick (ImageMagick)"
    echo "Install: sudo apt install librsvg2-bin"
    exit 1
fi

echo "Using: $TOOL"

for S in "${SIZES[@]}"; do
    OUT_FILE="$OUT/icon-${S}.png"
    echo "  ${S}x${S} → $OUT_FILE"

    case "$TOOL" in
        rsvg-convert)
            rsvg-convert -w "$S" -h "$S" "$SVG" -o "$OUT_FILE"
            ;;
        inkscape)
            inkscape "$SVG" -w "$S" -h "$S" -o "$OUT_FILE" 2>/dev/null
            ;;
        magick)
            magick -background none -density 300 "$SVG" -resize "${S}x${S}" "$OUT_FILE"
            ;;
    esac
done

echo ""
echo "Generated ${#SIZES[@]} icons in $OUT"
