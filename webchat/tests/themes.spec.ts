import { expect, test } from "playwright/test";

test.describe("Theme Presets", () => {
	test("theme picker is visible in topbar", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("#theme-picker")).toBeVisible();
		await expect(page.locator("#theme-prev")).toBeVisible();
		await expect(page.locator("#theme-name")).toBeVisible();
		await expect(page.locator("#theme-shuffle")).toBeVisible();
		await expect(page.locator("#theme-next")).toBeVisible();
	});

	test("theme name shows default preset label", async ({ page }) => {
		await page.goto("/");
		const themeName = page.locator("#theme-name");
		// Default preset is "mono", label should be "Mono"
		await expect(themeName).toHaveText("Mono");
	});

	test("clicking next changes the theme name", async ({ page }) => {
		await page.goto("/");
		const themeName = page.locator("#theme-name");
		const initial = await themeName.textContent();

		await page.locator("#theme-next").click();
		const after = await themeName.textContent();
		expect(after).not.toEqual(initial);
	});

	test("clicking prev changes the theme name", async ({ page }) => {
		await page.goto("/");
		const themeName = page.locator("#theme-name");
		const initial = await themeName.textContent();

		await page.locator("#theme-prev").click();
		const after = await themeName.textContent();
		expect(after).not.toEqual(initial);
	});

	test("shuffle picks a different theme", async ({ page }) => {
		await page.goto("/");
		const themeName = page.locator("#theme-name");

		// Click shuffle multiple times to ensure at least one change
		const initial = await themeName.textContent();
		let changed = false;
		for (let i = 0; i < 10; i++) {
			await page.locator("#theme-shuffle").click();
			const current = await themeName.textContent();
			if (current !== initial) {
				changed = true;
				break;
			}
		}
		expect(changed).toBe(true);
	});

	test("theme preset changes CSS variables", async ({ page }) => {
		await page.goto("/");

		// Get initial primary color
		const initialPrimary = await page.evaluate(() =>
			getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
		);

		// Click next theme a few times to ensure we get a different preset
		for (let i = 0; i < 5; i++) {
			await page.locator("#theme-next").click();
		}

		// Get new primary color
		const newPrimary = await page.evaluate(() =>
			getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
		);

		expect(newPrimary).not.toEqual(initialPrimary);
	});

	test("theme preset style element is injected", async ({ page }) => {
		await page.goto("/");
		const styleEl = page.locator("#theme-preset-vars");
		await expect(styleEl).toBeAttached();
	});
});
