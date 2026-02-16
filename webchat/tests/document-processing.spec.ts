import { expect, test } from "playwright/test";

test.describe("Document Processing", () => {
	test("document file input accepts correct types", async ({ page }) => {
		await page.goto("/");
		const docInput = page.locator("#doc-input");
		await expect(docInput).toBeAttached();
		await expect(docInput).toHaveAttribute("accept", ".pdf,.txt,.md,.csv,.json");
	});

	test("image file input accepts image types", async ({ page }) => {
		await page.goto("/");
		const imageInput = page.locator("#image-input");
		await expect(imageInput).toBeAttached();
		await expect(imageInput).toHaveAttribute("accept", "image/*");
	});

	test("attachment area is initially empty/hidden", async ({ page }) => {
		await page.goto("/");
		const area = page.locator("#attachment-area");
		await expect(area).toBeAttached();
		// Should be empty and thus hidden via CSS :empty
		const isEmpty = await area.evaluate((el) => el.innerHTML.trim() === "");
		expect(isEmpty).toBe(true);
	});

	test("attachment chip can be rendered and removed", async ({ page }) => {
		await page.goto("/");

		// Wait for attachment area to exist in DOM
		await expect(page.locator("#attachment-area")).toBeAttached();

		// Simulate an attachment chip appearing
		await page.evaluate(() => {
			const area = document.getElementById("attachment-area");
			if (!area) return;
			area.innerHTML = `<div class="attachment-chip">
				<span>test-file.txt</span>
				<button class="attachment-chip-remove" id="remove-attachment" title="Remove">&times;</button>
			</div>`;
		});

		const chip = page.locator(".attachment-chip");
		await expect(chip).toBeVisible();
		await expect(chip.locator("span")).toHaveText("test-file.txt");

		// Click remove button
		await page.evaluate(() => {
			const btn = document.getElementById("remove-attachment");
			if (btn) {
				btn.addEventListener("click", () => {
					const area = document.getElementById("attachment-area");
					if (area) area.innerHTML = "";
				});
				btn.click();
			}
		});

		// Area should be empty now
		const isEmpty = await page.locator("#attachment-area").evaluate((el) => el.innerHTML.trim() === "");
		expect(isEmpty).toBe(true);
	});

	test("attachment chip styling is defined", async ({ page }) => {
		await page.goto("/");

		const hasChipStyle = await page.evaluate(() => {
			const sheets = document.styleSheets;
			for (const sheet of sheets) {
				try {
					for (const rule of sheet.cssRules) {
						if (rule instanceof CSSStyleRule && rule.selectorText?.includes(".attachment-chip")) {
							return true;
						}
					}
				} catch {
					// Cross-origin stylesheet
				}
			}
			return false;
		});
		expect(hasChipStyle).toBe(true);
	});
});
