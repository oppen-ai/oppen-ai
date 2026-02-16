/** Base64url encode an ArrayBuffer */
export function b64Encode(buffer: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(buffer)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/** Base64url decode to Uint8Array */
export function b64Decode(str: string): Uint8Array {
	let s = str.replace(/-/g, "+").replace(/_/g, "/");
	while (s.length % 4) s += "=";
	const binary = atob(s);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/** Derive AES-256 key from password + salt via PBKDF2 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveKey"],
	);
	return crypto.subtle.deriveKey(
		{ name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: "SHA-256" },
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

/** Encrypt plaintext with AES-256-GCM. Returns base64url string. */
export async function encrypt(plaintext: string, password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const key = await deriveKey(password, salt);
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		new TextEncoder().encode(plaintext),
	);
	const packed = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
	packed.set(salt);
	packed.set(iv, 16);
	packed.set(new Uint8Array(ciphertext), 28);
	return b64Encode(packed.buffer as ArrayBuffer);
}

/** Decrypt base64url ciphertext with AES-256-GCM */
export async function decrypt(ciphertext: string, password: string): Promise<string> {
	const packed = b64Decode(ciphertext);
	const salt = packed.slice(0, 16);
	const iv = packed.slice(16, 28);
	const data = packed.slice(28);
	const key = await deriveKey(password, salt);
	const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
	return new TextDecoder().decode(plaintext);
}
