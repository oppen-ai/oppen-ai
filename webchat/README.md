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

## Icon Generation

Requires `rsvg-convert` (librsvg) or ImageMagick:

```bash
scripts/generate-icons.sh    # PNG icons (all sizes)
scripts/generate-favicon.sh  # favicon.ico
scripts/generate-og.sh       # OG preview image
```

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
