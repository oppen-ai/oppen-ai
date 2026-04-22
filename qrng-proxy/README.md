# oppen-qrng-proxy

Cloudflare Worker that fronts the [ANU QRNG](https://qrng.anu.edu.au/) lab's
public quantum-randomness endpoints with CORS, so the Öppen AI browser chat
can stream real quantum bytes directly into the LLM sampler.

Production URL: **`https://qrng.oppen.ai`**

## Why a proxy

- ANU's endpoints don't send `Access-Control-Allow-Origin`, so a browser
  can't call them.
- ANU IP-throttles the documented JSON endpoint heavily (Cloudflare egress
  IPs in particular). Without a proxy, every cold isolate would stall for
  ~5 s on the first request and then 503.
- We need fresh entropy continuously, not on demand. The proxy fetches in
  the background and pushes bytes to clients over WebSocket as they arrive.

## Architecture

A single global **Durable Object** (`QrngPool`)
holds the most recent batch of quantum bytes and a list of connected
WebSocket sessions.

- A self-rescheduling **alarm fires every 500 ms**.
- Each tick fans out **4 parallel** GETs to ANU's demo endpoint
  `get_one_binary.php` (returns 1 byte per call, no visible per-IP throttle).
- If all 4 fail, the documented endpoint `/API/jsonI.php?length=32` is tried
  as a fallback.
- Successful bytes replace the in-memory batch and are **broadcast to every
  open WebSocket session**.

```
┌─────────────┐   alarm /500ms   ┌──────────────┐
│  QrngPool   │── 4 parallel ───▶│ ANU demo EP  │
│   (DO)      │◀─── 4 bytes ─────│              │
│             │                  └──────────────┘
│  pool[]     │
│  sessions[] │  broadcast each batch
└──────┬──────┘
       │
       ├── WS ──▶ browser A
       ├── WS ──▶ browser B
       └── WS ──▶ ...
```

Every connected client receives the same byte stream. Browsers track
consumed bytes locally - the server doesn't partition bytes between
sessions. Sustained throughput is ~4-8 bytes/sec (dominated by the demo
endpoint's response time, not bandwidth).

## Endpoints

### WebSocket (primary, used by the chat)

```
WSS wss://qrng.oppen.ai/
Server pushes JSON frames every alarm cycle:
   { bytes: [uint8...], fetchedAt: <ms>, ts: <ms> }
```

Open the connection and read messages; no client request needed.

### HTTP snapshot (curl, scripts)

```
GET https://qrng.oppen.ai/?length=N
   length: 1..64    (oversized clamped, default 32; cap intentional - keeps
                    the endpoint useful for chat but uninteresting as a
                    bulk-quantum-bytes service)
   -> { success, bytes:[uint8...], length, source: "anu-demo",
        fetchedAt, ageMs, ts }
```

Returns whatever the latest pool currently holds (no consumption). May
return 503 `pool_empty` if upstream is down and the pool was never
populated.

### Health

```
GET https://qrng.oppen.ai/health
   -> { ok, sessions, latestBatchSize, fetchedAt, ageMs,
        lastFetchOk, lastError, totalBytesFetched,
        refreshIntervalMs, parallelFetches }
```

CORS is `*` on every endpoint.

## Deploy

```sh
cd qrng-proxy
./deploy.sh --test     # dry-run via wrangler
./deploy.sh            # actual deploy
```

First time: `npx wrangler login` to authenticate. The custom domain is
wired in `wrangler.toml` (`custom_domain = true`); wrangler creates the
DNS record automatically when you deploy.

## Test

```sh
node test.mjs https://qrng.oppen.ai
```

Hits the deployed worker and verifies CORS, byte ranges, freshness fields,
and a working WebSocket handshake. Requires Node 22+ (uses native global
`WebSocket`).
