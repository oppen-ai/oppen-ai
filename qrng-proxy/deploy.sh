#!/bin/bash
set -e

# Deploy the QRNG proxy Cloudflare Worker.
# Usage: ./deploy.sh [--test]
#   --test: dry-run via `wrangler deploy --dry-run` (no upload)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TEST_MODE=0
if [ "$1" = "--test" ]; then TEST_MODE=1; fi

echo "=== qrng-proxy: Deploy ==="

if ! command -v npx >/dev/null 2>&1; then
    echo "ERROR: npx not found - install Node.js (use the nix flake: nix develop)"
    exit 1
fi

if [ "$TEST_MODE" -eq 1 ]; then
    echo "Dry-run (no upload)..."
    npx -y wrangler@latest deploy --dry-run
    echo "[OK] Dry-run complete"
    exit 0
fi

echo "Deploying to Cloudflare..."
npx -y wrangler@latest deploy

echo ""
echo "[OK] Worker deployed. URL is shown above."
echo "Run integration tests:"
echo "  node test.mjs https://oppen-qrng-proxy.<account>.workers.dev"
