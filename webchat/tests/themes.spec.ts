import { expect, test } from "playwright/test";

test.describe("Theme Presets", () => {
	test("preset select is available in settings modal", async ({ page }) => {
		await page.goto("/");
		// Open settings
		await page.locator("#settings-btn").click();
		await expect(page.locator("#preset-select")).toBeVisible();
	});

	test("preset select has multiple options", async ({ page }) => {
		await page.goto("/");
		await page.locator("#settings-btn").click();
		const options = await page.locator("#preset-select option").count();
		expect(options).toBeGreaterThan(10);
	});

	test("theme preset style element is injected", async ({ page }) => {
		await page.goto("/");
		const styleEl = page.locator("#theme-preset-vars");
		await expect(styleEl).toBeAttached();
	});
});
