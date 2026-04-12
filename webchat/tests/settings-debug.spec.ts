import { expect, test } from "playwright/test";

test.describe("Settings accessibility", () => {
	test("settings button visible and modal opens with all fields", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		const settingsBtn = page.locator("#settings-btn");
		await expect(settingsBtn).toBeVisible();
		await settingsBtn.click();

		const modal = page.locator("#settings-modal");
		await expect(modal).toHaveClass(/visible/);

		await expect(page.locator("#theme-select")).toBeVisible();
		await expect(page.locator("#preset-select")).toBeVisible();
		await expect(page.locator("#model-select")).toBeVisible();
		await expect(page.locator("#context-select")).toBeVisible();
		await expect(page.locator("#system-prompt")).toBeVisible();
		await expect(page.locator("#debug-toggle-setting")).toBeAttached();
		await expect(page.locator("#settings-save")).toBeVisible();
		await expect(page.locator("#settings-cancel")).toBeVisible();

		await page.locator("#settings-save").click();
		await expect(modal).not.toHaveClass(/visible/);
	});

	test("topbar model dropdown opens on badge click", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		await expect(page.locator("#model-badge")).toBeVisible();
		await page.locator("#model-badge").click();
		await expect(page.locator("#model-dropdown")).toHaveClass(/open/);
		const items = await page.locator(".model-dropdown-item").count();
		expect(items).toBeGreaterThan(0);
	});

	test("settings accessible on mobile viewport", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto("/");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		await page.locator("#menu-toggle").click();
		await page.locator("#settings-btn").click();
		await expect(page.locator("#settings-modal")).toHaveClass(/visible/);

		await expect(page.locator("#model-select")).toBeVisible();
		await expect(page.locator("#context-select")).toBeVisible();
		await expect(page.locator("#settings-save")).toBeVisible();
	});

	test("debug panel does not block settings button", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		await page.locator("#settings-btn").click();
		await page.locator(".toggle-label").click();
		await page.locator("#settings-save").click();

		const debugContainer = page.locator("#debug-container");
		await expect(debugContainer).toBeVisible();

		const settingsBtn = page.locator("#settings-btn");
		await expect(settingsBtn).toBeVisible();
		await settingsBtn.click();
		await expect(page.locator("#settings-modal")).toHaveClass(/visible/);
	});
});
