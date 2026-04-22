type LogLevel = "info" | "warn" | "error" | "debug" | "network";

interface LogEntry {
	time: number;
	level: LogLevel;
	source: string;
	message: string;
	dedupKey?: string;
}

const MAX_ENTRIES = 500;
const entries: LogEntry[] = [];
let enabled = false;
let listEl: HTMLElement | null = null;
let badgeEl: HTMLElement | null = null;
let renderScheduled = false;
let lastRenderedCount = 0;
let errorCount = 0;

const LEVEL_ICONS: Record<LogLevel, string> = {
	info: "\u2139\ufe0f",
	warn: "\u26a0\ufe0f",
	error: "\u274c",
	debug: "\ud83d\udd27",
	network: "\ud83c\udf10",
};

const LEVEL_CLASS: Record<LogLevel, string> = {
	info: "dbg-info",
	warn: "dbg-warn",
	error: "dbg-error",
	debug: "dbg-debug",
	network: "dbg-network",
};

export function isDebugEnabled(): boolean {
	return enabled;
}

export function setDebugEnabled(on: boolean): void {
	enabled = on;
	const container = document.getElementById("debug-container");
	if (container) {
		container.style.display = on ? "block" : "none";
	}
	// Toggle a body class so the chat layout reserves space at the bottom
	// for the debug pane (otherwise the fixed-position pane covers the
	// input row).
	document.body.classList.toggle("debug-on", on);
	if (on) {
		scheduleRender();
	}
}

export function dlog(level: LogLevel, source: string, message: string, dedupKey?: string): void {
	// Dedup: if the most recent entry shares the same dedupKey (and that key
	// is non-empty), overwrite it in place instead of appending. Useful for
	// high-rate status updates (e.g. incoming QRNG bytes) that would
	// otherwise drown out other log lines.
	const last = entries[entries.length - 1];
	if (dedupKey && last && last.dedupKey === dedupKey) {
		last.time = Date.now();
		last.level = level;
		last.source = source;
		last.message = message;
		// Drop the already-rendered row from the DOM so the next render pass
		// replaces it with the updated content. Tracks lastRenderedCount so
		// flushRender re-emits just this one entry.
		if (enabled) {
			if (!listEl) listEl = document.getElementById("debug-list");
			listEl?.lastElementChild?.remove();
			lastRenderedCount = Math.max(0, entries.length - 1);
			scheduleRender();
		}
		if (level === "error") {
			errorCount++;
			updateBadge();
		}
		return;
	}
	const entry: LogEntry = { time: Date.now(), level, source, message, dedupKey };
	entries.push(entry);
	if (entries.length > MAX_ENTRIES) {
		entries.shift();
		lastRenderedCount = Math.max(0, lastRenderedCount - 1);
	}
	if (level === "error") {
		errorCount++;
		updateBadge();
	}
	if (enabled) {
		scheduleRender();
	}
}

function updateBadge(): void {
	if (!badgeEl) badgeEl = document.getElementById("debug-badge");
	if (badgeEl) {
		badgeEl.textContent = String(errorCount);
		badgeEl.style.display = errorCount > 0 ? "" : "none";
	}
}

function scheduleRender(): void {
	if (renderScheduled) return;
	renderScheduled = true;
	requestAnimationFrame(flushRender);
}

function flushRender(): void {
	renderScheduled = false;
	if (!listEl) listEl = document.getElementById("debug-list");
	if (!listEl || !enabled) return;

	const frag = document.createDocumentFragment();
	for (let i = lastRenderedCount; i < entries.length; i++) {
		frag.appendChild(createEntryEl(entries[i]));
	}
	listEl.appendChild(frag);
	lastRenderedCount = entries.length;

	// Auto-scroll to bottom
	listEl.scrollTop = listEl.scrollHeight;
}

function createEntryEl(entry: LogEntry): HTMLElement {
	const row = document.createElement("div");
	row.className = `dbg-row ${LEVEL_CLASS[entry.level]}`;

	const ts = new Date(entry.time);
	const timeStr = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}.${pad3(ts.getMilliseconds())}`;

	row.innerHTML = `<span class="dbg-time">${timeStr}</span><span class="dbg-icon">${LEVEL_ICONS[entry.level]}</span><span class="dbg-src">${escapeHtml(entry.source)}</span><span class="dbg-msg">${escapeHtml(entry.message)}</span>`;
	return row;
}

function pad(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

function pad3(n: number): string {
	if (n < 10) return `00${n}`;
	if (n < 100) return `0${n}`;
	return String(n);
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function copyDebugLog(): string {
	return entries
		.map((e) => {
			const ts = new Date(e.time);
			const timeStr = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}.${pad3(ts.getMilliseconds())}`;
			return `[${timeStr}] [${e.level.toUpperCase()}] [${e.source}] ${e.message}`;
		})
		.join("\n");
}

export function clearDebugLog(): void {
	entries.length = 0;
	lastRenderedCount = 0;
	errorCount = 0;
	if (listEl) listEl.innerHTML = "";
	updateBadge();
}

export function getDebugEntryCount(): number {
	return entries.length;
}

function stringify(a: unknown): string {
	if (typeof a === "string") return a;
	if (a instanceof Error) return `${a.name}: ${a.message}`;
	try {
		return JSON.stringify(a);
	} catch {
		return String(a);
	}
}

/** Intercept console.log, console.warn, console.error to mirror into debug log */
export function interceptConsole(): void {
	const origLog = console.log;
	const origWarn = console.warn;
	const origError = console.error;

	console.log = (...args: unknown[]) => {
		origLog.apply(console, args);
		dlog("info", "console", args.map(stringify).join(" "));
	};

	console.warn = (...args: unknown[]) => {
		origWarn.apply(console, args);
		dlog("warn", "console", args.map(stringify).join(" "));
	};

	console.error = (...args: unknown[]) => {
		origError.apply(console, args);
		dlog("error", "console", args.map(stringify).join(" "));
	};
}

/** Intercept fetch to log network requests */
export function interceptFetch(): void {
	const origFetch = window.fetch;
	window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		const method = init?.method || "GET";
		const shortUrl = url.length > 120 ? `${url.slice(0, 117)}...` : url;
		dlog("network", "fetch", `${method} ${shortUrl}`);
		try {
			const resp = await origFetch.call(window, input, init);
			if (!resp.ok) {
				dlog("warn", "fetch", `${resp.status} ${resp.statusText} - ${shortUrl}`);
			}
			return resp;
		} catch (e) {
			dlog("error", "fetch", `FAILED ${shortUrl} - ${stringify(e)}`);
			throw e;
		}
	};
}

/** Capture unhandled errors and rejections */
export function interceptGlobalErrors(): void {
	window.addEventListener("error", (e) => {
		dlog("error", "window", `${e.message} (${e.filename}:${e.lineno})`);
	});
	window.addEventListener("unhandledrejection", (e) => {
		const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
		dlog("error", "promise", reason);
	});
}

export function initDebugPane(): void {
	listEl = document.getElementById("debug-list");
	badgeEl = document.getElementById("debug-badge");

	document.getElementById("debug-toggle")?.addEventListener("click", togglePane);
	document.getElementById("debug-copy")?.addEventListener("click", handleCopy);
	document.getElementById("debug-clear")?.addEventListener("click", handleClear);

	updateBadge();

	if (enabled) {
		scheduleRender();
	}
}

function togglePane(): void {
	const list = document.getElementById("debug-list");
	const pane = document.getElementById("debug-pane");
	const toggle = document.getElementById("debug-toggle");
	if (!list || !pane) return;

	const isExpanded = pane.classList.toggle("expanded");
	if (toggle) {
		toggle.setAttribute("aria-expanded", String(isExpanded));
	}
	if (isExpanded) {
		scheduleRender();
	}
}

function handleCopy(): void {
	const text = copyDebugLog();
	navigator.clipboard.writeText(text).then(() => {
		const btn = document.getElementById("debug-copy");
		if (btn) {
			const orig = btn.textContent;
			btn.textContent = "Copied!";
			setTimeout(() => {
				if (btn) btn.textContent = orig;
			}, 1500);
		}
	});
}

function handleClear(): void {
	clearDebugLog();
}
