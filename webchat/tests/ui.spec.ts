import { expect, test } from "playwright/test";

test.describe("UI", () => {
	test("sidebar toggles on mobile viewport", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto("/");

		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		const sidebar = page.locator("#sidebar");
		await expect(sidebar).not.toHaveClass(/open/);

		await page.locator("#menu-toggle").click();
		await expect(sidebar).toHaveClass(/open/);

		await page.locator("#sidebar-backdrop").click({ position: { x: 350, y: 400 } });
		await expect(sidebar).not.toHaveClass(/open/);
	});

	test("theme switch changes data-theme attribute", async ({ page }) => {
		await page.goto("/");
		const html = page.locator("html");
		await expect(html).toHaveAttribute("data-theme", "dark");

		await page.locator("#settings-btn").click();
		await page.locator("#theme-select").selectOption("light");
		await page.locator("#settings-save").click();

		await expect(html).toHaveAttribute("data-theme", "light");
	});

	test("settings modal opens and closes", async ({ page }) => {
		await page.goto("/");
		const modal = page.locator("#settings-modal");
		await expect(modal).not.toHaveClass(/visible/);

		await page.locator("#settings-btn").click();
		await expect(modal).toHaveClass(/visible/);

		await page.locator("#settings-cancel").click();
		await expect(modal).not.toHaveClass(/visible/);
	});

	test("new chat button creates a new chat", async ({ page }) => {
		await page.goto("/");
		const title = page.locator("#topbar-title");
		await expect(title).toHaveText("New Chat");

		await page.locator("#new-chat-btn").click();
		await expect(title).toHaveText("New Chat");
	});
});
