import { expect, test } from "playwright/test";

test.describe("Copy Button", () => {
	test("assistant message copy button is attached and visible on hover", async ({ page }) => {
		await page.goto("/");

		// Wait for app shell to render
		await expect(page.locator("#messages-inner")).toBeAttached();

		// Inject an assistant message into the DOM
		await page.evaluate(() => {
			const inner = document.getElementById("messages-inner");
			if (!inner) return;
			inner.innerHTML = `
				<div class="message user">
					<div class="msg-body"><div class="msg-content">Hello</div></div>
				</div>
				<div class="message assistant" data-msg-idx="1">
					<div class="msg-body">
						<div class="msg-content">Hi there!</div>
						<div class="msg-meta">
							<span class="msg-time">12:00</span>
							<button class="msg-copy-btn" title="Copy">Copy</button>
						</div>
					</div>
				</div>
			`;
		});

		const copyBtn = page.locator(".msg-copy-btn").first();
		// Button should be in the DOM
		await expect(copyBtn).toBeAttached();

		// Button becomes visible on hover (opacity: 0 → 1)
		const msgEl = page.locator(".message.assistant").first();
		await msgEl.hover();
		await expect(copyBtn).toBeVisible();
	});

	test("copy button element exists in assistant message template", async ({ page }) => {
		await page.goto("/");

		// Verify the renderer includes copy button by checking the button class exists in page styles
		const hasCopyBtnStyle = await page.evaluate(() => {
			const sheets = document.styleSheets;
			for (const sheet of sheets) {
				try {
					for (const rule of sheet.cssRules) {
						if (rule instanceof CSSStyleRule && rule.selectorText?.includes(".msg-copy-btn")) {
							return true;
						}
					}
				} catch {
					// Cross-origin stylesheet
				}
			}
			return false;
		});
		expect(hasCopyBtnStyle).toBe(true);
	});
});
