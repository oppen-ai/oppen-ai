import { expect, test } from "playwright/test";

test.describe("Memory", () => {
	test("memory modal opens with tabs", async ({ page }) => {
		// Use wide viewport so sidebar is visible
		await page.setViewportSize({ width: 1024, height: 768 });
		await page.goto("/");
		await page.locator("#memory-btn").click();
		await expect(page.locator("#memory-modal")).toHaveClass(/visible/);
		await expect(page.locator("#tab-create")).toBeVisible();
		await expect(page.locator("#tab-load")).toBeVisible();
	});

	test("memory tabs switch content", async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await page.goto("/");
		await page.locator("#memory-btn").click();
		await expect(page.locator("#memory-modal")).toHaveClass(/visible/);

		// Create tab should be visible by default
		await expect(page.locator("#memory-create-tab")).toBeVisible();
		await expect(page.locator("#memory-load-tab")).not.toBeVisible();

		// Switch to load tab
		await page.locator("#tab-load").click();
		await expect(page.locator("#memory-create-tab")).not.toBeVisible();
		await expect(page.locator("#memory-load-tab")).toBeVisible();
	});

	test("URL with hash triggers password modal", async ({ page }) => {
		await page.goto("/#/memory/testdata");
		await expect(page.locator("#password-modal")).toHaveClass(/visible/);
	});
});
