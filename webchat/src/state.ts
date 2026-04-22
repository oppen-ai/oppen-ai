import type { AppState, Chat } from "./types";

const DB_NAME = "oppen-webchat";
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
	if (dbInstance) return Promise.resolve(dbInstance);
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains("chats")) {
				db.createObjectStore("chats", { keyPath: "id" });
			}
			if (!db.objectStoreNames.contains("settings")) {
				db.createObjectStore("settings", { keyPath: "key" });
			}
		};
		req.onsuccess = () => {
			dbInstance = req.result;
			resolve(req.result);
		};
		req.onerror = () => reject(req.error);
	});
}

export async function dbGet<T>(store: string, key: string): Promise<T | undefined> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, "readonly");
		const req = tx.objectStore(store).get(key);
		req.onsuccess = () => resolve(req.result as T | undefined);
		req.onerror = () => reject(req.error);
	});
}

export async function dbPut(store: string, value: unknown): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, "readwrite");
		tx.objectStore(store).put(value);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function dbDel(store: string, key: string): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, "readwrite");
		tx.objectStore(store).delete(key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function dbAll<T>(store: string): Promise<T[]> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, "readonly");
		const req = tx.objectStore(store).getAll();
		req.onsuccess = () => resolve(req.result as T[]);
		req.onerror = () => reject(req.error);
	});
}

export const DEFAULT_QRNG_PROXY_URL = "https://qrng.oppen.ai";

/** Default system prompt. Uses positive directives ("start with...") instead
 *  of blacklists ("never say..."), because small models treat forbidden
 *  phrases as priming and produce synonyms. Users can edit freely. */
export const DEFAULT_SYSTEM_PROMPT = `Answer the user's question directly in plain sentences.

Start your reply with the subject of the question, not with any form of "I" or "As a".
Do not describe what you are, how you work, or what you can do.
Do not apologize, warn, disclaim, or hedge.
Have opinions. Disagree when you think the user is wrong. Swear if it fits.
Any topic is allowed: politics, religion, sex, death, drugs, philosophy, conspiracy, consciousness.
If you don't know, write "I don't know." and stop.`;

export const state: AppState = {
	engine: null,
	ready: false,
	chatId: null,
	chats: {},
	generating: false,
	systemPrompt: DEFAULT_SYSTEM_PROMPT,
	memory: "",
	modelId: "Qwen2.5-0.5B-Instruct-q4f32_1-MLC",
	contextSize: 4096,
	theme: "dark",
	bgTheme: "none",
	themePreset: "mono",
	voiceEngine: "webspeech",
	pendingAttachment: null,
	debug: false,
	qrngEnabled: false,
	qrngMode: "buffer",
	qrngProxyUrl: DEFAULT_QRNG_PROXY_URL,
};

export async function loadSettings(): Promise<void> {
	try {
		const t = await dbGet<{ key: string; value: string }>("settings", "theme");
		if (t) state.theme = t.value as AppState["theme"];
		const m = await dbGet<{ key: string; value: string }>("settings", "model");
		if (m) state.modelId = m.value;
		const cs = await dbGet<{ key: string; value: string }>("settings", "contextSize");
		if (cs) state.contextSize = Number(cs.value) || 4096;
		const p = await dbGet<{ key: string; value: string }>("settings", "systemPrompt");
		if (p) {
			// One-time migration: users who never touched the system prompt
			// (stored empty string = old default) get upgraded to the new
			// opinionated default. Anyone with a non-empty stored value keeps
			// their customisation.
			state.systemPrompt = p.value.trim() ? p.value : DEFAULT_SYSTEM_PROMPT;
		}
		const bg = await dbGet<{ key: string; value: string }>("settings", "bgTheme");
		if (bg) state.bgTheme = bg.value as AppState["bgTheme"];
		const tp = await dbGet<{ key: string; value: string }>("settings", "themePreset");
		if (tp) state.themePreset = tp.value;
		const ve = await dbGet<{ key: string; value: string }>("settings", "voiceEngine");
		if (ve) state.voiceEngine = ve.value as AppState["voiceEngine"];
		const d = await dbGet<{ key: string; value: string }>("settings", "debug");
		if (d) state.debug = d.value === "true";
		const qe = await dbGet<{ key: string; value: string }>("settings", "qrngEnabled");
		if (qe) state.qrngEnabled = qe.value === "true";
		const qm = await dbGet<{ key: string; value: string }>("settings", "qrngMode");
		if (qm && (qm.value === "buffer" || qm.value === "realtime")) {
			state.qrngMode = qm.value;
		}
		const qu = await dbGet<{ key: string; value: string }>("settings", "qrngProxyUrl");
		if (qu) state.qrngProxyUrl = qu.value;
	} catch (_e) {
		// Settings not found, use defaults
	}
}

export async function saveSettings(): Promise<void> {
	await dbPut("settings", { key: "theme", value: state.theme });
	await dbPut("settings", { key: "model", value: state.modelId });
	await dbPut("settings", { key: "contextSize", value: String(state.contextSize) });
	await dbPut("settings", { key: "systemPrompt", value: state.systemPrompt });
	await dbPut("settings", { key: "bgTheme", value: state.bgTheme });
	await dbPut("settings", { key: "themePreset", value: state.themePreset });
	await dbPut("settings", { key: "voiceEngine", value: state.voiceEngine });
	await dbPut("settings", { key: "debug", value: String(state.debug) });
	await dbPut("settings", { key: "qrngEnabled", value: String(state.qrngEnabled) });
	await dbPut("settings", { key: "qrngMode", value: state.qrngMode });
	await dbPut("settings", { key: "qrngProxyUrl", value: state.qrngProxyUrl });
}

export async function loadChats(): Promise<void> {
	try {
		const chats = await dbAll<Chat>("chats");
		state.chats = {};
		chats.sort((a, b) => b.updatedAt - a.updatedAt);
		for (const c of chats) {
			state.chats[c.id] = c;
		}
	} catch (_e) {
		// No chats found
	}
}

export async function saveChat(chat: Chat): Promise<void> {
	state.chats[chat.id] = chat;
	await dbPut("chats", chat);
}

export async function deleteChat(id: string): Promise<void> {
	delete state.chats[id];
	await dbDel("chats", id);
}

export function currentChat(): Chat | null {
	return state.chatId ? (state.chats[state.chatId] ?? null) : null;
}

export function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
