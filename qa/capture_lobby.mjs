// Screenshots for LOBBY_SESSION_FLOW_REPORT.md — a mix of:
//  (a) real end-to-end flows against the live dev server + Supabase backend
//      (actual room create/join/start, exercising the real Edge Functions),
//      for the states that matter to prove the real flow works, and
//  (b) the DEV-only /dev/lobby-preview harness for states that are awkward
//      or impossible to reach live (a lobby-phase "disconnected" player —
//      the real architecture deletes that row instead of marking it
//      disconnected, see the report — or a specific bot count on demand).
// No production cheat: (b) is fully dead-code-eliminated from a prod build
// (see App.tsx), and (a) only ever talks to the same dev-mode Supabase
// project the app already uses.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:5173";
const OUT = fileURLToPath(new URL("./final/screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });
function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

const browser = await chromium.launch();

async function newPage(width = 390, height = 844) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  return ctx.newPage();
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}${name}.png` });
  log("saved", name);
}

async function createRoomAsHost(page, name) {
  await page.goto(`${BASE}/`);
  await page.getByPlaceholder("Sophie").fill(name);
  await page.getByRole("button", { name: "Neues Spiel" }).click();
  await page.waitForURL(/\/room\//);
  await page.locator(".lobby-player-list li").first().waitFor({ timeout: 10000 });
  const roomCode = (await page.locator(".brand-title").innerText()).replace("Raum", "").trim();
  return roomCode;
}

async function joinRoom(page, roomCode, roleLabel, name) {
  await page.goto(`${BASE}/join/${roomCode}`);
  await page.getByRole("button", { name: new RegExp(roleLabel) }).click();
  if (name) await page.getByPlaceholder("Max").fill(name);
  await page.getByRole("button", { name: "Beitreten" }).click();
  await page.waitForURL(/\/room\//);
  await page.locator(".lobby-player-list li, .lobby-table-device").first().waitFor({ timeout: 10000 });
}

// ===== FLOW A: Remote (no table device) =====
{
  const host = await newPage();
  const roomCode = await createRoomAsHost(host, "Sophie");
  await shot(host, "LOBBY_REMOTE_HOST");

  const player2 = await newPage();
  await joinRoom(player2, roomCode, "Spieler", "Max");
  await host.waitForTimeout(500);
  await shot(host, "LOBBY_REMOTE_PLAYERS");

  await host.getByRole("button", { name: "Spiel starten" }).click();
  await host.waitForTimeout(1500);
  await shot(host, "GAME_START_REMOTE");

  // Reconnect: reload the second player mid-game.
  await player2.waitForTimeout(500);
  await player2.reload();
  await player2.locator(".reconnect-toast").waitFor({ timeout: 10000 });
  await player2.locator(".player-hand__slot").first().waitFor({ timeout: 10000 });
  await player2.waitForTimeout(1500); // let the staggered hand deal-in animation finish
  await shot(player2, "RECONNECT_PLAYER");

  await host.close();
  await player2.close();
}

// ===== FLOW B: Presence (table device + player) =====
{
  const host = await newPage();
  const roomCode = await createRoomAsHost(host, "Sophie Presence");

  const table = await newPage();
  await joinRoom(table, roomCode, "Spieltisch");
  const player2 = await newPage();
  await joinRoom(player2, roomCode, "Spieler", "Lena");
  // KNOWN BUG (see LOBBY_SESSION_FLOW_REPORT.md / migration 0010, not yet
  // applied): `devices` isn't in the supabase_realtime publication, so
  // useHasTableDevice's postgres_changes subscription never actually fires —
  // the host's already-open Lobby tab will NOT pick up the table device
  // joining live. Reloading is the only way to get a correct read today,
  // exactly the workaround a real host would currently need too.
  await host.reload();
  await host.waitForFunction(() => document.querySelector(".lobby-table-device")?.textContent?.includes("Verbunden"), { timeout: 8000 });
  await shot(host, "LOBBY_WITH_TABLE_DEVICE");
  await shot(table, "TABLE_DEVICE_CONNECTED");

  await host.getByRole("button", { name: "Spiel starten" }).click();
  await host.waitForTimeout(1500);
  await shot(host, "GAME_START_PRESENCE");
  await table.waitForTimeout(500);
  await shot(table, "TABLE_DEVICE_CONNECTED"); // overwrite with in-game state

  await host.close();
  await table.close();
  await player2.close();
}

// ===== Dev-harness-only states =====
{
  const page = await newPage();
  await page.goto(`${BASE}/dev/lobby-preview?humans=2&bots=4`);
  await page.locator(".lobby-player-list li").first().waitFor({ timeout: 10000 });
  await shot(page, "LOBBY_WITH_BOTS");
  await page.close();
}
{
  const page = await newPage();
  await page.goto(`${BASE}/dev/lobby-preview?humans=2&disconnected=1`);
  await page.locator(".lobby-player-list li").first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  await shot(page, "LOBBY_DISCONNECTED_PLAYER");
  await page.close();
}
{
  const page = await newPage(390, 844);
  await page.goto(`${BASE}/dev/lobby-preview?humans=3&bots=1&table=1`);
  await page.waitForTimeout(300);
  await shot(page, "LOBBY_MOBILE");
  await page.close();
}

log("done");
await browser.close();
