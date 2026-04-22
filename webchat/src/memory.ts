import { decrypt, encrypt } from "./crypto";
import { dlog } from "./debug";
import { MODELS } from "./engine";
import { configureQrng } from "./qrng";
import { state } from "./state";
import type { QrngMode } from "./qrng";
import { showToast } from "./ui/toast";

/**
 * Memory payload v1: lets a single shared URL carry the user's context text
 * AND the chat configuration (model, quantum-randomness settings) that the
 * recipient should land on.
 *
 * Backwards compatible: legacy ciphertexts that decrypt to a plain string
 * (no JSON wrapper) are treated as memory-only and other fields are left
 * untouched.
 */
export interface MemoryPayloadV1 {
	v: 1;
	memory: string;
	model?: string;
	qrng?: {
		enabled: boolean;
		mode: QrngMode;
	};
}

/** Hard cap on memory text size to keep URLs sane and prevent DoS via big hashes. */
export const MAX_MEMORY_BYTES = 32 * 1024; // 32 KB

export interface CreateMemoryOptions {
	model?: string;
	qrngEnabled?: boolean;
	qrngMode?: QrngMode;
}

/** Currently-active memory snapshot (mirrors what was loaded), exposed for the View tab. */
export interface ActiveMemory {
	memory: string;
	model?: string;
	qrng?: { enabled: boolean; mode: QrngMode };
}
let activeMemory: ActiveMemory | null = null;

export function getActiveMemory(): ActiveMemory | null {
	return activeMemory ? { ...activeMemory } : null;
}

function isValidModel(id: unknown): id is string {
	return typeof id === "string" && MODELS.some((m) => m.id === id);
}

function isValidMode(m: unknown): m is QrngMode {
	return m === "buffer" || m === "realtime";
}

function buildPayload(memory: string, opts: CreateMemoryOptions): MemoryPayloadV1 {
	const payload: MemoryPayloadV1 = { v: 1, memory };
	if (opts.model && isValidModel(opts.model)) payload.model = opts.model;
	if (typeof opts.qrngEnabled === "boolean") {
		payload.qrng = {
			enabled: opts.qrngEnabled,
			mode: isValidMode(opts.qrngMode) ? opts.qrngMode : "buffer",
		};
	}
	return payload;
}

/** Create encrypted memory URL with hash fragment and embedded settings. */
export async function createEncryptedMemory(
	text: string,
	password: string,
	opts: CreateMemoryOptions = {},
): Promise<string | null> {
	if (!text.trim() || !password) {
		showToast("Fill both fields");
		return null;
	}
	const byteLen = new TextEncoder().encode(text).length;
	if (byteLen > MAX_MEMORY_BYTES) {
		showToast(`Memory too large (${byteLen} bytes, max ${MAX_MEMORY_BYTES})`);
		return null;
	}
	try {
		const payload = buildPayload(text, opts);
		const encrypted = await encrypt(JSON.stringify(payload), password);
		return `${location.origin}${location.pathname}#/memory/${encrypted}`;
	} catch (e) {
		showToast(`Encryption error: ${(e as Error).message}`);
		return null;
	}
}

/**
 * Decode a decrypted plaintext into a sanitized payload. Accepts both the
 * v1 JSON format and legacy plain-text strings. Unknown fields are dropped.
 * Invalid model/mode values are silently ignored (we don't trust the URL).
 */
function parsePayload(plaintext: string): MemoryPayloadV1 {
	try {
		const parsed = JSON.parse(plaintext);
		if (parsed && typeof parsed === "object" && parsed.v === 1 && typeof parsed.memory === "string") {
			const out: MemoryPayloadV1 = { v: 1, memory: parsed.memory };
			if (isValidModel(parsed.model)) out.model = parsed.model;
			if (parsed.qrng && typeof parsed.qrng === "object") {
				const q = parsed.qrng as Record<string, unknown>;
				if (typeof q.enabled === "boolean") {
					out.qrng = {
						enabled: q.enabled,
						mode: isValidMode(q.mode) ? q.mode : "buffer",
					};
				}
			}
			return out;
		}
	} catch {/* fall through to plain-text legacy handling */}
	return { v: 1, memory: plaintext };
}

/** Apply a parsed payload to runtime state, including model switch and QRNG config. */
async function applyPayload(payload: MemoryPayloadV1): Promise<void> {
	state.memory = payload.memory;
	activeMemory = {
		memory: payload.memory,
		model: payload.model,
		qrng: payload.qrng,
	};

	let modelChanged = false;
	if (payload.model && payload.model !== state.modelId) {
		state.modelId = payload.model;
		modelChanged = true;
		dlog("info", "memory", `applied model from URL: ${payload.model}`);
	}

	if (payload.qrng) {
		state.qrngEnabled = payload.qrng.enabled;
		state.qrngMode = payload.qrng.mode;
		configureQrng({
			enabled: state.qrngEnabled,
			mode: state.qrngMode,
			proxyUrl: state.qrngProxyUrl,
		});
		dlog("info", "memory", `applied QRNG from URL: enabled=${payload.qrng.enabled} mode=${payload.qrng.mode}`);
	}

	updateMemoryIndicator();

	// Persist the new settings so reloads keep them.
	const { saveSettings } = await import("./state");
	await saveSettings();

	if (modelChanged) {
		// Reload the engine in the background. Import lazily to avoid
		// a circular dependency on ui/modals.
		state.ready = false;
		state.engine = null;
		const { startEngineLoad } = await import("./ui/modals");
		startEngineLoad();
	}
}

/** Load encrypted memory from full URL or raw ciphertext. */
export async function loadEncryptedMemory(urlOrHash: string, password: string): Promise<boolean> {
	if (!urlOrHash.trim() || !password) {
		showToast("Fill both fields");
		return false;
	}
	try {
		const hash = urlOrHash.includes("#/memory/") ? urlOrHash.split("#/memory/")[1] : urlOrHash;
		const plaintext = await decrypt(hash, password);
		const payload = parsePayload(plaintext);
		await applyPayload(payload);
		showToast("Memory applied");
		return true;
	} catch (_e) {
		showToast("Wrong password?");
		return false;
	}
}

/** Decrypt memory from URL hash on first page load. */
export async function decryptHashMemory(password: string): Promise<boolean> {
	if (!password) return false;
	try {
		const hash = location.hash.replace("#/memory/", "");
		const plaintext = await decrypt(hash, password);
		const payload = parsePayload(plaintext);
		await applyPayload(payload);
		showToast("Memory unlocked");
		return true;
	} catch (_e) {
		showToast("Wrong password");
		return false;
	}
}

/** Check if current URL has a memory hash */
export function hasMemoryHash(): boolean {
	return location.hash.startsWith("#/memory/");
}

/** Clear hash from URL */
export function clearHash(): void {
	history.replaceState(null, "", location.pathname);
}

/** Update memory indicator. Icon is always visible; `.inactive` is toggled
 *  based on whether a memory is currently loaded. */
export function updateMemoryIndicator(): void {
	const el = document.getElementById("memory-indicator");
	if (!el) return;
	const active = !!state.memory;
	el.classList.toggle("inactive", !active);
	const text = document.getElementById("memory-popover-text");
	const toggle = document.getElementById("memory-popover-toggle") as HTMLInputElement | null;
	const label = document.getElementById("memory-toggle-label");
	if (text) {
		text.textContent = active
			? "Encrypted memory is active. The LLM sees this extra context on every prompt."
			: "No encrypted memory loaded. Toggle on to load an encrypted memory URL.";
	}
	if (toggle) toggle.checked = active;
	if (label) label.textContent = active ? "Enabled" : "Disabled";
}

/** Wipe the active memory in-memory and from runtime state. URL hash and
 *  IndexedDB are not touched - the user can re-load from the same URL. */
export async function clearActiveMemory(): Promise<void> {
	state.memory = "";
	activeMemory = null;
	updateMemoryIndicator();
}
