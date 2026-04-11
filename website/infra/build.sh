#!/bin/bash
set -e

# Build and package the oppen-website static landing page
# Usage: ./build.sh
# Output: timestamped artifact in infra/artifacts/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ARTIFACTS_DIR="$SCRIPT_DIR/artifacts"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARTIFACT_DIR="$ARTIFACTS_DIR/$TIMESTAMP"

echo "=== oppen-website: Build ==="
echo ""

# Validate required files exist
if [ ! -f "$APP_DIR/index.html" ]; then
    echo "ERROR: index.html not found in $APP_DIR"
    exit 1
fi

# Create artifact
echo "Creating artifact: $TIMESTAMP"
mkdir -p "$ARTIFACT_DIR"

# Copy static files
cp "$APP_DIR/index.html" "$ARTIFACT_DIR/"
cp "$APP_DIR/privacy.html" "$ARTIFACT_DIR/"
cp "$APP_DIR/terms.html" "$ARTIFACT_DIR/"
cp "$APP_DIR/about.html" "$ARTIFACT_DIR/"
cp "$APP_DIR/cookie-consent.css" "$ARTIFACT_DIR/"
cp "$APP_DIR/cookie-consent.js" "$ARTIFACT_DIR/"
cp "$APP_DIR/og-image.png" "$ARTIFACT_DIR/" 2>/dev/null || true
cp "$APP_DIR/favicon.ico" "$ARTIFACT_DIR/" 2>/dev/null || true
cp "$APP_DIR/favicon.svg" "$ARTIFACT_DIR/" 2>/dev/null || true

# Copy images directory
if [ -d "$APP_DIR/img" ]; then
    cp -r "$APP_DIR/img" "$ARTIFACT_DIR/"
fi

# Print summary
echo ""
echo "=== Build Complete ==="
echo "Artifact: $ARTIFACT_DIR"
echo ""
echo "Contents:"
find "$ARTIFACT_DIR" -type f | while read -r f; do
    SIZE=$(du -h "$f" | cut -f1)
    REL=${f#"$ARTIFACT_DIR/"}
    printf "  %-40s %s\n" "$REL" "$SIZE"
done
echo ""
TOTAL=$(du -sh "$ARTIFACT_DIR" | cut -f1)
FILE_COUNT=$(find "$ARTIFACT_DIR" -type f | wc -l)
echo "Total: $TOTAL ($FILE_COUNT files)"
