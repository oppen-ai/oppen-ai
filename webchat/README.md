# Öppen AI WebChat

Private AI chat that runs entirely on your device using WebGPU. No server, no tracking, no data leaves your browser.

## Browser Requirements

- **Safari 18+** (macOS/iOS)
- **Chrome 113+** / **Edge 113+**
- WebGPU must be enabled

## Development

```bash
nix develop
npm install
npm run dev
```

Open `http://localhost:5173`. The app loads the chat UI immediately, then downloads the AI model (~500MB) in the background.

## Build & Deploy

```bash
# Enter nix shell
nix develop

# Build
infra/build.sh

# Deploy (environments: prd, dev, test)
infra/deploy.sh prd

# Dry-run validation
infra/deploy.sh dev --test
```

## Scripts

All scripts live in `scripts/` and use Playwright (Chromium). Run them from inside `nix develop`.

### Generate OG image (website)

Captures the hero section of the landing page at 1200x630 @2x for social media previews.

```bash
node scripts/capture-og-image.mjs                          # auto-serves website/ locally
node scripts/capture-og-image.mjs --url https://oppen.ai   # from production
```

Output: `../website/og-image.png`

### Capture app screenshots

Captures desktop and mobile screenshots of the chat app (home, typing, chat, loading states).

```bash
node scripts/capture-app-screenshots.mjs                              # from https://chat.oppen.ai
node scripts/capture-app-screenshots.mjs --url http://localhost:5173  # from local dev
```

Output: `../website/img/app-*.png`

### Capture website previews

Captures each section of the landing page (hero, features, showcase, etc.).

```bash
node scripts/capture-website-previews.mjs --url https://oppen.ai
```

Output: `../.temp/preview-*.png`

### Generate favicons and PWA icons

Renders `src/logo.svg` at all required sizes using Chromium for correct gradient rendering.

```bash
node scripts/generate-icons.mjs
```

Output: `public/icons/`, `public/favicon.ico`, `public/favicon.svg`

### Generate GitHub repo social preview

Renders a 1280x640 PNG matching the site palette for GitHub's repo social preview. Follows the 40pt safe-zone guideline from `../website/img/repository-open-graph-template.png`.

```bash
node scripts/generate-repo-og-image.mjs
```

Output: `../website/img/repository-open-graph.png`

Upload via GitHub repo Settings - General - Social preview.

## Tests

```bash
npm run build
npx playwright test
```

## Security Model

- **On-device processing**: All AI inference runs locally via WebGPU. No data is sent to any server.
- **Hash-based encrypted memory**: Fragment identifiers (`#/memory/...`) are never sent to servers per HTTP specification. Memory is encrypted with AES-256-GCM (PBKDF2, 100k iterations).
- **XSS prevention**: All user content is sanitized before DOM insertion. No `innerHTML` with raw input. Event delegation instead of inline handlers.
- **CSP**: Content Security Policy restricts scripts to self + CDN for WebLLM only.
- **No tracking**: Zero analytics, zero external requests except CDN for WebLLM library and HuggingFace for model weights.
- **No third-party CSS/JS**: System fonts, zero external dependencies in the bundle.
- **COOP/COEP headers**: Required for SharedArrayBuffer (WebGPU performance). Set via Cloudflare page rules in production, via Vite plugin in development.

## Environment Setup

Copy the env template and fill in your credentials:

```bash
cp infra/.env.example .env
```

| Variable | Description |
|---|---|
| `S3_BUCKET_PRD/DEV/TEST` | S3 bucket names per environment |
| `DOMAIN_PRD/DEV/TEST` | Domain names (default: chat.oppen.ai, etc.) |
| `AWS_REGION` | AWS region for S3 |
| `CF_API_TOKEN` | Cloudflare API token for cache purging |
| `CF_ZONE_ID` | Cloudflare zone ID |

## Architecture

```
webchat/
├── src/
│   ├── main.ts          # App entry - init, routing, engine boot
│   ├── types.ts          # TypeScript interfaces
│   ├── state.ts          # Reactive state + IndexedDB persistence
│   ├── engine.ts         # WebLLM engine: load, diagnostics, streaming
│   ├── chat.ts           # Send/receive messages, auto-title
│   ├── crypto.ts         # AES-256-GCM encryption
│   ├── memory.ts         # Encrypted memory via URL hash
│   ├── security.ts       # XSS sanitization
│   ├── theme.ts          # Dark/light/system theme
│   ├── sw-register.ts    # Service worker registration
│   ├── ui/               # UI modules (renderer, input, sidebar, modals, toast, loading)
│   └── styles/           # CSS (variables, reset, glass, layout, chat, input, modals)
├── public/
│   ├── sw.js             # Service worker (cache model assets)
│   └── manifest.json     # PWA manifest
├── infra/                # Build & deploy scripts
└── tests/                # Playwright E2E tests
```

Default model: **Qwen2.5-0.5B-Instruct-q4f32_1-MLC** (~500MB download, runs on most WebGPU devices).
