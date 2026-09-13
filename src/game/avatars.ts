// Shared avatar catalog: pure ids, no image references here on purpose —
// this file is imported by both the client and the create-room/join-room/
// add-bot edge functions (Deno), which cannot resolve Vite's asset imports.
// The id -> actual artwork mapping lives in avatarImages.ts (client-only),
// the same split cardArt.ts already uses for card artwork.

export const HUMAN_AVATAR_IDS = [
  "H01", "H02", "H03", "H04", "H05", "H06", "H07",
  "H08", "H09", "H10", "H11", "H12", "H13", "H14",
  "H15", "H16", "H17", "H18", "H19", "H20", "H21",
  "H22", "H23", "H24", "H25", "H26", "H27", "H28",
] as const;
export type HumanAvatarId = (typeof HUMAN_AVATAR_IDS)[number];

// 5 distinct bot avatars so bots are visually tellable apart, per brief.
export const BOT_AVATAR_IDS = ["BOT1", "BOT2", "BOT3", "BOT4", "BOT5"] as const;
export type BotAvatarId = (typeof BOT_AVATAR_IDS)[number];

export type AvatarId = HumanAvatarId | BotAvatarId;

export const DEFAULT_HUMAN_AVATAR: HumanAvatarId = "H01";

export function isHumanAvatarId(value: unknown): value is HumanAvatarId {
  return typeof value === "string" && (HUMAN_AVATAR_IDS as readonly string[]).includes(value);
}

/** Cycles through the bot avatar set so every new bot in a room looks different from the last few. */
export function botAvatarForIndex(index: number): BotAvatarId {
  return BOT_AVATAR_IDS[index % BOT_AVATAR_IDS.length];
}
