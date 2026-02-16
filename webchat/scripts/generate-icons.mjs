#!/usr/bin/env node
/**
 * Generate all favicon/PWA icons from src/logo.svg using Playwright's Chromium.
 * This renders the SVG gradient correctly.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ICONS_DIR = resolve(ROOT, "public/icons");
const SVG_PATH = resolve(ROOT, "src/logo.svg");

// All sizes needed for browsers, iOS, Android, PWA
const SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512];

// Dark background matching the app's theme
const BG_COLOR = "#0a0a0a";

mkdirSync(ICONS_DIR, { recursive: true });

const svgContent = readFileSync(SVG_PATH, "utf-8");

// Build an HTML page that renders the icon at a given size
function buildHTML(size) {
  return `<!DOCTYPE html>
<html>
<head><style>
  * { margin: 0; padding: 0; }
  body { width: ${size}px; height: ${size}px; background: ${BG_COLOR}; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .icon { width: ${size}px; height: ${size}px; }
</style></head>
<body>
  <div class="icon">${svgContent}</div>
</body>
</html>`;
}

// Also generate a maskable variant with extra padding (safe zone = 80% center)
function buildMaskableHTML(size) {
  const inner = Math.round(size * 0.7);
  return `<!DOCTYPE html>
<html>
<head><style>
  * { margin: 0; padding: 0; }
  body { width: ${size}px; height: ${size}px; background: ${BG_COLOR}; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .icon { width: ${inner}px; height: ${inner}px; }
</style></head>
<body>
  <div class="icon">${svgContent}</div>
</body>
</html>`;
}

async function main() {
  console.log("Launching Chromium...");
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 1 });

  for (const size of SIZES) {
    const page = await context.newPage();
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(buildHTML(size));
    await page.waitForTimeout(100);

    const buf = await page.screenshot({ type: "png", omitBackground: false });
    const outPath = resolve(ICONS_DIR, `icon-${size}.png`);
    writeFileSync(outPath, buf);
    console.log(`  icon-${size}.png (${buf.length} bytes)`);
    await page.close();
  }

  // Maskable icon for Android/PWA (512px with safe-zone padding)
  const maskPage = await context.newPage();
  await maskPage.setViewportSize({ width: 512, height: 512 });
  await maskPage.setContent(buildMaskableHTML(512));
  await maskPage.waitForTimeout(100);
  const maskBuf = await maskPage.screenshot({ type: "png", omitBackground: false });
  writeFileSync(resolve(ICONS_DIR, "icon-512-maskable.png"), maskBuf);
  console.log(`  icon-512-maskable.png (${maskBuf.length} bytes)`);
  await maskPage.close();

  await browser.close();

  // Generate favicon.ico from the 16, 32, and 48 PNGs using ImageMagick
  console.log("\nGenerating favicon.ico...");
  const { execSync } = await import("child_process");
  try {
    execSync(
      `convert ${ICONS_DIR}/icon-16.png ${ICONS_DIR}/icon-32.png ${ICONS_DIR}/icon-48.png ${ROOT}/public/favicon.ico`,
      { stdio: "inherit" }
    );
    console.log("  favicon.ico created");
  } catch {
    console.warn("  WARNING: ImageMagick not available, skipping favicon.ico");
    console.warn("  Copy icon-32.png to favicon.ico as fallback");
  }

  // Also copy SVG to public for modern browsers
  writeFileSync(resolve(ROOT, "public/favicon.svg"), svgContent);
  console.log("  favicon.svg copied");

  console.log("\nDone! Generated icons:");
  console.log(`  ${ICONS_DIR}/`);
  SIZES.forEach(s => console.log(`    icon-${s}.png`));
  console.log("    icon-512-maskable.png");
  console.log(`  ${ROOT}/public/favicon.ico`);
  console.log(`  ${ROOT}/public/favicon.svg`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
