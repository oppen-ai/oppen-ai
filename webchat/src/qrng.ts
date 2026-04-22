/**
 * Quantum random number client.
 *
 * The WebSocket to qrng.oppen.ai is **always open** while QRNG is enabled.
 * Bytes stream in continuously; we keep them in a rolling buffer but don't
 * consume them until the LLM sampler asks for a seed. Every seed request
 * takes the LATEST unused bytes in the buffer and marks them consumed.
 *
 * If the stream drops, we auto-reconnect with exponential backoff. If the
 * LLM asks for a seed and no bytes are available within a short deadline,
 * `nextQuantumU32()` returns null - the sampler then throws, which chat.ts
 * translates into a user-facing error. There is no fallback to PRNG.
 */

import { dlog } from "./debug";
import { state } from "./state";

export type QrngMode = "buffer" | "realtime";

export interface QrngConfig {
	enabled: boolean;
	mode: QrngMode;
	proxyUrl: string;
}

export interface QrngStatus {
	poolBytes: number;
	lastFetchAt: number;
	lastFetchOk: boolean;
	lastError: string;
	tokensQuantum: number;
	tokensSkipped: number;
	tokensFetchFailed: number;
	wsConnected: boolean;
	totalBytesReceived: number;
}

const SEED_BYTES = 4;
const SEED_WAIT_MS = 3000;          // LLM waits at most this long for bytes
const BACKOFF_INITIAL_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

let config: QrngConfig = { enabled: false, mode: "buffer", proxyUrl: "" };
let socket: WebSocket | null = null;
let buffer: number[] = [];
let wakers: Array<() => void> = [];
let wantOpen = false;
let reconnectTimer: number | null = null;
let reconnectDelay = BACKOFF_INITIAL_MS;
let tickDebounceTimer: number | null = null;

const status: QrngStatus = {
	poolBytes: 0,
	lastFetchAt: 0,
	lastFetchOk: false,
	lastError: "",
	tokensQuantum: 0,
	tokensSkipped: 0,
	tokensFetchFailed: 0,
	wsConnected: false,
	totalBytesReceived: 0,
};

export function configureQrng(next: QrngConfig): void {
	const prev = config;
	config = { ...next };
	// URL or enabled state changed: tear down and re-open if needed.
	if (!next.enabled || next.proxyUrl !== prev.proxyUrl) {
		closeSocket();
	}
	if (next.enabled && next.proxyUrl) {
		openSocket();
	}
	updateQrngIndicator();
	dlog(
		"info",
		"qrng",
		`configured: enabled=${next.enabled} url=${next.proxyUrl || "<unset>"}`,
	);
}

export function getQrngConfig(): QrngConfig {
	return { ...config };
}

export function getQrngStatus(): QrngStatus {
	return { ...status, poolBytes: buffer.length, wsConnected: socket?.readyState === WebSocket.OPEN };
}

export function isQrngActive(): boolean {
	return config.enabled && !!config.proxyUrl;
}

/** Called from chat.ts on prompt submit; kept as a no-op now that the stream is always on. */
export function startStream(): void {
	if (config.enabled && config.proxyUrl) openSocket();
}

/** Called from chat.ts on response completion; also a no-op. */
export function stopStream(): void {
	// intentional: stream stays open across prompts
}

/** Drop any unused bytes in the local buffer. Called by chat.ts at the end
 *  of a generation so leftover entropy never crosses prompt boundaries. */
export function clearBuffer(): void {
	if (buffer.length > 0) {
		dlog("debug", "qrng", `cleared buffer (${buffer.length} unused bytes dropped)`);
	}
	buffer = [];
	status.poolBytes = 0;
}

function wsUrl(): string {
	const base = config.proxyUrl.replace(/\/$/, "");
	return `${base.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}/`;
}

function openSocket(): void {
	wantOpen = true;
	if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
		return;
	}
	if (reconnectTimer !== null) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	const url = wsUrl();
	dlog("info", "qrng", `WS connecting: ${url}`);
	try {
		socket = new WebSocket(url);
	} catch (e) {
		status.lastError = (e as Error).message;
		status.lastFetchOk = false;
		dlog("error", "qrng", `WS constructor threw: ${status.lastError}`);
		scheduleReconnect();
		return;
	}

	socket.onopen = () => {
		status.wsConnected = true;
		reconnectDelay = BACKOFF_INITIAL_MS;
		updateQrngIndicator();
		dlog("info", "qrng", "WS open");
	};
	socket.onmessage = (ev) => {
		try {
			const data = JSON.parse(ev.data);
			if (Array.isArray(data.bytes) && data.bytes.length > 0) {
				const fetchedAt = typeof data.fetchedAt === "number" ? data.fetchedAt : Date.now();
				status.lastFetchAt = fetchedAt;
				status.lastFetchOk = true;
				status.lastError = "";
				status.totalBytesReceived += data.bytes.length;
				triggerElectronTick();

				// Only KEEP bytes when the LLM is actually generating. Outside
				// generation we still surface that the stream is alive (tick,
				// counters, log) but drop the bytes - per-token quantum means
				// the byte that goes into a sample must arrive while that
				// sample is in flight, not minutes earlier sitting in a buffer.
				if (!state.generating) {
					if (buffer.length > 0) buffer = [];
					status.poolBytes = 0;
					dlog(
						"debug",
						"qrng",
						`+${data.bytes.length} B dropped (LLM idle, total rx ${status.totalBytesReceived})`,
						"qrng-bytes-rx",
					);
					return;
				}

				// Generating: append, cap to a small rolling window so even
				// during long generations we always serve the LATEST.
				buffer.push(...data.bytes);
				if (buffer.length > 64) buffer = buffer.slice(-64);
				status.poolBytes = buffer.length;
				const preview = data.bytes.slice(0, 4).map((b: number) => b.toString(16).padStart(2, "0")).join(" ");
				dlog(
					"debug",
					"qrng",
					`+${data.bytes.length} B (total rx ${status.totalBytesReceived}, buf ${buffer.length}) latest: ${preview}`,
					"qrng-bytes-rx",
				);
				const toWake = wakers;
				wakers = [];
				for (const w of toWake) w();
			}
		} catch (e) {
			dlog("warn", "qrng", `WS bad message: ${(e as Error).message}`);
		}
	};
	socket.onclose = (ev) => {
		status.wsConnected = false;
		socket = null;
		updateQrngIndicator();
		// Wake consumers so they can fail fast.
		const toWake = wakers;
		wakers = [];
		for (const w of toWake) w();
		dlog("info", "qrng", `WS closed (code=${ev.code}, reason=${ev.reason || ""}, wantOpen=${wantOpen})`);
		if (wantOpen) scheduleReconnect();
	};
	socket.onerror = () => {
		status.lastFetchOk = false;
		status.lastError = "websocket error";
		// onclose fires right after - reconnect handled there.
	};
}

function scheduleReconnect(): void {
	if (!wantOpen) return;
	if (reconnectTimer !== null) return;
	const delay = reconnectDelay;
	dlog("info", "qrng", `WS reconnect in ${delay}ms`);
	reconnectTimer = window.setTimeout(() => {
		reconnectTimer = null;
		if (wantOpen) openSocket();
	}, delay);
	reconnectDelay = Math.min(reconnectDelay * 2, BACKOFF_MAX_MS);
}

function closeSocket(): void {
	wantOpen = false;
	if (reconnectTimer !== null) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	if (socket) {
		try { socket.close(); } catch { /* noop */ }
	}
	socket = null;
	buffer = [];
	status.poolBytes = 0;
	status.wsConnected = false;
	const toWake = wakers;
	wakers = [];
	for (const w of toWake) w();
	updateQrngIndicator();
}

function waitForBytes(timeoutMs: number): Promise<void> {
	return new Promise<void>((resolve) => {
		const t = setTimeout(() => {
			const idx = wakers.indexOf(waker);
			if (idx >= 0) wakers.splice(idx, 1);
			resolve();
		}, timeoutMs);
		const waker = () => {
			clearTimeout(t);
			resolve();
		};
		wakers.push(waker);
	});
}

/**
 * Get a quantum-derived 32-bit seed for the next token sample.
 *
 * Returns null when:
 *   - QRNG is disabled
 *   - we can't get 4 unused bytes within SEED_WAIT_MS
 *
 * The patched sampler translates null into a thrown error so generation
 * aborts loudly rather than silently continuing with TVM's PRNG.
 */
export async function nextQuantumU32(): Promise<number | null> {
	if (!config.enabled) return null;
	if (!socket || socket.readyState === WebSocket.CLOSED) openSocket();

	const deadline = Date.now() + SEED_WAIT_MS;
	while (buffer.length < SEED_BYTES) {
		const remaining = deadline - Date.now();
		if (remaining <= 0) {
			status.tokensFetchFailed++;
			return null;
		}
		await waitForBytes(Math.min(remaining, 1000));
	}

	// Splice the LATEST 4 bytes off the end - freshest bytes first.
	const bytes = buffer.splice(-SEED_BYTES, SEED_BYTES);
	status.poolBytes = buffer.length;
	status.tokensQuantum++;
	return (
		((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
	);
}

/** Trigger the electron-orbit burst on the atom icon. Debounced so
 *  fast-arriving messages don't chain-cancel the animation mid-flight. */
function triggerElectronTick(): void {
	const el = document.getElementById("qrng-indicator");
	if (!el) return;
	if (tickDebounceTimer !== null) return; // already animating; let it finish
	el.classList.add("tick");
	tickDebounceTimer = window.setTimeout(() => {
		el.classList.remove("tick");
		tickDebounceTimer = null;
	}, 600);
}

/** Toggle the QRNG atom badge to reflect enabled / streaming state.
 *  The icon is always visible; we just swap the `.inactive` class. */
function updateQrngIndicator(): void {
	const el = document.getElementById("qrng-indicator");
	if (!el) return;
	const enabled = isQrngActive();
	el.classList.toggle("inactive", !enabled);
	const toggle = document.getElementById("qrng-popover-toggle") as HTMLInputElement | null;
	if (toggle) toggle.checked = enabled;
	const label = document.getElementById("qrng-toggle-label");
	if (label) label.textContent = enabled ? "Enabled" : "Disabled";
}
