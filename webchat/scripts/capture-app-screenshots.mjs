#!/usr/bin/env node
/**
 * Capture marketing screenshots of the Öppen AI chat app.
 * Uses Playwright to render real app states for the landing page.
 *
 * Usage:
 *   node scripts/capture-app-screenshots.mjs [--url URL]
 *
 * Options:
 *   --url URL   Base URL to capture (default: https://chat.oppen.ai)
 *
 * Output: ../website/img/app-*.png
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../../website/img");

// Parse --url flag
let BASE_URL = "https://chat.oppen.ai";
const urlIdx = process.argv.indexOf("--url");
if (urlIdx !== -1 && process.argv[urlIdx + 1]) {
	BASE_URL = process.argv[urlIdx + 1];
}

mkdirSync(OUT_DIR, { recursive: true });

async function waitForApp(page) {
	// Wait for loading overlay to disappear (engine error auto-hides it)
	await page
		.waitForFunction(
			() => {
				const overlay = document.getElementById("loading-overlay");
				return !overlay?.classList.contains("visible");
			},
			{ timeout: 30000 },
		)
		.catch(() => {});
	await page.waitForTimeout(600);
}

function injectChat(page, messages) {
	return page.evaluate((msgs) => {
		const inner = document.getElementById("messages-inner");
		if (!inner) return;
		const now = new Date().toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
		inner.innerHTML = msgs
			.map(
				(m) => `
      <div class="message ${m.role}">
        <div class="msg-body">
          <div class="msg-content">${m.content}</div>
          <div class="msg-meta"><span class="msg-time">${now}</span></div>
        </div>
      </div>`,
			)
			.join("");
		const empty = document.querySelector(".empty-state");
		if (empty) empty.remove();
		const input = document.getElementById("chat-input");
		if (input) input.value = "";
	}, messages);
}

function injectLoading(page, { title, subtitle, percent, status }) {
	return page.evaluate(
		({ title, subtitle, percent, status }) => {
			const titleEl = document.getElementById("loading-title");
			const subtitleEl = document.getElementById("loading-subtitle");
			const fill = document.getElementById("progress-fill");
			const statusEl = document.getElementById("loading-status");
			const overlay = document.getElementById("loading-overlay");
			if (titleEl) titleEl.textContent = title;
			if (subtitleEl) subtitleEl.textContent = subtitle;
			if (fill) fill.style.width = `${percent}%`;
			if (statusEl) statusEl.textContent = status;
			if (overlay) overlay.classList.add("visible");
		},
		{ title, subtitle, percent, status },
	);
}

async function main() {
	console.log(`Capturing screenshots from: ${BASE_URL}`);
	console.log(`Output: ${OUT_DIR}\n`);

	const browser = await chromium.launch();

	// ── Desktop screenshots ──
	console.log("Desktop (1280x800)...");
	let page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
	await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
	await waitForApp(page);

	// 1. Home / empty state
	await page.screenshot({ path: resolve(OUT_DIR, "app-home-desktop.png") });
	console.log("  app-home-desktop.png");

	// 2. User typing
	const input = page.locator("#chat-input");
	await input.click();
	await input.type("Tell me a joke about programming", { delay: 0 });
	await page.waitForTimeout(300);
	await page.screenshot({ path: resolve(OUT_DIR, "app-typing-desktop.png") });
	console.log("  app-typing-desktop.png");

	// 3. Multi-turn conversation
	await injectChat(page, [
		{
			role: "user",
			content: "Tell me a joke about programming",
		},
		{
			role: "assistant",
			content:
				"Why do programmers prefer dark mode? Because light attracts bugs! \ud83e\udeb2\u2728",
		},
		{
			role: "user",
			content: "That's great! Now write me a haiku about AI",
		},
		{
			role: "assistant",
			content:
				"Silicon neurons<br>Dreaming in electric waves<br>Learning to be kind",
		},
	]);
	await page.waitForTimeout(300);
	await page.screenshot({ path: resolve(OUT_DIR, "app-chat-desktop.png") });
	console.log("  app-chat-desktop.png");
	await page.close();

	// ── Mobile screenshots ──
	console.log("\nMobile (390x844)...");
	page = await browser.newPage({ viewport: { width: 390, height: 844 } });
	await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
	await waitForApp(page);

	// 4. Mobile home
	await page.screenshot({ path: resolve(OUT_DIR, "app-home-mobile.png") });
	console.log("  app-home-mobile.png");

	// 5. Mobile chat
	await injectChat(page, [
		{
			role: "user",
			content: "What can you do?",
		},
		{
			role: "assistant",
			content:
				"I can answer questions, write stories, explain concepts, help with code, summarize documents, and much more \u2014 all running privately on your device! No data ever leaves your browser. \ud83d\udd12",
		},
	]);
	await page.waitForTimeout(300);
	await page.screenshot({ path: resolve(OUT_DIR, "app-chat-mobile.png") });
	console.log("  app-chat-mobile.png");

	// 6. Loading overlay
	await injectLoading(page, {
		title: "Downloading my brain...",
		subtitle: "Qwen2.5 0.5B",
		percent: 42,
		status: "model-q4f32_1.wasm \u2014 42%",
	});
	await page.waitForTimeout(300);
	await page.screenshot({ path: resolve(OUT_DIR, "app-loading-mobile.png") });
	console.log("  app-loading-mobile.png");
	await page.close();

	await browser.close();
	console.log("\nDone! All screenshots saved to website/img/");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
