// Deterministic Action Focus screenshots via the DEV-only /dev/action-preview
// harness (see src/pages/dev/ActionPreview.tsx) — no bot RNG, no waiting.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:5173";
const OUT = fileURLToPath(new URL("./final/screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });
function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

async function shot(name) { await page.screenshot({ path: `${OUT}${name}.png` }); log("saved", name); }

async function sequence(kind, prefix) {
  await page.goto(`${BASE}/dev/action-preview?kind=${kind}`);
  await page.locator(".game-table").first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(20);
  await shot(`${prefix}_START`);
  await page.waitForTimeout(180);
  await shot(`${prefix}_MID`);
  await page.waitForTimeout(700);
  await shot(`${prefix}_END`);
}

async function single(kind, name) {
  await page.goto(`${BASE}/dev/action-preview?kind=${kind}`);
  await page.locator(".game-table").first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  await shot(name);
}

await sequence("ROTATE", "POLISH_ROTATE");
await sequence("SWAP", "POLISH_SWAP");
await single("TARGET", "POLISH_TARGET");
await sequence("DRAW_4", "POLISH_DRAW4");
await single("SKIP_ALL", "POLISH_SKIP_ALL");

log("done");
await browser.close();
