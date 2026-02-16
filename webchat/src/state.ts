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

export const state: AppState = {
	engine: null,
	ready: false,
	chatId: null,
	chats: {},
	generating: false,
	systemPrompt: "",
	memory: "",
	modelId: "Qwen2.5-0.5B-Instruct-q4f32_1-MLC",
	theme: "dark",
	bgTheme: "none",
	themePreset: "mono",
	voiceEngine: "whisper",
	pendingAttachment: null,
	debug: false,
};

export async function loadSettings(): Promise<void> {
	try {
		const t = await dbGet<{ key: string; value: string }>("settings", "theme");
		if (t) state.theme = t.value as AppState["theme"];
		const m = await dbGet<{ key: string; value: string }>("settings", "model");
		if (m) state.modelId = m.value;
		const p = await dbGet<{ key: string; value: string }>("settings", "systemPrompt");
		if (p) state.systemPrompt = p.value;
		const bg = await dbGet<{ key: string; value: string }>("settings", "bgTheme");
		if (bg) state.bgTheme = bg.value as AppState["bgTheme"];
		const tp = await dbGet<{ key: string; value: string }>("settings", "themePreset");
		if (tp) state.themePreset = tp.value;
		const ve = await dbGet<{ key: string; value: string }>("settings", "voiceEngine");
		if (ve) state.voiceEngine = ve.value as AppState["voiceEngine"];
		const d = await dbGet<{ key: string; value: string }>("settings", "debug");
		if (d) state.debug = d.value === "true";
	} catch (_e) {
		// Settings not found, use defaults
	}
}

export async function saveSettings(): Promise<void> {
	await dbPut("settings", { key: "theme", value: state.theme });
	await dbPut("settings", { key: "model", value: state.modelId });
	await dbPut("settings", { key: "systemPrompt", value: state.systemPrompt });
	await dbPut("settings", { key: "bgTheme", value: state.bgTheme });
	await dbPut("settings", { key: "themePreset", value: state.themePreset });
	await dbPut("settings", { key: "voiceEngine", value: state.voiceEngine });
	await dbPut("settings", { key: "debug", value: String(state.debug) });
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
