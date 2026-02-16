#!/usr/bin/env node
/**
 * Capture preview screenshots of the Öppen AI landing page.
 * Useful for social media previews, OG images, and documentation.
 *
 * Usage:
 *   node scripts/capture-website-previews.mjs [--url URL]
 *
 * Options:
 *   --url URL   Base URL of the website (default: http://localhost:4176)
 *               Pass the production URL for live captures.
 *
 * Output: ../../.temp/preview-*.png
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../../.temp");

let BASE_URL = "http://localhost:4176";
const urlIdx = process.argv.indexOf("--url");
if (urlIdx !== -1 && process.argv[urlIdx + 1]) {
	BASE_URL = process.argv[urlIdx + 1];
}

const SECTIONS = [
	{ name: "hero", selector: ".hero" },
	{ name: "features", selector: ".features" },
	{ name: "showcase", selector: ".showcase" },
	{ name: "phones", selector: ".showcase-phones" },
	{ name: "how", selector: ".how" },
	{ name: "cta", selector: ".final-cta" },
];

async function main() {
	mkdirSync(OUT_DIR, { recursive: true });
	console.log(`Capturing website previews from: ${BASE_URL}`);
	console.log(`Output: ${OUT_DIR}\n`);

	const browser = await chromium.launch();

	// Desktop
	console.log("Desktop (1440x900)...");
	let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
	await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 15000 });
	await page.waitForTimeout(800);

	// Trigger all scroll-reveal animations
	await page.evaluate(() => {
		document
			.querySelectorAll(".reveal")
			.forEach((el) => el.classList.add("visible"));
	});
	await page.waitForTimeout(400);

	for (const { name, selector } of SECTIONS) {
		await page.evaluate(
			(sel) => {
				const el = document.querySelector(sel);
				if (el) window.scrollTo(0, el.offsetTop - 50);
			},
			selector,
		);
		await page.waitForTimeout(400);
		await page.screenshot({
			path: resolve(OUT_DIR, `preview-${name}.png`),
		});
		console.log(`  preview-${name}.png`);
	}
	await page.close();

	// Mobile
	console.log("\nMobile (390x844)...");
	page = await browser.newPage({ viewport: { width: 390, height: 844 } });
	await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 15000 });
	await page.evaluate(() => {
		document
			.querySelectorAll(".reveal")
			.forEach((el) => el.classList.add("visible"));
	});
	await page.waitForTimeout(400);
	await page.screenshot({ path: resolve(OUT_DIR, "preview-mobile.png") });
	console.log("  preview-mobile.png");
	await page.close();

	await browser.close();
	console.log("\nDone!");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
