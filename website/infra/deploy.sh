#!/bin/bash
set -e

# Deploy oppen-website static landing page to S3
# Usage: ./deploy.sh <ENV> [--test] [--artifact PATH]
#   ENV: prd, dev, or test
#   --test: dry-run mode (validate without uploading)
#   --artifact PATH: use specific artifact directory

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ARTIFACTS_DIR="$SCRIPT_DIR/artifacts"
ENV_FILE="$APP_DIR/.env"

# --- Parse arguments ---
ENV=""
TEST_MODE=0
ARTIFACT_PATH=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        prd|dev|test) ENV="$1" ;;
        --test) TEST_MODE=1 ;;
        --artifact) ARTIFACT_PATH="$2"; shift ;;
        *) echo "ERROR: Unknown argument: $1"; echo "Usage: ./deploy.sh <prd|dev|test> [--test] [--artifact PATH]"; exit 1 ;;
    esac
    shift
done

if [ -z "$ENV" ]; then
    echo "ERROR: Environment is required"
    echo "Usage: ./deploy.sh <prd|dev|test> [--test] [--artifact PATH]"
    exit 1
fi

echo "=== oppen-website: Deploy ($ENV) ==="
[ "$TEST_MODE" -eq 1 ] && echo "*** TEST MODE - no changes will be made ***"
echo ""

# --- Load .env ---
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: .env not found at $ENV_FILE"
    echo "Copy .env.example and fill in credentials: cp $APP_DIR/infra/.env.example $APP_DIR/.env"
    exit 1
fi
set -a
source "$ENV_FILE"
set +a
echo "[OK] Loaded .env"

# --- Resolve bucket and domain ---
case "$ENV" in
    prd)  S3_BUCKET="$S3_BUCKET_PRD"; DOMAIN="$DOMAIN_PRD" ;;
    dev)  S3_BUCKET="$S3_BUCKET_DEV"; DOMAIN="$DOMAIN_DEV" ;;
    test) S3_BUCKET="$S3_BUCKET_TEST"; DOMAIN="$DOMAIN_TEST" ;;
esac

if [ -z "$S3_BUCKET" ] || [ -z "$DOMAIN" ]; then
    echo "ERROR: S3_BUCKET or DOMAIN not configured for env '$ENV' in .env"
    exit 1
fi
echo "[OK] Bucket: $S3_BUCKET | Domain: $DOMAIN"

# --- Validate AWS credentials ---
if aws sts get-caller-identity &>/dev/null; then
    echo "[OK] AWS credentials valid"
else
    echo "ERROR: AWS credentials invalid or not configured"
    exit 1
fi

# --- Validate bucket access ---
if aws s3 ls "s3://$S3_BUCKET" --region "$AWS_REGION" &>/dev/null; then
    echo "[OK] Bucket accessible: s3://$S3_BUCKET"
else
    echo "ERROR: Cannot access bucket s3://$S3_BUCKET in region $AWS_REGION"
    exit 1
fi

# --- Resolve artifact ---
if [ -n "$ARTIFACT_PATH" ]; then
    if [ ! -d "$ARTIFACT_PATH" ]; then
        echo "ERROR: Artifact not found: $ARTIFACT_PATH"
        exit 1
    fi
else
    # Find latest artifact
    if [ ! -d "$ARTIFACTS_DIR" ] || [ -z "$(ls -A "$ARTIFACTS_DIR" 2>/dev/null)" ]; then
        echo "ERROR: No artifacts found. Run build.sh first."
        exit 1
    fi
    ARTIFACT_PATH="$ARTIFACTS_DIR/$(ls -1 "$ARTIFACTS_DIR" | sort -r | head -1)"
fi

FILE_COUNT=$(find "$ARTIFACT_PATH" -type f | wc -l)
TOTAL_SIZE=$(du -sh "$ARTIFACT_PATH" | cut -f1)
echo "[OK] Artifact: $ARTIFACT_PATH ($FILE_COUNT files, $TOTAL_SIZE)"

# --- Validate Cloudflare config ---
if [ -z "$CF_API_TOKEN" ] || [ -z "$CF_ZONE_ID" ]; then
    echo "WARNING: CF_API_TOKEN or CF_ZONE_ID not set - cache purge will be skipped"
    CF_PURGE=0
else
    CF_PURGE=1
    echo "[OK] Cloudflare config present"
fi

echo ""

# --- Test mode: stop here ---
if [ "$TEST_MODE" -eq 1 ]; then
    echo "=== Test Complete ==="
    echo "All validations passed. Ready to deploy."
    exit 0
fi

# --- Deploy to S3 ---
echo "Deploying to s3://$S3_BUCKET ..."

# HTML: no-cache (always revalidate)
echo "  Uploading HTML..."
aws s3 sync "$ARTIFACT_PATH" "s3://$S3_BUCKET" \
    --region "$AWS_REGION" \
    --exclude "*" --include "*.html" \
    --cache-control "no-cache" \
    --content-type "text/html" \
    --delete

# JS: short cache so we can iterate without 1-year immutable lockin
echo "  Uploading JS..."
aws s3 sync "$ARTIFACT_PATH" "s3://$S3_BUCKET" \
    --region "$AWS_REGION" \
    --exclude "*" --include "*.js" \
    --cache-control "max-age=300" \
    --content-type "application/javascript"

# CSS: short cache
echo "  Uploading CSS..."
aws s3 sync "$ARTIFACT_PATH" "s3://$S3_BUCKET" \
    --region "$AWS_REGION" \
    --exclude "*" --include "*.css" \
    --cache-control "max-age=300" \
    --content-type "text/css"

# robots.txt / sitemap.xml: no-cache so they always reflect the latest deploy
echo "  Uploading robots.txt / sitemap.xml..."
aws s3 sync "$ARTIFACT_PATH" "s3://$S3_BUCKET" \
    --region "$AWS_REGION" \
    --exclude "*" --include "robots.txt" \
    --cache-control "no-cache" \
    --content-type "text/plain"
aws s3 sync "$ARTIFACT_PATH" "s3://$S3_BUCKET" \
    --region "$AWS_REGION" \
    --exclude "*" --include "*.xml" \
    --cache-control "no-cache" \
    --content-type "application/xml"

# Images: 1 day cache
echo "  Uploading images..."
aws s3 sync "$ARTIFACT_PATH" "s3://$S3_BUCKET" \
    --region "$AWS_REGION" \
    --exclude "*" --include "*.png" --include "*.ico" --include "*.svg" --include "*.jpg" --include "*.webp" \
    --cache-control "max-age=86400"

echo ""
echo "[OK] S3 sync complete"

# --- Purge Cloudflare cache ---
if [ "$CF_PURGE" -eq 1 ]; then
    echo "Purging Cloudflare cache for $DOMAIN ..."
    RESPONSE=$(curl -s -X POST \
        "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"purge_everything":true}')

    if echo "$RESPONSE" | grep -q '"success":\s*true'; then
        echo "[OK] Cloudflare cache purged"
    else
        echo "WARNING: Cloudflare cache purge may have failed:"
        echo "$RESPONSE"
    fi
fi

echo ""
echo "=== Deploy Complete ==="
echo "URL: https://$DOMAIN"
