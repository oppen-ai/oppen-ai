#!/usr/bin/env node
/**
 * Integration test for the QRNG proxy (DO + WebSocket streaming).
 *
 * Verifies:
 *   - CORS, OPTIONS preflight, /health
 *   - HTTP GET /?length=N returns a snapshot of the latest batch
 *   - Oversized requests clamped to MAX_REQUEST_LEN (64)
 *   - `fetchedAt` / `ageMs` freshness fields present
 *   - WebSocket: connects, receives a batch, and bytes are uint8 in [0,255]
 *
 * Usage:
 *   node test.mjs https://qrng.oppen.ai
 */

// Node 22+ exposes WebSocket as a global - no dependency needed.
if (typeof WebSocket === "undefined") {
	console.error("ERROR: this test requires Node 22+ (native WebSocket)");
	process.exit(2);
}

const url = (process.argv[2] || process.env.QRNG_PROXY_URL || "").replace(/\/$/, "");
if (!url) {
	console.error("ERROR: pass proxy URL as first arg or set QRNG_PROXY_URL");
	process.exit(2);
}

let failed = 0;
function pass(name) { console.log(`  PASS  ${name}`); }
function fail(name, msg) { console.log(`  FAIL  ${name} - ${msg}`); failed++; }

async function test(name, fn) {
	try {
		await fn();
		pass(name);
	} catch (e) {
		fail(name, e?.message || String(e));
	}
}

console.log(`=== QRNG proxy integration tests ===`);
console.log(`Target: ${url}\n`);

await test("health endpoint returns JSON with streaming fields", async () => {
	const r = await fetch(`${url}/health`);
	if (!r.ok) throw new Error(`HTTP ${r.status}`);
	const j = await r.json();
	if (typeof j.ok !== "boolean") throw new Error("missing 'ok'");
	if (typeof j.refreshIntervalMs !== "number") throw new Error("missing refreshIntervalMs");
	if (typeof j.parallelFetches !== "number") throw new Error("missing parallelFetches");
	if (typeof j.sessions !== "number") throw new Error("missing sessions count");
});

await test("CORS headers present on health", async () => {
	const r = await fetch(`${url}/health`);
	if (r.headers.get("access-control-allow-origin") !== "*") {
		throw new Error("missing CORS");
	}
});

await test("OPTIONS preflight returns 204 with CORS", async () => {
	const r = await fetch(`${url}/`, { method: "OPTIONS" });
	if (r.status !== 204) throw new Error(`HTTP ${r.status}`);
	if (r.headers.get("access-control-allow-origin") !== "*") {
		throw new Error("missing CORS on preflight");
	}
});

// The HTTP snapshot returns `min(length, latestBatch.length)` bytes.
// The batch size depends on upstream success and PARALLEL_FETCHES, so
// these tests assert "no more than requested" rather than "exactly".
await test("HTTP snapshot returns bytes with freshness fields", async () => {
	const r = await fetch(`${url}/`);
	if (!r.ok) {
		const t = await r.text();
		throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
	}
	const j = await r.json();
	if (!j.success) throw new Error(`success=false: ${j.error}`);
	if (!Array.isArray(j.bytes)) throw new Error("bytes is not array");
	if (j.bytes.length === 0) throw new Error("empty batch");
	if (j.bytes.length > 32) throw new Error(`over default 32: ${j.bytes.length}`);
	for (const b of j.bytes) {
		if (!Number.isInteger(b) || b < 0 || b > 255) {
			throw new Error(`out-of-range byte: ${b}`);
		}
	}
	if (typeof j.fetchedAt !== "number" || j.fetchedAt <= 0) {
		throw new Error(`fetchedAt missing/invalid: ${j.fetchedAt}`);
	}
	if (typeof j.ageMs !== "number" || j.ageMs < 0) {
		throw new Error(`ageMs missing/invalid: ${j.ageMs}`);
	}
	if (j.source !== "anu-demo") throw new Error(`unexpected source: ${j.source}`);
});

await test("HTTP accepts ?length=N (returns <= N)", async () => {
	const r = await fetch(`${url}/?length=16`);
	if (!r.ok) throw new Error(`HTTP ${r.status}`);
	const j = await r.json();
	if (j.bytes.length === 0) throw new Error("empty bytes");
	if (j.bytes.length > 16) throw new Error(`over 16: ${j.bytes.length}`);
});

await test("HTTP clamps oversized requests (returns <= 64)", async () => {
	const r = await fetch(`${url}/?length=99999`);
	const j = await r.json();
	if (!j.success) throw new Error(`success=false: ${j.error}`);
	if (j.bytes.length > 64) throw new Error(`over 64: ${j.bytes.length}`);
});

await test("WebSocket connects and streams a batch within 3 seconds", async () => {
	const wsUrl = url.replace(/^http:/, "ws:").replace(/^https:/, "wss:") + "/";
	const ws = new WebSocket(wsUrl);
	const received = await new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			try { ws.close(); } catch {}
			reject(new Error("no WS message within 3000ms"));
		}, 3000);
		ws.onerror = (e) => {
			clearTimeout(timer);
			reject(new Error(e.message || "WS error"));
		};
		ws.onmessage = (ev) => {
			clearTimeout(timer);
			try {
				const data = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
				resolve(data);
			} catch (e) {
				reject(e);
			} finally {
				ws.close();
			}
		};
	});
	if (!Array.isArray(received?.bytes)) throw new Error(`no bytes array: ${JSON.stringify(received)}`);
	if (received.bytes.length === 0) throw new Error("empty bytes array");
	for (const b of received.bytes) {
		if (!Number.isInteger(b) || b < 0 || b > 255) {
			throw new Error(`out-of-range byte: ${b}`);
		}
	}
	if (typeof received.fetchedAt !== "number") throw new Error("missing fetchedAt");
});

await test("404 on unknown path", async () => {
	const r = await fetch(`${url}/nope`);
	if (r.status !== 404) throw new Error(`expected 404, got ${r.status}`);
});

console.log("");
if (failed === 0) {
	console.log("All tests passed.");
	process.exit(0);
} else {
	console.log(`${failed} test(s) failed.`);
	process.exit(1);
}
