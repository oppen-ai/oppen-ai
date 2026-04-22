const APP_CACHE = "oppen-app-v1";
const MODEL_CACHE = "oppen-models-v1";

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		Promise.all([
			self.clients.claim(),
			// Clean up old caches
			caches.keys().then((names) =>
				Promise.all(
					names
						.filter((n) => n !== APP_CACHE && n !== MODEL_CACHE)
						.map((n) => caches.delete(n)),
				),
			),
		]),
	);
});

self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);

	// Model files from HuggingFace - cache-first (immutable, large)
	if (url.hostname.includes("huggingface.co") || url.hostname.includes("hf.co")) {
		event.respondWith(cacheFirstModel(event.request));
		return;
	}

	// App shell (HTML, JS, CSS) - cache-first with network update
	if (url.origin === self.location.origin) {
		event.respondWith(staleWhileRevalidate(event.request));
		return;
	}

	// CDN resources (webllm) - cache-first
	if (url.hostname.includes("jsdelivr.net") || url.hostname.includes("esm.sh")) {
		event.respondWith(cacheFirstModel(event.request));
		return;
	}
});

async function cacheFirstModel(request) {
	// Cache API only supports GET requests - skip HEAD/POST/etc.
	if (request.method !== "GET") {
		return fetch(request).catch(() => new Response("Offline", { status: 503 }));
	}

	const cache = await caches.open(MODEL_CACHE);
	const cached = await cache.match(request);
	if (cached) return cached;

	try {
		const response = await fetch(request);
		if (response.ok && response.status === 200) {
			cache.put(request, response.clone());
		}
		return response;
	} catch (e) {
		// Offline and not cached
		return new Response("Offline - resource not cached", { status: 503 });
	}
}

async function staleWhileRevalidate(request) {
	const cache = await caches.open(APP_CACHE);
	const cached = await cache.match(request);
	const fetchPromise = fetch(request)
		.then((response) => {
			if (response.ok) cache.put(request, response.clone());
			return response;
		})
		.catch(() => cached || new Response("Offline", { status: 503 }));
	return cached || fetchPromise;
}
