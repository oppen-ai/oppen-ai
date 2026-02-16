import { decrypt, encrypt } from "./crypto";
import { state } from "./state";
import { showToast } from "./ui/toast";

/** Create encrypted memory URL with hash fragment */
export async function createEncryptedMemory(
	text: string,
	password: string,
): Promise<string | null> {
	if (!text.trim() || !password) {
		showToast("Fill both fields");
		return null;
	}
	try {
		const encrypted = await encrypt(text, password);
		return `${location.origin}${location.pathname}#/memory/${encrypted}`;
	} catch (e) {
		showToast(`Encryption error: ${(e as Error).message}`);
		return null;
	}
}

/** Load encrypted memory from hash or raw ciphertext */
export async function loadEncryptedMemory(urlOrHash: string, password: string): Promise<boolean> {
	if (!urlOrHash.trim() || !password) {
		showToast("Fill both fields");
		return false;
	}
	try {
		const hash = urlOrHash.includes("#/memory/") ? urlOrHash.split("#/memory/")[1] : urlOrHash;
		state.memory = await decrypt(hash, password);
		updateMemoryIndicator();
		showToast("Memory applied");
		return true;
	} catch (_e) {
		showToast("Wrong password?");
		return false;
	}
}

/** Decrypt memory from URL hash */
export async function decryptHashMemory(password: string): Promise<boolean> {
	if (!password) return false;
	try {
		const hash = location.hash.replace("#/memory/", "");
		state.memory = await decrypt(hash, password);
		updateMemoryIndicator();
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

/** Update memory indicator in topbar */
export function updateMemoryIndicator(): void {
	const el = document.getElementById("memory-indicator");
	if (!el) return;
	if (state.memory) {
		el.style.display = "";
		el.innerHTML = '<span class="memory-badge">Memory active</span>';
	} else {
		el.style.display = "none";
	}
}
