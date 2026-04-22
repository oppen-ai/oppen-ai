#!/bin/bash
set -e

# Build and package the oppen-webchat Vite app
# Usage: ./build.sh
# Output: timestamped artifact in infra/artifacts/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ARTIFACTS_DIR="$SCRIPT_DIR/artifacts"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARTIFACT_DIR="$ARTIFACTS_DIR/$TIMESTAMP"

echo "=== oppen-webchat: Build ==="
echo ""

# Install dependencies if needed
if [ ! -d "$APP_DIR/node_modules" ]; then
    echo "Installing dependencies..."
    cd "$APP_DIR"
    npm install
fi

# Run build
echo "Running npm run build..."
cd "$APP_DIR"
npm run build

# Check dist was created
if [ ! -d "$APP_DIR/dist" ]; then
    echo "ERROR: dist/ directory not found after build"
    exit 1
fi

# Create artifact
echo "Creating artifact: $TIMESTAMP"
mkdir -p "$ARTIFACT_DIR"
cp -r "$APP_DIR/dist/"* "$ARTIFACT_DIR/"

# Cache-bust the service worker. Vite already gives JS/CSS hashed filenames
# (immutable URLs) but the SW's APP_CACHE key is hardcoded `oppen-app-v1`,
# so a deploy would otherwise re-hand the user the OLD cached bundle on
# their next visit. Bumping APP_CACHE forces the SW activate handler to
# evict old caches and refetch the new index.html / hashed assets.
# MODEL_CACHE is intentionally NOT bumped - we want HuggingFace model
# downloads cached across builds.
SW_FILE="$ARTIFACT_DIR/sw.js"
if [ -f "$SW_FILE" ]; then
    APP_CACHE_NEW="oppen-app-${TIMESTAMP}"
    sed -i.bak "s|oppen-app-v1|${APP_CACHE_NEW}|g" "$SW_FILE"
    rm -f "${SW_FILE}.bak"
    if grep -q "${APP_CACHE_NEW}" "$SW_FILE"; then
        echo "  SW cache key bumped: oppen-app-v1 -> ${APP_CACHE_NEW}"
    else
        echo "  WARN: SW cache key was not bumped - check sw.js for 'oppen-app-v1'"
    fi
else
    echo "  WARN: sw.js not found in artifact - cache-bust skipped"
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
