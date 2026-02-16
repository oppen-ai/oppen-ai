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
