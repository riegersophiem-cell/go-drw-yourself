import type { AvatarId } from "./avatars";

// Client-only: resolves each avatar id to its illustration file. Never
// imported by an edge function (see avatars.ts) since import.meta.glob is a
// Vite build-time macro that doesn't exist under Deno.
const HUMAN_URLS = import.meta.glob<string>("../assets/avatars/humans/*.png", { eager: true, query: "url", import: "default" });
const BOT_URLS = import.meta.glob<string>("../assets/avatars/bots/*.png", { eager: true, query: "url", import: "default" });

function resolve(urls: Record<string, string>, path: string): string {
  const url = urls[path];
  if (!url) throw new Error(`Missing avatar artwork file: ${path}`);
  return url;
}

export const AVATAR_IMAGE: Record<AvatarId, string> = {
  H01: resolve(HUMAN_URLS, "../assets/avatars/humans/h01.png"),
  H02: resolve(HUMAN_URLS, "../assets/avatars/humans/h02.png"),
  H03: resolve(HUMAN_URLS, "../assets/avatars/humans/h03.png"),
  H04: resolve(HUMAN_URLS, "../assets/avatars/humans/h04.png"),
  H05: resolve(HUMAN_URLS, "../assets/avatars/humans/h05.png"),
  H06: resolve(HUMAN_URLS, "../assets/avatars/humans/h06.png"),
  H07: resolve(HUMAN_URLS, "../assets/avatars/humans/h07.png"),
  H08: resolve(HUMAN_URLS, "../assets/avatars/humans/h08.png"),
  H09: resolve(HUMAN_URLS, "../assets/avatars/humans/h09.png"),
  H10: resolve(HUMAN_URLS, "../assets/avatars/humans/h10.png"),
  H11: resolve(HUMAN_URLS, "../assets/avatars/humans/h11.png"),
  H12: resolve(HUMAN_URLS, "../assets/avatars/humans/h12.png"),
  H13: resolve(HUMAN_URLS, "../assets/avatars/humans/h13.png"),
  H14: resolve(HUMAN_URLS, "../assets/avatars/humans/h14.png"),
  H15: resolve(HUMAN_URLS, "../assets/avatars/humans/h15.png"),
  H16: resolve(HUMAN_URLS, "../assets/avatars/humans/h16.png"),
  H17: resolve(HUMAN_URLS, "../assets/avatars/humans/h17.png"),
  H18: resolve(HUMAN_URLS, "../assets/avatars/humans/h18.png"),
  H19: resolve(HUMAN_URLS, "../assets/avatars/humans/h19.png"),
  H20: resolve(HUMAN_URLS, "../assets/avatars/humans/h20.png"),
  H21: resolve(HUMAN_URLS, "../assets/avatars/humans/h21.png"),
  H22: resolve(HUMAN_URLS, "../assets/avatars/humans/h22.png"),
  H23: resolve(HUMAN_URLS, "../assets/avatars/humans/h23.png"),
  H24: resolve(HUMAN_URLS, "../assets/avatars/humans/h24.png"),
  H25: resolve(HUMAN_URLS, "../assets/avatars/humans/h25.png"),
  H26: resolve(HUMAN_URLS, "../assets/avatars/humans/h26.png"),
  H27: resolve(HUMAN_URLS, "../assets/avatars/humans/h27.png"),
  H28: resolve(HUMAN_URLS, "../assets/avatars/humans/h28.png"),
  BOT1: resolve(BOT_URLS, "../assets/avatars/bots/bot1.png"),
  BOT2: resolve(BOT_URLS, "../assets/avatars/bots/bot2.png"),
  BOT3: resolve(BOT_URLS, "../assets/avatars/bots/bot3.png"),
  BOT4: resolve(BOT_URLS, "../assets/avatars/bots/bot4.png"),
  BOT5: resolve(BOT_URLS, "../assets/avatars/bots/bot5.png"),
};
