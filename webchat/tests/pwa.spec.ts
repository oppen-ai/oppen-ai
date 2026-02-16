import { expect, test } from "playwright/test";

test.describe("PWA", () => {
	test("manifest.json is accessible", async ({ page }) => {
		const response = await page.goto("/manifest.json");
		expect(response?.status()).toBe(200);
		const manifest = await response?.json();
		expect(manifest.name).toBe("Öppen AI Chat");
		expect(manifest.short_name).toBe("Öppen AI");
		expect(manifest.display).toBe("standalone");
		expect(manifest.icons.length).toBeGreaterThan(0);
	});

	test("PWA meta tags are present", async ({ page }) => {
		await page.goto("/");

		const capable = await page
			.locator('meta[name="apple-mobile-web-app-capable"]')
			.getAttribute("content");
		expect(capable).toBe("yes");

		const themeColor = await page
			.locator('meta[name="theme-color"]')
			.first()
			.getAttribute("content");
		expect(themeColor).toBeTruthy();

		const manifestLink = await page.locator('link[rel="manifest"]').getAttribute("href");
		expect(manifestLink).toBe("/manifest.json");
	});

	test("service worker registers", async ({ page }) => {
		await page.goto("/");
		// Give SW time to register
		await page.waitForTimeout(1000);

		const swRegistered = await page.evaluate(async () => {
			if (!("serviceWorker" in navigator)) return false;
			const registrations = await navigator.serviceWorker.getRegistrations();
			return registrations.length > 0;
		});
		expect(swRegistered).toBe(true);
	});
});
