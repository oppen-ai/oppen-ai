/**
 * QrngPool: Durable Object that streams quantum bytes over WebSocket.
 *
 * A single self-rescheduling alarm fetches bytes from ANU's endpoint
 * (`get_one_binary.php`) in parallel every REFRESH_INTERVAL_MS. Incoming
 * bytes are broadcast to every connected WebSocket session so every client
 * receives the same stream in real time. Each client maintains its own
 * used/unused state locally; the server does not partition bytes between
 * clients.
 *
 * HTTP endpoints (`/` and `/health`) are kept for scripting and probes -
 * `/?length=N` returns a snapshot of the latest batch without consuming.
 */

const DEMO_URL =
	"https://qrng.anu.edu.au/wp-content/plugins/colours-plugin/get_one_binary.php";
const DOCUMENTED_URL = "https://qrng.anu.edu.au/API/jsonI.php";
const REFRESH_INTERVAL_MS = 500;   // alarm cadence
const PARALLEL_FETCHES = 4;        // demo calls per refresh, ~4 bytes/cycle
                                   // Keep this small - we share one egress
                                   // IP with every other CF Workers customer
                                   // and ANU is known to throttle CF ranges.
const UPSTREAM_TIMEOUT_MS = 3000;
const MAX_REQUEST_LEN = 64;        // HTTP snapshot cap
const FIRST_ALARM_DELAY_MS = 100;

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Max-Age": "86400",
};

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store",
			...corsHeaders,
		},
	});
}

export class QrngPool {
	constructor(state, env) {
		this.state = state;
		this.env = env;
		this.sessions = new Set();
		this.latestBatch = [];
		this.fetchedAt = 0;
		this.lastFetchOk = false;
		this.lastError = "";
		this.totalBytesFetched = 0;

		// Bootstrap the alarm chain.
		this.state.blockConcurrencyWhile(async () => {
			const existing = await this.state.storage.getAlarm();
			if (!existing) {
				await this.state.storage.setAlarm(Date.now() + FIRST_ALARM_DELAY_MS);
			}
		});
	}

	async fetch(request) {
		const url = new URL(request.url);

		if (request.headers.get("Upgrade") === "websocket") {
			return this.handleWebSocket();
		}

		if (url.pathname === "/health") {
			return jsonResponse({
				ok: true,
				sessions: this.sessions.size,
				latestBatchSize: this.latestBatch.length,
				fetchedAt: this.fetchedAt,
				ageMs: this.fetchedAt ? Date.now() - this.fetchedAt : null,
				lastFetchOk: this.lastFetchOk,
				lastError: this.lastError,
				totalBytesFetched: this.totalBytesFetched,
				refreshIntervalMs: REFRESH_INTERVAL_MS,
				parallelFetches: PARALLEL_FETCHES,
			});
		}

		if (url.pathname !== "/" && url.pathname !== "") {
			return jsonResponse({ success: false, error: "not_found" }, 404);
		}

		// HTTP snapshot - non-consuming read of the latest batch.
		if (this.latestBatch.length === 0) {
			await this.refillBatch();
		}
		if (this.latestBatch.length === 0) {
			return jsonResponse(
				{
					success: false,
					error: "pool_empty",
					detail: this.lastError || "no bytes available",
				},
				503,
			);
		}

		const lengthRaw = url.searchParams.get("length");
		const length = Math.max(
			1,
			Math.min(
				MAX_REQUEST_LEN,
				Number.parseInt(lengthRaw || "32", 10) || 32,
			),
		);
		const bytes = this.latestBatch.slice(-length);
		return jsonResponse({
			success: true,
			bytes,
			length: bytes.length,
			source: "anu-demo",
			fetchedAt: this.fetchedAt,
			ageMs: Date.now() - this.fetchedAt,
			ts: Date.now(),
		});
	}

	handleWebSocket() {
		const pair = new WebSocketPair();
		const client = pair[0];
		const server = pair[1];
		server.accept();
		this.sessions.add(server);

		server.addEventListener("close", () => {
			this.sessions.delete(server);
		});
		server.addEventListener("error", () => {
			this.sessions.delete(server);
		});

		// Send the current batch immediately so newly-connected clients
		// don't have to wait for the next alarm tick.
		if (this.latestBatch.length > 0) {
			this.sendToSession(server, this.latestBatch, this.fetchedAt);
		}

		return new Response(null, { status: 101, webSocket: client });
	}

	sendToSession(ws, bytes, fetchedAt) {
		try {
			ws.send(
				JSON.stringify({
					bytes,
					fetchedAt,
					ts: Date.now(),
				}),
			);
		} catch (_e) {
			// Broken session - drop it.
			this.sessions.delete(ws);
		}
	}

	broadcast() {
		if (this.latestBatch.length === 0 || this.sessions.size === 0) return;
		for (const ws of this.sessions) {
			this.sendToSession(ws, this.latestBatch, this.fetchedAt);
		}
	}

	async alarm() {
		await this.refillBatch();
		this.broadcast();
		await this.state.storage.setAlarm(Date.now() + REFRESH_INTERVAL_MS);
	}

	async refillBatch() {
		const tasks = [];
		for (let i = 0; i < PARALLEL_FETCHES; i++) {
			tasks.push(this.fetchOneByteDemo());
		}
		const results = await Promise.allSettled(tasks);
		const bytes = [];
		for (const r of results) {
			if (r.status === "fulfilled" && r.value !== null) {
				bytes.push(r.value);
			}
		}

		// If the demo endpoint got heavily throttled, try the documented one
		// as a fallback. This is a fire-and-forget defense - we don't block
		// on it if the primary got anything at all.
		if (bytes.length === 0) {
			try {
				const extra = await this.fetchBatchDocumented(32);
				if (extra.length > 0) bytes.push(...extra);
			} catch {/* swallow - will retry next alarm */}
		}

		if (bytes.length > 0) {
			this.latestBatch = bytes;
			this.fetchedAt = Date.now();
			this.lastFetchOk = true;
			this.lastError = "";
			this.totalBytesFetched += bytes.length;
		} else {
			this.lastFetchOk = false;
			this.lastError = "all upstream fetches failed";
		}
	}

	async fetchOneByteDemo() {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
		try {
			const url = `${DEMO_URL}?_=${Date.now()}_${Math.random().toString(36).slice(2)}`;
			const resp = await fetch(url, {
				signal: ctrl.signal,
				cf: { cacheTtl: 0, cacheEverything: false },
				headers: {
					"User-Agent": "oppen-qrng-proxy/3.0 (+https://oppen.ai)",
				},
			});
			if (!resp.ok) return null;
			const text = (await resp.text()).trim();
			// Response is 8 bits like "00011011"
			if (!/^[01]{8}$/.test(text)) return null;
			return Number.parseInt(text, 2);
		} catch {
			return null;
		} finally {
			clearTimeout(timer);
		}
	}

	async fetchBatchDocumented(count) {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
		try {
			const url = `${DOCUMENTED_URL}?length=${count}&type=uint8&_=${Date.now()}`;
			const resp = await fetch(url, {
				signal: ctrl.signal,
				cf: { cacheTtl: 0, cacheEverything: false },
				headers: {
					"User-Agent": "oppen-qrng-proxy/3.0 (+https://oppen.ai)",
				},
			});
			if (!resp.ok) return [];
			const data = await resp.json();
			if (data?.success && Array.isArray(data.data)) return data.data;
			return [];
		} catch {
			return [];
		} finally {
			clearTimeout(timer);
		}
	}
}
