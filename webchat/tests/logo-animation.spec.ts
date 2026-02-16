import { expect, test } from "playwright/test";

test.describe("Logo Animations", () => {
	test("empty state shows logo with O and eyes in circle", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator(".empty-logo")).toBeVisible();
		await expect(page.locator(".logo-char")).toHaveText("O");
		const eyes = page.locator(".logo-eye");
		await expect(eyes).toHaveCount(2);
	});

	test("logo circle matches splash style weight", async ({ page }) => {
		await page.goto("/");
		const char = page.locator(".logo-char");
		const fontSize = await char.evaluate((el) => getComputedStyle(el).fontSize);
		const fontWeight = await char.evaluate((el) => getComputedStyle(el).fontWeight);
		expect(fontSize).toBe("48px");
		expect(Number(fontWeight)).toBeGreaterThanOrEqual(800);
	});

	test("logo has cursor pointer for tap interaction", async ({ page }) => {
		await page.goto("/");
		const logo = page.locator(".empty-logo");
		const cursor = await logo.evaluate((el) => getComputedStyle(el).cursor);
		expect(cursor).toBe("pointer");
	});

	test("tapping logo adds an animation class", async ({ page }) => {
		await page.goto("/");
		const logo = page.locator(".empty-logo");

		await logo.click();

		const hasAnimation = await logo.evaluate((el) =>
			el.classList.contains("logo-squeeze") ||
			el.classList.contains("logo-jump") ||
			el.classList.contains("logo-kiss") ||
			el.classList.contains("logo-shake") ||
			el.classList.contains("logo-nod") ||
			el.classList.contains("logo-crazy-eyes") ||
			el.classList.contains("logo-bonk"),
		);
		expect(hasAnimation).toBe(true);
	});

	test("animation class is removed after animation ends", async ({ page }) => {
		await page.goto("/");
		const logo = page.locator(".empty-logo");

		await logo.click();

		// Wait for double animation to complete (2x ~700ms + 100ms pause)
		await page.waitForTimeout(1600);

		const hasAnimation = await logo.evaluate((el) =>
			el.classList.contains("logo-squeeze") ||
			el.classList.contains("logo-jump") ||
			el.classList.contains("logo-kiss") ||
			el.classList.contains("logo-shake") ||
			el.classList.contains("logo-nod") ||
			el.classList.contains("logo-crazy-eyes") ||
			el.classList.contains("logo-bonk"),
		);
		expect(hasAnimation).toBe(false);
	});

	test("eyes track mouse movement", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator(".empty-logo")).toBeVisible();

		const eyes = page.locator(".logo-eyes");

		// Get initial transform
		const initial = await eyes.evaluate((el) => el.style.transform);

		// Move mouse far to the right of the logo
		const logoBox = await page.locator(".empty-logo").boundingBox();
		if (logoBox) {
			await page.mouse.move(logoBox.x + logoBox.width + 200, logoBox.y + logoBox.height / 2);
			await page.waitForTimeout(200);
		}

		const after = await eyes.evaluate((el) => el.style.transform);
		expect(after).not.toEqual(initial);
	});
});
