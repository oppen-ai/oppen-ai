import { expect, test } from "playwright/test";

test.describe("Input Action Buttons", () => {
	test("upload image button is visible", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("#upload-image-btn")).toBeVisible();
	});

	test("upload document button is visible", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("#upload-doc-btn")).toBeVisible();
	});

	test("voice button is visible", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("#voice-btn")).toBeVisible();
	});

	test("clear chat button is visible", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("#clear-chat-btn")).toBeVisible();
	});

	test("upload image button triggers file input", async ({ page }) => {
		await page.goto("/");
		const imageInput = page.locator("#image-input");

		// Verify hidden file input exists
		await expect(imageInput).toBeAttached();
		await expect(imageInput).toHaveAttribute("accept", "image/*");

		// Verify clicking the button triggers the file input
		const fileChooserPromise = page.waitForEvent("filechooser");
		await page.locator("#upload-image-btn").click();
		const fileChooser = await fileChooserPromise;
		expect(fileChooser).toBeTruthy();
	});

	test("upload document button triggers file input", async ({ page }) => {
		await page.goto("/");
		const docInput = page.locator("#doc-input");

		// Verify hidden file input exists
		await expect(docInput).toBeAttached();
		await expect(docInput).toHaveAttribute("accept", ".pdf,.txt,.md,.csv,.json");

		// Verify clicking the button triggers the file input
		const fileChooserPromise = page.waitForEvent("filechooser");
		await page.locator("#upload-doc-btn").click();
		const fileChooser = await fileChooserPromise;
		expect(fileChooser).toBeTruthy();
	});

	test("send button is present in input actions", async ({ page }) => {
		await page.goto("/");
		const sendBtn = page.locator("#send-btn");
		await expect(sendBtn).toBeVisible();
		await expect(sendBtn).toBeDisabled();
	});

	test("clear chat button shows confirm dialog", async ({ page }) => {
		await page.goto("/");

		// Listen for dialog event
		let dialogMessage = "";
		page.on("dialog", async (dialog) => {
			dialogMessage = dialog.message();
			await dialog.dismiss();
		});

		await page.locator("#clear-chat-btn").click();
		expect(dialogMessage).toContain("Clear all messages");
	});
});
