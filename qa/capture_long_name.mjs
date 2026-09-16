import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:5173";
const OUT = fileURLToPath(new URL("./final/screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const host = await ctx.newPage();
await host.goto(BASE);
await host.getByPlaceholder("Sophie").fill("Maximiliane-Alexandra");
await host.getByRole("button", { name: "Neues Spiel" }).click();
await host.getByRole("button", { name: "Bot hinzufügen" }).waitFor();
for (let i = 0; i < 3; i++) { await host.getByRole("button", { name: "Bot hinzufügen" }).click(); await host.waitForTimeout(150); }
const codeText = await host.locator("h1", { hasText: /^Raum / }).first().textContent();
const roomCode = codeText.replace("Raum", "").trim();
await host.getByRole("button", { name: "Spiel starten" }).click();
await host.locator(".player-game, .game-table").first().waitFor({ timeout: 15000 });
await host.waitForTimeout(300);

const table = await ctx.newPage();
await table.goto(`${BASE}/join/${roomCode}`);
await table.getByPlaceholder("AB7K2Q").fill(roomCode);
await table.getByText("Spieltisch").click();
await table.getByRole("button", { name: /Trete bei|Beitreten/ }).click();
await table.locator(".game-table").first().waitFor({ timeout: 15000 });
await table.waitForTimeout(500);
await table.screenshot({ path: `${OUT}TABLE_PLAYER_UNITS_LONG_NAME.png` });
console.log("saved TABLE_PLAYER_UNITS_LONG_NAME, room", roomCode);

await browser.close();
