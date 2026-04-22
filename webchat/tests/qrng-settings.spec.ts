import { expect, test } from "playwright/test";

const REAL_PROXY_URL = process.env.QRNG_PROXY_URL || "";

test.describe("QRNG experimental settings", () => {
	test("disabled by default and lives under Experimental", async ({ page }) => {
		await page.goto("/?noengine=1");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 60000 });

		await page.locator("#settings-btn").click();
		await expect(page.locator("#settings-modal")).toHaveClass(/visible/);

		const section = page.locator("#experimental-section");
		await expect(section).toBeVisible();
		// Must be collapsed by default - keeps experimental noise out of sight
		expect(await section.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);

		await section.locator("summary").click();
		await expect(page.locator("#qrng-enabled")).toBeAttached();
		await expect(page.locator("#qrng-mode")).toBeVisible();
		await expect(page.locator("#qrng-proxy-url")).toBeVisible();

		// Default state: off, buffer mode
		expect(await page.locator("#qrng-enabled").isChecked()).toBe(false);
		expect(await page.locator("#qrng-mode").inputValue()).toBe("buffer");
	});

	test("toggling on persists across reload", async ({ page }) => {
		await page.goto("/?noengine=1");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 60000 });

		await page.locator("#settings-btn").click();
		await page.locator("#experimental-section summary").click();

		await page.locator("label.toggle-label:has(#qrng-enabled)").click();
		await page.locator("#qrng-mode").selectOption("realtime");
		await page.locator("#qrng-proxy-url").fill("https://example-qrng.workers.dev");
		await page.locator("#settings-save").click();

		await expect(page.locator("#settings-modal")).not.toHaveClass(/visible/);

		await page.reload();
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 60000 });

		await page.locator("#settings-btn").click();
		await page.locator("#experimental-section summary").click();

		expect(await page.locator("#qrng-enabled").isChecked()).toBe(true);
		expect(await page.locator("#qrng-mode").inputValue()).toBe("realtime");
		expect(await page.locator("#qrng-proxy-url").inputValue()).toBe(
			"https://example-qrng.workers.dev",
		);
	});

	test("invalid proxy URL fails gracefully without breaking the app", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (e) => errors.push(e.message));

		await page.goto("/?noengine=1");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 60000 });

		await page.locator("#settings-btn").click();
		await page.locator("#experimental-section summary").click();
		await page.locator("label.toggle-label:has(#qrng-enabled)").click();
		await page.locator("#qrng-proxy-url").fill("https://this-host-definitely-does-not-exist.invalid");
		await page.locator("#settings-save").click();

		// Wait a beat for the eager pool refill to attempt and fail
		await page.waitForTimeout(1500);

		// App must still be functional - no uncaught errors
		expect(errors.filter((e) => /qrng/i.test(e))).toEqual([]);

		// Reopen settings - status line should reflect the failure
		await page.locator("#settings-btn").click();
		await page.locator("#experimental-section summary").click();
		const status = await page.locator("#qrng-status-line").textContent();
		expect(status || "").toMatch(/error|pending/i);
	});

	test("CSP allows configured proxy domains", async ({ page }) => {
		// Verify the meta CSP includes both the default (qrng.oppen.ai) and *.workers.dev.
		await page.goto("/?noengine=1");
		const csp = await page
			.locator('meta[http-equiv="Content-Security-Policy"]')
			.getAttribute("content");
		expect(csp || "").toContain("https://qrng.oppen.ai");
		expect(csp || "").toContain("https://*.workers.dev");
	});

	test.describe("real QRNG proxy", () => {
		test.skip(!REAL_PROXY_URL, "set QRNG_PROXY_URL env to run");

		test("buffer mode fetches bytes from the real proxy on enable", async ({ page }) => {
			const proxyHost = new URL(REAL_PROXY_URL).host;
			const fetched: string[] = [];
			page.on("request", (req) => {
				if (req.url().includes(proxyHost)) fetched.push(req.url());
			});

			await page.goto("/?noengine=1");
			await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 60000 });

			await page.locator("#settings-btn").click();
			await page.locator("#experimental-section summary").click();
			await page.locator("#qrng-proxy-url").fill(REAL_PROXY_URL);
			await page.locator("label.toggle-label:has(#qrng-enabled)").click();
			await page.locator("#settings-save").click();

			// Eager pool warm-up should have fired exactly one upstream call
			await expect.poll(() => fetched.length, { timeout: 8000 }).toBeGreaterThan(0);
			expect(fetched[0]).toContain("/?length=");
		});
	});
});
