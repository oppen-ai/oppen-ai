/**
 * Cloudflare Worker: QRNG proxy entry point.
 *
 * Forwards all requests (HTTP GET, OPTIONS, and WebSocket Upgrade) to the
 * single global QrngPool Durable Object. The DO broadcasts quantum bytes
 * over WebSocket to every connected browser. See pool.js for the logic and
 * README.md for the public API.
 */

export { QrngPool } from "./pool.js";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Max-Age": "86400",
};

function corsJson(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store",
			...corsHeaders,
		},
	});
}

export default {
	async fetch(request, env) {
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		// WebSocket upgrades and GETs both flow to the DO.
		const isWs = request.headers.get("Upgrade") === "websocket";
		if (!isWs && request.method !== "GET") {
			return corsJson({ success: false, error: "method_not_allowed" }, 405);
		}

		const id = env.QRNG_POOL.idFromName("global");
		const stub = env.QRNG_POOL.get(id);
		return stub.fetch(request);
	},
};
