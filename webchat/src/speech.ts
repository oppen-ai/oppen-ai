/**
 * Browser speech synthesis for assistant responses.
 *
 * Enabled globally - once the user clicks the speaker icon, every new
 * streaming response reads aloud automatically until they click it off.
 *
 * Chunking: word-by-word. Every time a full word (one whitespace-delimited
 * chunk) arrives, it's enqueued to SpeechSynthesis. That keeps the voice
 * close to the token stream - if generation is slow (e.g. QRNG on), the
 * voice follows one word at a time as tokens come in.
 */

import { dlog } from "./debug";
import { isQrngActive } from "./qrng";

interface ActiveReader {
	chatId: string;
	msgIdx: number;
	spokenLen: number;
}

let enabled = false;
let active: ActiveReader | null = null;

function isSupported(): boolean {
	return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Strip markdown so the speech is clean (no asterisks, hashes, code fences). */
function strip(text: string): string {
	return text
		.replace(/```[\s\S]*?```/g, " (code block) ")
		.replace(/`[^`]*`/g, "")
		.replace(/[*_~#>]/g, "")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/**
 * Pick the chunk size based on QRNG mode:
 *
 *   - QRNG on  -> words (whitespace boundary). Generation is slow (~1-2
 *                 tok/s), so word-sized utterances keep pace with tokens.
 *   - QRNG off -> phrases (comma/semicolon/colon or sentence-end). Fast
 *                 generation would otherwise make each word a separate
 *                 robotic utterance. Phrase chunking gives natural prosody.
 *
 * Returns the longest prefix of `text` that ends at a valid chunk boundary
 * in the current mode, or "" if no boundary is present yet.
 */
function takeSpeechChunk(text: string): string {
	if (isQrngActive()) {
		for (let i = text.length - 1; i >= 0; i--) {
			const c = text[i];
			if (c === " " || c === "\n" || c === "\t") return text.slice(0, i + 1);
		}
		return "";
	}
	// Fast mode: chunk at any phrase or sentence boundary - commas, semicolons,
	// colons, or sentence punctuation followed by whitespace or end-of-text.
	for (let i = text.length - 1; i >= 0; i--) {
		const c = text[i];
		if (c === "\n") return text.slice(0, i + 1);
		if (c === "," || c === ";" || c === ":") {
			const next = text[i + 1];
			if (!next || next === " " || next === "\n") return text.slice(0, i + 1);
		}
		if (c === "." || c === "!" || c === "?") {
			const next = text[i + 1];
			if (!next || next === " " || next === "\n") return text.slice(0, i + 1);
		}
	}
	return "";
}

function enqueue(text: string): void {
	if (!isSupported()) return;
	const cleaned = strip(text).trim();
	if (!cleaned) return;
	const utter = new SpeechSynthesisUtterance(cleaned);
	utter.rate = 1.0;
	utter.pitch = 1.0;
	utter.volume = 1.0;
	speechSynthesis.speak(utter);
}

/** Toggle global read-aloud. Returns the new state. */
export function toggleEnabled(): boolean {
	if (!isSupported()) {
		dlog("warn", "speech", "speechSynthesis not available in this browser");
		return false;
	}
	setEnabled(!enabled);
	return enabled;
}

export function setEnabled(on: boolean): void {
	if (!isSupported()) return;
	if (on === enabled) return;
	enabled = on;
	if (!on) {
		try { speechSynthesis.cancel(); } catch {/* noop */}
		active = null;
	}
	updateButtons();
	dlog("info", "speech", `read-aloud ${enabled ? "on" : "off"}`);
}

export function isEnabled(): boolean {
	return enabled;
}

/** Called from chat.ts on every streaming chunk. */
export function onAssistantUpdate(chatId: string, msgIdx: number, fullText: string): void {
	if (!enabled || !isSupported()) return;
	// New message? Reset.
	if (!active || active.chatId !== chatId || active.msgIdx !== msgIdx) {
		active = { chatId, msgIdx, spokenLen: 0 };
	}
	const newPortion = fullText.slice(active.spokenLen);
	const ready = takeSpeechChunk(newPortion);
	if (!ready) return;
	enqueue(ready);
	active.spokenLen += ready.length;
}

/** Called from chat.ts when a response finishes streaming - flush trailing text. */
export function onAssistantComplete(chatId: string, msgIdx: number, fullText: string): void {
	if (!enabled || !isSupported()) return;
	if (!active || active.chatId !== chatId || active.msgIdx !== msgIdx) {
		// The user probably just toggled on - speak whatever we have now.
		active = { chatId, msgIdx, spokenLen: 0 };
	}
	const trailing = fullText.slice(active.spokenLen);
	if (trailing.trim().length > 0) {
		enqueue(trailing);
		active.spokenLen = fullText.length;
	}
}

/** Kick off speech for the last assistant message in the current chat -
 *  used when the user toggles speech on and a message is already complete. */
export function readLastIfAny(
	chatId: string,
	messages: Array<{ role: string; content: string }>,
): void {
	if (!enabled || !isSupported()) return;
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].role === "assistant") {
			onAssistantUpdate(chatId, i, messages[i].content);
			onAssistantComplete(chatId, i, messages[i].content);
			return;
		}
	}
}

/** Update the visual state of all .msg-speak-btn buttons - now reflects
 *  the GLOBAL enabled state, not per-message. */
function updateButtons(): void {
	const buttons = document.querySelectorAll<HTMLElement>(".msg-speak-btn");
	for (const b of buttons) {
		b.classList.toggle("reading", enabled);
		b.setAttribute("aria-pressed", String(enabled));
		b.title = enabled ? "Stop reading aloud" : "Read aloud (stays on for new replies)";
	}
}
