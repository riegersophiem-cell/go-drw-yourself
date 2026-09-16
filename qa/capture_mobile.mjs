// Deterministic REMOTE_MOBILE_FULL / hand-size screenshots via the DEV-only
// /dev/mobile-preview harness (see src/pages/dev/MobilePreview.tsx) — no bot
// RNG, no manual multi-device session. See MOBILE_HAND_UI_FIX_REPORT.md.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:5173";
const OUT = fileURLToPath(new URL("./final/screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });
function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

const browser = await chromium.launch();

async function newPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  return ctx.newPage();
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}${name}.png` });
  log("saved", name);
}

async function gotoPreview(page, query) {
  await page.goto(`${BASE}/dev/mobile-preview?${query}`);
  await page.locator(".game-table").first().waitFor({ timeout: 10000 });
  // PlayerHand staggers its deal-in animation by 35ms per card (see
  // PlayerHand.tsx's --hand-index) — up to ~1.4s for a 30-card hand. Without
  // waiting this out, a screenshot taken too early shows only the
  // already-animated-in early cards, missing whole later rows entirely
  // (found live: a 13-card screenshot with row 2 completely absent).
  await page.waitForTimeout(1400);
}

// --- Hand size / responsive screenshots (portrait) ---
{
  const page = await newPage(390, 844);
  await gotoPreview(page, "hand=7");
  await shot(page, "MOBILE_NORMAL_390");

  await gotoPreview(page, "hand=13");
  await shot(page, "MOBILE_13_CARDS");
  // Select a card in row 2 to verify the selected-state works in every row.
  const row2Card = page.locator(".player-hand__row").nth(1).locator(".uno-card--playable").nth(2);
  await row2Card.click();
  await shot(page, "MOBILE_13_CARDS_SELECTED");

  await gotoPreview(page, "hand=22");
  await shot(page, "MOBILE_22_CARDS");

  await gotoPreview(page, "hand=30");
  await shot(page, "MOBILE_30_CARDS");
  await page.close();
}

{
  const page = await newPage(320, 568);
  await gotoPreview(page, "hand=13");
  await shot(page, "MOBILE_SMALL_320");
  await page.close();
}

{
  const page = await newPage(360, 800);
  await gotoPreview(page, "hand=7");
  await shot(page, "MOBILE_360_NORMAL");
  await page.close();
}

{
  const page = await newPage(430, 932);
  await gotoPreview(page, "hand=7");
  await shot(page, "MOBILE_430_NORMAL");
  await page.close();
}

// --- Landscape ---
{
  const page = await newPage(844, 390);
  await gotoPreview(page, "hand=13");
  await shot(page, "MOBILE_LANDSCAPE");
  await page.close();
}
{
  const page = await newPage(932, 430);
  await gotoPreview(page, "hand=13");
  await shot(page, "MOBILE_LANDSCAPE_932");
  await page.close();
}

// --- Orbit / turn arc (public table geometry follow-up) ---
{
  const page = await newPage(390, 844);
  await gotoPreview(page, "hand=7");
  await shot(page, "MOBILE_ORBIT_FORWARD");
  await page.close();
}
{
  const page = await newPage(390, 844);
  await gotoPreview(page, "hand=7&direction=-1");
  await shot(page, "MOBILE_ORBIT_REVERSE");
  await page.close();
}
{
  const page = await newPage(390, 844);
  await gotoPreview(page, "hand=7&players=8");
  await shot(page, "MOBILE_ORBIT_8_PLAYERS");
  await page.close();
}

// --- Actions ---
{
  const page = await newPage(390, 844);
  await gotoPreview(page, "hand=7&kind=TARGET");
  await shot(page, "MOBILE_STANDARD_ACTION");
  await page.close();
}
{
  const page = await newPage(390, 844);
  await gotoPreview(page, "hand=7&kind=ROTATE");
  await page.waitForTimeout(150);
  await shot(page, "MOBILE_ROTATE");
  await page.close();
}
{
  const page = await newPage(390, 844);
  await gotoPreview(page, "hand=7&kind=SWAP");
  await page.waitForTimeout(150);
  await shot(page, "MOBILE_SWAP");
  await page.close();
}
{
  const page = await newPage(390, 844);
  await gotoPreview(page, "hand=7&kind=TARGET");
  await shot(page, "MOBILE_TARGET");
  await page.close();
}
{
  const page = await newPage(390, 844);
  await gotoPreview(page, "hand=7&kind=DRAW_4");
  await page.waitForTimeout(150);
  await shot(page, "MOBILE_DRAW4");
  await page.close();
}

// --- PLAYER_HAND_ONLY (separate table device present) ---
{
  const page = await newPage(390, 844);
  await gotoPreview(page, "hand=7&handOnly=1");
  await shot(page, "MOBILE_HAND_ONLY_NORMAL");

  await gotoPreview(page, "hand=5&handOnly=1&myTurn=0&pending=4");
  await shot(page, "MOBILE_HAND_ONLY_NOT_MY_TURN_PENDING");

  await gotoPreview(page, "hand=22&handOnly=1");
  await shot(page, "MOBILE_HAND_ONLY_22_CARDS");
  await page.close();
}
{
  const page = await newPage(390, 844);
  await gotoPreview(page, "hand=7&handOnly=1&kind=ROTATE");
  await shot(page, "MOBILE_HAND_ONLY_ROTATE");
  await page.close();
}
{
  const page = await newPage(390, 844);
  await gotoPreview(page, "hand=7&handOnly=1&kind=SWAP");
  await shot(page, "MOBILE_HAND_ONLY_SWAP");
  await page.close();
}

log("done");
await browser.close();
