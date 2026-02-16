import { expect, test } from "playwright/test";

test.describe("Chat", () => {
	test("app loads and shows empty state", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator(".empty-state")).toBeVisible();
		await expect(page.locator(".empty-state h2")).toHaveText("Öppen AI");
	});

	test("chat input is present and functional", async ({ page }) => {
		await page.goto("/");
		const input = page.locator("#chat-input");
		await expect(input).toBeVisible();
		await input.fill("Hello world");
		await expect(input).toHaveValue("Hello world");
	});

	test("send button is disabled when model not loaded", async ({ page }) => {
		await page.goto("/");
		const sendBtn = page.locator("#send-btn");
		await expect(sendBtn).toBeDisabled();
	});

	test("suggestion chips are clickable", async ({ page }) => {
		await page.goto("/");
		const chip = page.locator(".empty-chip").first();
		await chip.click();
		const input = page.locator("#chat-input");
		const value = await input.inputValue();
		expect(value.length).toBeGreaterThan(0);
	});

	test("no CSP or JS errors block app shell", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(err.message));
		page.on("console", (msg) => {
			if (msg.type() === "error") errors.push(msg.text());
		});

		await page.goto("/");
		await page.waitForTimeout(1000);

		// App shell must render without fatal errors
		await expect(page.locator("#app")).not.toBeEmpty();
		await expect(page.locator("#chat-input")).toBeVisible();

		// No CSP violations should block the app
		const cspErrors = errors.filter(
			(e) => e.includes("Content Security Policy") || e.includes("CSP"),
		);
		expect(cspErrors).toEqual([]);
	});

	test("loading overlay appears on init", async ({ page }) => {
		await page.goto("/");
		// The loading overlay should appear during engine init
		const overlay = page.locator("#loading-overlay");
		// It exists in DOM
		await expect(overlay).toBeAttached();
	});
});
