# Öppen AI

Truly open, private AI chat that runs entirely on your device. No servers, no cloud, no accounts - just private conversation powered by on-device LLMs.

* Phase 1: First implementation is provided as a web-based static HTML page using WebGPU
* Phase 2: iPhone app

## Supported Devices

- Apple Silicon
- Other: coming soon

**Live:** [oppen.ai](https://oppen.ai) | **Chat:** [chat.oppen.ai](https://chat.oppen.ai)

## Local Development

### Website (landing page)

```bash
cd website
npx serve -s . -l 8878
```

### Chat App

```bash
cd webchat
npm install
npm run dev
```

## Web Chat Scripts

Scripts live in `webchat/scripts/` and require Playwright:

```bash
cd webchat
npm install
npx playwright install chromium
```

### Website Generate OG image

Captures the hero section of the landing page at 1200x630 @2x for social media previews.

```bash
node scripts/capture-og-image.mjs                # auto-serves website/ locally
node scripts/capture-og-image.mjs --url https://oppen.ai  # from production
```

Output: `website/og-image.png`

### Capture app screenshots

Captures desktop & mobile screenshots of the chat app (home, typing, chat, loading states).

```bash
node scripts/capture-app-screenshots.mjs                          # from https://chat.oppen.ai
node scripts/capture-app-screenshots.mjs --url http://localhost:5173  # from local dev
```

Output: `website/img/app-*.png`

### Capture website previews

Captures each section of the landing page (hero, features, showcase, etc.).

```bash
node scripts/capture-website-previews.mjs --url https://oppen.ai
```

Output: `.temp/preview-*.png`

### Generate favicons & PWA icons

Renders `src/logo.svg` at all required sizes using Chromium for correct gradient rendering.

```bash
node scripts/generate-icons.mjs
```

Output: `public/icons/`, `public/favicon.ico`, `public/favicon.svg`

## Build & Deploy

### Prerequisites

Create a `.env` file from the example template in each project:

```bash
cp website/infra/.env.example website/.env   # landing page
cp webchat/infra/.env.example webchat/.env   # chat app
```

Fill in S3 bucket names, AWS credentials, Cloudflare API token and zone ID.

### Website (oppen.ai)

```bash
# Build - packages static files into a timestamped artifact
website/infra/build.sh

# Deploy to production
website/infra/deploy.sh prd

# Deploy to dev/test
website/infra/deploy.sh dev
website/infra/deploy.sh test

# Dry run - validates credentials and config without uploading
website/infra/deploy.sh prd --test

# Deploy a specific artifact
website/infra/deploy.sh prd --artifact website/infra/artifacts/20260216_143000
```

### Chat App (chat.oppen.ai)

```bash
# Build — runs Vite build, creates timestamped artifact
webchat/infra/build.sh

# Deploy to production
webchat/infra/deploy.sh prd

# Deploy to dev/test
webchat/infra/deploy.sh dev
webchat/infra/deploy.sh test

# Dry run
webchat/infra/deploy.sh prd --test
```

## Credits

- WebChat UI design inspired by [chatgpt-lite](https://github.com/blrchen/chatgpt-lite) by [blrchen](https://github.com/blrchen)
