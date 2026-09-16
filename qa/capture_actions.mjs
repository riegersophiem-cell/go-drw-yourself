// Captures live STANDARD/MAJOR Action Focus screenshots and large-hand
// screenshots by actually playing (autoplay heuristic) through a real game.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:5173";
const OUT = fileURLToPath(new URL("./final/screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });
function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }
async function shot(page, name) { await page.screenshot({ path: `${OUT}${name}.png` }); log("saved", name); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const host = await ctx.newPage();
await host.goto(BASE);
await host.getByPlaceholder("Sophie").fill("Sophie");
await host.getByRole("button", { name: "Neues Spiel" }).click();
await host.getByRole("button", { name: "Bot hinzufügen" }).waitFor();
for (let i = 0; i < 5; i++) { await host.getByRole("button", { name: "Bot hinzufügen" }).click(); await host.waitForTimeout(150); }
const codeText = await host.locator("h1", { hasText: /^Raum / }).first().textContent();
const roomCode = codeText.replace("Raum", "").trim();
log("room =", roomCode);
await host.getByRole("button", { name: "Spiel starten" }).click();
await host.locator(".player-game").first().waitFor({ timeout: 15000 });

const ctxTable = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const table = await ctxTable.newPage();
await table.goto(`${BASE}/join/${roomCode}`);
await table.getByPlaceholder("AB7K2Q").fill(roomCode);
await table.getByText("Spieltisch").click();
await table.getByRole("button", { name: /Trete bei|Beitreten/ }).click();
await table.locator(".game-table").first().waitFor({ timeout: 15000 });

const captured = new Set();
const wanted = {
  standard: "05_TABLE_STANDARD_ACTION",
  major_swap: "06_TABLE_SWAP",
  major_rotate: "07_TABLE_ROTATE",
  major_skip_all: "08_TABLE_SKIP_ALL",
  reverse: "09_TABLE_REVERSE",
};

async function classifyFocus(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".action-focus--active");
    if (!el) return null;
    const cls = el.className;
    const title = el.querySelector(".action-focus__title")?.textContent ?? "";
    return { cls, title };
  });
}

async function autoplaySophie() {
  // Color choice popup
  const colorChoice = host.locator(".player-game__choice button[aria-label]");
  if (await colorChoice.count()) { await colorChoice.first().click().catch(() => {}); return true; }
  // Swap/skip target choice
  const targetBtn = host.locator(".player-game__targets button");
  if (await targetBtn.count()) { await targetBtn.first().click().catch(() => {}); return true; }
  const playBtn = host.locator(".player-game__play");
  const drawBtn = host.locator(".player-game__draw");
  if (await playBtn.count() && !(await playBtn.isDisabled().catch(() => true))) {
    // select first playable card
    const card = host.locator(".player-hand__slot .uno-card--playable").first();
    if (await card.count()) {
      await card.click().catch(() => {});
      await host.waitForTimeout(150);
      if (!(await playBtn.isDisabled().catch(() => true))) await playBtn.click().catch(() => {});
      return true;
    }
  }
  if (await drawBtn.count() && !(await drawBtn.isDisabled().catch(() => true))) {
    await drawBtn.click().catch(() => {});
    return true;
  }
  return false;
}

const deadline = Date.now() + 180000;
while (Date.now() < deadline && Object.keys(wanted).length > captured.size) {
  await autoplaySophie().catch(() => {});
  const focus = await classifyFocus(table).catch(() => null);
  if (focus) {
    if (focus.cls.includes("action-focus--standard") && !captured.has("standard")) {
      await shot(table, wanted.standard); captured.add("standard");
    }
    if (focus.cls.includes("action-focus--major")) {
      const t = focus.title.toUpperCase();
      if (t.includes("SWAP") && !captured.has("major_swap")) { await shot(table, wanted.major_swap); captured.add("major_swap"); }
      if (t.includes("ROTATE") && !captured.has("major_rotate")) { await shot(table, wanted.major_rotate); captured.add("major_rotate"); }
      if (t.includes("SKIP ALL") && !captured.has("major_skip_all")) { await shot(table, wanted.major_skip_all); captured.add("major_skip_all"); }
    }
  }
  // Reverse: detect direction flip via orbit-flow class
  const reversing = await table.evaluate(() => !!document.querySelector(".orbit-flow--reversing")).catch(() => false);
  if (reversing && !captured.has("reverse")) { await shot(table, wanted.reverse); captured.add("reverse"); }
  await table.waitForTimeout(120);
}

log("captured:", [...captured].join(", ") || "(none)");
log("missing:", Object.keys(wanted).filter((k) => !captured.has(k)).join(", ") || "(none)");

await browser.close();
