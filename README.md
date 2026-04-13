# Öppen AI

![Öppen AI — Truly Open, Private AI on Your Device](website/img/repository-open-graph.png)

Truly open, private AI chat that runs entirely on your device. No servers, no cloud, no accounts - just private conversation powered by on-device LLMs.

**Live:** [oppen.ai](https://oppen.ai) | **Chat:** [chat.oppen.ai](https://chat.oppen.ai)

## How it works

Oppen AI runs large language models directly in your browser using WebGPU and WebAssembly. The models are small enough to fit on a phone (135M-7B parameters, 270MB-5GB VRAM) but come with real trade-offs:

- **Small models, small context** - all models have a 4096-token context window (~3000 words). Conversations are automatically truncated to fit, with the most recent messages preserved and older ones dropped.
- **Document handling** - when you upload a PDF, text file, or image, the text is extracted locally. If the extracted text is too long for the context window, Oppen AI uses the chat model itself to summarize it in batches before injecting it into the conversation.
- **Image OCR** - text is extracted from photos using Tesseract.js (full-page OCR, ~4MB, runs alongside the chat model). On browsers that support the TextDetector API, native browser OCR is tried first.
- **Voice input** - speech-to-text via the browser's Web Speech API (default) or on-device Whisper model.
- **Early preview** - these are small models that will hallucinate, get facts wrong, and struggle with complex conversations. Treat responses as a starting point, not a source of truth.

## Supported Devices and GPUs

Oppen AI requires a browser with **WebGPU** support and a GPU that can run it. WebGPU is the successor to WebGL and provides direct access to the GPU for compute workloads like LLM inference.

### Browsers

| Browser | Platform | WebGPU Status |
|---|---|---|
| Chrome 113+ | Windows, macOS, Linux, Android | Enabled by default |
| Edge 113+ | Windows, macOS | Enabled by default |
| Safari 18+ | macOS, iOS, iPadOS | Enabled by default |
| Brave | All | Works but may need `brave://flags/#enable-unsafe-webgpu` on Linux |
| Firefox | All | Behind flag (`dom.webgpu.enabled` in `about:config`) |

### GPUs

| GPU | Status | Notes |
|---|---|---|
| **Apple Silicon** (M1/M2/M3/M4) | Best support | Unified memory, works on Mac + iPhone + iPad |
| **Apple A15+** (iPhone 13+) | Works | Mobile Safari 18+ required |
| **NVIDIA GTX 1060+** | Works | Desktop Chrome/Edge, needs up-to-date drivers |
| **NVIDIA RTX series** | Works | Best desktop performance |
| **AMD Radeon RX 5000+** | Works | Desktop Chrome/Edge |
| **AMD RDNA 2/3** | Works | Including Steam Deck |
| **Intel Iris Xe** (11th gen+) | Works | May need `enable-unsafe-webgpu` flag in Brave |
| **Intel Arc** (A-series) | Works | Dedicated GPU, good performance |
| **Intel UHD 600/700** | Limited | Older integrated, may fail on larger models |
| **Qualcomm Adreno 640+** | Limited | Android Chrome, experimental |
| **ARM Mali** | Not supported | No WebGPU support yet |
| **Older NVIDIA (pre-GTX 1060)** | Not supported | Missing required Vulkan features |
| **Older Intel (pre-11th gen)** | Not supported | No WebGPU adapter available |

### Memory requirements

| Model | VRAM needed | Suitable for |
|---|---|---|
| SmolLM2 135M | ~270 MB | Any device, phones |
| Qwen2.5 0.5B | ~400-500 MB | Phones, tablets |
| Llama 3.2 1B | ~900-1100 MB | Tablets, laptops |
| Qwen2.5 1.5B | ~1.6-1.9 GB | Laptops, desktops |
| Llama 3.2 3B | ~2.3 GB | Desktops, Apple Silicon |
| Qwen2.5 3B | ~2.5 GB | Desktops, Apple Silicon |
| Qwen2.5 7B | ~5.1 GB | Desktops with 8GB+ VRAM |

## Troubleshooting

### "WebGPU is not available"

Your browser does not support WebGPU or it is disabled.

- **Chrome/Edge**: update to version 113 or later
- **Safari**: update to Safari 18 or later
- **Firefox**: go to `about:config`, search for `dom.webgpu.enabled`, set to `true`
- **Brave**: go to `brave://flags/#enable-unsafe-webgpu`, set to Enabled, relaunch

### "No available adapters"

WebGPU is available in the browser but it cannot find a usable GPU. This is common on **Linux with Intel integrated GPUs** where the browser does not trust the GPU by default.

**Fix for Brave on Linux:**
1. Go to `brave://flags/#enable-unsafe-webgpu`
2. Set to **Enabled**
3. Relaunch the browser

**Fix for Chrome on Linux (if needed):**
1. Go to `chrome://flags/#enable-unsafe-webgpu`
2. Set to **Enabled**
3. Relaunch

**Check Vulkan drivers (Linux):**
```bash
vulkaninfo --summary
```
If this fails, install the Vulkan drivers for your GPU:
```bash
# Intel
sudo apt install mesa-vulkan-drivers

# NVIDIA
sudo apt install nvidia-driver-535  # or latest

# AMD
sudo apt install mesa-vulkan-drivers
```

### "Cannot reach model server"

The browser cannot connect to HuggingFace to download model weights.

- Check your internet connection
- Disable ad blockers or VPN for `chat.oppen.ai`
- On Safari: Settings - Privacy - disable "Prevent cross-site tracking" for this site
- Corporate firewalls may block `huggingface.co` - ask your IT team

### "Not enough GPU memory" / page crashes

The selected model is too large for your device.

- Switch to a smaller model in the top-right dropdown
- On mobile: use SmolLM2 135M or Qwen2.5 0.5B (under 500 MB)
- Close other GPU-intensive tabs (video, games, other AI tools)

### Service worker cache errors

If you see `Failed to execute 'put' on 'Cache'` in the console:

- Clear site data: browser Settings - Privacy - Site data - clear for `chat.oppen.ai`
- Unregister the service worker: DevTools (F12) - Application - Service Workers - Unregister
- Reload the page

## Toolchain (Nix flake)

All tooling for this repo lives in `flake.nix` - Node.js, npm, Playwright browsers, AWS CLI, jq, curl, etc. You don't need to install any of them globally.

**Prerequisites:** [Nix](https://nixos.org/download) with flakes enabled (`experimental-features = nix-command flakes`).

Enter the dev shell from the repo root:

```bash
nix develop
```

You're now in a shell with everything pinned. Every command below assumes you are inside this shell. If you prefer one-shot commands, prefix them with `nix develop --command`, e.g. `nix develop --command npm test`.

The shell sets `PLAYWRIGHT_BROWSERS_PATH` to the Nix-provided browser bundle, so `npx playwright install` is **not** needed - the correct Chromium revision is already available.

## Local Development

### Website (landing page)

```bash
nix develop
cd website
npx serve -l 8878
```

Open http://localhost:8878. Static files including `index.html` and `privacy.html` are served as-is.

> Note: do **not** pass `-s` to `serve`. Single-page mode rewrites unknown routes to `index.html`, which breaks the privacy page.

### Chat App

```bash
nix develop
cd webchat
npm install
npm run dev
```

Vite dev server starts on http://localhost:5173 by default.

### Build the chat app

```bash
nix develop
cd webchat
npm run build        # tsc + vite build, output in dist/
```

### Run tests

```bash
nix develop
cd webchat
npm test             # playwright - 73 tests, ~40s
```

Playwright uses the pinned Chromium from the flake; no separate browser install step.

## Build & Deploy

Both projects' `build.sh` / `deploy.sh` scripts use `aws`, `jq`, and `curl` - all provided by the flake, so you can run them directly inside `nix develop`.

### Prerequisites

Create a `.env` file from the example template in each project:

```bash
cp website/infra/.env.example website/.env   # landing page
cp webchat/infra/.env.example webchat/.env   # chat app
```

Fill in S3 bucket names, AWS credentials, Cloudflare API token and zone ID.

### Website (oppen.ai)

```bash
nix develop

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
nix develop

# Build - runs Vite build, creates timestamped artifact
webchat/infra/build.sh

# Deploy to production
webchat/infra/deploy.sh prd

# Deploy to dev/test
webchat/infra/deploy.sh dev
webchat/infra/deploy.sh test

# Dry run
webchat/infra/deploy.sh prd --test
```

## Open Source Libraries

Oppen AI is built on top of these excellent open source projects:

| Library | Purpose | License |
|---|---|---|
| [MLC WebLLM](https://github.com/mlc-ai/web-llm) | In-browser LLM inference via WebGPU | Apache 2.0 |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | Full-page OCR for text extraction from images | Apache 2.0 |
| [PDF.js](https://github.com/niclasgrannet/pdfjs-dist) | PDF text extraction in the browser | Apache 2.0 |
| [Vite](https://github.com/vitejs/vite) | Build tooling and dev server with HMR | MIT |
| [TypeScript](https://github.com/microsoft/TypeScript) | Type-safe JavaScript | Apache 2.0 |
| [Playwright](https://github.com/microsoft/playwright) | End-to-end testing | Apache 2.0 |
| [vanilla-cookieconsent](https://github.com/orestbida/cookieconsent) | GDPR cookie consent banner (marketing site) | MIT |

### Models

The chat runs open-weight models from the community, loaded via MLC's pre-compiled WebGPU bundles hosted on HuggingFace:

- [SmolLM2](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct) (135M, 360M, 1.7B) by HuggingFace
- [Qwen2.5](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct) (0.5B, 1.5B, 3B, 7B) by Alibaba/Qwen
- [Llama 3.2](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct) (1B, 3B) by Meta

Each model has its own license - check the model card on HuggingFace before commercial use.

## Credits

- WebChat UI design inspired by [chatgpt-lite](https://github.com/blrchen/chatgpt-lite) by [blrchen](https://github.com/blrchen)
