import basicSsl from "@vitejs/plugin-basic-ssl";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

function securityHeaders(): Plugin {
	return {
		name: "security-headers",
		configureServer(server) {
			server.middlewares.use((_req, res, next) => {
				// COOP for security isolation. COEP intentionally omitted:
				// - Safari doesn't support "credentialless"
				// - "require-corp" blocks CDN loads (jsdelivr, esm.sh, HuggingFace)
				// - In production, set COEP via Cloudflare if SharedArrayBuffer is needed
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				next();
			});
		},
	};
}

export default defineConfig({
	root: ".",
	publicDir: "public",
	server: {
		// basicSsl provides self-signed cert for HTTPS (needed for WebGPU on mobile)
		https: true,
	},
	preview: {
		// Preview serves over plain HTTP for tests
		https: false,
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
	define: {
		__BUILD_NUMBER__: JSON.stringify(String(Date.now())),
	},
	plugins: [basicSsl(), securityHeaders()],
});
