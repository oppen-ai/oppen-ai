#!/usr/bin/env node
/**
 * Generate the GitHub repository "Open Graph" / social preview image.
 *
 * GitHub's recommended size for a repo social preview is 1280x640 px, with a
 * 40pt safe zone around the edges (see website/img/repository-open-graph-template.png).
 * This script renders an inline HTML page styled like oppen.ai and screenshots
 * it to a PNG inside the safe zone. Design mirrors the live landing page:
 * - header-style "Öppen AI" gradient wordmark on the left
 * - real hero-logo O (ring + gradient "o" + two eyes) on the right
 * - bottom bar with white https:// URLs
 *
 * Usage:  node scripts/generate-repo-og-image.mjs
 * Output: website/img/repository-open-graph.png
 */
import { chromium } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(
	__dirname,
	"../../website/img/repository-open-graph.png",
);

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  :root{
    --bg:#0a0a12;
    --text:#e2e2f0;
    --muted:rgba(226,226,240,.62);
    --neon-blue:#3b82f6;
    --neon-purple:#8b5cf6;
    --neon-pink:#d946ef;
    --grad-neon:linear-gradient(135deg,var(--neon-blue),var(--neon-purple),var(--neon-pink));
  }
  html,body{
    width:1280px;height:640px;
    background:var(--bg);color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;
    overflow:hidden;
  }

  /* Ambient glow orbs matching the website */
  .glow{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
  .glow::before,.glow::after{
    content:'';position:absolute;border-radius:50%;filter:blur(120px);
  }
  .glow::before{
    width:720px;height:720px;top:-240px;left:-160px;
    background:radial-gradient(circle,rgba(59,130,246,.45),transparent 70%);
    opacity:.85;
  }
  .glow::after{
    width:640px;height:640px;bottom:-220px;right:-140px;
    background:radial-gradient(circle,rgba(217,70,239,.4),transparent 70%);
    opacity:.85;
  }

  /* 80px safe zone padding = ~40pt GitHub guideline */
  .frame{
    position:relative;z-index:1;
    width:100%;height:100%;
    padding:80px 96px 120px;
    display:flex;align-items:center;justify-content:space-between;gap:64px;
  }

  .left{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}

  /* Header-style wordmark, lifted straight from the website's .nav-logo */
  .wordmark{
    font-size:44px;font-weight:800;letter-spacing:-.5px;line-height:1;
    background:var(--grad-neon);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;
    background-clip:text;
    margin-bottom:36px;
  }

  h1{
    font-size:62px;font-weight:800;line-height:1.05;letter-spacing:-1.4px;
    margin-bottom:24px;color:#fff;
  }
  h1 em{
    font-style:normal;
    background:var(--grad-neon);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;
    background-clip:text;
  }
  .tagline{
    font-size:22px;line-height:1.5;color:var(--muted);
    max-width:680px;margin-bottom:30px;
  }

  .pills{display:flex;gap:10px;flex-wrap:wrap}
  .pill{
    font-size:17px;font-weight:600;color:#e2e2f0;
    padding:9px 16px;border-radius:999px;
    background:rgba(139,92,246,.12);
    border:1px solid rgba(139,92,246,.4);
    white-space:nowrap;
  }

  /* Hero logo (exact copy of .hero-logo / .o-ring / .o-char / .o-eyes from index.html,
     scaled up: 260px ring / 200px char / 26px eyes) */
  .right{flex:0 0 auto;display:flex;align-items:center;justify-content:center}
  .hero-logo{position:relative;width:260px;height:260px}
  .hero-logo .o-ring{
    width:260px;height:260px;border-radius:50%;
    background:#0a0a12;
    border:3px solid rgba(139,92,246,.4);
    display:flex;align-items:center;justify-content:center;
    position:relative;
  }
  .hero-logo .o-char{
    font-size:200px;font-weight:800;line-height:1;
    color:var(--neon-purple);
  }
  .hero-logo .o-eyes{
    position:absolute;top:38px;left:50%;transform:translateX(-50%);
    display:flex;gap:26px;
  }
  .hero-logo .o-eye{
    width:26px;height:26px;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;
    clip-path:inset(50% 0 0 0);
    background:var(--neon-purple);
    box-shadow:0 0 28px var(--neon-purple),0 0 56px rgba(139,92,246,.35);
  }

  /* Bottom URL strip - aligned to the frame padding, white, with https:// */
  .urls{
    position:absolute;z-index:2;
    left:96px;right:96px;bottom:56px;
    display:flex;align-items:center;gap:36px;
    font-size:20px;font-weight:600;color:#ffffff;letter-spacing:.3px;
  }
  .urls .sep{opacity:.35;font-weight:400}
</style>
</head>
<body>
  <div class="glow"></div>
  <div class="frame">
    <div class="left">
      <div class="wordmark">Öppen AI</div>
      <h1>Truly <em>Open</em>, Private AI<br>on Your Device</h1>
      <p class="tagline">Open-source, on-device LLM chat running entirely in your browser. No servers, no accounts, no data collection.</p>
      <div class="pills">
        <span class="pill">Open Source</span>
        <span class="pill">On-Device</span>
        <span class="pill">WebGPU</span>
        <span class="pill">Private by Default</span>
      </div>
    </div>
    <div class="right">
      <div class="hero-logo">
        <div class="o-ring">
          <span class="o-char">o</span>
          <div class="o-eyes">
            <div class="o-eye"></div>
            <div class="o-eye"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="urls">
    <span>https://oppen.ai</span>
    <span class="sep">|</span>
    <span>https://chat.oppen.ai</span>
  </div>
</body>
</html>`;

async function main() {
	console.log(`Generating: ${OUT_PATH}`);

	const browser = await chromium.launch();
	const page = await browser.newPage({
		viewport: { width: 1280, height: 640 },
		deviceScaleFactor: 2,
	});

	await page.setContent(HTML, { waitUntil: "networkidle" });
	await page.waitForTimeout(300);

	await page.screenshot({
		path: OUT_PATH,
		type: "png",
		clip: { x: 0, y: 0, width: 1280, height: 640 },
	});

	await page.close();
	await browser.close();
	console.log("  repository-open-graph.png (1280x640 @2x)");
	console.log("\nDone!");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
