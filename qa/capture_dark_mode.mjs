// Captures the Light/Dark theme screenshot matrix for
// DARK_MODE_IMPLEMENTATION_REPORT.md, using the DEV-only harnesses (no live
// Supabase backend needed - see App.tsx's import.meta.env.DEV-gated routes).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:5173";
const OUT = fileURLToPath(new URL("./dark_mode_screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });
function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 800, height: 820 } })).newPage();

async function setTheme(mode) {
  await page.evaluate((m) => localStorage.setItem("gdy_theme", m), mode);
}

async function shot(url, name, theme) {
  await setTheme(theme);
  await page.goto(url);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}${name}.png` });
  log("saved", name);
}

// Home page has to be visited once first so localStorage exists in this origin.
await page.goto(BASE);

await shot(`${BASE}/dev/action-preview?kind=NONE`, "LIGHT_TABLE", "light");
await shot(`${BASE}/dev/action-preview?kind=NONE`, "DARK_TABLE", "dark");

await shot(`${BASE}/dev/mobile-preview`, "LIGHT_MOBILE", "light");
await shot(`${BASE}/dev/mobile-preview`, "DARK_MOBILE", "dark");

await shot(`${BASE}/dev/mobile-preview?handOnly=1`, "LIGHT_HAND_ONLY", "light");
await shot(`${BASE}/dev/mobile-preview?handOnly=1`, "DARK_HAND_ONLY", "dark");

await shot(`${BASE}/dev/lobby-preview?humans=2&bots=2&host=true`, "LIGHT_LOBBY", "light");
await shot(`${BASE}/dev/lobby-preview?humans=2&bots=2&host=true`, "DARK_LOBBY", "dark");

await shot(`${BASE}/dev/action-preview?kind=TARGET`, "DARK_ACTION", "dark");
await shot(`${BASE}/dev/action-preview?kind=COLOR_ROULETTE`, "DARK_CHAOS", "dark");

await browser.close();
log("done");
