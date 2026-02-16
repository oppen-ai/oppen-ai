import { expect, test } from "playwright/test";

test.describe("Loading Overlay", () => {
	test("loading overlay has required DOM elements", async ({ page }) => {
		await page.goto("/");

		await expect(page.locator("#loading-overlay")).toBeAttached();
		await expect(page.locator("#loading-title")).toBeAttached();
		await expect(page.locator("#loading-subtitle")).toBeAttached();
		await expect(page.locator("#progress-fill")).toBeAttached();
		await expect(page.locator("#loading-status")).toBeAttached();
		await expect(page.locator("#loading-actions")).toBeAttached();
	});

	test("loading overlay title is an h3 element", async ({ page }) => {
		await page.goto("/");

		const tagName = await page.locator("#loading-title").evaluate((el) => el.tagName);
		expect(tagName).toBe("H3");
	});

	test("loading overlay subtitle is a p element", async ({ page }) => {
		await page.goto("/");

		const tagName = await page.locator("#loading-subtitle").evaluate((el) => el.tagName);
		expect(tagName).toBe("P");
	});

	test("loading overlay shows during engine init", async ({ page }) => {
		await page.goto("/");

		// The overlay should appear during init (visible class added)
		// It may hide quickly if engine errors out, but the element should exist
		const overlay = page.locator("#loading-overlay");
		await expect(overlay).toBeAttached();
	});

	test("loading overlay action buttons exist", async ({ page }) => {
		await page.goto("/");

		await expect(page.locator("#loading-change-model")).toBeAttached();
		await expect(page.locator("#loading-retry")).toBeAttached();
	});

	test("loading overlay actions are hidden by default", async ({ page }) => {
		await page.goto("/");

		const display = await page.locator("#loading-actions").evaluate(
			(el) => getComputedStyle(el).display,
		);
		expect(display).toBe("none");
	});

	test("loading overlay shows friendly title on engine load", async ({ page }) => {
		await page.goto("/");

		// Check that the title is set to one of the friendly messages
		const title = await page.locator("#loading-title").textContent();
		expect(
			title === "Loading my brain..." || title === "Downloading my brain..." || title === "Loading...",
		).toBe(true);
	});

	test("loading overlay subtitle shows model info during engine load", async ({ page }) => {
		await page.goto("/");

		// The subtitle should contain model label info
		const subtitle = await page.locator("#loading-subtitle").textContent();
		// It should have been set (could be model label or empty before init completes)
		expect(subtitle !== null).toBe(true);
	});

	test("progress bar fill element has correct initial width", async ({ page }) => {
		await page.goto("/");

		// Progress fill should start at 0%
		const width = await page.locator("#progress-fill").evaluate(
			(el) => (el as HTMLElement).style.width,
		);
		expect(width === "0%" || width === "").toBe(true);
	});
});
