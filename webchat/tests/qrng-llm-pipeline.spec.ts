/**
 * End-to-end test of the LLM + QRNG pipeline.
 *
 * Loads the smallest WebLLM model in a real WebGPU-capable browser,
 * enables quantum randomness against the live proxy at qrng.oppen.ai,
 * sends a chat message, and verifies a real response streams (vs. the
 * "patch could not be installed" error).
 *
 * Why it's gated behind RUN_LLM_PIPELINE=1:
 *   - downloads ~270 MB of model weights on first run
 *   - takes 30s-3m even with cached weights
 *   - requires WebGPU which may not be available in CI headless chromium
 *   - hits the live qrng.oppen.ai proxy
 *
 * Run locally:
 *   RUN_LLM_PIPELINE=1 npx playwright test tests/qrng-llm-pipeline.spec.ts \
 *     --headed --workers=1
 *
 * Headed mode is recommended - chromium's headless WebGPU support is
 * partial and varies by version.
 */

import { type Page, expect, test } from "playwright/test";

const RUN = process.env.RUN_LLM_PIPELINE === "1";
const PROXY_URL = process.env.QRNG_PROXY_URL || "https://qrng.oppen.ai";

// 5 minutes per test - model download + load + chat all together
test.describe.configure({ mode: "serial", timeout: 300_000 });

test.describe("QRNG + LLM end-to-end", () => {
	test.skip(!RUN, "set RUN_LLM_PIPELINE=1 to run (downloads ~270MB, needs WebGPU)");

	// biome-ignore lint/suspicious/noExplicitAny: window globals exposed for tests
	type OppenGlobals = { engine: any; state: any; isQrngPerTokenActive: () => boolean; getQrngStatus: () => any };

	async function waitForModelReady(page: Page): Promise<void> {
		// Atomically: state.ready==true AND overlay hidden. Avoids the race
		// where state.ready is true from a previous load while the current
		// reload's overlay is still visible.
		await page.waitForFunction(
			() => {
				const w = window as unknown as { __oppen?: OppenGlobals };
				const overlay = document.getElementById("loading-overlay");
				const hidden = !overlay?.classList.contains("visible");
				return w.__oppen?.state?.ready === true && hidden;
			},
			{ timeout: 240_000, polling: 500 },
		);
	}

	async function setQrngEnabled(page: Page, proxyUrl: string): Promise<void> {
		await page.locator("#settings-btn").click();
		await page.locator("#experimental-section summary").click();
		await page.locator("#qrng-proxy-url").fill(proxyUrl);
		await page.locator("label.toggle-label:has(#qrng-enabled)").click();
		await page.locator("#settings-save").click();
		await expect(page.locator("#settings-modal")).not.toHaveClass(/visible/);
	}

	test("model loads, patch installs, chat generates with QRNG on", async ({ page }) => {
		const consoleMsgs: string[] = [];
		page.on("console", (m) => {
			const t = m.text();
			if (t.includes("[qrng]") || t.includes("qrng") || t.includes("patch")) {
				consoleMsgs.push(`[${m.type()}] ${t}`);
			}
		});

		await page.goto("/");

		// Just wait for the default model to finish loading. We accept whatever
		// model is persisted in IndexedDB (Qwen2.5-0.5B by default). Model
		// switching from the test added a second download cycle that flaked
		// when WebGPU adapter context got stressed.
		await waitForModelReady(page);

		// Sanity: window.__oppen is exposed and engine is real
		const introspection = await page.evaluate(() => {
			const w = window as unknown as { __oppen?: OppenGlobals };
			const e = w.__oppen?.engine;
			if (!e) return { hasEngine: false };
			const props = Object.getOwnPropertyNames(e);
			const map = e.loadedModelIdToPipeline;
			const isMap = map instanceof Map;
			const mapSize = isMap ? map.size : -1;
			let pipelineProtoMethods: string[] = [];
			let pipelineInstanceProps: string[] = [];
			if (isMap && mapSize > 0) {
				const p = map.values().next().value;
				const proto = Object.getPrototypeOf(p);
				pipelineProtoMethods = proto ? Object.getOwnPropertyNames(proto).slice(0, 40) : [];
				pipelineInstanceProps = Object.getOwnPropertyNames(p).slice(0, 40);
			}
			return {
				hasEngine: true,
				engineProps: props,
				hasPipelineMap: isMap,
				pipelineMapSize: mapSize,
				pipelineProtoMethods,
				pipelineInstanceProps,
				perTokenActive: w.__oppen?.isQrngPerTokenActive?.() ?? null,
			};
		});

		// Dump the introspection so future patch breakage is debuggable from CI logs
		console.log("\n--- engine introspection ---");
		console.log(JSON.stringify(introspection, null, 2));
		console.log("--- qrng dlog lines ---");
		for (const m of consoleMsgs) console.log(m);
		console.log("---");

		expect(introspection.hasEngine, "engine should be exposed on window.__oppen").toBe(true);
		expect(introspection.hasPipelineMap, "engine.loadedModelIdToPipeline should be a Map").toBe(true);
		expect(introspection.pipelineMapSize, "Map should have at least one pipeline").toBeGreaterThan(0);

		// The patch should run during onReady. Per-token-active is true once
		// the patch found sampleTokenFromLogits AND QRNG config is enabled.
		// At this point we haven't enabled QRNG yet, so just verify the patch
		// itself succeeded (qrngPatchSucceeded internal flag, surfaced via
		// isQrngPerTokenActive when enabled).
		expect(
			introspection.pipelineProtoMethods.includes("sampleTokenFromLogits") ||
				introspection.pipelineInstanceProps.includes("sampleTokenFromLogits"),
			`sampleTokenFromLogits should exist on pipeline (proto: ${introspection.pipelineProtoMethods.join(", ")})`,
		).toBe(true);

		// Now enable QRNG and check per-token-active becomes true
		await setQrngEnabled(page, PROXY_URL);
		const afterEnable = await page.evaluate(() => {
			const w = window as unknown as { __oppen?: OppenGlobals };
			return {
				perTokenActive: w.__oppen?.isQrngPerTokenActive?.() ?? null,
				status: w.__oppen?.getQrngStatus?.() ?? null,
			};
		});
		expect(
			afterEnable.perTokenActive,
			"isQrngPerTokenActive() must be true after enabling QRNG with proxy URL set",
		).toBe(true);

		// Send a chat message and watch for either streaming response OR the
		// patch-failure error. With the patch installed, response should stream.
		await page.locator("#chat-input").fill("Say hi in one word.");
		await page.locator("#send-btn").click();

		// Wait for a non-empty assistant response. If the patch failed, the
		// assistant message would contain the explicit "Quantum randomness is
		// enabled but the per-token sampler patch could not be installed"
		// error - we assert the OPPOSITE.
		const lastAssistant = page.locator(".message.assistant .msg-content").last();
		await expect(lastAssistant).toBeVisible({ timeout: 60_000 });
		const responseText = await page.waitForFunction(
			() => {
				const els = document.querySelectorAll(".message.assistant .msg-content");
				const last = els[els.length - 1];
				const text = last?.textContent?.trim() || "";
				if (text.length === 0) return false;
				if (text.includes("typing-indicator")) return false;
				return text;
			},
			{ timeout: 120_000 },
		);
		const text = await responseText.jsonValue();
		expect(typeof text).toBe("string");
		expect(text as string, "response must not contain the patch-failure error").not.toContain(
			"per-token sampler patch could not be installed",
		);
		expect((text as string).length, "response should be non-trivial").toBeGreaterThan(0);

		// Verify the per-token hook FIRED - the sum of all per-token outcomes
		// should match the number of tokens generated. Whether bytes were
		// actually quantum (vs skipped/failed) depends on whether ANU was
		// cooperating during the test run, which we can't control.
		const finalStatus = await page.evaluate(() => {
			const w = window as unknown as { __oppen?: OppenGlobals };
			return w.__oppen?.getQrngStatus?.() ?? null;
		});
		console.log("\n--- final QRNG status ---");
		console.log(JSON.stringify(finalStatus, null, 2));
		const totalHookFires =
			(finalStatus?.tokensQuantum ?? 0) +
			(finalStatus?.tokensSkipped ?? 0) +
			(finalStatus?.tokensFetchFailed ?? 0);
		expect(
			totalHookFires,
			`per-token hook must fire for at least one token (status: ${JSON.stringify(finalStatus)})`,
		).toBeGreaterThan(0);

		// Best-effort: if ANY bytes flowed through, that's a bonus and worth
		// surfacing. Don't fail the test if ANU was rate-limited - the patch
		// itself working is the contract we're verifying here.
		if ((finalStatus?.tokensQuantum ?? 0) > 0) {
			console.log(`Quantum bytes actually flowed (${finalStatus.tokensQuantum} tokens reseeded).`);
		} else {
			console.log(
				`Patch fired ${totalHookFires} times but no quantum bytes (proxy/ANU likely rate-limited). lastError="${finalStatus?.lastError}"`,
			);
		}
	});
});
