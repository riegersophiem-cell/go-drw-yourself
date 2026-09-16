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

async function classifyFocus(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".action-focus--active");
    if (!el) return null;
    return { cls: el.className };
  });
}
async function autoplaySophie() {
  const colorChoice = host.locator(".player-game__choice button[aria-label]");
  if (await colorChoice.count()) { await colorChoice.first().click().catch(() => {}); return; }
  const targetBtn = host.locator(".player-game__targets button");
  if (await targetBtn.count()) { await targetBtn.first().click().catch(() => {}); return; }
  const playBtn = host.locator(".player-game__play");
  const drawBtn = host.locator(".player-game__draw");
  if (await playBtn.count() && !(await playBtn.isDisabled().catch(() => true))) {
    const card = host.locator(".player-hand__slot .uno-card--playable").first();
    if (await card.count()) {
      await card.click().catch(() => {});
      await host.waitForTimeout(150);
      if (!(await playBtn.isDisabled().catch(() => true))) await playBtn.click().catch(() => {});
      return;
    }
  }
  if (await drawBtn.count() && !(await drawBtn.isDisabled().catch(() => true))) await drawBtn.click().catch(() => {});
}

const captured = new Set();
const deadline = Date.now() + 110000;
while (Date.now() < deadline && captured.size < 2) {
  await autoplaySophie().catch(() => {});
  const focus = await classifyFocus(host).catch(() => null);
  if (focus) {
    if (focus.cls.includes("action-focus--standard") && !captured.has("standard")) {
      await shot(host, "11_MOBILE_STANDARD_ACTION"); captured.add("standard");
    }
    if (focus.cls.includes("action-focus--major") && !captured.has("major")) {
      await shot(host, "12_MOBILE_MAJOR_ACTION"); captured.add("major");
    }
  }
  await host.waitForTimeout(100);
}
log("captured:", [...captured].join(", ") || "(none)");
await browser.close();
