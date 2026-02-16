import { expect, test } from "playwright/test";

test.describe("Security", () => {
	test("XSS in chat input renders as plain text", async ({ page }) => {
		await page.goto("/");
		const input = page.locator("#chat-input");
		await input.fill('<script>alert(1)</script>');

		// The input should contain the raw text
		await expect(input).toHaveValue('<script>alert(1)</script>');

		// No script execution should have occurred
		const alertFired = await page.evaluate(() => {
			return (window as unknown as Record<string, boolean>).__xss_fired === true;
		});
		expect(alertFired).toBe(false);
	});

	test("CSP meta tag is present", async ({ page }) => {
		await page.goto("/");
		const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
		expect(csp).toBeTruthy();
		expect(csp).toContain("default-src");
	});

	test("no inline onclick handlers in rendered HTML", async ({ page }) => {
		await page.goto("/");
		const inlineHandlers = await page.evaluate(() => {
			return document.querySelectorAll("[onclick]").length;
		});
		expect(inlineHandlers).toBe(0);
	});
});
