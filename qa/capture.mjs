// One-off QA screenshot capture script (not part of the app/test suite).
// Drives the already-running local dev server through several real rooms
// and states, saving genuine rendered PNGs under qa/final/screenshots/.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:5173";
const OUT = fileURLToPath(new URL("./final/screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });
console.log("OUT dir resolved to:", OUT);

function log(...args) { console.log(new Date().toISOString().slice(11, 19), ...args); }

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}${name}.png` });
  log("saved", name);
}

async function newIdentity(context) {
  // Each context has isolated localStorage/sessionStorage -> independent device sessions.
  return context.newPage();
}

async function createRoom(page, hostName, botCount) {
  await page.goto(BASE);
  await page.getByPlaceholder("Sophie").fill(hostName);
  await page.getByRole("button", { name: "Neues Spiel" }).click();
  await page.getByRole("button", { name: "Bot hinzufügen" }).waitFor();
  for (let i = 0; i < botCount; i++) {
    await page.getByRole("button", { name: "Bot hinzufügen" }).click();
    await page.waitForTimeout(150);
  }
  const codeEl = await page.locator("h1", { hasText: /^Raum / }).first();
  const text = await codeEl.textContent();
  const roomCode = text.replace("Raum", "").trim();
  await page.getByRole("button", { name: "Spiel starten" }).click();
  await page.locator(".game-table, .player-game").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  return roomCode;
}

async function joinAsTable(context, roomCode) {
  const page = await newIdentity(context);
  await page.goto(`${BASE}/join/${roomCode}`);
  await page.getByPlaceholder("AB7K2Q").fill(roomCode);
  await page.getByText("Spieltisch").click();
  await page.getByRole("button", { name: /Trete bei|Beitreten/ }).click();
  await page.locator(".game-table").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  return page;
}

const browser = await chromium.launch();

// ---------- Scenario 1: 4-player game, hosted by Sophie (player device) ----------
{
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const host = await newIdentity(ctx1);
  const roomCode = await createRoom(host, "Sophie", 3);
  log("room (4p) =", roomCode);

  const ctxTable = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const table = await joinAsTable(ctxTable, roomCode);
  await shot(table, "02_TABLE_4_PLAYERS");

  // Standard action: try to find a legal move on the host and play until we hit
  // a colored action card naturally, else just capture the base state.
  await shot(host, "01_TABLE_NORMAL_hostview");

  // Table sizes matrix
  for (const [w, h, label] of [[1024, 768, "1024x768"], [1366, 768, "1366x768"], [1920, 1080, "1920x1080"]]) {
    await table.setViewportSize({ width: w, height: h });
    await table.waitForTimeout(200);
    await shot(table, `TABLE_${label}`);
  }
  await table.setViewportSize({ width: 1280, height: 800 });

  // Seat edit mode
  await table.getByRole("button", { name: /Sitzordnung anpassen/ }).click();
  await table.waitForTimeout(200);
  await shot(table, "04_TABLE_SEAT_EDIT");
  await table.getByRole("button", { name: /Sitzordnung fertig/ }).click();

  await ctx1.close();
  await ctxTable.close();
}

// ---------- Scenario 2: 6-player game for ring density ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const host = await newIdentity(ctx);
  const roomCode = await createRoom(host, "Sophie", 5);
  log("room (6p) =", roomCode);
  const ctxTable = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const table = await joinAsTable(ctxTable, roomCode);
  await shot(table, "03_TABLE_6_PLAYERS");
  await ctx.close();
  await ctxTable.close();
}

// ---------- Scenario 3: mobile REMOTE_MOBILE_FULL ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await newIdentity(ctx);
  const roomCode = await createRoom(host, "Sophie", 3);
  log("room (mobile) =", roomCode);
  await shot(host, "10_MOBILE_NORMAL");

  for (const [w, h, label] of [[320, 568, "320x568"], [360, 800, "360x800"], [430, 932, "430x932"]]) {
    await host.setViewportSize({ width: w, height: h });
    await host.waitForTimeout(200);
    await shot(host, `MOBILE_${label}`);
  }
  await shot(host, "15_MOBILE_SMALL_320");

  // Landscape
  await host.setViewportSize({ width: 844, height: 390 });
  await host.waitForTimeout(200);
  await shot(host, "16_MOBILE_LANDSCAPE_844x390");
  await host.setViewportSize({ width: 932, height: 430 });
  await host.waitForTimeout(200);
  await shot(host, "16b_MOBILE_LANDSCAPE_932x430");
  await host.setViewportSize({ width: 390, height: 844 });

  await ctx.close();
}

await browser.close();
log("done");
