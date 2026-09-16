// Forces Sophie's hand to grow (always draw, never play) until it reaches
// 13 and then 22 cards, screenshotting the mobile hand dock at each point.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:5173";
const OUT = fileURLToPath(new URL("./final/screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });
function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }
async function shot(page, name) { await page.screenshot({ path: `${OUT}${name}.png` }); log("saved", name); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const host = await ctx.newPage();
await host.goto(BASE);
await host.getByPlaceholder("Sophie").fill("Sophie");
await host.getByRole("button", { name: "Neues Spiel" }).click();
await host.getByRole("button", { name: "Bot hinzufügen" }).waitFor();
for (let i = 0; i < 5; i++) { await host.getByRole("button", { name: "Bot hinzufügen" }).click(); await host.waitForTimeout(150); }
await host.getByRole("button", { name: "Spiel starten" }).click();
await host.locator(".player-game").first().waitFor({ timeout: 15000 });

function countCards(page) {
  return page.evaluate(() => document.querySelectorAll(".player-hand__slot").length);
}

const targets = [13, 22];
let nextTargetIdx = 0;
const deadline = Date.now() + 200000;
while (Date.now() < deadline && nextTargetIdx < targets.length) {
  // Resolve color popup if present (pick first color)
  const colorChoice = host.locator(".player-game__choice button[aria-label]");
  if (await colorChoice.count()) { await colorChoice.first().click().catch(() => {}); await host.waitForTimeout(150); continue; }
  const targetBtn = host.locator(".player-game__targets button");
  if (await targetBtn.count()) { await targetBtn.first().click().catch(() => {}); await host.waitForTimeout(150); continue; }

  const drawBtn = host.locator(".player-game__draw");
  if (await drawBtn.count() && !(await drawBtn.isDisabled().catch(() => true))) {
    await drawBtn.click().catch(() => {});
    await host.waitForTimeout(250);
  } else {
    await host.waitForTimeout(200);
  }
  const n = await countCards(host).catch(() => 0);
  if (n >= targets[nextTargetIdx]) {
    await host.waitForTimeout(300);
    await shot(host, nextTargetIdx === 0 ? "13_MOBILE_13_CARDS" : "14_MOBILE_22_CARDS");
    log(`reached ${n} cards (target ${targets[nextTargetIdx]})`);
    nextTargetIdx++;
  }
}
if (nextTargetIdx < targets.length) log("did not reach all targets, stopped at", await countCards(host).catch(() => "?"));

await browser.close();
