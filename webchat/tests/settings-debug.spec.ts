import { expect, test } from "playwright/test";

test.describe("Settings accessibility", () => {
	test("settings button visible and modal opens with all fields", async ({ page }) => {
		await page.goto("/");

		// Wait for loading overlay to disappear
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		// Screenshot after load
		await page.screenshot({ path: "test-results/01-after-load.png", fullPage: true });

		// Settings button in sidebar should be visible (desktop)
		const settingsBtn = page.locator("#settings-btn");
		await expect(settingsBtn).toBeVisible();

		// Click it
		await settingsBtn.click();

		// Modal should be visible
		const modal = page.locator("#settings-modal");
		await expect(modal).toHaveClass(/visible/);

		// Screenshot of the open modal
		await page.screenshot({ path: "test-results/02-settings-open.png", fullPage: true });

		// Verify ALL form fields exist
		await expect(page.locator("#theme-select")).toBeVisible();
		await expect(page.locator("#bg-select")).toBeVisible();
		await expect(page.locator("#model-select")).toBeVisible();
		await expect(page.locator("#system-prompt")).toBeVisible();
		await expect(page.locator("#debug-toggle-setting")).toBeAttached();
		await expect(page.locator("#settings-save")).toBeVisible();
		await expect(page.locator("#settings-cancel")).toBeVisible();

		// Save and verify modal closes
		await page.locator("#settings-save").click();
		await expect(modal).not.toHaveClass(/visible/);
	});

	test("settings accessible via model badge click", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		await page.locator("#model-badge").click();
		await expect(page.locator("#settings-modal")).toHaveClass(/visible/);
		await expect(page.locator("#bg-select")).toBeVisible();
	});

	test("settings accessible on mobile viewport", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto("/");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		// On mobile, model badge should be clickable to open settings
		await page.locator("#model-badge").click();
		await expect(page.locator("#settings-modal")).toHaveClass(/visible/);

		await page.screenshot({ path: "test-results/03-settings-mobile.png", fullPage: true });

		await expect(page.locator("#bg-select")).toBeVisible();
		await expect(page.locator("#settings-save")).toBeVisible();
	});

	test("debug panel does not block settings button", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		// Enable debug via settings
		await page.locator("#model-badge").click();
		await page.locator(".toggle-label").click();
		await page.locator("#settings-save").click();

		// Debug container should be visible
		const debugContainer = page.locator("#debug-container");
		await expect(debugContainer).toBeVisible();

		await page.screenshot({ path: "test-results/04-with-debug.png", fullPage: true });

		// Settings button should still be clickable
		const settingsBtn = page.locator("#settings-btn");
		await expect(settingsBtn).toBeVisible();
		await settingsBtn.click();
		await expect(page.locator("#settings-modal")).toHaveClass(/visible/);
	});
});
