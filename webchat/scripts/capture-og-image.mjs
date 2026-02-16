#!/usr/bin/env node
/**
 * Capture OG (Open Graph) image from the Öppen AI landing page.
 * Standard OG dimensions: 1200x630px.
 *
 * Usage:
 *   node scripts/capture-og-image.mjs [--url URL]
 *
 * Options:
 *   --url URL   Base URL of the website (default: serves ../website locally)
 *
 * Output: ../website/og-image.png
 */
import { chromium } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import { extname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBSITE_DIR = resolve(__dirname, "../../website");
const OUT_PATH = resolve(WEBSITE_DIR, "og-image.png");

// Parse --url flag
let BASE_URL = null;
const urlIdx = process.argv.indexOf("--url");
if (urlIdx !== -1 && process.argv[urlIdx + 1]) {
	BASE_URL = process.argv[urlIdx + 1];
}

const MIME_TYPES = {
	".html": "text/html",
	".css": "text/css",
	".js": "application/javascript",
	".png": "image/png",
	".jpg": "image/jpeg",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".json": "application/json",
};

function serveStatic(dir) {
	return new Promise((resolve) => {
		const server = createServer((req, res) => {
			let filePath = join(dir, req.url === "/" ? "index.html" : req.url);
			if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
				filePath = join(filePath, "index.html");
			}
			if (!existsSync(filePath)) {
				res.writeHead(404);
				res.end("Not found");
				return;
			}
			const ext = extname(filePath);
			const mime = MIME_TYPES[ext] || "application/octet-stream";
			res.writeHead(200, { "Content-Type": mime });
			res.end(readFileSync(filePath));
		});
		server.listen(0, () => {
			const port = server.address().port;
			resolve({ server, url: `http://localhost:${port}` });
		});
	});
}

async function main() {
	let server = null;
	let url = BASE_URL;

	if (!url) {
		const result = await serveStatic(WEBSITE_DIR);
		server = result.server;
		url = result.url;
		console.log(`Serving website from: ${WEBSITE_DIR}`);
	}

	console.log(`Capturing OG image from: ${url}`);
	console.log(`Output: ${OUT_PATH}\n`);

	const browser = await chromium.launch();
	const page = await browser.newPage({
		viewport: { width: 1200, height: 630 },
		deviceScaleFactor: 2,
	});

	await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
	await page.waitForTimeout(800);

	// Trigger all scroll-reveal animations so hero content is visible
	await page.evaluate(() => {
		document
			.querySelectorAll(".reveal")
			.forEach((el) => el.classList.add("visible"));
	});
	await page.waitForTimeout(400);

	await page.screenshot({
		path: OUT_PATH,
		type: "png",
	});
	console.log("  og-image.png (1200x630 @2x)");

	await page.close();
	await browser.close();
	if (server) server.close();
	console.log("\nDone!");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
