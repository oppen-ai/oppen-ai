import { expect, test } from "playwright/test";

test.describe("UI", () => {
	test("sidebar toggles on mobile viewport", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto("/");

		// Wait for loading overlay to lose its .visible class (auto-hides after engine error)
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		const sidebar = page.locator("#sidebar");
		await expect(sidebar).not.toHaveClass(/open/);

		// Open sidebar
		await page.locator("#menu-toggle").click();
		await expect(sidebar).toHaveClass(/open/);

		// Close via backdrop — click the right edge (outside the 320px sidebar)
		await page.locator("#sidebar-backdrop").click({ position: { x: 350, y: 400 } });
		await expect(sidebar).not.toHaveClass(/open/);
	});

	test("theme switch changes data-theme attribute", async ({ page }) => {
		await page.goto("/");
		const html = page.locator("html");
		await expect(html).toHaveAttribute("data-theme", "dark");

		// Open settings and change theme
		await page.locator("#model-badge").click();
		await page.locator("#theme-select").selectOption("light");
		await page.locator("#settings-save").click();

		await expect(html).toHaveAttribute("data-theme", "light");
	});

	test("background theme switch sets data-bg attribute", async ({ page }) => {
		await page.goto("/");
		const html = page.locator("html");
		await expect(html).toHaveAttribute("data-bg", "none");

		// Open settings and change bg theme
		await page.locator("#model-badge").click();
		await page.locator("#bg-select").selectOption("obsidian");
		await page.locator("#settings-save").click();
		await expect(html).toHaveAttribute("data-bg", "obsidian");

		// Switch to another theme
		await page.locator("#model-badge").click();
		await page.locator("#bg-select").selectOption("nova");
		await page.locator("#settings-save").click();
		await expect(html).toHaveAttribute("data-bg", "nova");

		// Switch back to none
		await page.locator("#model-badge").click();
		await page.locator("#bg-select").selectOption("none");
		await page.locator("#settings-save").click();
		await expect(html).toHaveAttribute("data-bg", "none");
	});

	test("bg-animated element exists and pseudo-elements render for active theme", async ({ page }) => {
		await page.goto("/");

		// Verify #bg-animated exists
		await expect(page.locator("#bg-animated")).toBeAttached();

		// Set obsidian theme
		await page.locator("#model-badge").click();
		await page.locator("#bg-select").selectOption("obsidian");
		await page.locator("#settings-save").click();

		// Verify pseudo-element has opacity > 0 via computed style
		const opacity = await page.evaluate(() => {
			const el = document.getElementById("bg-animated");
			if (!el) return "0";
			return getComputedStyle(el, "::before").opacity;
		});
		expect(Number.parseFloat(opacity)).toBeGreaterThan(0);
	});

	test("settings modal opens and closes", async ({ page }) => {
		await page.goto("/");
		const modal = page.locator("#settings-modal");
		await expect(modal).not.toHaveClass(/visible/);

		await page.locator("#model-badge").click();
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
