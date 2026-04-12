import { expect, test } from "playwright/test";

test.describe("Voice Input", () => {
	test("voice button exists and is clickable", async ({ page }) => {
		await page.goto("/");
		const voiceBtn = page.locator("#voice-btn");
		await expect(voiceBtn).toBeVisible();
		await expect(voiceBtn).toBeEnabled();
	});

	test("voice engine setting exists in settings modal", async ({ page }) => {
		await page.goto("/");

		// Open settings modal
		await page.locator("#settings-btn").click();
		await expect(page.locator("#settings-modal")).toHaveClass(/visible/);

		// Check voice engine select
		const voiceSelect = page.locator("#voice-engine-select");
		await expect(voiceSelect).toBeVisible();

		// Verify it has the two options
		const options = voiceSelect.locator("option");
		await expect(options).toHaveCount(2);
		await expect(options.nth(0)).toHaveAttribute("value", "whisper");
		await expect(options.nth(1)).toHaveAttribute("value", "webspeech");
	});

	test("voice engine setting defaults to whisper", async ({ page }) => {
		await page.goto("/");

		await page.locator("#model-badge").click();
		const voiceSelect = page.locator("#voice-engine-select");
		await expect(voiceSelect).toHaveValue("whisper");
	});

	test("voice button does not have recording class initially", async ({ page }) => {
		await page.goto("/");
		const voiceBtn = page.locator("#voice-btn");
		await expect(voiceBtn).not.toHaveClass(/recording/);
	});

	test("voice button has recording pulse animation CSS defined", async ({ page }) => {
		await page.goto("/");

		const hasPulseAnimation = await page.evaluate(() => {
			const sheets = document.styleSheets;
			for (const sheet of sheets) {
				try {
					for (const rule of sheet.cssRules) {
						if (rule instanceof CSSStyleRule && rule.selectorText?.includes("#voice-btn.recording")) {
							return true;
						}
					}
				} catch {
					// Cross-origin stylesheet
				}
			}
			return false;
		});
		expect(hasPulseAnimation).toBe(true);
	});
});
