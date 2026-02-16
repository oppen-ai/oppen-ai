import { expect, test } from "playwright/test";

test.describe("Mobile layout", () => {
	test("empty state: input pinned to bottom, not centered vertically", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
		await page.goto("/");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		await page.screenshot({ path: "test-results/mobile-empty-se.png" });

		// Input area should be near the bottom of the viewport
		const inputBox = await page.locator("#input-area").boundingBox();
		expect(inputBox).not.toBeNull();
		// Bottom of input area should be within 60px of the viewport bottom
		const inputBottom = inputBox!.y + inputBox!.height;
		expect(inputBottom).toBeGreaterThan(667 - 60);

		// Messages area should fill the space between topbar and input
		const messagesBox = await page.locator("#messages").boundingBox();
		expect(messagesBox).not.toBeNull();
		expect(messagesBox!.y).toBeLessThan(60); // starts near top

		// The messages container should reach down to the input area
		const messagesBottom = messagesBox!.y + messagesBox!.height;
		expect(messagesBottom).toBeGreaterThan(inputBox!.y - 5);
	});

	test("messages are scrollable when content overflows", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto("/");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		// Inject many messages to force overflow
		await page.evaluate(() => {
			const inner = document.getElementById("messages-inner");
			if (!inner) return;
			inner.innerHTML = "";
			for (let i = 0; i < 30; i++) {
				const div = document.createElement("div");
				div.className = "message user";
				div.innerHTML = `<div class="msg-body"><div class="msg-content">Message number ${i + 1} with some extra text to fill space.</div></div>`;
				inner.appendChild(div);
			}
		});

		await page.screenshot({ path: "test-results/mobile-messages-before-scroll.png" });

		const messagesEl = page.locator("#messages");

		// Check scrollHeight > clientHeight (content overflows)
		const scrollable = await messagesEl.evaluate((el) => {
			return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, scrollTop: el.scrollTop };
		});
		expect(scrollable.scrollHeight).toBeGreaterThan(scrollable.clientHeight);

		// Try scrolling
		await messagesEl.evaluate((el) => { el.scrollTop = el.scrollHeight; });
		await page.waitForTimeout(300);

		const afterScroll = await messagesEl.evaluate((el) => el.scrollTop);
		expect(afterScroll).toBeGreaterThan(0);

		await page.screenshot({ path: "test-results/mobile-messages-after-scroll.png" });

		// Input should still be visible at bottom after scroll
		const inputBox = await page.locator("#input-area").boundingBox();
		expect(inputBox).not.toBeNull();
		const inputBottom = inputBox!.y + inputBox!.height;
		expect(inputBottom).toBeGreaterThan(667 - 60);
	});

	test("settings modal: all buttons visible on small screen", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
		await page.goto("/");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		// Open settings
		await page.locator("#model-badge").click();
		await expect(page.locator("#settings-modal")).toHaveClass(/visible/);

		await page.screenshot({ path: "test-results/mobile-settings-se.png" });

		// Save button must be visible (not cut off)
		const saveBtn = page.locator("#settings-save");
		await expect(saveBtn).toBeVisible();
		const saveBtnBox = await saveBtn.boundingBox();
		expect(saveBtnBox).not.toBeNull();
		// Button bottom must be within viewport
		expect(saveBtnBox!.y + saveBtnBox!.height).toBeLessThan(667);

		// Cancel button must also be visible
		await expect(page.locator("#settings-cancel")).toBeVisible();
	});

	test("settings modal: scrollable on very short screen", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 500 }); // very short
		await page.goto("/");
		await expect(page.locator("#loading-overlay")).not.toHaveClass(/visible/, { timeout: 15000 });

		await page.locator("#model-badge").click();
		await expect(page.locator("#settings-modal")).toHaveClass(/visible/);

		await page.screenshot({ path: "test-results/mobile-settings-short.png" });

		// Modal should be scrollable
		const modal = page.locator("#settings-modal .modal");
		const isScrollable = await modal.evaluate((el) => el.scrollHeight > el.clientHeight);

		// If scrollable, scroll to the save button
		if (isScrollable) {
			await modal.evaluate((el) => { el.scrollTop = el.scrollHeight; });
			await page.waitForTimeout(200);
		}

		await page.screenshot({ path: "test-results/mobile-settings-short-scrolled.png" });

		// Save button should still be reachable
		const saveBtn = page.locator("#settings-save");
		await expect(saveBtn).toBeVisible();
	});
});
