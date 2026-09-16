import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:5173";
const OUT = fileURLToPath(new URL("./final/screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

async function shotSelected(count, rowIndex, name) {
  await page.goto(`${BASE}/dev/mobile-preview?hand=${count}`);
  await page.locator(".game-table").first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(1400);
  const cardsInRow = await page.locator(".player-hand__row").nth(rowIndex).locator(".player-hand__slot").count();
  await page.locator(".player-hand__row").nth(rowIndex).locator(".uno-card--playable").nth(Math.floor(cardsInRow / 2)).click();
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log("saved", name);
}

await shotSelected(22, 2, "MOBILE_22_CARDS_SELECTED_ROW3");
await shotSelected(30, 1, "MOBILE_30_CARDS_SELECTED_ROW2");

await browser.close();
